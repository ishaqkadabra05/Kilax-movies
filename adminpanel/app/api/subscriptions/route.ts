import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createUserDb } from "@/lib/supabase/user-db";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = createUserDb();

    const [{ data, error }, profilesRes, plansRes] = await Promise.all([
      db.from("subscriptions")
        .select("id,user_id,plan_id,subscription_type,payment_method,status,start_date,expiry_date,created_at")
        .order("created_at", { ascending: false }),
      db.from("profiles").select("id,full_name,email,avatar_url"),
      db.from("plans").select("id,name,tier_label"),
    ]);

    if (error) throw error;
    const profiles = new Map((profilesRes.data || []).map((profile: any) => [String(profile.id), profile]));
    const plans = new Map((plansRes.data || []).map((plan: any) => [String(plan.id), plan]));

    const rows = (data || []).map((s: any) => {
      const profile = profiles.get(String(s.user_id)) || {};
      const plan = plans.get(String(s.plan_id));
      const isTrial = String(s.subscription_type ?? "").toLowerCase() === "trial";
      return {
        id: s.id,
        user_id: s.user_id,
        email: profile.email ?? s.user_id,
        name: profile.full_name ?? null,
        plan: isTrial ? "Trial" : plan?.name ?? s.plan_id ?? "—",
        payment_method: s.payment_method ?? (isTrial ? "trial" : "—"),
        status: s.status ?? "active",
        start_date: s.start_date ?? s.created_at,
        end_date: s.expiry_date ?? null,
      };
    });

    return NextResponse.json(rows);
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load subscriptions" },
      { status }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: "Subscription id is required" }, { status: 400 });

    const db = createUserDb();
    const { data: existingSub, error: existingSubError } = await db
      .from("subscriptions")
      .select("id,user_id,plan_id,plan,subscription_type,status,start_date,expiry_date")
      .eq("id", body.id)
      .maybeSingle();

    if (existingSubError) throw existingSubError;

    let planId = body.plan_id ?? existingSub?.plan_id ?? null;
    let planName = body.plan ?? existingSub?.plan ?? null;

    if ((body.plan_id !== undefined || body.plan !== undefined) && !planId && planName) {
      const { data: plan } = await db.from("plans").select("id,name").ilike("name", String(planName)).maybeSingle();
      planId = plan?.id ?? null;
      planName = plan?.name ?? planName;
    }

    if (body.plan_id !== undefined || body.plan !== undefined) {
      if (!planId && body.plan) {
        const { data: plan } = await db.from("plans").select("id,name").ilike("name", String(body.plan)).maybeSingle();
        planId = plan?.id ?? null;
        planName = plan?.name ?? String(body.plan);
      }
    }

    const status = body.status ?? existingSub?.status ?? "active";
    const startDate = body.start_date ?? existingSub?.start_date ?? new Date().toISOString().slice(0, 10);
    const endDate = body.end_date ?? existingSub?.expiry_date ?? null;
    const normalizedPlan = planName ? String(planName).trim() : null;
    const isTrial = (normalizedPlan ?? "").toLowerCase().includes("trial") || String(existingSub?.subscription_type ?? "").toLowerCase() === "trial";

    const update: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.plan_id !== undefined || body.plan !== undefined || planId) update.plan_id = planId;
    if (normalizedPlan) update.plan = normalizedPlan;
    if (body.start_date !== undefined || startDate) update.start_date = startDate;
    if (body.end_date !== undefined || endDate !== null) update.expiry_date = endDate;
    if (body.status !== undefined || status) update.status = status;
    update.subscription_type = status === "active" ? (isTrial ? "trial" : "premium") : "free";

    const { data, error } = await db
      .from("subscriptions")
      .update(update)
      .eq("id", body.id)
      .select()
      .single();

    if (error) throw error;

    if (existingSub?.user_id) {
      const profileUpdate: Record<string, any> = {
        id: existingSub.user_id,
        subscription: status === "active" && normalizedPlan ? normalizedPlan : "free",
        subscription_start_date: startDate || null,
        subscription_expiry_date: status === "active" ? (endDate || null) : null,
        trial_status: isTrial && status === "active" ? "active" : "inactive",
        trial_expires_at: isTrial && status === "active" && endDate ? endDate : null,
      };

      const { error: profileError } = await db
        .from("profiles")
        .upsert(profileUpdate, { onConflict: "id" });

      if (profileError) throw profileError;
    }

    return NextResponse.json(data);
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update subscription" },
      { status }
    );
  }
}
