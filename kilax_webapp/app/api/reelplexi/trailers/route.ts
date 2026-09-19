import { NextRequest, NextResponse } from 'next/server'
import ReelplexiService from '@/lib/reelplexi-service'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  const type = request.nextUrl.searchParams.get('type') === 'series' ? 'series' : 'movie'
  if (!id) return NextResponse.json({ trailers: [] }, { status: 400 })

  const trailers = await ReelplexiService.getTrailers(id, type)
  return NextResponse.json(
    { trailers },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  )
}