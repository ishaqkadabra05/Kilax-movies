import { ReelplexiConfig } from './reelplexi-config'
import { cache } from './cache'
import { supabaseAdmin } from './supabase'

// TTL constants (seconds)
const TTL_LIST    = 300   // 5 min  — paginated lists
const TTL_DETAIL  = 600   // 10 min — single-item detail
const TTL_GENRE   = 600   // 10 min — genre catalogue
const TTL_SEARCH  = 60    // 1 min  — search (more dynamic)
const TTL_TREND   = 120   // 2 min  — trending rows

export interface ReelplexiMovie {
  id: string
  type?: 'movie' | 'series'
  title: string
  name?: string
  overview?: string
  description?: string
  storyline?: string
  score?: number
  vote_average?: number
  popularity?: number
  rating?: number | string
  imdb_rating?: number
  imdb_score?: number
  release_date?: string
  released_at?: string
  year?: number
  poster_url?: string
  poster_path?: string
  thumbnail_url?: string
  backdrop_url?: string
  backdrop_path?: string
  cover_image_url?: string
  embed_url?: string
  stream_url?: string
  proxy_url?: string
  video_url?: string
  genres?: string[]
  genre_ids?: string[]
  vj_name?: string
  vj?: string
  translator?: string
  vjs?: { name: string }
  available_vj_versions?: Array<{ vj_name?: string; name?: string }>
  published?: boolean
}

export interface ReelplexiSeries extends ReelplexiMovie {
  first_air_date?: string
  number_of_seasons?: number
  seasons?: number
}

export interface ReelplexiEpisode {
  id: string
  series_id?: string
  season_number: number
  episode_number: number
  title?: string
  name?: string
  overview?: string
  description?: string
  thumbnail_url?: string
  poster_url?: string
  poster_path?: string
  backdrop_url?: string
  backdrop_path?: string
  cover_image_url?: string
  video_url?: string
  stream_url?: string
  proxy_url?: string
  embed_url?: string
  published?: boolean
}

export interface ReelplexiPlaylist {
  id: string | number
  name?: string
  title?: string
  description?: string
  poster_url?: string
  cover_url?: string
  items?: any[]
  movies?: any[]
  series?: any[]
  content?: any[]
}

export interface ReelplexiTrailer {
  key: string
  site?: string
  type?: string
  name?: string
}

export interface ReelplexiUsage {
  total_requests: number
  requests_by_endpoint: Record<string, number>
  range: string
  period_start: string
  period_end: string
}

export interface ReelplexiTopContent {
  id: string | number
  title: string
  poster_url?: string
  view_count: number
  genres?: string[]
}

class ReelplexiService {
  private static async getJson(
    path: string,
    query?: Record<string, string>
  ): Promise<any> {
    if (!ReelplexiConfig.isConfigured) {
      throw new Error('Reelplexi API key is missing')
    }

    const apiKey = ReelplexiConfig.apiKey
    const url = new URL(`${ReelplexiConfig.baseUrl}${path}`)
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
    }

    const startedAt = Date.now()
    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    })

    const rawText = await response.text()

    void (supabaseAdmin as any).from('analytics_events').insert({
      event_type: path.includes('/search') ? 'search' : 'reelplexi_request',
      query_text: query?.q || null,
      endpoint: path,
      method: 'GET',
      status_code: response.status,
      response_time_ms: Date.now() - startedAt,
      metadata: query || {},
    }).then(() => undefined).catch(() => undefined)


    if (!response.ok) {
      let message = 'Unknown API error'
      try {
        const body = JSON.parse(rawText)
        // Check all common Reelplexi error fields
        if (body.detail) {
          message = typeof body.detail === 'string'
            ? body.detail
            : (body.detail?.error?.message || JSON.stringify(body.detail))
        } else if (body.error) {
          message = typeof body.error === 'object' ? (body.error.message || JSON.stringify(body.error)) : body.error
        } else if (body.message) {
          message = body.message
        } else {
          // Fall back to the full body so nothing is hidden
          message = rawText.substring(0, 300)
        }
      } catch {
        message = rawText.substring(0, 300) || message
      }
      throw new Error(`Reelplexi API error (${response.status}): ${message}`)
    }

    try {
      return JSON.parse(rawText)
    } catch {
      throw new Error(`Reelplexi response is not JSON: ${rawText.substring(0, 200)}`)
    }
  }

  private static normalizeMovie(raw: any): ReelplexiMovie {
    const genres = Array.isArray(raw.genres) ? raw.genres.filter((g: any) => g?.toString().trim()) : []
    const vjName = this.extractVjName(raw)
    const posterUrl = raw.poster_url
    const backdropUrl = raw.backdrop_url || posterUrl

    // Build embed URL: always ensure the API key is appended, whether from the API or constructed
    const buildEmbedUrl = (base: string | undefined, id: string | undefined): string | undefined => {
      const baseUrl = base || (id ? `${ReelplexiConfig.baseUrl}/v1/embed/movie/${id}` : undefined)
      if (!baseUrl) return undefined
      return baseUrl.includes('?')
        ? `${baseUrl}&key=${ReelplexiConfig.apiKey}`
        : `${baseUrl}?key=${ReelplexiConfig.apiKey}`
    }

    return {
      ...raw,
      id: raw.id?.toString() || '',
      title: raw.title || raw.name || 'Untitled',
      overview: raw.overview || raw.description || raw.storyline || raw.story_line || raw.storyLine || raw.summary,
      description: raw.storyline || raw.story_line || raw.storyLine || raw.synopsis || raw.plot || raw.summary || raw.description || raw.overview || '',
      storyline: raw.storyline || raw.story_line || raw.storyLine || raw.synopsis || raw.plot || raw.summary || raw.overview || raw.description || '',
      score: this.getScore(raw),
      release_date: raw.release_date || raw.released_at || this.yearToDate(raw.year),
      poster_path: posterUrl,
      thumbnail_url: posterUrl,
      cover_image_url: backdropUrl,
      backdrop_path: backdropUrl,
      embed_url: buildEmbedUrl(raw.embed_url, raw.id?.toString()),
      video_url: raw.stream_url || raw.proxy_url,
      genres,
      genre_ids: genres.map((g: string) => g.toLowerCase()),
      vjs: vjName ? { name: vjName } : undefined,
      published: true,
      premium: raw.premium !== false,
    }
  }

  private static normalizeSeries(raw: any): ReelplexiSeries {
    const genres = Array.isArray(raw.genres) ? raw.genres.filter((g: any) => g?.toString().trim()) : []
    const vjName = this.extractVjName(raw)
    const posterUrl = raw.poster_url
    const backdropUrl = raw.backdrop_url || posterUrl

    return {
      ...raw,
      id: raw.id?.toString() || '',
      title: raw.title || raw.name || 'Untitled',
      name: raw.name || raw.title || 'Untitled',
      overview: raw.overview || raw.description || raw.storyline || raw.story_line || raw.storyLine || raw.summary,
      description: raw.storyline || raw.story_line || raw.storyLine || raw.synopsis || raw.plot || raw.summary || raw.description || raw.overview || '',
      storyline: raw.storyline || raw.story_line || raw.storyLine || raw.synopsis || raw.plot || raw.summary || raw.overview || raw.description || '',
      score: this.getScore(raw),
      first_air_date: raw.first_air_date || this.yearToDate(raw.year) || raw.release_date,
      poster_path: posterUrl,
      thumbnail_url: posterUrl,
      cover_image_url: backdropUrl,
      backdrop_path: backdropUrl,
      genres,
      genre_ids: genres.map((g: string) => g.toLowerCase()),
      vjs: vjName ? { name: vjName } : undefined,
      published: true,
      premium: raw.premium !== false,
    }
  }

  private static normalizeMixedContent(raw: any): ReelplexiMovie | ReelplexiSeries {
    if (raw.type === 'series' || raw.first_air_date || raw.seasons != null) {
      return this.normalizeSeries(raw)
    }
    return this.normalizeMovie(raw)
  }

  private static normalizeEpisode(seriesId: string, season: number, raw: any): ReelplexiEpisode {
    const episodeNumber = parseInt(raw.episode_number?.toString() || '0')
    const posterUrl = raw.poster_url || raw.thumbnail_url
    const backdropUrl = raw.backdrop_url || posterUrl
    const syntheticId = `${seriesId}:season:${season}:episode:${episodeNumber}`

    // Build episode embed URL: always ensure the API key is appended
    const buildEpisodeEmbedUrl = (base: string | undefined, sid: string, s: number, ep: number): string | undefined => {
      const baseUrl = base || `${ReelplexiConfig.baseUrl}/v1/embed/tv/${sid}/${s}/${ep}`
      return baseUrl.includes('?')
        ? `${baseUrl}&key=${ReelplexiConfig.apiKey}`
        : `${baseUrl}?key=${ReelplexiConfig.apiKey}`
    }

    return {
      ...raw,
      id: syntheticId,
      series_id: raw.series_id || seriesId,
      season_number: season,
      episode_number: episodeNumber,
      title: raw.title || `Episode ${episodeNumber}`,
      name: raw.name || raw.title || `Episode ${episodeNumber}`,
      overview: raw.overview || raw.description,
      description: raw.description || raw.overview || '',
      thumbnail_url: posterUrl,
      poster_path: posterUrl,
      cover_image_url: backdropUrl,
      backdrop_path: backdropUrl,
      video_url: raw.video_url || raw.stream_url || raw.proxy_url,
      embed_url: buildEpisodeEmbedUrl(raw.embed_url, raw.series_id || seriesId, season, episodeNumber),
      published: true,
    }
  }

  private static extractVjName(raw: any): string | undefined {
    const direct = raw.vj_name || raw.vj || raw.translator
    if (direct?.trim()) return direct.trim()

    const versions = raw.available_vj_versions
    if (Array.isArray(versions) && versions.length > 0 && versions[0]) {
      return versions[0].vj_name || versions[0].name
    }
    return undefined
  }

  private static yearToDate(year: any): string | undefined {
    const parsed = parseInt(year?.toString() || '')
    return isNaN(parsed) ? undefined : `${parsed}-01-01`
  }

  private static parseRatingValue(value: any): number | null {
    if (value === null || value === undefined || value === '') return null

    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value > 0 && value <= 10) return Number(value.toFixed(1))
      if (value > 10 && value <= 100) return Number((value / 10).toFixed(1))
      return null
    }

    if (typeof value === 'string') {
      const cleaned = value.trim()
      if (!cleaned || cleaned.toLowerCase() === 'n/a' || cleaned.toLowerCase() === 'nr') return null

      const normalized = cleaned.replace(/\s+/g, '')
      const isRatingLikeString = /^\d+(?:\.\d+)?(?:\/10|\/100|%)?$/.test(normalized)
      if (!isRatingLikeString) return null

      const numeric = Number(normalized.replace(/%$/, '').replace(/\/10$/, '').replace(/\/100$/, ''))
      if (!Number.isFinite(numeric) || numeric <= 0) return null

      if (numeric <= 10) return Number(numeric.toFixed(1))
      if (numeric <= 100) return Number((numeric / 10).toFixed(1))
      return null
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const parsed = this.parseRatingValue(item)
        if (parsed !== null) return parsed
      }
      return null
    }

    if (typeof value === 'object') {
      const keys = ['value', 'score', 'rating', 'average', 'avg', 'imdb', 'tmdb']
      for (const key of keys) {
        const parsed = this.parseRatingValue((value as Record<string, any>)[key])
        if (parsed !== null) return parsed
      }

      for (const item of Object.values(value as Record<string, any>)) {
        const parsed = this.parseRatingValue(item)
        if (parsed !== null) return parsed
      }
    }

    return null
  }

  private static getScore(raw: any): number {
    // Try every known field name Reelplexi uses for numeric scores.
    // Also handles nested objects like { ratings: { imdb: '8.5' } }
    const direct = [
      raw.score,
      raw.vote_average,
      raw.imdb_rating,
      raw.imdb_score,
      raw.average_rating,
      raw.reelplexi_score,
      raw.audience_score,
      raw.critics_score,
      typeof raw.rating === 'number' ? raw.rating : null,
      typeof raw.rating === 'string' ? raw.rating : null,
    ]

    const nested = raw.ratings
      ? [raw.ratings?.imdb, raw.ratings?.tmdb, raw.ratings?.average, raw.ratings?.score, raw.ratings?.value]
      : []

    const candidates = [...direct, ...nested]
    let score = candidates
      .map(v => this.parseRatingValue(v))
      .find((v): v is number => v !== null) ?? 0

    // Fall back to popularity / 100 (Reelplexi returns 0–1000+)
    if (score === 0 && raw.popularity) {
      const pop = Number(raw.popularity)
      if (pop > 0) score = Math.min(10, parseFloat((pop / 100).toFixed(1)))
    }

    return score
  }

  static async getMovies(page = 1, perPage = 50): Promise<ReelplexiMovie[]> {
    return cache.getOrSet(`movies:p${page}:n${perPage}`, async () => {
      const response = await this.getJson('/v1/movies', {
        page: page.toString(),
        per_page: perPage.toString(),
      })
      const data = Array.isArray(response.data) ? response.data : []
      return data.map((item: any) => this.normalizeMovie(item))
    }, TTL_LIST)
  }

  static async getMovieById(id: string): Promise<ReelplexiMovie | null> {
    return cache.getOrSet(`movie:${id}`, async () => {
      try {
        const response = await this.getJson(`/v1/movies/${id}`)
        const movie = response.data || response
        return movie ? this.normalizeMovie(movie) : null
      } catch (error) {
        console.error('Error fetching movie by ID:', error)
        return null
      }
    }, TTL_DETAIL)
  }

  static async getSeries(page = 1, perPage = 50): Promise<ReelplexiSeries[]> {
    return cache.getOrSet(`series:p${page}:n${perPage}`, async () => {
      const response = await this.getJson('/v1/series', {
        page: page.toString(),
        per_page: perPage.toString(),
      })
      const data = Array.isArray(response.data) ? response.data : []
      return data.map((item: any) => this.normalizeSeries(item))
    }, TTL_LIST)
  }

  static async getSeriesById(id: string): Promise<ReelplexiSeries | null> {
    return cache.getOrSet(`series:${id}`, async () => {
      try {
        const response = await this.getJson(`/v1/series/${id}`)
        const series = response.data || response
        return series ? this.normalizeSeries(series) : null
      } catch {
        return null
      }
    }, TTL_DETAIL)
  }

  static async getSeriesEpisodes(seriesId: string, season: number): Promise<ReelplexiEpisode[]> {
    return cache.getOrSet(`episodes:${seriesId}:s${season}`, async () => {
      try {
        const response = await this.getJson(`/v1/series/${seriesId}/seasons/${season}/episodes`)
        const data = Array.isArray(response.data) ? response.data : []
        return data.map((episode: any) => this.normalizeEpisode(seriesId, season, episode))
      } catch {
        return []
      }
    }, TTL_DETAIL)
  }

  static async getPlaylists(): Promise<ReelplexiPlaylist[]> {
    try {
      const response = await this.getJson('/v1/playlists')
      return Array.isArray(response.data) ? response.data : []
    } catch {
      return []
    }
  }

  static async getPlaylist(id: string): Promise<ReelplexiPlaylist | null> {
    try {
      const response = await this.getJson(`/v1/playlists/${encodeURIComponent(id)}`)
      return response.data || response
    } catch {
      return null
    }
  }

  static async getMovieStream(id: string): Promise<{ stream_url: string; is_embed: boolean; hls_url?: string }> {
    // The stream endpoint returns both the raw URL and the documented embed URL.
    try {
      const response = await this.getJson(`/v1/stream/movie/${encodeURIComponent(id)}`)
      const streamData = response.data || response
      const hlsUrl = streamData.hls_url || streamData.m3u8_url || streamData.playlist_url || streamData.manifest_url
      if (hlsUrl) {
        return { stream_url: hlsUrl, is_embed: false, hls_url: hlsUrl }
      }
      if (streamData.stream_url) {
        return { stream_url: streamData.stream_url, is_embed: false }
      }
      if (streamData.embed_url) {
        return { stream_url: streamData.embed_url, is_embed: true }
      }
    } catch {
      // Older plans may only expose the movie-specific stream endpoint.
      try {
        const response = await this.getJson(`/v1/movies/${encodeURIComponent(id)}/stream`)
        const streamData = response.data || response
        if (streamData.video_url || streamData.stream_url || streamData.proxy_url) {
          return {
            stream_url: streamData.video_url || streamData.stream_url || streamData.proxy_url,
            is_embed: false,
          }
        }
      } catch {
        // Fall through to the documented embed endpoint.
      }
    }

    const embedBase = ReelplexiConfig.embedBase
    const embedUrl = `${embedBase}/movie/${encodeURIComponent(id)}?key=${encodeURIComponent(ReelplexiConfig.apiKey)}`
    return { stream_url: embedUrl, is_embed: true }
  }

  static async getTrailers(id: string, type: 'movie' | 'series'): Promise<ReelplexiTrailer[]> {
    try {
      const resource = type === 'series' ? 'series' : 'movies'
      const response = await this.getJson(`/v1/${resource}/${encodeURIComponent(id)}/trailers`)
      const trailers = response.trailers || response.data?.trailers || response.data || []
      if (!Array.isArray(trailers)) return []
      return trailers.filter((trailer: any) =>
        trailer?.key && (!trailer.site || trailer.site.toLowerCase() === 'youtube')
      )
    } catch {
      return []
    }
  }

  static async getEpisodeStream(seriesId: string, season: number, episode: number): Promise<{ stream_url: string; is_embed: boolean; hls_url?: string }> {
    try {
      const response = await this.getJson(`/v1/stream/tv/${encodeURIComponent(seriesId)}/${season}/${episode}`)
      const streamData = response.data || response
      const hlsUrl = streamData.hls_url || streamData.m3u8_url || streamData.playlist_url || streamData.manifest_url
      if (hlsUrl) {
        return { stream_url: hlsUrl, is_embed: false, hls_url: hlsUrl }
      }
      if (streamData.stream_url) {
        return { stream_url: streamData.stream_url, is_embed: false }
      }
      if (streamData.embed_url) {
        return { stream_url: streamData.embed_url, is_embed: true }
      }
    } catch {
      try {
        const response = await this.getJson(
          `/v1/series/${encodeURIComponent(seriesId)}/seasons/${season}/episodes/${episode}/stream`
        )
        const streamData = response.data || response
        if (streamData.video_url || streamData.stream_url || streamData.proxy_url) {
          return {
            stream_url: streamData.video_url || streamData.stream_url || streamData.proxy_url,
            is_embed: false,
          }
        }
      } catch {
        // Fall through to the documented embed endpoint.
      }
    }

    const embedBase = ReelplexiConfig.embedBase
    const embedUrl = `${embedBase}/tv/${encodeURIComponent(seriesId)}/${season}/${episode}?key=${encodeURIComponent(ReelplexiConfig.apiKey)}`
    return { stream_url: embedUrl, is_embed: true }
  }

  /**
   * Fetch a dedicated Wasabi presigned download URL for a movie.
   * The URL has response-content-disposition=attachment baked in so the
   * browser triggers a download instead of playing inline.
   */
  static async getMovieDownloadUrl(id: string): Promise<string> {
    console.log(`[ReelplexiService] getMovieDownloadUrl called for id=${id}`)
    try {
      const response = await this.getJson(`/v1/download/movie/${id}`)
      console.log('[ReelplexiService] getMovieDownloadUrl raw response:', JSON.stringify(response))
      const downloadUrl = response.download_url as string
      if (!downloadUrl) throw new Error(`download_url missing from API response. Full response: ${JSON.stringify(response)}`)
      return downloadUrl
    } catch (e: any) {
      console.error('[ReelplexiService] getMovieDownloadUrl FAILED:', e.message)
      throw e
    }
  }

  /**
   * Fetch a dedicated Wasabi presigned download URL for a TV episode.
   * The URL has response-content-disposition=attachment baked in.
   */
  static async getEpisodeDownloadUrl(seriesId: string, season: number, episode: number): Promise<string> {
    console.log(`[ReelplexiService] getEpisodeDownloadUrl called for seriesId=${seriesId} s=${season} ep=${episode}`)
    try {
      const response = await this.getJson(`/v1/download/tv/${seriesId}/${season}/${episode}`)
      console.log('[ReelplexiService] getEpisodeDownloadUrl raw response:', JSON.stringify(response))
      const downloadUrl = response.download_url as string
      if (!downloadUrl) throw new Error(`download_url missing from API response. Full response: ${JSON.stringify(response)}`)
      return downloadUrl
    } catch (e: any) {
      console.error('[ReelplexiService] getEpisodeDownloadUrl FAILED:', e.message)
      throw e
    }
  }

  static async getGenres(): Promise<Array<{ id: string; name: string }>> {
    return cache.getOrSet('genres', async () => {
      try {
        const response = await this.getJson('/v1/genres')
        const raw = response.data
        if (!Array.isArray(raw)) return []
        return raw
          .map((g) => g?.toString().trim())
          .filter((g) => g)
          .map((genre) => ({
            id: genre.toLowerCase(),
            name: this.titleCase(genre),
          }))
      } catch {
        return []
      }
    }, TTL_GENRE)
  }

  static async getMoviesByGenre(genre: string, page = 1, perPage = 50): Promise<ReelplexiMovie[]> {
    return cache.getOrSet(`genre:movie:${genre}:p${page}:n${perPage}`, async () => {
      try {
        const genreName = this.titleCase(genre)
        const response = await this.getJson(`/v1/genres/${encodeURIComponent(genreName)}/movies`, { page: page.toString(), per_page: perPage.toString() })
        const data = Array.isArray(response.data) ? response.data : []
        return data.map((item: any) => this.normalizeMovie(item))
      } catch (error) {
        console.error(`Error fetching movies for genre ${genre}:`, error)
        return []
      }
    }, TTL_GENRE)
  }

  static async getSeriesByGenre(genre: string, page = 1, perPage = 50): Promise<ReelplexiSeries[]> {
    return cache.getOrSet(`genre:series:${genre}:p${page}:n${perPage}`, async () => {
      try {
        const genreName = this.titleCase(genre)
        const response = await this.getJson(`/v1/genres/${encodeURIComponent(genreName)}/series`, { page: page.toString(), per_page: perPage.toString() })
        const data = Array.isArray(response.data) ? response.data : []
        return data.map((item: any) => this.normalizeSeries(item))
      } catch (error) {
        console.error(`Error fetching series for genre ${genre}:`, error)
        return []
      }
    }, TTL_GENRE)
  }

  static async getTrendingAll(page = 1, perPage = 50): Promise<Array<ReelplexiMovie | ReelplexiSeries>> {
    return cache.getOrSet(`trending:all:p${page}:n${perPage}`, async () => {
      try {
        const response = await this.getJson('/v1/trending/all', {
          page: page.toString(),
          per_page: perPage.toString(),
        })
        const data = Array.isArray(response.data) ? response.data : []
        return data.map((item: any) => this.normalizeMixedContent(item))
      } catch {
        return []
      }
    }, TTL_TREND)
  }

  private static async fetchSearchResultsAcrossPages<T>(path: string, query: string, perPage = 100, maxPages = 8): Promise<T[]> {
    const normalizedPerPage = Math.min(100, Math.max(20, perPage))
    const rows: T[] = []

    for (let page = 1; page <= maxPages; page += 1) {
      try {
        const response = await this.getJson(path, {
          q: query,
          page: page.toString(),
          per_page: normalizedPerPage.toString(),
        })

        const payload = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.results)
            ? response.results
            : Array.isArray(response.items)
              ? response.items
              : []

        if (!payload.length) break

        rows.push(...payload)

        const totalPages = Number(response.pagination?.total_pages ?? response.total_pages ?? response.pages ?? 0)
        if (totalPages > 0 && page >= totalPages) break
        if (payload.length < normalizedPerPage) break
      } catch {
        break
      }
    }

    return rows
  }

  static async searchAll(query: string, page = 1, perPage = 50): Promise<Array<ReelplexiMovie | ReelplexiSeries>> {
    const searchKey = `search:all:${query}:p${page}:n${perPage}`
    return cache.getOrSet(searchKey, async () => {
      const normalizedQuery = query.trim()
      if (!normalizedQuery) return []

      try {
        const allRows = await this.fetchSearchResultsAcrossPages('/v1/search', normalizedQuery, Math.min(100, Math.max(perPage, 20)), 8)
        const normalized = allRows.map((item: any) => this.normalizeMixedContent(item))

        if (normalized.length > 0) {
          const seen = new Map<string, ReelplexiMovie | ReelplexiSeries>()
          for (const item of normalized) {
            const key = `${item.type || 'movie'}-${item.id}`
            if (!seen.has(key)) seen.set(key, item)
          }
          return Array.from(seen.values())
        }

        const [movieRows, seriesRows] = await Promise.all([
          this.fetchSearchResultsAcrossPages('/v1/movies/search', normalizedQuery, Math.min(100, Math.max(perPage, 20)), 8),
          this.fetchSearchResultsAcrossPages('/v1/series/search', normalizedQuery, Math.min(100, Math.max(perPage, 20)), 8),
        ])

        const fallback = [
          ...movieRows.map((item: any) => this.normalizeMovie(item)),
          ...seriesRows.map((item: any) => this.normalizeSeries(item)),
        ]

        const deduped = new Map<string, ReelplexiMovie | ReelplexiSeries>()
        for (const item of fallback) {
          const key = `${item.type || 'movie'}-${item.id}`
          if (!deduped.has(key)) deduped.set(key, item)
        }

        return Array.from(deduped.values())
      } catch {
        return []
      }
    }, TTL_SEARCH)
  }

  static async searchMovies(query: string, page = 1, perPage = 50): Promise<ReelplexiMovie[]> {
    const searchKey = `search:movies:${query}:p${page}:n${perPage}`
    return cache.getOrSet(searchKey, async () => {
      const normalizedQuery = query.trim()
      if (!normalizedQuery) return []

      try {
        const rows = await this.fetchSearchResultsAcrossPages('/v1/movies/search', normalizedQuery, Math.min(100, Math.max(perPage, 20)), 8)
        const deduped = new Map<string, ReelplexiMovie>()
        for (const item of rows.map((row: any) => this.normalizeMovie(row))) {
          const key = `movie-${item.id}`
          if (!deduped.has(key)) deduped.set(key, item)
        }
        return Array.from(deduped.values())
      } catch {
        return []
      }
    }, TTL_SEARCH)
  }

  static async searchSeries(query: string, page = 1, perPage = 50): Promise<ReelplexiSeries[]> {
    const searchKey = `search:series:${query}:p${page}:n${perPage}`
    return cache.getOrSet(searchKey, async () => {
      const normalizedQuery = query.trim()
      if (!normalizedQuery) return []

      try {
        const rows = await this.fetchSearchResultsAcrossPages('/v1/series/search', normalizedQuery, Math.min(100, Math.max(perPage, 20)), 8)
        const deduped = new Map<string, ReelplexiSeries>()
        for (const item of rows.map((row: any) => this.normalizeSeries(row))) {
          const key = `series-${item.id}`
          if (!deduped.has(key)) deduped.set(key, item)
        }
        return Array.from(deduped.values())
      } catch {
        return []
      }
    }, TTL_SEARCH)
  }

  static async getTrendingMovies(page = 1, perPage = 50): Promise<ReelplexiMovie[]> {
    return cache.getOrSet(`trending:movies:p${page}:n${perPage}`, async () => {
      try {
        const response = await this.getJson('/v1/trending/movies', {
          page: page.toString(),
          per_page: perPage.toString(),
        })
        const data = Array.isArray(response.data) ? response.data : []
        return data.map((item: any) => this.normalizeMovie(item))
      } catch {
        return []
      }
    }, TTL_TREND)
  }

  static async getTrendingSeries(page = 1, perPage = 50): Promise<ReelplexiSeries[]> {
    return cache.getOrSet(`trending:series:p${page}:n${perPage}`, async () => {
      try {
        const response = await this.getJson('/v1/trending/series', {
          page: page.toString(),
          per_page: perPage.toString(),
        })
        const data = Array.isArray(response.data) ? response.data : []
        return data.map((item: any) => this.normalizeSeries(item))
      } catch {
        return []
      }
    }, TTL_TREND)
  }

  static async getRelatedMovies(id: string, page = 1, perPage = 20): Promise<ReelplexiMovie[]> {
    return cache.getOrSet(`related:movies:genre:${id}:p${page}:n${perPage}`, async () => {
      try {
        const response = await this.getJson(`/v1/movies/${id}/related/genre`, {
          page: page.toString(),
          per_page: perPage.toString(),
        })
        const data = Array.isArray(response.data) ? response.data : []
        return data.map((item: any) => this.normalizeMovie(item))
      } catch {
        return []
      }
    }, TTL_LIST)
  }

  static async getRelatedMoviesByVJ(id: string, page = 1, perPage = 20): Promise<ReelplexiMovie[]> {
    return cache.getOrSet(`related:movies:vj:${id}:p${page}:n${perPage}`, async () => {
      try {
        const response = await this.getJson(`/v1/movies/${id}/related/vj`, {
          page: page.toString(),
          per_page: perPage.toString(),
        })
        const data = Array.isArray(response.data) ? response.data : []
        return data.map((item: any) => this.normalizeMovie(item))
      } catch {
        return []
      }
    }, TTL_LIST)
  }

  static async getRelatedSeries(id: string, page = 1, perPage = 20): Promise<ReelplexiSeries[]> {
    return cache.getOrSet(`related:series:genre:${id}:p${page}:n${perPage}`, async () => {
      try {
        const response = await this.getJson(`/v1/series/${id}/related/genre`, {
          page: page.toString(),
          per_page: perPage.toString(),
        })
        const data = Array.isArray(response.data) ? response.data : []
        return data.map((item: any) => this.normalizeSeries(item))
      } catch {
        return []
      }
    }, TTL_LIST)
  }

  static async getRelatedSeriesByVJ(id: string, page = 1, perPage = 20): Promise<ReelplexiSeries[]> {
    return cache.getOrSet(`related:series:vj:${id}:p${page}:n${perPage}`, async () => {
      try {
        const response = await this.getJson(`/v1/series/${id}/related/vj`, {
          page: page.toString(),
          per_page: perPage.toString(),
        })
        const data = Array.isArray(response.data) ? response.data : []
        return data.map((item: any) => this.normalizeSeries(item))
      } catch {
        return []
      }
    }, TTL_LIST)
  }

  static async getTopMovies(page = 1, perPage = 20): Promise<ReelplexiMovie[]> {
    return cache.getOrSet(`top:movies:p${page}:n${perPage}`, async () => {
      try {
        const response = await this.getJson('/v1/account/analytics/top-movies', { limit: perPage.toString() })
        const data = Array.isArray(response.data) ? response.data : []
        return data.map((item: any) => this.normalizeMovie(item))
      } catch {
        return []
      }
    }, TTL_LIST)
  }

  static async getTopSeries(page = 1, perPage = 20): Promise<ReelplexiSeries[]> {
    return cache.getOrSet(`top:series:p${page}:n${perPage}`, async () => {
      try {
        const response = await this.getJson('/v1/account/analytics/top-series', { limit: perPage.toString() })
        const data = Array.isArray(response.data) ? response.data : []
        return data.map((item: any) => this.normalizeSeries(item))
      } catch {
        return []
      }
    }, TTL_LIST)
  }

  static async getAccountUsage(range: '24h' | '7d' | '30d' = '30d'): Promise<ReelplexiUsage | null> {
    try {
      const response = await this.getJson('/v1/account/usage', { range })
      return response.data || response
    } catch {
      return null
    }
  }

  static async getTopMovieAnalytics(limit = 10): Promise<ReelplexiTopContent[]> {
    try {
      const response = await this.getJson('/v1/account/analytics/top-movies', { limit: limit.toString() })
      return Array.isArray(response.data) ? response.data : []
    } catch {
      return []
    }
  }

  static async getTopSeriesAnalytics(limit = 10): Promise<ReelplexiTopContent[]> {
    try {
      const response = await this.getJson('/v1/account/analytics/top-series', { limit: limit.toString() })
      return Array.isArray(response.data) ? response.data : []
    } catch {
      return []
    }
  }

  private static titleCase(value: string): string {
    return value
      .split(' ')
      .filter((part) => part.trim())
      .map((part) => {
        const p = part.trim()
        return p.length === 1 ? p.toUpperCase() : `${p[0].toUpperCase()}${p.substring(1).toLowerCase()}`
      })
      .join(' ')
  }
}

export default ReelplexiService
