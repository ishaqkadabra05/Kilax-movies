import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createUserDb } from "@/lib/supabase/user-db";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = createUserDb();
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || 1));
    const perPage = Math.min(1000, Math.max(1, Number(request.nextUrl.searchParams.get("per_page") || 500)));
    const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase() || "";

    // Search must include every auth user and profile field before pagination.
    const [profilesRes, subsRes, plansRes] = await Promise.all([
      db.from("profiles").select("id,full_name,email,avatar_url,role,created_at,subscription,subscription_start_date,subscription_expiry_date,trial_status,trial_started_at,trial_expires_at,phone"),
      db.from("subscriptions")
        .select("user_id,plan_id,subscription_type,status,start_date,expiry_date,payment_method,created_at")
        .order("created_at", { ascending: false }),
      db.from("plans").select("id,name,tier,tier_label"),
    ]);

    let authData: any;
    let authError: any;
    if (!search) {
      ({ data: authData, error: authError } = await db.auth.admin.listUsers({ page, perPage }));
    } else {
      const allUsers: any[] = [];
      let scanPage = 1;
      while (true) {
        const result = await db.auth.admin.listUsers({ page: scanPage, perPage: 1000 });
        if (result.error) { authError = result.error; break; }
        allUsers.push(...(result.data?.users || []));
        if (!result.data?.users?.length || result.data.users.length < 1000) break;
        scanPage += 1;
      }
      const profileById = new Map((profilesRes.data || []).map((profile: any) => [profile.id, profile]));
      authData = {
        users: allUsers.filter((user: any) => {
          const profile = profileById.get(user.id) || {};
          return [
            user.email,
            user.phone,
            user.user_metadata?.full_name,
            user.user_metadata?.name,
            profile.full_name,
            profile.email,
            profile.phone,
          ].some(value => String(value || "").toLowerCase().includes(search));
        }),
      };
    }

    if (authError) throw authError;

    const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
    const planMap = new Map((plansRes.data || []).map((plan: any) => [String(plan.id), plan]));

    // Keep only the most recent subscription per user
    const subMap = new Map<string, any>();
    for (const sub of subsRes.data || []) {
      if (!subMap.has(sub.user_id)) subMap.set(sub.user_id, sub);
    }

    const premiumUserIds = new Set(
      [...subMap.entries()]
        .filter(([, sub]) => {
          const plan = planMap.get(String(sub.plan_id));
          const type = String(sub.subscription_type ?? "").toLowerCase();
          const status = String(sub.status ?? "active").toLowerCase();
          const expiry = sub.expiry_date ? new Date(sub.expiry_date).getTime() : Infinity;
          const profile = profileMap.get(String(userId));
          const profilePaid = profile?.subscription && !["free", "trial"].includes(String(profile.subscription).toLowerCase()) && profile.subscription_expiry_date && new Date(profile.subscription_expiry_date).getTime() >= Date.now();
          return (status === "active" && expiry >= Date.now() && type !== "trial" && Boolean(plan)) || Boolean(profilePaid);
        })
        .map(([userId]) => String(userId))
    );

    const trialUserIds = new Set(
      [...subMap.entries()]
        .filter(([userId, sub]) => String(sub.subscription_type ?? "").toLowerCase() === "trial" &&
          String(sub.status ?? "active").toLowerCase() === "active" &&
          (!sub.expiry_date || new Date(sub.expiry_date).getTime() >= Date.now()) || profileMap.get(String(userId))?.trial_status === "active")
        .map(([userId]) => String(userId))
    );

    const filteredUsers = search
      ? (authData.users || []).slice((page - 1) * perPage, page * perPage)
      : authData.users || [];
    const users = filteredUsers.map((u: any) => {
      const profile = profileMap.get(u.id) ?? {};
      const sub = subMap.get(u.id) ?? null;
      const profilePaid = profile.subscription && !["free", "trial"].includes(String(profile.subscription).toLowerCase()) && profile.subscription_expiry_date && new Date(profile.subscription_expiry_date).getTime() >= Date.now();
      const profileTrial = profile.trial_status === "active" && profile.trial_expires_at && new Date(profile.trial_expires_at).getTime() >= Date.now();
      const currentSubscription = profilePaid
        ? { plan: profile.subscription, status: "active", end_date: profile.subscription_expiry_date }
        : profileTrial
          ? { plan: "Trial", status: "active", end_date: profile.trial_expires_at }
          : sub;
      return {
        id: u.id,
        email: u.email ?? profile.email ?? "",
        name: profile.full_name ?? u.user_metadata?.full_name ?? u.user_metadata?.name ?? "",
        phone: u.phone ?? u.user_metadata?.phone ?? profile.phone ?? "",
        role: profile.role ?? "user",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        subscription: currentSubscription
          ? {
              plan: String(sub.subscription_type ?? "").toLowerCase() === "trial"
                ? "Trial"
                : planMap.get(String(sub.plan_id))?.name ?? sub.plan_id ?? "—",
              status: sub.status ?? "active",
              end_date: sub.expiry_date ?? null,
            }
          : null,
        // keep raw for UI flexibility
        profile,
      };
    });

    return NextResponse.json({
      users,
      page,
      perPage,
      total: search ? authData.users.length : users.length,
      totalPremium: premiumUserIds.size,
      totalTrial: trialUserIds.size,
    });
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load users" },
      { status }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "User id is required" }, { status: 400 });

    const db = createUserDb();
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete user" },
      { status }
    );
  }
}
