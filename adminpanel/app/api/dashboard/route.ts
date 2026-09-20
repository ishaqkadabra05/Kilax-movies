import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createLegacyUserDb, createUserDb } from "@/lib/supabase/user-db";
import { reelplexiFetch } from "@/lib/reelplexi";
import { withCache } from "@/lib/cache";

// Reelplexi content counts — cache for 5 minutes (counts change rarely)
const REELPLEXI_TTL = 5 * 60;
// User/subscription counts — cache for 2 minutes
const USER_STATS_TTL = 2 * 60;
// Latest content — cache for 5 minutes
const LATEST_TTL = 5 * 60;

function mapContent(items: any[], type: "movie" | "series") {
  return (items || []).map((m: any) => ({
    id: m.id,
    title: m.title,
    genre: Array.isArray(m.genres) ? m.genres[0] || "Uncategorized" : m.genre || "Uncategorized",
    vj: m.vj || "—",
    thumb: m.poster_url || m.backdrop_url || "",
    added: m.release_date || m.created_at?.slice(0, 10) || "—",
    type,
    episodes: m.episodes,
  }));
}

async function loadCombinedUserCount(defaultDb: ReturnType<typeof createUserDb>, legacyDb: ReturnType<typeof createLegacyUserDb>) {
  const [defaultUsers, legacyUsers] = await Promise.all([
    defaultDb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    legacyDb ? legacyDb.auth.admin.listUsers({ page: 1, perPage: 1000 }) : Promise.resolve({ data: { users: [] }, error: null }),
  ]);

  if (defaultUsers.error) throw defaultUsers.error;
  if (legacyUsers.error) throw legacyUsers.error;

  const merged = new Map<string, any>();
  for (const user of defaultUsers.data?.users || []) {
    if (user?.id) merged.set(String(user.id), user);
  }
  for (const user of legacyUsers.data?.users || []) {
    if (user?.id && !merged.has(String(user.id))) merged.set(String(user.id), user);
  }

  return merged.size;
}

async function loadActiveUserStats(db: ReturnType<typeof createUserDb>) {
  const now = Date.now();
  const dayCutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const monthCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [activityRes, usersRes] = await Promise.all([
    db.from("user_video_activity")
      .select("user_id,created_at")
      .in("event_type", ["stream_started", "playback_progress", "stream_completed", "stream_incomplete"])
      .gte("created_at", monthCutoff),
    db.from("profiles").select("id,created_at"),
  ]);
  if (activityRes.error || usersRes.error) throw activityRes.error || usersRes.error;

  const createdAtById = new Map((usersRes.data || []).map((user: any) => [String(user.id), new Date(user.created_at).getTime()]));
  const activeDay = new Set<string>();
  const activeMonth = new Set<string>();
  const newDay = new Set<string>();
  const oldDay = new Set<string>();
  const newMonth = new Set<string>();
  const oldMonth = new Set<string>();
  for (const row of activityRes.data || []) {
    const userId = String(row.user_id);
    const createdAt = createdAtById.get(userId) || 0;
    activeMonth.add(userId);
    if (createdAt >= now - 30 * 24 * 60 * 60 * 1000) newMonth.add(userId);
    else oldMonth.add(userId);
    if (row.created_at >= dayCutoff) {
      activeDay.add(userId);
      if (createdAt >= now - 24 * 60 * 60 * 1000) newDay.add(userId);
      else oldDay.add(userId);
    }
  }
  return {
    active24h: activeDay.size,
    active30d: activeMonth.size,
    newActive24h: newDay.size,
    oldActive24h: oldDay.size,
    newActive30d: newMonth.size,
    oldActive30d: oldMonth.size,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = createUserDb();
    const legacyDb = createLegacyUserDb();

    const activeNowCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const [movies, series, latestMovies, latestSeries, totalUsers, activeSubs, activeNowResult, activeUsers] = await Promise.all([
      // ── Reelplexi: cached counts ────────────────────────────────────────
      withCache("reelplexi:movies:count", REELPLEXI_TTL, () =>
        reelplexiFetch<any>("/v1/movies?per_page=1")
      ),
      withCache("reelplexi:series:count", REELPLEXI_TTL, () =>
        reelplexiFetch<any>("/v1/series?per_page=1")
      ),

      // ── Reelplexi: latest movies & series fetched separately ────────────
      // /v1/latest returns type:"All" for every item so we can't filter it —
      // instead hit the typed endpoints directly, ordered by created_at desc.
      withCache("reelplexi:latest:movies", LATEST_TTL, () =>
        reelplexiFetch<any>("/v1/movies?per_page=6")
      ),
      withCache("reelplexi:latest:series", LATEST_TTL, () =>
        reelplexiFetch<any>("/v1/series?per_page=6")
      ),

      // ── User DB: combined canonical + legacy user count, cached 2 min ──
      withCache("userdb:total-users", USER_STATS_TTL, async () => loadCombinedUserCount(db, legacyDb)),

      // ── User DB: active subscriptions, cached 2 min ─────────────────────
      withCache("userdb:active-subs", USER_STATS_TTL, async () => {
        const res = await db
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .gt("expiry_date", new Date().toISOString());
        return res.count ?? 0;
      }),

      // ── User DB: live active now — NOT cached (real-time) ───────────────
      db
        .from("user_video_activity")
        .select("user_id")
        .in("event_type", ["stream_started", "playback_progress", "stream_completed", "stream_incomplete"])
        .gte("created_at", activeNowCutoff),
      loadActiveUserStats(db),
    ]);

    // Deduplicate active-now user IDs
    const activeNowCount = new Set(
      (activeNowResult.data || []).map((r: any) => String(r.user_id))
    ).size;

    const defaultUsersResult = await db.auth.admin.listUsers({ page: 1, perPage: 1 });
    const legacyUsersResult = legacyDb ? await legacyDb.auth.admin.listUsers({ page: 1, perPage: 1 }) : null;
    const defaultUserCount = Number((defaultUsersResult as any)?.data?.total ?? (defaultUsersResult as any)?.data?.users?.length ?? 0);
    const legacyUserCount = legacyUsersResult ? Number((legacyUsersResult as any)?.data?.total ?? (legacyUsersResult as any)?.data?.users?.length ?? 0) : 0;
    const legacyUsers = legacyDb ? Math.max(0, totalUsers - defaultUserCount) : 0;

    return NextResponse.json({
      stats: {
        users: totalUsers,
        legacyUsers: Math.min(legacyUsers, legacyUserCount),
        movies: movies.pagination?.total ?? movies.total ?? (movies.data?.length || 0),
        series: series.pagination?.total ?? series.total ?? (series.data?.length || 0),
        premium: activeSubs,
        activeNow: activeNowCount,
        active24h: activeUsers.active24h,
        active30d: activeUsers.active30d,
        newActive24h: activeUsers.newActive24h,
        oldActive24h: activeUsers.oldActive24h,
        newActive30d: activeUsers.newActive30d,
        oldActive30d: activeUsers.oldActive30d,
      },
      latestMovies: mapContent(latestMovies?.data || [], "movie"),
      latestSeries: mapContent(latestSeries?.data || [], "series"),
    });
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load dashboard" },
      { status }
    );
  }
}
