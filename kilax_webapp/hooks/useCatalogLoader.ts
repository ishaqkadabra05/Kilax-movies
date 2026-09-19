import { useEffect, useState } from 'react'
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
  const [state, setState] = useState<CatalogState>({
    catalog: [],
    ready:   false,
    error:   null,
  })

  useEffect(() => {
    let cancelled = false

    fetch('/api/reelplexi/catalog', { cache: 'force-cache' })
      .then(async response => {
        const payload = await response.json()

        if (!response.ok || payload.unavailable) {
          throw new Error(payload.error || 'Reelplexi catalog unavailable')
        }

        const movies = (payload.movies || []).map((item: any, index: number) =>
          ({
            ...mapMediaItem(item, 'movie', index),
            isLatest: Boolean(item.latest || item.is_latest || index < 12),
          })
        )
        const series = (payload.series || []).map((item: any, index: number) =>
          ({
            ...mapMediaItem(item, 'series', index + movies.length),
            isLatest: Boolean(item.latest || item.is_latest || index < 12),
          })
        )

        if (!cancelled) {
          setState({ catalog: [...movies, ...series], ready: true, error: null })
        }
      })
      .catch(error => {
        console.warn('[useCatalogLoader] Reelplexi catalog unavailable:', error)
        // Show an empty catalog — never fall back to TMDB/hardcoded data
        if (!cancelled) {
          setState({ catalog: [], ready: true, error: error instanceof Error ? error.message : 'Catalog unavailable' })
        }
      })

    return () => { cancelled = true }
  }, []) // intentionally empty — catalog is fetched once on mount

  return state
}
