import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createUserDb } from "@/lib/supabase/user-db";

/**
 * GET /api/live-activity
 *
 * Returns:
 *  - activeNow:      users with a playback_positions row updated in the last 5 minutes
 *  - timeframes:     unique user counts for 12h, 24h, 48h (2 days), 7d (week)
 *  - hourlyBuckets:  hourly unique-user counts for the selected window (for bar chart)
 *
 * Query params:
 *  - window: "12h" | "24h" | "48h" | "7d"  (default "24h")
 *
 * Data source: user_video_activity, written by the website usage RPC.
 */

const WINDOWS = {
  "12h": 12,
  "24h": 24,
  "48h": 48,
  "7d": 168,
} as const;

type WindowKey = keyof typeof WINDOWS;

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = createUserDb();

    const windowParam = (request.nextUrl.searchParams.get("window") || "24h") as WindowKey;
    const windowHours = WINDOWS[windowParam] ?? 24;

    const now = Date.now();
    const windowStart = new Date(now - windowHours * 60 * 60 * 1000).toISOString();
    const activeNowCutoff = new Date(now - 5 * 60 * 1000).toISOString(); // 5 min

    // ── Parallel queries ────────────────────────────────────────────────────
    const [activityActive, activityWindow, allTimeframes] = await Promise.all([
      db.from("user_video_activity")
        .select("user_id")
        .in("event_type", ["stream_started", "playback_progress", "stream_completed", "stream_incomplete"])
        .gte("created_at", activeNowCutoff),

      db.from("user_video_activity")
        .select("user_id, created_at")
        .in("event_type", ["stream_started", "playback_progress", "stream_completed", "stream_incomplete"])
        .gte("created_at", windowStart)
        .order("created_at", { ascending: true }),

      // 4. Counts for all fixed timeframes
      Promise.all(
        Object.entries(WINDOWS).map(async ([key, hours]) => {
          const cutoff = hoursAgo(hours);
          const activity = await db.from("user_video_activity")
            .select("user_id")
            .in("event_type", ["stream_started", "playback_progress", "stream_completed", "stream_incomplete"])
            .gte("created_at", cutoff);
          const ids = new Set((activity.data || []).map((r: any) => String(r.user_id)));
          return { window: key, count: ids.size };
        })
      ),
    ]);

    // ── Active now (deduplicated) ───────────────────────────────────────────
    if (activityActive.error || activityWindow.error) throw new Error(activityActive.error?.message || activityWindow.error?.message || "Usage activity is unavailable");
    const activeNowIds = new Set((activityActive.data || []).map((r: any) => String(r.user_id)));

    // ── Merge window data from both sources ────────────────────────────────
    interface Activity { user_id: string; ts: number }
    const windowActivities: Activity[] = [
      ...((activityWindow.data || []).map((r: any) => ({
        user_id: String(r.user_id),
        ts: new Date(r.created_at).getTime(),
      }))),
    ];

    // ── Build hourly buckets ────────────────────────────────────────────────
    const bucketCount = Math.min(windowHours, 48); // cap at 48 bars for readability
    const bucketSizeMs = (windowHours * 60 * 60 * 1000) / bucketCount;

    const buckets: { label: string; users: Set<string> }[] = Array.from(
      { length: bucketCount },
      (_, i) => {
        const bucketStart = new Date(now - (bucketCount - i) * bucketSizeMs);
        // Label: "HH:mm" for <48h windows, "Day HH:mm" for week
        let label: string;
        if (windowHours <= 48) {
          label = bucketStart.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        } else {
          label = bucketStart.toLocaleDateString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });
        }
        return { label, users: new Set<string>() };
      }
    );

    for (const { user_id, ts } of windowActivities) {
      const bucketIndex = Math.floor((ts - (now - windowHours * 60 * 60 * 1000)) / bucketSizeMs);
      if (bucketIndex >= 0 && bucketIndex < bucketCount) {
        buckets[bucketIndex].users.add(user_id);
      }
    }

    const hourlyBuckets = buckets.map(b => ({
      label: b.label,
      count: b.users.size,
    }));

    // ── Unique users in window (merged) ────────────────────────────────────
    const windowUniqueIds = new Set(windowActivities.map(a => a.user_id));

    return NextResponse.json({
      activeNow: activeNowIds.size,
      windowUsers: windowUniqueIds.size,
      selectedWindow: windowParam,
      timeframes: allTimeframes,
      hourlyBuckets,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load live activity" },
      { status }
    );
  }
}
