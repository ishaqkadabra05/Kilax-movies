import { NextRequest, NextResponse } from 'next/server'
import ReelplexiService from '@/lib/reelplexi-service'

export async function GET(request: NextRequest) {
  const genreName = (request.nextUrl.searchParams.get('genre') || '').trim()
  const type = request.nextUrl.searchParams.get('type') || 'all'
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 50)))
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1))
  if (!genreName) return NextResponse.json({ success: false, data: [] }, { status: 400 })

  try {
    const genres = await ReelplexiService.getGenres()
    const match = genres.find(g => g.name.toLowerCase() === genreName.toLowerCase()) || genres.find(g => g.name.toLowerCase().includes(genreName.toLowerCase()))
    if (!match) return NextResponse.json({ success: true, data: [] }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } })
    const [movies, series] = await Promise.all([
      type === 'series' ? Promise.resolve([]) : ReelplexiService.getMoviesByGenre(match.id, page, limit),
      type === 'movie' ? Promise.resolve([]) : ReelplexiService.getSeriesByGenre(match.id, page, limit),
    ])
    const data = [
      ...movies.slice(0, limit).map(item => ({ ...item, type: 'movie' as const, created_at: item.release_date || new Date().toISOString(), published: true })),
      ...series.slice(0, limit).map(item => ({ ...item, type: 'series' as const, created_at: item.first_air_date || new Date().toISOString(), published: true })),
    ]
    return NextResponse.json({ success: true, data, pagination: { page, limit, hasMore: data.length >= limit } }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } })
  } catch (error) {
    console.error('Error fetching Reelplexi genre:', error)
    return NextResponse.json({ success: false, data: [], error: 'Failed to fetch genre' }, { status: 502 })
  }
}
