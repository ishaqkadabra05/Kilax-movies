import { NextRequest, NextResponse } from 'next/server'
import ReelplexiService from '@/lib/reelplexi-service'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const season = Number(request.nextUrl.searchParams.get('season') || '1')
    const episodes = await ReelplexiService.getSeriesEpisodes(id, season)
    return NextResponse.json({ episodes }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Episode request failed' }, { status: 502 })
  }
}
