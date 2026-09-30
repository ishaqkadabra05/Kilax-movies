import { NextRequest, NextResponse } from 'next/server'
import ReelplexiService from '@/lib/reelplexi-service'

const playbackFields = new Set(['embed_url', 'stream_url', 'video_url', 'playback_url'])

function stripPlaybackUrls(value: any): any {
  if (Array.isArray(value)) return value.map(stripPlaybackUrls)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !playbackFields.has(key.toLowerCase()))
    .map(([key, item]) => [key, stripPlaybackUrls(item)]))
}

export async function GET(request: NextRequest) {
  try {
    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 100)))
    const data = await ReelplexiService.getSeries(page, limit)
    return NextResponse.json(stripPlaybackUrls({ data, pagination: { page, limit, hasMore: data.length === limit } }), { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nontranslated series request failed' },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }
}