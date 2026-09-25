import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Redirect cookie functions for authentication flow
export function setRedirectCookie(path: string, maxAgeSeconds = 600) {
  // Validate that path is a valid relative path (starts with /)
  if (!path || typeof path !== 'string') {
    console.warn('Invalid redirect path:', path);
    return;
  }
  
  // Ensure path is relative (doesn't include domain)
  let validPath = path;
  try {
    // If it looks like a full URL, extract just the path
    if (path.startsWith('http://') || path.startsWith('https://')) {
      const url = new URL(path);
      validPath = url.pathname + url.search;
    }
  } catch (e) {
    console.warn('Could not parse redirect path:', path, e);
    return;
  }
  
  // Only set cookie for valid relative paths
  if (!validPath.startsWith('/')) {
    console.warn('Redirect path must be relative:', validPath);
    return;
  }
  
  const encoded = encodeURIComponent(validPath)
  const cookieValue = `redirectAfterAuth=${encoded}; path=/; max-age=${maxAgeSeconds}`
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    document.cookie = cookieValue + '; SameSite=None; Secure'
  } else if (typeof window !== 'undefined') {
    document.cookie = cookieValue
  }
}

export function clearRedirectCookie() {
  if (typeof window !== 'undefined') {
    document.cookie = 'redirectAfterAuth=; path=/; max-age=0'
  }
}

export function getRedirectCookie(): string | null {
  if (typeof window === 'undefined') return null
  const cookie = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('redirectAfterAuth='))
  if (!cookie) return null
  try {
    return decodeURIComponent(cookie.split('=')[1])
  } catch {
    return cookie.split('=')[1]
  }
}

export function isDirectMediaSource(url: string): boolean {
  if (!url || url === '#') {
    return false
  }

  const trimmed = url.trim()

  // Reelplexi stream proxy URLs already contain a signed JWT token and must be used
  // directly. Re-proxying them through /api/stream causes the provider to reject the
  // request with 402/Permission blocked even for valid premium users.
  const isReelplexiProtectedProxy = /(api\.)?reelplexi\.com/i.test(trimmed)
    && /\/v1\/stream\/proxy(?:$|[?#])/i.test(trimmed)
    && /[?&]token=/i.test(trimmed)

  // Already proxied or is an iframe embed URL.
  if (trimmed.startsWith('/api/stream') || trimmed.includes('embed.reelplexi.com') || isReelplexiProtectedProxy) {
    return true
  }

  const hasPlaylistOrManifest = /\.(m3u8|mpd)(?:$|[?#])/i.test(trimmed) || /\/(manifest|playlist)(?:$|[?#])/i.test(trimmed)
  if (hasPlaylistOrManifest) {
    return true
  }

  // Forces direct playback for signed/pre-signed URLs and CDN media sources.
  const hasSignedQuery = /(?:[?&](?:X-Amz-|X-Goog-|token=|Signature=|sig=|key=|Expires=|AWSAccessKeyId=)|(?:X-Amz-|X-Goog-))/i.test(trimmed)
  if (hasSignedQuery) {
    return false
  }

  try {
    const absoluteUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`

    const parsed = new URL(absoluteUrl)
    const hostname = parsed.hostname.toLowerCase()
    const pathname = parsed.pathname.toLowerCase()
    const isCloudPresignHost = /(wasabisys\.com|amazonaws\.com|cloudfront\.net|googleapis\.com|storage\.googleapis\.com|fastly\.net|azureedge\.net|b-cdn\.net)/i.test(hostname)
    const isStreamAsset = /\.(mp4|m4v|webm|mov|m4s|ts|flv)(?:$|\?)/i.test(pathname)

    return isCloudPresignHost && isStreamAsset
  } catch {
    return false
  }
}

// Video URL processing functions - proxy through API to handle CORS
export function normalizeVideoUrl(url: string): string {
  if (!url || url === "#") {
    return url
  }

  const trimmed = url.trim()
  const isReelplexiProtectedProxy = /(api\.)?reelplexi\.com/i.test(trimmed)
    && /\/v1\/stream\/proxy(?:$|[?#])/i.test(trimmed)
    && /[?&]token=/i.test(trimmed)

  // HLS/DASH manifest URLs are best played directly by the browser. Routing them
  // through /api/stream adds an extra hop for every playlist/segment request and
  // often causes repeated buffering and stall loops.
  const isManifest = /\.(m3u8|mpd)(?:$|[?#])/i.test(trimmed) || /\/(manifest|playlist)(?:$|[?#])/i.test(trimmed)
  if (isManifest || trimmed.includes('embed.reelplexi.com') || isReelplexiProtectedProxy) {
    return trimmed
  }

  // Prefetched signed cloud URLs (Wasabi/S3/pre-signed) are usually blocked by
  // browser CORS policy when accessed directly from localhost. Proxy them to our
  // server so the signed URL is fetched server-side and the browser keeps a same-origin stream.
  if (isDirectMediaSource(trimmed)) {
    return trimmed
  }

  let fullUrl = trimmed
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
    fullUrl = `https://${trimmed}`
  }

  // Any signed media URL with authenticated query params must be proxied. A direct
  // access from the browser will often fail with CORS/ERR_FAILED on presigned URLs.
  const signedQuery = /(?:[?&](?:X-Amz-|X-Goog-|token=|Signature=|sig=|key=|Expires=|AWSAccessKeyId=))/i.test(fullUrl)
  if (signedQuery) {
    return `/api/stream?url=${encodeURIComponent(fullUrl)}`
  }

  // Proxy through /api/stream to handle CORS and authentication
  return `/api/stream?url=${encodeURIComponent(fullUrl)}`
}

export async function fetchAuthenticatedVideoUrl(videoPath: string): Promise<string | null> {
  if (!videoPath || videoPath === "#") {
    return videoPath
  }

  const trimmed = videoPath.trim()
  const isReelplexiProtectedProxy = /(api\.)?reelplexi\.com/i.test(trimmed)
    && /\/v1\/stream\/proxy(?:$|[?#])/i.test(trimmed)
    && /[?&]token=/i.test(trimmed)

  if (trimmed.includes('embed.reelplexi.com') || isReelplexiProtectedProxy) {
    return trimmed
  }

  let normalizedUrl = trimmed
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    normalizedUrl = `https://${trimmed}`
  }

  // Proxy through /api/stream to handle CORS and authentication
  return `/api/stream?url=${encodeURIComponent(normalizedUrl)}`
}

/**
 * Forces a file download by routing through /api/stream with a filename param.
 * This sets Content-Disposition: attachment on the response, preventing Chrome
 * from opening the video in its built-in player instead of downloading.
 *
 * The `download` attribute on <a> tags is ignored for cross-origin URLs,
 * so we proxy through our own server to make it same-origin.
 */
export function forceDownloadFile(url: string, filename: string) {
  // Ensure the URL is absolute
  let fullUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    fullUrl = `https://${url}`;
  }

  // Route through /api/stream with filename to trigger Content-Disposition: attachment
  const proxyUrl = `/api/stream?url=${encodeURIComponent(fullUrl)}&filename=${encodeURIComponent(filename)}`;

  const link = document.createElement('a');
  link.href = proxyUrl;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function redirectToLogin(currentPath?: string) {
  if (currentPath) {
    setRedirectCookie(currentPath)
  }
  if (typeof window !== 'undefined') {
    window.location.href = '/signin'
  }
}
