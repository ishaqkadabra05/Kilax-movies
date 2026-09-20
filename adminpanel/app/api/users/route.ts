import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createLegacyUserDb, createUserDb } from "@/lib/supabase/user-db";

function toArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function mergeAuthUsersById(users: any[] = [], source: "default" | "legacy") {
  const map = new Map<string, any>();
  for (const user of users) {
    if (!user?.id) continue;
    map.set(String(user.id), { ...user, source });
  }
  return map;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = createUserDb();
    const legacyDb = createLegacyUserDb();
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || 1));
    const perPage = Math.min(1000, Math.max(1, Number(request.nextUrl.searchParams.get("per_page") || 500)));
    const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase() || "";

    const [profilesRes, subsRes, plansRes, legacyProfilesRes, legacySubsRes] = await Promise.all([
      db.from("profiles").select("id,full_name,email,avatar_url,role,created_at,subscription,subscription_start_date,subscription_expiry_date,trial_status,trial_started_at,trial_expires_at,phone"),
      db.from("subscriptions")
        .select("user_id,plan_id,subscription_type,status,start_date,expiry_date,payment_method,created_at")
        .order("created_at", { ascending: false }),
      db.from("plans").select("id,name,tier,tier_label"),
      legacyDb
        ? legacyDb.from("profiles").select("id,full_name,email,avatar_url,role,created_at,subscription,subscription_start_date,subscription_expiry_date,trial_status,trial_started_at,trial_expires_at,phone")
        : Promise.resolve({ data: [], error: null }),
      legacyDb
        ? legacyDb.from("subscriptions")
            .select("user_id,plan_id,subscription_type,status,start_date,expiry_date,payment_method,created_at")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const authUsersById = new Map<string, any>();
    const defaultUsers = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (defaultUsers.error) throw defaultUsers.error;
    for (const user of toArray(defaultUsers.data?.users)) {
      if (user?.id) authUsersById.set(String(user.id), { ...user, source: "default" });
    }

    if (legacyDb) {
      const legacyUsers = await legacyDb.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (legacyUsers.error) throw legacyUsers.error;
      for (const user of toArray(legacyUsers.data?.users)) {
        if (!user?.id) continue;
        const key = String(user.id);
        if (!authUsersById.has(key)) authUsersById.set(key, { ...user, source: "legacy" });
      }
    }

    const profileMap = new Map<string, any>();
    for (const profile of toArray((profilesRes as any)?.data) as any[]) {
      if (profile?.id) profileMap.set(String(profile.id), { ...profile, source: "default" });
    }
    for (const profile of toArray((legacyProfilesRes as any)?.data) as any[]) {
      if (profile?.id) {
        const key = String(profile.id);
        if (!profileMap.has(key)) profileMap.set(key, { ...profile, source: "legacy" });
      }
    }

    const planMap = new Map((toArray((plansRes as any)?.data) || []).map((plan: any) => [String(plan.id), plan]));

    const subMap = new Map<string, any>();
    for (const sub of toArray((subsRes as any)?.data) as any[]) {
      if (sub?.user_id && !subMap.has(String(sub.user_id))) subMap.set(String(sub.user_id), { ...sub, source: "default" });
    }
    for (const sub of toArray((legacySubsRes as any)?.data) as any[]) {
      if (sub?.user_id) {
        const key = String(sub.user_id);
        if (!subMap.has(key)) subMap.set(key, { ...sub, source: "legacy" });
      }
    }

    const premiumUserIds = new Set<string>();
    const trialUserIds = new Set<string>();

    for (const [userId, sub] of subMap.entries()) {
      const profile = profileMap.get(String(userId)) || {};
      const plan = planMap.get(String(sub.plan_id));
      const type = String(sub.subscription_type ?? "").toLowerCase();
      const status = String(sub.status ?? "active").toLowerCase();
      const expiry = sub.expiry_date ? new Date(sub.expiry_date).getTime() : Infinity;
      const profilePaid = profile.subscription && !["free", "trial"].includes(String(profile.subscription).toLowerCase()) && profile.subscription_expiry_date && new Date(profile.subscription_expiry_date).getTime() >= Date.now();
      if ((status === "active" && expiry >= Date.now() && type !== "trial" && Boolean(plan)) || Boolean(profilePaid)) {
        premiumUserIds.add(String(userId));
      }
      if ((String(sub.subscription_type ?? "").toLowerCase() === "trial" && String(sub.status ?? "active").toLowerCase() === "active" && (!sub.expiry_date || new Date(sub.expiry_date).getTime() >= Date.now())) || profile.trial_status === "active") {
        trialUserIds.add(String(userId));
      }
    }

    const normalizedUsers = [...authUsersById.values()].map((u: any) => {
      const profile = profileMap.get(String(u.id)) ?? {};
      const sub = subMap.get(String(u.id)) ?? null;
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
        source: u.source ?? "default",
        isLegacy: u.source === "legacy",
        subscription: currentSubscription
          ? {
              plan: currentSubscription.subscription_type
                ? (String(currentSubscription.subscription_type).toLowerCase() === "trial" ? "Trial" : planMap.get(String(currentSubscription.plan_id))?.name ?? currentSubscription.plan_id ?? "—")
                : (String(profile.subscription || "").toLowerCase() === "trial" ? "Trial" : profile.subscription ?? "—"),
              status: currentSubscription.status ?? "active",
              end_date: currentSubscription.expiry_date ?? currentSubscription.subscription_expiry_date ?? null,
            }
          : null,
        profile,
      };
    });

    const filteredUsers = search
      ? normalizedUsers.filter((user: any) => {
          const haystack = [
            user.email,
            user.phone,
            user.name,
            user.profile?.full_name,
            user.profile?.email,
            user.profile?.phone,
            user.source,
          ].join(" ").toLowerCase();
          return haystack.includes(search);
        })
      : normalizedUsers;

    const start = (page - 1) * perPage;
    const pagedUsers = filteredUsers.slice(start, start + perPage);

    return NextResponse.json({
      users: pagedUsers,
      page,
      perPage,
      total: filteredUsers.length,
      totalPremium: premiumUserIds.size,
      totalTrial: trialUserIds.size,
      totalLegacy: filteredUsers.filter((user: any) => user.isLegacy).length,
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
