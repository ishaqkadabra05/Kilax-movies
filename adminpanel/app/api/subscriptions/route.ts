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
    const update: Record<string, any> = {};
    if (body.plan_id !== undefined || body.plan !== undefined) {
      let planId = body.plan_id;
      if (!planId && body.plan) {
        const { data: plan } = await db.from("plans").select("id").ilike("name", String(body.plan)).maybeSingle();
        planId = plan?.id;
      }
      if (planId) update.plan_id = planId;
    }
    if (body.start_date !== undefined) update.start_date = body.start_date;
    if (body.end_date !== undefined) {
      update.expiry_date = body.end_date;
    }
    if (body.status !== undefined) update.status = body.status;
    update.updated_at = new Date().toISOString();

    const { data, error } = await db
      .from("subscriptions")
      .update(update)
      .eq("id", body.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update subscription" },
      { status }
    );
  }
}
