import { NextRequest, NextResponse } from 'next/server'
import { ReelplexiConfig } from '@/lib/reelplexi-config'

/**
 * GET /api/reelplexi/rating?type=movie|series&id=<reelplexi_id>
 *
 * Fetches full detail from Reelplexi only — no TMDB.
 * Returns description, genres, score (from popularity/imdb fields),
 * and all metadata consumed by the hero slider, detail modal, and cards.
 */
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') || 'movie'
  const id   = req.nextUrl.searchParams.get('id')   || ''

  if (!id) {
    return NextResponse.json({ score: 0, description: '', source: 'none' }, { status: 400 })
  }

  const apiKey  = ReelplexiConfig.apiKey
  const baseUrl = ReelplexiConfig.baseUrl

  // ── Fetch Reelplexi detail ─────────────────────────────────────────────────
  let raw: Record<string, any> = {}
  try {
    const path = type === 'series' ? `/v1/series/${id}` : `/v1/movies/${id}`
    const res  = await fetch(`${baseUrl}${path}`, {
      headers: { 'X-API-Key': apiKey, Authorization: `Bearer ${apiKey}` },
      cache:   'no-store',
    })
    if (res.ok) {
      const json = await res.json()
      raw = json.data || json
    }
  } catch (err) {
    console.warn('[rating] Reelplexi fetch failed for', id, err)
  }

  // ── Score: use every Reelplexi field that might carry a numeric rating ─────
  // Reelplexi returns `popularity` (0–1000+), `vote_average` (0–10),
  // `imdb_rating`, `imdb_score`, `score`, or `rating` (numeric).
  const scoreCandidates = [
    raw.vote_average,
    raw.imdb_rating,
    raw.imdb_score,
    raw.score,
    // popularity is on a 0–1000 scale — normalise to 0–10
    raw.popularity != null ? parseFloat((Number(raw.popularity) / 100).toFixed(1)) : null,
    // raw.rating may be numeric (e.g. 7.5) or a string classification ("PG-13")
    typeof raw.rating === 'number' ? raw.rating : null,
  ]

  let score = scoreCandidates
    .map(v => Number(v))
    .find(v => Number.isFinite(v) && v > 0 && v <= 10) ?? 0

  // If still 0 and popularity is available, use capped popularity/10
  if (score === 0 && raw.popularity) {
    const pop = Number(raw.popularity)
    if (pop > 0) score = Math.min(10, parseFloat((pop / 100).toFixed(1)))
  }

  // ── Description ───────────────────────────────────────────────────────────
  const description =
    raw.storyline   ||
    raw.story_line  ||
    raw.storyLine   ||
    raw.synopsis    ||
    raw.plot        ||
    raw.summary     ||
    raw.description ||
    raw.overview    ||
    ''

  // ── Genres ────────────────────────────────────────────────────────────────
  const genres: string[] = Array.isArray(raw.genres)
    ? raw.genres.map(String).filter((g: string) => g.toLowerCase() !== 'musical')
    : []

  // Content classification string (PG-13, NR etc.)
  const contentRating = typeof raw.rating === 'string' ? raw.rating : 'NR'

  return NextResponse.json({
    score,
    description,
    overview:     description,
    storyline:    description,
    release_date: raw.release_date || raw.first_air_date || raw.released_at || null,
    genres,
    rating:       contentRating,
    poster_url:   raw.poster_url   || raw.thumbnail_url  || null,
    backdrop_url: raw.backdrop_url || raw.poster_url     || null,
    source:       score > 0 || description ? 'reelplexi' : 'none',
  })
}
