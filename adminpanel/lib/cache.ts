/**
 * Lightweight in-process TTL cache for server-side API routes.
 *
 * Works across requests in a single Node.js process (dev + production).
 * Each cache entry stores a value and an expiry timestamp.
 *
 * Usage:
 *   const result = await withCache("key", 300, () => fetchExpensiveData());
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

// Module-level map survives across requests in the same process
const store = new Map<string, Entry<unknown>>();

/**
 * Return the cached value for `key` if still fresh, otherwise call
 * `fetcher()`, cache its result for `ttlSeconds`, and return it.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as Entry<T> | undefined;

  if (entry && entry.expiresAt > now) {
    return entry.value;
  }

  const value = await fetcher();
  store.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
  return value;
}

/** Manually invalidate a cache entry */
export function invalidateCache(key: string) {
  store.delete(key);
}

/** Clear all cached entries */
export function clearCache() {
  store.clear();
}
