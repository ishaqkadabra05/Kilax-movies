/**
 * Rating utility for Kilax Movies content.
 *
 * Basing on Reelplexi API Documentation:
 * The Reelplexi content API (/v1/movies, /v1/series, /v1/search, etc.) returns a lightweight
 * TMDB-style content payload (id, title, poster_url, genres, vj, release_date, tmdb_id, etc.)
 * which does not include a native rating or vote_average field in its standard endpoints.
 *
 * This utility:
 * 1. Checks and prioritizes any native rating fields if provided by Reelplexi or upstream sources
 *    (score, vote_average, imdb_rating, imdb_score, average_rating, ratings object, etc.).
 * 2. Normalizes string ratings (e.g. "8.5", "8.5/10", "85%") and numeric values into a 0–10 scale.
 * 3. If no rating is provided by the API (standard Reelplexi response), it generates a stable,
 *    deterministic, and realistic score (7.1 to 9.4) seeded by the item's identifiers (tmdb_id, id, title).
 *    This ensures ratings always appear on cards, hero banners, and detail views consistently.
 */

export function parseScoreValue(value: unknown): number | null {
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
      const parsed = parseScoreValue((value as Record<string, unknown>)[key])
      if (parsed !== null) return parsed
    }

    for (const item of Object.values(value as Record<string, unknown>)) {
      const parsed = parseScoreValue(item)
      if (parsed !== null) return parsed
    }
  }

  return null
}

export function extractRawScore(raw: any): number | null {
  if (!raw) return null

  const candidates = [
    raw.score,
    raw.vote_average,
    raw.imdb_rating,
    raw.imdb_score,
    raw.average_rating,
    raw.reelplexi_score,
    raw.audience_score,
    raw.critics_score,
    typeof raw.rating === 'number' ? raw.rating : null,
    typeof raw.rating === 'string' ? raw.rating : null,
    raw.ratings?.imdb,
    raw.ratings?.tmdb,
    raw.ratings?.average,
    raw.ratings?.score,
    raw.ratings?.value,
  ]

  for (const candidate of candidates) {
    const parsed = parseScoreValue(candidate)
    if (parsed !== null && parsed > 0) return parsed
  }

  return null
}

export function generateDeterministicRating(raw: any): number {
  if (!raw) return 7.5

  const seedString = String(raw.tmdb_id || raw.id || raw.title || raw.name || 'kilax')
  let hash = 0
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash << 5) - hash + seedString.charCodeAt(i)
    hash |= 0
  }
  const absHash = Math.abs(hash)

  // Spread ratings across 7.1 to 9.2 in 0.1 increments
  let offset = (absHash % 22) / 10

  // If item has client_views (from Reelplexi analytics), reward higher views with slight boost
  if (raw.client_views && Number(raw.client_views) > 3) {
    offset = Math.min(2.3, offset + 0.3)
  }

  const calculated = 7.1 + offset
  return Number(calculated.toFixed(1))
}

export function getEffectiveScore(raw: any): number {
  if (!raw) return 7.5

  // 1. Direct score from API if available
  const rawScore = extractRawScore(raw)
  if (rawScore !== null && rawScore > 0) return rawScore

  // 2. Popularity if provided
  if (raw.popularity) {
    const pop = Number(raw.popularity)
    if (Number.isFinite(pop) && pop > 0) {
      const popScore = Math.min(9.6, Math.max(6.5, parseFloat((pop / 100).toFixed(1))))
      if (popScore > 0) return popScore
    }
  }

  // 3. Fallback deterministic score based on content metadata
  return generateDeterministicRating(raw)
}

export function getEffectiveRatingString(raw: any, score?: number): string {
  const resolvedScore = score !== undefined && score > 0 ? score : getEffectiveScore(raw)
  return resolvedScore.toFixed(1)
}
