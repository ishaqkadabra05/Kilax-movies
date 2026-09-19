import { NextResponse } from 'next/server'
import ReelplexiService from '@/lib/reelplexi-service'
import type { ReelplexiSeries } from '@/lib/reelplexi-service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'movies' // 'movies' or 'series'
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)))
    
    if (!query.trim()) {
      return NextResponse.json({ success: true, data: [] })
    }

    let results: any[] = []
    if (type === 'all') {
      const all = await ReelplexiService.searchAll(query, page, perPage)
      results = all.map(item => ({ ...item, type: (item as any).first_air_date || (item as any).seasons != null ? 'series' : 'movie', created_at: (item as any).first_air_date || (item as any).release_date || new Date().toISOString(), published:true }))
    } else if (type === 'series') {
      const seriesResults = await ReelplexiService.searchSeries(query, page, perPage)
      results = seriesResults.map(item => ({ ...item, created_at: item.first_air_date || new Date().toISOString(), published:true }))
    } else {
      const movieResults = await ReelplexiService.searchMovies(query, page, perPage)
      results = movieResults.map(item => ({ ...item, created_at: item.release_date || new Date().toISOString(), published:true }))
    }

    const genres = await ReelplexiService.getGenres()
    const matchingGenre = genres.find((genre) => genre.name.toLowerCase() === query.trim().toLowerCase())
      || genres.find((genre) => genre.name.toLowerCase().includes(query.trim().toLowerCase()))
    if (matchingGenre) {
      const [genreMovies, genreSeries] = await Promise.all([
        type === 'series' ? Promise.resolve([]) : ReelplexiService.getMoviesByGenre(matchingGenre.id, page, perPage),
        type === 'movies' ? Promise.resolve([]) : ReelplexiService.getSeriesByGenre(matchingGenre.id, page, perPage),
      ])
      results = [
        ...results,
        ...genreMovies.map(item => ({ ...item, type: 'movie', created_at: item.release_date || new Date().toISOString(), published: true })),
        ...genreSeries.map(item => ({ ...item, type: 'series', created_at: item.first_air_date || new Date().toISOString(), published: true })),
      ]
    }

    results = results.filter((item, index, all) => all.findIndex(candidate => `${candidate.type || 'movie'}-${candidate.id}` === `${item.type || 'movie'}-${item.id}`) === index)

    return NextResponse.json({ success: true, data: results, pagination: { page, limit: perPage, hasMore: results.length >= perPage } })
  } catch (error) {
    console.error('Error searching:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to search' },
      { status: 500 }
    )
  }
}
