import type { MediaItem, MediaType } from '@/lib/types/media'

/**
 * Maps a raw Reelplexi API item into the app's MediaItem shape.
 *
 * Score is NOT read from Reelplexi (they don't store one).
 * It comes from TMDB via the catalog enrichment step using tmdb_id.
 * The normalizer preserves whatever score was set by enrichItems().
 */
export function mapMediaItem(raw: any, type: MediaType, index: number): MediaItem {
  // ── Stable numeric ID from Reelplexi string ID ──────────────────────────────
  const sourceId = String(raw.id ?? '')
  let numericId = 0
  for (const ch of sourceId) {
    numericId = (numericId * 31 + ch.charCodeAt(0)) % 2_147_483_000
  }
  numericId = Math.abs(numericId) || index + 1

  // ── Year ──────────────────────────────────────────────────────────────────
  const date = raw.release_date || raw.first_air_date || raw.released_at
  const year = Number(
    raw.year || (date ? String(date).slice(0, 4) : new Date().getFullYear())
  )

  // ── Score ─────────────────────────────────────────────────────────────────
  // The catalog enrichment step sets raw.score from TMDB vote_average.
  // Accept whatever value was placed here; do not attempt to re-derive it
  // from content-classification strings like "PG-13".
  const scoreRaw = Number(raw.score ?? 0)
  const score = Number.isFinite(scoreRaw) && scoreRaw > 0
    ? parseFloat(scoreRaw.toFixed(1))
    : 0

  // ── Duration ─────────────────────────────────────────────────────────────
  const durationMins = Number(raw.duration_mins ?? raw.runtime ?? 0)
  const duration = durationMins
    ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`
    : type === 'series' ? 'Series' : 'Movie'

  // ── Description ──────────────────────────────────────────────────────────
  const description =
    raw.storyline   ||
    raw.synopsis    ||
    raw.plot        ||
    raw.description ||
    raw.overview    ||
    ''

  // ── Genres ────────────────────────────────────────────────────────────────
  const genres: string[] = Array.isArray(raw.genres)
    ? raw.genres.map(String).filter((g: string) => g.toLowerCase() !== 'musical')
    : []

  // ── Images ────────────────────────────────────────────────────────────────
  const image     = raw.poster_url   || raw.thumbnail_url  || raw.cover_image_url || ''
  const heroImage = raw.backdrop_url || raw.backdrop_path  || raw.poster_url      || raw.cover_image_url || ''

  // Content classification string — only use if it's actually a string rating
  const contentRating = typeof raw.rating === 'string' && raw.rating ? raw.rating : 'NR'

  return {
    id: numericId,
    sourceId,
    type,
    title:       raw.title     || raw.name || 'Untitled',
    year,
    rating:      contentRating,
    score,
    duration,
    genres,
    description,
    image,
    heroImage,
    seasons:     Number(raw.number_of_seasons || raw.seasons  || 1) || 1,
    episodes:    Number(raw.number_of_episodes || raw.episode_count || 0) || undefined,
    premium:     raw.premium !== false,
    isLatest:    Boolean(raw.latest    || raw.is_latest),
    isTrending:  Boolean(raw.trending  || raw.is_trending),
    embedUrl:    raw.embed_url,
    vj:          raw.vj || raw.vj_name || raw.translator,
  }
}
