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
      provider: payload.collection?.provider || null,
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
      const found = await admin.from("transactions").select("id,user_id,plan_id").eq("provider_transaction_id", row.provider_transaction_id).maybeSingle();
      existing = found.data;
    }
    
    if (existing?.id) {
      const { error } = await admin.from("transactions").update(row).eq("id", existing.id);
      if (error) throw error;
      transactionId = existing.id;
    } else {
      const { data: newTx, error } = await admin.from("transactions").insert(row).select("id").single();
      if (error) throw error;
      transactionId = newTx?.id;
    }
    
    // Auto-upgrade subscription if payment is successful
    const isSuccess = row.status === "success" || payload.event_type === "collection.successful";
    const finalUserId = userId || existing?.user_id;
    const finalPlanId = planId || existing?.plan_id;
    
    if (isSuccess && finalUserId && finalPlanId && transactionId) {
      // Get plan details for duration
      const { data: plan } = await admin.from("plans").select("duration_in_days,tier_label,name").eq("id", finalPlanId).single();
      
      if (plan) {
        const durationDays = plan.duration_in_days || 30;
        const startDate = new Date();
        const expiryDate = new Date(startDate);
        expiryDate.setDate(expiryDate.getDate() + durationDays);
        
        // Check if user has active subscription
        const { data: activeSub } = await admin
          .from("subscriptions")
          .select("id")
          .eq("user_id", finalUserId)
          .eq("status", "active")
          .maybeSingle();
        
        if (activeSub) {
          // Update existing subscription to paid plan
          await admin.from("subscriptions").update({
            plan_id: finalPlanId,
            transaction_id: transactionId,
            subscription_type: "paid",
            start_date: startDate.toISOString(),
            expiry_date: expiryDate.toISOString(),
            payment_method: row.provider || "mobile_money",
            updated_at: new Date().toISOString(),
          }).eq("id", activeSub.id);
        } else {
          // Create new paid subscription
          await admin.from("subscriptions").insert({
            user_id: finalUserId,
            plan_id: finalPlanId,
            transaction_id: transactionId,
            subscription_type: "paid",
            status: "active",
            start_date: startDate.toISOString(),
            expiry_date: expiryDate.toISOString(),
            payment_method: row.provider || "mobile_money",
          });
        }
        
        // Update profile
        await admin.from("profiles").upsert({
          id: finalUserId,
          subscription: plan.tier_label || plan.name,
          subscription_start_date: startDate.toISOString(),
          subscription_expiry_date: expiryDate.toISOString(),
          trial_status: "none",
        }, { onConflict: "id" });
      }
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid webhook" }, { status: 400 });
  }
}
