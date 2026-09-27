import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createUserDb } from "@/lib/supabase/user-db";

/**
 * Syncs successful transactions to subscriptions.
 * Creates or updates subscriptions based on transaction plan_id.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = createUserDb();

    // Get all successful transactions with plan info
    const { data: transactions, error: txError } = await db
      .from("transactions")
      .select("id,user_id,plan_id,package_name,amount,payment_method,created_at")
      .eq("status", "success")
      .not("plan_id", "is", null)
      .order("created_at", { ascending: false });

    if (txError) throw txError;

    // Get all plans
    const { data: plans, error: plansError } = await db
      .from("plans")
      .select("id,name,tier_label,duration_in_days");

    if (plansError) throw plansError;

    const plansMap = new Map(plans?.map(p => [p.id, p]) || []);
    const synced: any[] = [];
    const skipped: any[] = [];

    for (const tx of transactions || []) {
      // Skip if no user_id or plan_id
      if (!tx.user_id || !tx.plan_id) {
        skipped.push({ tx_id: tx.id, reason: "Missing user_id or plan_id" });
        continue;
      }

      const plan = plansMap.get(tx.plan_id);
      if (!plan) {
        skipped.push({ tx_id: tx.id, reason: "Plan not found in database" });
        continue;
      }

      const planName = plan.tier_label || plan.name;
      const durationDays = plan.duration_in_days || 30;
      const startDate = new Date(tx.created_at);
      const expiryDate = new Date(startDate);
      expiryDate.setDate(expiryDate.getDate() + durationDays);

      // Check if subscription already exists for this transaction
      const { data: existingSubForTx } = await db
        .from("subscriptions")
        .select("id")
        .eq("transaction_id", tx.id)
        .maybeSingle();

      if (existingSubForTx) {
        skipped.push({ tx_id: tx.id, reason: "Subscription already exists for this transaction" });
        continue;
      }

      // Check if user has an active subscription
      const { data: activeUserSub } = await db
        .from("subscriptions")
        .select("id,expiry_date,plan_id")
        .eq("user_id", tx.user_id)
        .eq("status", "active")
        .order("expiry_date", { ascending: false })
        .maybeSingle();

      if (activeUserSub) {
        // Update existing subscription with new plan
        const { error: updateError } = await db
          .from("subscriptions")
          .update({
            plan_id: tx.plan_id,
            transaction_id: tx.id,
            payment_method: tx.payment_method,
            start_date: startDate.toISOString(),
            expiry_date: expiryDate.toISOString(),
            subscription_type: "paid",
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeUserSub.id);

        if (updateError) {
          skipped.push({ tx_id: tx.id, reason: updateError.message });
          continue;
        }

        synced.push({ 
          tx_id: tx.id, 
          user_id: tx.user_id, 
          action: "updated", 
          plan: planName,
          sub_id: activeUserSub.id
        });
      } else {
        // Create new subscription
        const { data: newSub, error: insertError } = await db
          .from("subscriptions")
          .insert({
            user_id: tx.user_id,
            plan_id: tx.plan_id,
            transaction_id: tx.id,
            payment_method: tx.payment_method,
            subscription_type: "paid",
            status: "active",
            start_date: startDate.toISOString(),
            expiry_date: expiryDate.toISOString(),
          })
          .select("id")
          .single();

        if (insertError) {
          skipped.push({ tx_id: tx.id, reason: insertError.message });
          continue;
        }

        synced.push({ 
          tx_id: tx.id, 
          user_id: tx.user_id, 
          action: "created", 
          plan: planName,
          sub_id: newSub.id
        });
      }

      // Update profile
      await db
        .from("profiles")
        .upsert({
          id: tx.user_id,
          subscription: planName,
          subscription_start_date: startDate.toISOString(),
          subscription_expiry_date: expiryDate.toISOString(),
          trial_status: "none",
        }, { onConflict: "id" });
    }

    return NextResponse.json({
      success: true,
      synced: synced.length,
      skipped: skipped.length,
      details: { synced, skipped: skipped.slice(0, 10) }, // Limit skipped to first 10
    });
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sync subscriptions" },
      { status }
    );
  }
}
