import { NextResponse } from 'next/server'
import ReelplexiService from '@/lib/reelplexi-service'

export async function GET(request: Request) {
  try {
    const type = new URL(request.url).searchParams.get('type')
    const pages = Array.from({ length: 5 }, (_, i) => i + 1)
    const allContent = type === 'series'
      ? (await Promise.all(pages.map(page => ReelplexiService.getSeries(page, 100)))).flat()
      : type === 'movie'
        ? (await Promise.all(pages.map(page => ReelplexiService.getMovies(page, 100)))).flat()
        : (await Promise.all([
            Promise.all(pages.map(page => ReelplexiService.getMovies(page, 100))),
            Promise.all(pages.map(page => ReelplexiService.getSeries(page, 100))),
          ])).flat(2)
    const vjsMap = new Map<string, { id: string; name: string }>()
    allContent.forEach((item: any) => {
      const names = [
        item.vjs?.name,
        item.vj_name,
        item.vj,
        item.translator,
        ...(Array.isArray(item.available_vj_versions)
          ? item.available_vj_versions.map((version: any) => version?.vj_name || version?.name)
          : []),
      ]
      names.forEach((name: unknown) => {
        if (typeof name !== 'string' || !name.trim()) return
        const clean = name.trim()
        const id = clean.toLowerCase().replace(/\s+/g, '-')
        if (!vjsMap.has(id)) vjsMap.set(id, { id, name: clean })
      })
    })
    const data = Array.from(vjsMap.values()).sort((a,b) => a.name.localeCompare(b.name))
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
  } catch (error) {
    console.error('Error fetching VJs:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch VJs', data: [] }, { status: 500 })
  }
}
