import type { MediaItem, MediaType } from '@/lib/types/media'

function parseScoreValue(value: any): number | null {
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
    const nestedKeys = ['value', 'score', 'rating', 'average', 'avg', 'imdb', 'tmdb', 'votes']
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

/**
 * Maps a raw Reelplexi API item into the app's MediaItem shape.
 *
 * Score is preserved from Reelplexi when available, even if it arrives as a
 * numeric string or nested rating object like { ratings: { imdb: '8.7' } }.
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
  // Accept real Reelplexi numbers and numeric strings such as "8.7", "8.7/10",
  // "87%", and nested rating objects instead of falling back to zero.
  const scoreCandidates = [
    raw.score,
    raw.vote_average,
    raw.imdb_rating,
    raw.imdb_score,
    raw.average_rating,
    raw.audience_score,
    raw.critics_score,
    raw.rating,
    raw.ratings?.imdb,
    raw.ratings?.tmdb,
    raw.ratings?.average,
    raw.ratings?.score,
    raw.ratings?.value,
  ]
  const score = scoreCandidates
    .map(parseScoreValue)
    .find((value): value is number => value !== null) ?? 0

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
