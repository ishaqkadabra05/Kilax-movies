import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { reelplexiFetch } from "@/lib/reelplexi";

const EMPTY_SUMMARY = {
  total_stream_starts: 0,
  total_movie_streams: 0,
  total_series_streams: 0,
  total_completed_streams: 0,
  total_incomplete_streams: 0,
  total_watch_seconds: 0,
  total_downloads: 0,
  total_searches: 0,
  total_reelplexi_requests: 0,
};

async function loadAudienceStats(db: ReturnType<typeof createSupabaseAdmin>, timeframe: string) {
  const cutoff = new Date();
  if (timeframe === "day") cutoff.setHours(0, 0, 0, 0);
  else if (timeframe === "week") cutoff.setDate(cutoff.getDate() - 6);
  else if (timeframe === "month") cutoff.setDate(cutoff.getDate() - 29);
  else cutoff.setTime(0);

  const cutoffIso = cutoff.toISOString();
  const [activityRes, usersRes, subscriptionsRes] = await Promise.all([
    db.from("user_video_activity").select("user_id,event_type,created_at").eq("event_type", "stream_started").gte("created_at", cutoffIso),
    db.from("profiles").select("id,created_at"),
    db.from("subscriptions").select("user_id,plan,plan_id,status,start_date,end_date,expiry_date"),
  ]);

  const premiumTrialUsers = new Set<string>();
  for (const subscription of subscriptionsRes.data || []) {
    const plan = String(subscription.plan ?? subscription.plan_id ?? "").toLowerCase();
    const status = String(subscription.status ?? "active").toLowerCase();
    const expiry = subscription.end_date ?? subscription.expiry_date;
    const isActive = status === "active" && (!expiry || new Date(expiry).getTime() >= Date.now());
    if (isActive && plan.includes("trial")) premiumTrialUsers.add(String(subscription.user_id));
  }

  if (activityRes.error || usersRes.error || subscriptionsRes.error) {
    return { newUsers: 0, newUserStreams: 0, oldUserStreams: 0, premiumTrialUsers: 0 };
  }
  const newUserIds = new Set((usersRes.data || [])
    .filter((user: any) => new Date(user.created_at).getTime() >= cutoff.getTime())
    .map((user: any) => String(user.id)));
  let newUserStreams = 0;
  let oldUserStreams = 0;
  for (const activity of activityRes.data || []) {
    if (newUserIds.has(String(activity.user_id))) newUserStreams += 1;
    else oldUserStreams += 1;
  }
  return { newUsers: newUserIds.size, newUserStreams, oldUserStreams, premiumTrialUsers: premiumTrialUsers.size };
}

function buildDailyRows(days: number) {
  const rows = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    rows.push({ usage_date: date.toISOString().slice(0, 10), views: 0, watch_seconds: 0, downloads: 0, searches: 0, reelplexi_requests: 0 });
  }
  return rows;
}

async function loadViewerStats(db: ReturnType<typeof createSupabaseAdmin>, timeframe: string) {
  const cutoff = new Date();
  if (timeframe === "day") cutoff.setHours(0, 0, 0, 0);
  else if (timeframe === "week") cutoff.setDate(cutoff.getDate() - 6);
  else if (timeframe === "month") cutoff.setDate(cutoff.getDate() - 29);
  else cutoff.setTime(0);

  const { data, error } = await db
    .from("user_video_activity")
    .select("user_id,content_type,created_at")
    .eq("event_type", "stream_started")
    .gte("created_at", cutoff.toISOString());
  if (error) throw error;

  const activeCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = data || [];
  return {
    totalViews: rows.length,
    uniqueViewers: new Set(rows.map((row: any) => String(row.user_id))).size,
    movieViews: rows.filter((row: any) => row.content_type === "movie").length,
    seriesViews: rows.filter((row: any) => row.content_type === "series" || row.content_type === "episode").length,
    activeViewers24h: new Set(rows.filter((row: any) => new Date(row.created_at) >= activeCutoff).map((row: any) => String(row.user_id))).size,
  };
}

async function loadDownloadStats(db: ReturnType<typeof createSupabaseAdmin>, timeframe: string) {
  const cutoff = new Date();
  if (timeframe === "day") cutoff.setHours(0, 0, 0, 0);
  else if (timeframe === "week") cutoff.setDate(cutoff.getDate() - 6);
  else if (timeframe === "month") cutoff.setDate(cutoff.getDate() - 29);
  else cutoff.setTime(0);

  const { data, error } = await db
    .from("download_events")
    .select("status,created_at")
    .gte("created_at", cutoff.toISOString());
  if (error) throw error;

  const rows = data || [];
  return {
    totalRequests: rows.length,
    successful: rows.filter((row: any) => row.status === "success").length,
    limitReached: rows.filter((row: any) => row.status === "limit_reached").length,
    failed: rows.filter((row: any) => !["success", "limit_reached"].includes(row.status)).length,
  };
}

async function loadFallbackAnalytics(db: ReturnType<typeof createSupabaseAdmin>, days: number) {
  const [activity, downloads, events] = await Promise.all([
    db.from("user_video_activity").select("content_type, content_id, content_title, event_type, watch_seconds, created_at"),
    db.from("download_events").select("created_at, status"),
    db.from("analytics_events").select("event_type, created_at"),
  ]);
  if (activity.error || downloads.error || events.error) {
    throw new Error(activity.error?.message || downloads.error?.message || events.error?.message || "Analytics tables are unavailable");
  }

  const summary = { ...EMPTY_SUMMARY };
  const topMap = new Map<string, any>();
  const daily = buildDailyRows(days);
  const byDate = new Map(daily.map(row => [row.usage_date, row]));
  for (const row of activity.data || []) {
    const date = byDate.get(String(row.created_at).slice(0, 10));
    if (row.event_type === "stream_started") {
      summary.total_stream_starts += 1;
      if (row.content_type === "movie") summary.total_movie_streams += 1;
      if (row.content_type === "series" || row.content_type === "episode") summary.total_series_streams += 1;
      if (date) date.views += 1;
    }
    if (row.event_type === "stream_completed") summary.total_completed_streams += 1;
    if (row.event_type === "stream_incomplete") summary.total_incomplete_streams += 1;
    summary.total_watch_seconds += Number(row.watch_seconds || 0);
    if (row.event_type === "stream_started") {
      const key = `${row.content_type}:${row.content_id}`;
      const item = topMap.get(key) || { content_type: row.content_type, content_id: row.content_id, content_title: row.content_title, views: 0, watch_seconds: 0 };
      item.views += 1;
      item.watch_seconds += Number(row.watch_seconds || 0);
      topMap.set(key, item);
    }
    if (date) date.watch_seconds += Number(row.watch_seconds || 0);
  }
  for (const row of downloads.data || []) {
    if (row.status === "success") { summary.total_downloads += 1; const date = byDate.get(String(row.created_at).slice(0, 10)); if (date) date.downloads += 1; }
  }
  for (const row of events.data || []) {
    const date = byDate.get(String(row.created_at).slice(0, 10));
    if (row.event_type === "search") { summary.total_searches += 1; if (date) date.searches += 1; }
    if (row.event_type === "reelplexi_request") { summary.total_reelplexi_requests += 1; if (date) date.reelplexi_requests += 1; }
  }
  return { summary, daily, topContent: [...topMap.values()].sort((a, b) => b.views - a.views).slice(0, 20) };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = createSupabaseAdmin();
    const timeframe = request.nextUrl.searchParams.get("timeframe") || "alltime";
    const days = Math.min(365, Math.max(1, Number(request.nextUrl.searchParams.get("days") || 7)));
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));
    const startDateString = startDate.toISOString().slice(0, 10);
    const [summary, daily, topContent, providerUsage, providerStats, audience, viewerStats, downloadStats] = await Promise.all([
      db.from("admin_usage_summary_view").select("*").maybeSingle(),
      db.from("admin_daily_usage_view").select("*").gte("usage_date", startDateString).order("usage_date", { ascending: false }),
      db.from("admin_top_content_view").select("*").limit(20),
      reelplexiFetch<any>("/v1/account/usage?range=30d").catch(() => null),
      reelplexiFetch<any>("/v1/account/stats").catch(() => null),
      loadAudienceStats(db, timeframe),
      loadViewerStats(db, timeframe),
      loadDownloadStats(db, timeframe),
    ]);

    const viewsMissing = [summary.error, daily.error, topContent.error].some((error: any) => error?.code === "42P01" || /does not exist/i.test(error?.message || ""));
    const fallback = viewsMissing ? await loadFallbackAnalytics(db, days) : null;

    return NextResponse.json({
      summary: fallback?.summary || summary.data || EMPTY_SUMMARY,
      daily: fallback?.daily || daily.data || [],
      topContent: fallback?.topContent || topContent.data || [],
      audience,
      viewerStats,
      downloadStats,
      providerUsage,
      providerStats,
    });
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load analytics" }, { status });
  }
}
