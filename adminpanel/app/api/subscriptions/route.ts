import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";
import { createUserDb } from "@/lib/supabase/user-db";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    const details = "details" in error && typeof error.details === "string" ? error.details : "";
    return details ? `${error.message}: ${details}` : error.message;
  }
  return fallback;
}

function calculatePlanExpiry(startDate: string, plan: { duration_in_days?: number | null; duration_in_months?: number | null; duration_in_hours?: number | null }) {
  const expiryDate = new Date(startDate);
  const hours = Number(plan.duration_in_hours);
  const days = Number(plan.duration_in_days);
  const months = Number(plan.duration_in_months);

  if (hours > 0) {
    expiryDate.setTime(expiryDate.getTime() + hours * 60 * 60 * 1000);
  } else if (days > 0) {
    expiryDate.setUTCDate(expiryDate.getUTCDate() + days);
  } else if (months > 0) {
    const day = expiryDate.getUTCDate();
    const wholeMonths = Math.trunc(months);
    expiryDate.setUTCDate(1);
    expiryDate.setUTCMonth(expiryDate.getUTCMonth() + wholeMonths);
    expiryDate.setUTCDate(Math.min(day, new Date(Date.UTC(expiryDate.getUTCFullYear(), expiryDate.getUTCMonth() + 1, 0)).getUTCDate()));
    const fractionalDays = Math.round((months - wholeMonths) * 30);
    if (fractionalDays) expiryDate.setUTCDate(expiryDate.getUTCDate() + fractionalDays);
  } else {
    expiryDate.setUTCDate(expiryDate.getUTCDate() + 30);
  }

  return expiryDate.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = createUserDb();

    const [data, profiles, plans] = await Promise.all([
      fetchAllSupabaseRows<any>(
        db.from("subscriptions")
          .select("id,user_id,plan_id,subscription_type,payment_method,status,start_date,expiry_date,created_at")
          .order("created_at", { ascending: false })
      ),
      fetchAllSupabaseRows<any>(db.from("profiles").select("id,full_name,email,avatar_url,subscription")),
      fetchAllSupabaseRows<any>(db.from("plans").select("id,name,tier_label")),
    ]);

    const profilesMap = new Map((profiles || []).map((profile: any) => [String(profile.id), profile]));
    const plansMap = new Map((plans || []).map((plan: any) => [String(plan.id), plan]));

    const rows = (data || []).map((s: any) => {
      const profile = profilesMap.get(String(s.user_id)) || {};
      const plan = plansMap.get(String(s.plan_id));
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
        plan_id: s.plan_id,
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

    let selectedPlan: { id: string; name: string; tier_label: string | null; duration_in_days: number | null; duration_in_months: number | null; duration_in_hours: number | null } | null = null;
    const requestedPlanId = typeof body.plan_id === "string" ? body.plan_id : "";
    const requestedPlanName = typeof body.plan === "string" ? body.plan : "";

    if (requestedPlanId) {
      const { data, error } = await db.from("plans").select("id,name,tier_label,duration_in_days,duration_in_months,duration_in_hours").eq("id", requestedPlanId).maybeSingle();
      if (error) throw error;
      selectedPlan = data;
      if (!selectedPlan) return NextResponse.json({ error: "Selected package was not found. Refresh the page and choose an available package." }, { status: 400 });
    } else if (requestedPlanName) {
      const { data: byName, error: nameError } = await db.from("plans").select("id,name,tier_label,duration_in_days,duration_in_months,duration_in_hours").ilike("name", requestedPlanName).maybeSingle();
      if (nameError) throw nameError;
      if (byName) {
        selectedPlan = byName;
      } else {
        const { data: byLabel, error: labelError } = await db.from("plans").select("id,name,tier_label,duration_in_days,duration_in_months,duration_in_hours").ilike("tier_label", requestedPlanName).maybeSingle();
        if (labelError) throw labelError;
        selectedPlan = byLabel;
      }
      if (!selectedPlan) return NextResponse.json({ error: "Selected package was not found. Refresh the page and choose an available package." }, { status: 400 });
    }

    const planId = selectedPlan?.id ?? existingSub?.plan_id ?? null;
    const planName = selectedPlan ? selectedPlan.tier_label || selectedPlan.name : requestedPlanName || null;

    const status = body.status ?? existingSub?.status ?? "active";
    const startDate = body.start_date ?? existingSub?.start_date ?? new Date().toISOString();
    let endDate = body.end_date ?? existingSub?.expiry_date ?? null;
    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = endDate ? new Date(endDate).getTime() : Number.NaN;
    if (status === "active" && selectedPlan && Number.isFinite(startTimestamp) && (!Number.isFinite(endTimestamp) || endTimestamp <= startTimestamp)) {
      endDate = calculatePlanExpiry(startDate, selectedPlan);
    }
    const finalEndTimestamp = endDate ? new Date(endDate).getTime() : Number.NaN;
    if (status === "active" && (!Number.isFinite(startTimestamp) || !Number.isFinite(finalEndTimestamp) || finalEndTimestamp <= startTimestamp)) {
      return NextResponse.json({ error: "The subscription end date must be later than the start date." }, { status: 400 });
    }
    const isTrial = !selectedPlan && String(existingSub?.subscription_type ?? "").toLowerCase() === "trial";

    const update: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (planId) update.plan_id = planId;
    if (startDate) update.start_date = startDate;
    if (endDate !== undefined) update.expiry_date = endDate;
    if (status) update.status = status;
    update.subscription_type = status === "active"
      ? (selectedPlan ? "paid" : isTrial ? "trial" : "paid")
      : existingSub?.subscription_type ?? "paid";

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
      { error: getErrorMessage(error, "Unable to update subscription") },
      { status }
    );
  }
}
