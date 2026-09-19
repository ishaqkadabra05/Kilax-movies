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
      ReelplexiService.getMovies(1, 50),
      ReelplexiService.getSeries(1, 50),
    ])

    const [enrichedMovies, enrichedSeries] = await Promise.all([
      enrichItems(movies,  'movie',  30),
      enrichItems(series,  'series', 30),
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

  const direct = [
    raw.vote_average,
    raw.imdb_rating,
    raw.imdb_score,
    raw.score,
    typeof raw.rating === 'number' ? raw.rating : null,
  ]
    .map(v => Number(v))
    .find(v => Number.isFinite(v) && v > 0 && v <= 10)

  if (direct != null) return parseFloat(direct.toFixed(1))

  // Fall back: popularity normalised to 0–10
  if (raw.popularity) {
    const pop = Number(raw.popularity)
    if (pop > 0) return Math.min(10, parseFloat((pop / 100).toFixed(1)))
  }

  return 0
}
