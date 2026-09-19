import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { reelplexiFetch } from "@/lib/reelplexi";

/**
 * Fetches Reelplexi client analytics:
 *   GET /v1/account/analytics/top-movies
 *   GET /v1/account/analytics/top-series
 *
 * Accepts ?timeframe=alltime|month|week|day
 *
 * Reelplexi analytics endpoints support limit.
 * They do not expose date-range filtering, so the selected timeframe
 * controls the displayed result size,
 * then annotate the response with the requested period.
 */

type Timeframe = "alltime" | "month" | "week" | "day";

function perPageForTimeframe(tf: Timeframe): number {
  if (tf === "day") return 10;
  return 20;
}

function labelForTimeframe(tf: Timeframe): string {
  if (tf === "day") return "Today";
  if (tf === "week") return "Last 7 days";
  if (tf === "month") return "This month";
  return "All time";
}

function normalizeItems(items: any[], type: "movie" | "series") {
  return (items || []).map((x: any) => ({
    id: x.id,
    title: x.title || "Unknown",
    vj: x.vj || "—",
    genres: x.genres || [],
    poster_url: x.poster_url || x.backdrop_url || "",
    type,
    views: Number(x.view_count ?? 0),
  }));
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const tf = (request.nextUrl.searchParams.get("timeframe") || "alltime") as Timeframe;
    const perPage = perPageForTimeframe(tf);

    const [moviesRes, seriesRes] = await Promise.allSettled([
      reelplexiFetch<any>(`/v1/account/analytics/top-movies?limit=${perPage}`),
      reelplexiFetch<any>(`/v1/account/analytics/top-series?limit=${perPage}`),
    ]);

    const moviePayload = moviesRes.status === "fulfilled" ? moviesRes.value?.data ?? moviesRes.value : [];
    const seriesPayload = seriesRes.status === "fulfilled" ? seriesRes.value?.data ?? seriesRes.value : [];
    const topMovies = moviesRes.status === "fulfilled"
      ? normalizeItems(Array.isArray(moviePayload) ? moviePayload : [], "movie")
      : [];

    const topSeries = seriesRes.status === "fulfilled"
      ? normalizeItems(Array.isArray(seriesPayload) ? seriesPayload : [], "series")
      : [];

    // Combined list sorted by views desc
    const topViews = [...topMovies, ...topSeries]
      .sort((a, b) => b.views - a.views)
      .slice(0, perPage);

    const totalMovieViews = topMovies.reduce((s, m) => s + m.views, 0);
    const totalSeriesViews = topSeries.reduce((s, m) => s + m.views, 0);
    const totalViews = totalMovieViews + totalSeriesViews;

    const errors: string[] = [];
    if (moviesRes.status === "rejected") {
      errors.push(`Movies: ${moviesRes.reason instanceof Error ? moviesRes.reason.message : String(moviesRes.reason)}`);
    }
    if (seriesRes.status === "rejected") {
      errors.push(`Series: ${seriesRes.reason instanceof Error ? seriesRes.reason.message : String(seriesRes.reason)}`);
    }

    if (topMovies.length === 0 && topSeries.length === 0 && errors.length === 2) {
      return NextResponse.json(
        { error: `Reelplexi analytics unavailable. ${errors.join(" | ")}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      timeframe: tf,
      timeframeLabel: labelForTimeframe(tf),
      totalViews,
      totalMovieViews,
      totalSeriesViews,
      topViewsCount: topViews.length,
      topViews,
      topMovies,
      topSeries,
      source: "Reelplexi account analytics API",
      endpoints: ["/v1/account/analytics/top-movies", "/v1/account/analytics/top-series"],
      partialErrors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load Reelplexi analytics" },
      { status }
    );
  }
}
