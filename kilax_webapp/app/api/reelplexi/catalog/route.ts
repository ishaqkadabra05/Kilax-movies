import { NextResponse } from 'next/server'
import ReelplexiService from '@/lib/reelplexi-service'

/**
 * GET /api/reelplexi/catalog
 *
 * Returns enriched movies + series from Reelplexi only — no TMDB.
 *
 * Reelplexi list endpoints don't include description or score in
 * their paginated response. We enrich the first 30 of each type by
 * fetching the Reelplexi detail endpoint for description, genres,
 * and any available score fields (popularity, vote_average, etc.).
 */
export async function GET() {
  try {
    const [movies, series] = await Promise.all([
      ReelplexiService.getMovies(1, 36),
      ReelplexiService.getSeries(1, 36),
    ])

    const [enrichedMovies, enrichedSeries] = await Promise.all([
      enrichItems(movies,  'movie',  8),
      enrichItems(series,  'series', 8),
    ])

    return NextResponse.json({ movies: enrichedMovies, series: enrichedSeries })

  } catch (error) {
    console.warn('[catalog] Reelplexi unavailable:', error)
    return NextResponse.json({
      movies: [],
      series: [],
      unavailable: true,
      error: error instanceof Error ? error.message : 'Reelplexi request failed',
    })
  }
}

/**
 * Enrich list items with detail data from Reelplexi.
 * All metadata — description, genres, score — comes from Reelplexi only.
 */
async function enrichItems(
  items: any[],
  type: 'movie' | 'series',
  limit: number
): Promise<any[]> {
  const toEnrich = items.slice(0, limit)
  const rest     = items.slice(limit)

  // Fetch Reelplexi detail for description + score fields
  const detailResults = await Promise.allSettled(
    toEnrich.map(item =>
      type === 'movie'
        ? ReelplexiService.getMovieById(item.sourceId || item.id)
        : ReelplexiService.getSeriesById(item.sourceId || item.id)
    )
  )

  const enrichedSlice = toEnrich.map((listItem, i) => {
    const result = detailResults[i]
    const detail = result.status === 'fulfilled' ? result.value : null

    // Extract score from Reelplexi fields only
    const score = extractScore(detail) || extractScore(listItem)

    return {
      ...listItem,
      description: listItem.description || (detail as any)?.description || (detail as any)?.storyline || (detail as any)?.overview || '',
      storyline:   listItem.storyline   || (detail as any)?.storyline   || (detail as any)?.description || '',
      overview:    listItem.overview    || (detail as any)?.overview    || (detail as any)?.description || '',
      score,
      genres:      (listItem.genres?.length ? listItem.genres : (detail as any)?.genres) || [],
    }
  })

  return [...enrichedSlice, ...rest]
}

/**
 * Extract a 0–10 numeric score from a Reelplexi item.
 * Tries vote_average, imdb_rating, imdb_score, score fields first,
 * then falls back to popularity / 100 (normalised to 0–10).
 */
function extractScore(raw: any): number {
  if (!raw) return 0

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

  const direct = [
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
    typeof raw.rating === 'number' ? raw.rating : null,
    typeof raw.rating === 'string' ? raw.rating : null,
  ]
    .map(parseScoreValue)
    .find((v): v is number => v !== null)

  if (direct != null) return direct

  // Fall back: popularity normalised to 0–10
  if (raw.popularity) {
    const pop = Number(raw.popularity)
    if (pop > 0) return Math.min(10, parseFloat((pop / 100).toFixed(1)))
  }

  return 0
}
