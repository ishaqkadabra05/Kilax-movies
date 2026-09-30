import { NextRequest, NextResponse } from 'next/server'
import ReelplexiService from '@/lib/reelplexi-service'
import { requireStandardAccess } from '@/lib/require-standard-access'

const playbackFields = new Set(['stream_url', 'embed_url', 'video_url', 'playback_url'])

function stripPlaybackUrls(value: any): any {
  if (Array.isArray(value)) return value.map(stripPlaybackUrls)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !playbackFields.has(key.toLowerCase()))
    .map(([key, item]) => [key, stripPlaybackUrls(item)]))
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const playback = params.get('playback') === 'true'
    if (playback) {
      const access = await requireStandardAccess(request)
      if (!access.allowed) return access.response
    }

    const id = params.get('id')
    if (id) {
      const result = params.get('downloads') === 'true'
        ? await ReelplexiService.getEnglishMovieDownloads(id)
        : await ReelplexiService.getEnglishMovieDetails(id, params.get('include_downloads') === 'true')
      return NextResponse.json(playback ? result : stripPlaybackUrls(result), { headers: { 'Cache-Control': 'private, no-store' } })
    }

    const endpoint = params.get('endpoint') || 'popular'
    const query: Record<string, string> = {}
    for (const key of ['q', 'page', 'per_page', 'time_window']) {
      const value = params.get(key)
      if (value) query[key] = value
    }
    const payload = await ReelplexiService.getEnglishMovies(endpoint, query)
    return NextResponse.json(stripPlaybackUrls(payload), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[english-movies] Reelplexi request failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'English movies request failed' }, { status: 502 })
  }
}