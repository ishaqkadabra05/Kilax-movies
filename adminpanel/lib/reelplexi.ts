import { withCache } from "./cache";

const BASE_URL = (process.env.REELPLEXI_BASE_URL || "https://api.reelplexi.com").replace(/\/$/, "");

// Default TTL for cached Reelplexi responses: 5 minutes
const DEFAULT_TTL = 5 * 60;

interface ReelplexiOptions extends RequestInit {
  /** Cache TTL in seconds. 0 = no cache. Default: 300 (5 min). */
  cacheTtl?: number;
}

async function fetchReelplexi<T>(path: string, init: ReelplexiOptions = {}): Promise<T> {
  const key = process.env.REELPLEXI_API_KEY;
  if (!key) throw new Error("REELPLEXI_API_KEY is not configured");
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${key}`,
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Reelplexi ${response.status}: ${body.slice(0, 500)}`);
  return body ? (JSON.parse(body) as T) : ({} as T);
}

export async function reelplexiFetch<T>(path: string, init: ReelplexiOptions = {}): Promise<T> {
  const { cacheTtl = DEFAULT_TTL, ...fetchInit } = init;

  // Skip cache for POST/PUT/DELETE or when TTL is explicitly 0
  if (cacheTtl === 0 || (fetchInit.method && fetchInit.method !== "GET")) {
    return fetchReelplexi<T>(path, fetchInit);
  }

  const cacheKey = `reelplexi:${path}`;
  return withCache<T>(cacheKey, cacheTtl, () => fetchReelplexi<T>(path, fetchInit));
}
