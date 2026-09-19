/**
 * Lightweight in-memory TTL cache for server-side use.
 *
 * Uses a module-level Map so the cache survives across requests within the same
 * Node.js process (Next.js server / API routes).  It is intentionally NOT
 * shared across worker processes or serverless invocations — for that you would
 * swap the backing store for Redis.  For a single-server / Vercel warm-instance
 * scenario this is sufficient to cut repeated upstream Reelplexi calls.
 *
 * Usage:
 *   import { cache } from '@/lib/cache'
 *
 *   const data = await cache.getOrSet('movies:page:1', () => fetchMovies(1), 300)
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number   // Date.now() + ttlMs
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()

  /** Return a cached value, or call `fetcher`, cache the result, and return it. */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds = 300
  ): Promise<T> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined

    if (entry && Date.now() < entry.expiresAt) {
      return entry.value
    }

    const value = await fetcher()
    this.set(key, value, ttlSeconds)
    return value
  }

  /** Manually write a value into the cache. */
  set<T>(key: string, value: T, ttlSeconds = 300): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1_000,
    })
  }

  /** Read a value without triggering a fetch.  Returns undefined on miss/expiry. */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined
    if (!entry || Date.now() >= entry.expiresAt) {
      if (entry) this.store.delete(key)   // eager eviction
      return undefined
    }
    return entry.value
  }

  /** Invalidate a single key. */
  del(key: string): void {
    this.store.delete(key)
  }

  /** Invalidate all keys that start with the given prefix. */
  delPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key)
    }
  }

  /** Remove all expired entries (call periodically if you care about memory). */
  prune(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.expiresAt) this.store.delete(key)
    }
  }

  /** Wipe everything — useful in tests. */
  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }
}

// Singleton — one cache instance for the whole server process.
const globalForCache = globalThis as typeof globalThis & {
  __kilaxCache?: MemoryCache
}

export const cache: MemoryCache =
  globalForCache.__kilaxCache ?? (globalForCache.__kilaxCache = new MemoryCache())

export default cache
