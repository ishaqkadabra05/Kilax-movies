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
  // Reelplexi can return numeric values or numeric strings such as "8.7" or "8.7/10".
  const parseScoreValue = (value: any): number | null => {
    if (value === null || value === undefined || value === '') return null

    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value > 0 && value <= 10) return Number(value.toFixed(1))
      if (value > 10 && value <= 100) return Number((value / 10).toFixed(1))
      return null
    }

    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'nr') return null

      const normalized = trimmed.replace(/\s+/g, '')
      const isRatingLikeString = /^\d+(?:\.\d+)?(?:\/10|\/100|%)?$/.test(normalized)
      if (!isRatingLikeString) return null

      const numeric = Number(normalized.replace(/%$/, '').replace(/\/10$/, '').replace(/\/100$/, ''))
      if (!Number.isFinite(numeric) || numeric <= 0) return null

      if (numeric <= 10) return Number(numeric.toFixed(1))
      if (numeric <= 100) return Number((numeric / 10).toFixed(1))
      return null
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const parsed = parseScoreValue(item)
        if (parsed !== null) return parsed
      }
      return null
    }

    if (typeof value === 'object') {
      const nestedKeys = ['value', 'score', 'rating', 'average', 'avg', 'imdb', 'tmdb']
      for (const key of nestedKeys) {
        const parsed = parseScoreValue((value as Record<string, any>)[key])
        if (parsed !== null) return parsed
      }

      for (const item of Object.values(value as Record<string, any>)) {
        const parsed = parseScoreValue(item)
        if (parsed !== null) return parsed
      }
    }

    return null
  }

  const scoreCandidates = [
    raw.vote_average,
    raw.imdb_rating,
    raw.imdb_score,
    raw.score,
    raw.average_rating,
    raw.audience_score,
    raw.critics_score,
    raw.ratings?.imdb,
    raw.ratings?.tmdb,
    raw.ratings?.average,
    raw.ratings?.score,
    raw.ratings?.value,
    raw.popularity != null ? raw.popularity : null,
    typeof raw.rating === 'number' ? raw.rating : null,
    typeof raw.rating === 'string' ? raw.rating : null,
  ]

  let score = scoreCandidates
    .map(parseScoreValue)
    .find((v): v is number => v !== null) ?? 0

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
