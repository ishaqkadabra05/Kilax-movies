import { NextRequest, NextResponse } from 'next/server'
import ReelplexiService from '@/lib/reelplexi-service'

const endpoints = new Set(['categories', 'channels', 'events/live', 'search'])
const playbackFields = new Set(['embed_url', 'stream_url', 'video_url', 'playback_url'])

function stripPlaybackUrls(value: any): any {
  if (Array.isArray(value)) return value.map(stripPlaybackUrls)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !playbackFields.has(key.toLowerCase()))
    .map(([key, item]) => [key, stripPlaybackUrls(item)]))
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const endpoint = params.get('endpoint') || 'channels'
  if (!endpoints.has(endpoint)) return NextResponse.json({ error: 'Unsupported sports endpoint' }, { status: 400 })

  const query: Record<string, string> = {}
  for (const key of ['page', 'per_page', 'category', 'q']) {
    const value = params.get(key)
    if (value) query[key] = value
  }

  try {
    const payload = await ReelplexiService.getSportsData(endpoint as 'categories' | 'channels' | 'events/live' | 'search', query)
    return NextResponse.json(stripPlaybackUrls(payload), { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
  } catch (error) {
    console.error('[sports] Reelplexi request failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Sports request failed' }, { status: 502 })
  }
}