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
      db.from("profiles").select("id,full_name,email,avatar_url,subscription"),
      db.from("plans").select("id,name,tier_label"),
    ]);

    if (error) throw error;
    
    // Debug: Log raw subscription data
    console.log("Raw subscriptions from DB (first 3):", (data || []).slice(0, 3).map(s => ({
      plan_id: s.plan_id,
      subscription_type: s.subscription_type,
      status: s.status
    })));
    
    const profiles = new Map((profilesRes.data || []).map((profile: any) => [String(profile.id), profile]));
    const plans = new Map((plansRes.data || []).map((plan: any) => [String(plan.id), plan]));
    
    // Debug: Log profile subscriptions to see if plan info is stored there
    console.log("Profile subscriptions (first 3):", (profilesRes.data || []).slice(0, 3).map(p => ({
      email: p.email,
      subscription: p.subscription
    })));
    
    // Debug: Log plans map
    console.log("Plans from DB:", Array.from(plans.values()).map(p => ({ id: p.id, name: p.name, tier_label: p.tier_label })));

    const rows = (data || []).map((s: any) => {
      const profile = profiles.get(String(s.user_id)) || {};
      const plan = plans.get(String(s.plan_id));
      const isTrial = String(s.subscription_type ?? "").toLowerCase() === "trial";
      
      // Check if profile has a subscription field that might indicate the plan
      const profileSubscription = profile.subscription;
      
      // Use plan name from plans table, or fallback to profile.subscription
      let planName = "—";
      if (isTrial) {
        planName = "Trial";
      } else if (plan?.tier_label || plan?.name) {
        planName = plan.tier_label || plan.name;
      } else if (profileSubscription && profileSubscription !== 'free') {
        planName = profileSubscription;
      }
      
      return {
        id: s.id,
        user_id: s.user_id,
        email: profile.email ?? s.user_id,
        name: profile.full_name ?? null,
        plan: planName,
        payment_method: s.payment_method ?? (isTrial ? "trial" : "—"),
        status: s.status ?? "active",
        start_date: s.start_date ?? s.created_at,
        end_date: s.expiry_date ?? null,
      };
    });

    console.log("Subscriptions data sample:", rows.slice(0, 3).map(r => ({ 
      email: r.email, 
      plan: r.plan, 
      status: r.status 
    })));

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
      .select("id,user_id,plan_id,subscription_type,status,start_date,expiry_date")
      .eq("id", body.id)
      .maybeSingle();

    if (existingSubError) throw existingSubError;

    let planId = body.plan_id ?? existingSub?.plan_id ?? null;
    let planName = body.plan ?? null;

    if (planName && !planId) {
      const { data: plan } = await db.from("plans").select("id,name,tier_label").ilike("name", String(planName)).maybeSingle();
      if (!plan) {
        const { data: planByLabel } = await db.from("plans").select("id,name,tier_label").ilike("tier_label", String(planName)).maybeSingle();
        planId = planByLabel?.id ?? null;
        planName = planByLabel?.tier_label || planByLabel?.name || planName;
      } else {
        planId = plan.id;
        planName = plan.tier_label || plan.name;
      }
    }

    const status = body.status ?? existingSub?.status ?? "active";
    const startDate = body.start_date ?? existingSub?.start_date ?? new Date().toISOString();
    const endDate = body.end_date ?? existingSub?.expiry_date ?? null;
    const isTrial = String(existingSub?.subscription_type ?? "").toLowerCase() === "trial";

    const update: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (planId) update.plan_id = planId;
    if (startDate) update.start_date = startDate;
    if (endDate !== undefined) update.expiry_date = endDate;
    if (status) update.status = status;
    update.subscription_type = status === "active" ? (isTrial ? "trial" : "paid") : "trial";

    const { data, error } = await db
      .from("subscriptions")
      .update(update)
      .eq("id", body.id)
      .select()
      .single();

    if (error) throw error;

    if (existingSub?.user_id && planName) {
      const profileUpdate: Record<string, any> = {
        id: existingSub.user_id,
        subscription: status === "active" && planName ? planName : null,
        subscription_start_date: startDate || null,
        subscription_expiry_date: status === "active" ? (endDate || null) : null,
        trial_status: isTrial && status === "active" ? "active" : "none",
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
