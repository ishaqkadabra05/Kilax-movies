import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MediaItem, MediaType } from '@/lib/types/media'
import { mapMediaItem } from '@/lib/media-normalizer'

interface CatalogCollectionOptions {
  type: MediaType
  endpoint: string
  initialVjs?: string[]
  getCatalog: () => MediaItem[]
  initialGenre?: string
  initialFilter?: 'all' | 'latest'
}

export function useCatalogCollection({ type, endpoint, initialVjs = [], getCatalog, initialGenre = 'All', initialFilter = 'all' }: CatalogCollectionOptions) {
  const [genre, setGenre] = useState(initialGenre)
  const [filter, setFilter] = useState<'all' | 'latest'>(initialFilter)
  const [vj, setVj] = useState('All VJs')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(type === 'movie' ? 'score' : 'title')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [version, setVersion] = useState(0)
  const [vjOptions, setVjOptions] = useState(initialVjs)
  const sentinel = useRef<HTMLDivElement>(null)

  const list = useMemo(() => getCatalog().filter(item => item.type === type), [type, version, getCatalog])
  const genres = useMemo(() => [
    'All',
    ...Array.from(new Set(list.flatMap(item => item.genres)))
      .filter(genreName => genreName.toLowerCase() !== 'musical')
      .sort(),
  ], [list])
  const filtered = useMemo(() => list
    .filter(item => filter !== 'latest' || item.isLatest)
    .filter(item => genre === 'All' || item.genres.some(value => value.toLowerCase() === genre.toLowerCase()))
    .filter(item => vj === 'All VJs' || (item.vj || '') === vj)
    .filter(item => !search.trim() || item.title.toLowerCase().includes(search.toLowerCase()))
    .sort((left, right) => sort === 'score' ? right.score - left.score : sort === 'year' ? right.year - left.year : left.title.localeCompare(right.title)),
  [list, filter, genre, vj, search, sort])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const response = await fetch(`${endpoint}?page=${page + 1}&limit=24`, { cache: 'no-store' })
      const payload = await response.json()
      const rows = Array.isArray(payload.data) ? payload.data : []
      const catalog = getCatalog()
      for (const row of rows) {
        const item = mapMediaItem(row, type, catalog.length)
        if (!catalog.some(existing => existing.sourceId === item.sourceId)) catalog.push(item)
      }
      setPage(current => current + 1)
      setHasMore(!!payload.pagination?.hasMore)
      setVersion(current => current + 1)
    } catch {
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [endpoint, getCatalog, hasMore, loading, page, type])

  useEffect(() => {
    const element = sentinel.current
    if (!element) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) void loadMore()
    }, { rootMargin: '700px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [loadMore])

  useEffect(() => {
    if ((genre !== 'All' || vj !== 'All VJs' || search.trim()) && !loading && hasMore && filtered.length < 12) void loadMore()
  }, [filtered.length, genre, hasMore, loadMore, loading, search, vj])

  useEffect(() => {
    fetch(`/api/reelplexi/vjs${type === 'series' ? '?type=series' : ''}`, { cache: 'force-cache' })
      .then(response => response.json())
      .then(payload => {
        const names = (payload.data || []).map((item: any) => item.name).filter(Boolean)
        if (names.length) setVjOptions(names)
      })
      .catch(() => undefined)
  }, [type])

  const clearFilters = () => { setFilter('all'); setGenre('All'); setVj('All VJs'); setSearch(''); setSort(type === 'movie' ? 'score' : 'title') }
  return { filter, setFilter, genre, setGenre, vj, setVj, search, setSearch, sort, setSort, genres, filtered, loading, hasMore, vjOptions, sentinel, clearFilters }
}
