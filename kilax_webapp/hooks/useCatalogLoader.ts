import { useEffect, useRef, useState } from 'react'
import type { MediaItem } from '@/lib/types/media'
import { mapMediaItem } from '@/lib/media-normalizer'

interface CatalogState {
  catalog: MediaItem[]
  ready: boolean
  error: string | null
}

/**
 * Fetches the full catalog from Reelplexi.
 *
 * The `fallbackCatalog` parameter is kept for API compatibility but is only
 * used when Reelplexi is completely unreachable — it should be an empty array
 * in production so no fake/TMDB-sourced cards ever appear.
 *
 * The localhost bypass has been removed: Reelplexi is always the data source
 * so local development shows the same real content as production.
 */
export function useCatalogLoader(_fallbackCatalog: MediaItem[]): CatalogState {
  const lastCatalogKey = useRef<string | null>(null)
  const [state, setState] = useState<CatalogState>({
    catalog: [],
    ready:   false,
    error:   null,
  })

  useEffect(() => {
    let cancelled = false
    let loading = false

    const loadCatalog = async () => {
      if (loading) return
      loading = true

      try {
        const response = await fetch('/api/reelplexi/catalog', { cache: 'no-store' })
        const payload = await response.json()

        if (!response.ok || payload.unavailable) {
          throw new Error(payload.error || 'Reelplexi catalog unavailable')
        }

        const baseItems = [
          ...(payload.movies || []).map((item: any, index: number) => ({
            ...mapMediaItem(item, 'movie', index),
            isLatest: Boolean(item.latest || item.is_latest || index < 12),
          })),
          ...(payload.series || []).map((item: any, index: number) => ({
            ...mapMediaItem(item, 'series', index + (payload.movies || []).length),
            isLatest: Boolean(item.latest || item.is_latest || index < 12),
          })),
        ]

        const catalogKey = JSON.stringify(baseItems.map(item => [
          item.type,
          item.sourceId,
          item.title,
          item.image,
          item.description,
          item.year,
        ]))

        if (!cancelled && catalogKey !== lastCatalogKey.current) {
          lastCatalogKey.current = catalogKey
          setState({ catalog: baseItems, ready: true, error: null })
        }
      } catch (error) {
        console.warn('[useCatalogLoader] Reelplexi catalog unavailable:', error)
        if (!cancelled) {
          setState(current => current.catalog.length
            ? current
            : { catalog: [], ready: true, error: error instanceof Error ? error.message : 'Catalog unavailable' })
        }
      } finally {
        loading = false
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadCatalog()
    }

    void loadCatalog()
    const interval = window.setInterval(refreshWhenVisible, 60_000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, []) // refresh is triggered on mount, focus, visibility, and interval

  return state
}
