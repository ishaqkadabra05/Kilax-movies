import { NextRequest, NextResponse } from 'next/server'
import { ReelplexiConfig } from '@/lib/reelplexi-config'

/**
 * GET /api/reelplexi/debug?id=<movie_id>&type=movie|series
 *
 * Returns the RAW Reelplexi API response for a single item so you can
 * see exactly which fields contain the score/rating.
 *
 * Only available in development. Remove or restrict in production.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const id   = req.nextUrl.searchParams.get('id')   || ''
  const type = req.nextUrl.searchParams.get('type') || 'movie'

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const apiKey  = ReelplexiConfig.apiKey
  const baseUrl = ReelplexiConfig.baseUrl
  const path    = type === 'series' ? `/v1/series/${id}` : `/v1/movies/${id}`

  try {
    const res  = await fetch(`${baseUrl}${path}`, {
      headers: { 'X-API-Key': apiKey, Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    const raw  = await res.json()

    // Highlight the score-related fields so they're easy to find
    const data = raw.data || raw
    const scoreFields: Record<string, any> = {}
    for (const key of Object.keys(data)) {
      const lower = key.toLowerCase()
      if (
        lower.includes('score') || lower.includes('rating') ||
        lower.includes('imdb')  || lower.includes('vote')   ||
        lower.includes('average') || lower.includes('popularity')
      ) {
        scoreFields[key] = data[key]
      }
    }

    return NextResponse.json({
      _score_related_fields: scoreFields,
      _full_response:        raw,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
