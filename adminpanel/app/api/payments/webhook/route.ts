import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

function verifySignature(rawBody: string, timestamp: string, signatureHeader: string, secret: string) {
  const match = signatureHeader.match(/v1=([a-f0-9]+)/i);
  if (!match) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const received = match[1];
  return received.length === expected.length && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

function calculateExpiryDate(startDate: Date, plan: { duration_in_days?: number | null; duration_in_months?: number | null; duration_in_hours?: number | null }) {
  const expiryDate = new Date(startDate);
  const days = Number(plan.duration_in_days);
  const months = Number(plan.duration_in_months);
  const hours = Number(plan.duration_in_hours);

  if (days > 0) {
    expiryDate.setUTCDate(expiryDate.getUTCDate() + days);
  } else if (months > 0) {
    const day = expiryDate.getUTCDate();
    const wholeMonths = Math.trunc(months);
    expiryDate.setUTCDate(1);
    expiryDate.setUTCMonth(expiryDate.getUTCMonth() + wholeMonths);
    expiryDate.setUTCDate(Math.min(day, new Date(Date.UTC(expiryDate.getUTCFullYear(), expiryDate.getUTCMonth() + 1, 0)).getUTCDate()));
    const fractionalDays = Math.round((months - wholeMonths) * 30);
    if (fractionalDays) expiryDate.setUTCDate(expiryDate.getUTCDate() + fractionalDays);
  } else if (hours > 0) {
    expiryDate.setTime(expiryDate.getTime() + hours * 60 * 60 * 1000);
  } else {
    expiryDate.setUTCDate(expiryDate.getUTCDate() + 30);
  }

  return expiryDate;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  const timestamp = request.headers.get("x-marzpay-timestamp") || "";
  const signature = request.headers.get("x-marzpay-signature") || "";

  if (secret && (!timestamp || !signature || !verifySignature(rawBody, timestamp, signature, secret))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as {
      event_type?: string;
      transaction?: { uuid?: string; reference?: string; status?: string; amount?: { raw?: number; currency?: string } };
      collection?: { provider_transaction_id?: string; provider?: string; phone_number?: string };
      metadata?: Array<Record<string, unknown>>;
    };
    const admin = createSupabaseAdmin();
    
    // Extract metadata
    const metadata = payload.metadata || [];
    const metaObj = Array.isArray(metadata) ? metadata[0] : metadata;
    const userId = metaObj?.user_id as string | undefined;
    const planId = metaObj?.plan_id as string | undefined;
    
    const row = {
      reference: payload.transaction?.reference || null,
      status: payload.transaction?.status || payload.event_type || null,
      amount: payload.transaction?.amount?.raw ?? null,
      currency: payload.transaction?.amount?.currency || null,
      payment_method: payload.collection?.provider || null,
      provider_reference: payload.transaction?.uuid || null,
      provider_transaction_id: payload.collection?.provider_transaction_id || null,
      phone_number: payload.collection?.phone_number || null,
      user_id: userId || null,
      plan_id: planId || null,
      metadata: payload.metadata || [],
      raw_payload: payload,
      updated_at: new Date().toISOString(),
    };
    
    let existing: any = null;
    let transactionId: string | null = null;
    
    if (row.provider_transaction_id) {
      const found = await admin.from("transactions").select("id,user_id,plan_id,metadata,status").eq("provider_transaction_id", row.provider_transaction_id).maybeSingle();
      if (found.error) throw found.error;
      existing = found.data;
    }

    if (!existing && row.reference) {
      const found = await admin.from("transactions").select("id,user_id,plan_id,metadata,status").eq("reference", row.reference).maybeSingle();
      if (found.error) throw found.error;
      existing = found.data;
    }

    if (!existing && row.provider_reference) {
      const found = await admin.from("transactions").select("id,user_id,plan_id,metadata,status").eq("provider_reference", row.provider_reference).limit(1).maybeSingle();
      if (found.error) throw found.error;
      existing = found.data;
    }

    const incomingStatus = String(row.status ?? "").toLowerCase();
    const eventType = String(payload.event_type ?? "").toLowerCase();
    const isSuccess = ["success", "successful", "completed"].includes(incomingStatus) || eventType === "collection.successful";
    const existingWasSuccessful = ["success", "successful", "completed"].includes(String(existing?.status ?? "").toLowerCase());
    const transactionRow = {
      ...row,
      status: existingWasSuccessful && !isSuccess ? existing.status : row.status,
      user_id: userId || existing?.user_id || null,
      plan_id: planId || existing?.plan_id || null,
      metadata: payload.metadata ?? existing?.metadata ?? [],
    };
    
    if (existing?.id) {
      const { error } = await admin.from("transactions").update(transactionRow).eq("id", existing.id);
      if (error) throw error;
      transactionId = existing.id;
    } else {
      const { data: newTx, error } = await admin.from("transactions").insert(transactionRow).select("id").single();
      if (error) throw error;
      transactionId = newTx?.id;
    }
    
    // Auto-upgrade subscription if payment is successful
    const finalUserId = transactionRow.user_id;
    const finalPlanId = transactionRow.plan_id;
    
    if (isSuccess && finalUserId && finalPlanId && transactionId) {
      // Get plan details for duration
      const { data: plan, error: planError } = await admin.from("plans").select("duration_in_days,duration_in_months,duration_in_hours,tier_label,name").eq("id", finalPlanId).single();
      if (planError) throw planError;

      const startDate = new Date();
      const expiryDate = calculateExpiryDate(startDate, plan);
      const { data: activeSub, error: activeSubError } = await admin
          .from("subscriptions")
          .select("id")
          .eq("user_id", finalUserId)
          .eq("status", "active")
          .order("expiry_date", { ascending: false })
          .limit(1)
          .maybeSingle();
      if (activeSubError) throw activeSubError;

      let subscriptionToUpdate = activeSub;
      if (!subscriptionToUpdate) {
        const { data: latestSub, error: latestSubError } = await admin
          .from("subscriptions")
          .select("id")
          .eq("user_id", finalUserId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestSubError) throw latestSubError;
        subscriptionToUpdate = latestSub;
      }

      const subscriptionFields = {
        plan_id: finalPlanId,
        transaction_id: transactionId,
        subscription_type: "paid",
        status: "active",
        start_date: startDate.toISOString(),
        expiry_date: expiryDate.toISOString(),
        payment_method: row.payment_method || "mobile_money",
        updated_at: new Date().toISOString(),
      };

      const subscriptionWrite = subscriptionToUpdate
        ? await admin.from("subscriptions").update(subscriptionFields).eq("id", subscriptionToUpdate.id)
        : await admin.from("subscriptions").insert({ user_id: finalUserId, ...subscriptionFields });
      if (subscriptionWrite.error) throw subscriptionWrite.error;

      const { error: profileError } = await admin.from("profiles").upsert({
        id: finalUserId,
        subscription: plan.tier_label || plan.name,
        subscription_start_date: startDate.toISOString(),
        subscription_expiry_date: expiryDate.toISOString(),
        trial_status: "none",
      }, { onConflict: "id" });
      if (profileError) throw profileError;
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid webhook" }, { status: 400 });
  }
}
