export const isIOSDevice = (): boolean => {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent)
}

export const isAndroidDevice = (): boolean => {
  if (typeof window === 'undefined') return false
  return /Android/i.test(window.navigator.userAgent)
}

export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    window.navigator.userAgent
  )
}

export const canStreamMKV = (): boolean => {
  if (isIOSDevice()) return false
  return true
}

/**
 * Returns true when the browser has NATIVE HLS support (i.e. Safari on iOS/macOS).
 * We probe this by creating a <video> element and checking canPlayType for the
 * standard HLS MIME type.  This is synchronous and safe to call at runtime.
 */
export const canUseNativeHLS = (): boolean => {
  if (typeof document === 'undefined') return false
  const video = document.createElement('video')
  return video.canPlayType('application/vnd.apple.mpegurl') !== ''
}

/**
 * Decide which player strategy to use for a given URL on the current device.
 *
 *  'hls-native'  — iOS/Safari: use a plain <video> tag; the browser handles HLS natively.
 *  'artplayer'   — Everything else: use ArtPlayer (which bundles hls.js internally
 *                  for non-Safari environments when type:'m3u8' is passed).
 */
export type PlayerStrategy = 'hls-native' | 'artplayer'

export const resolvePlayerStrategy = (url: string): PlayerStrategy => {
  const isHLS = url.toLowerCase().includes('.m3u8')
  if (isHLS && canUseNativeHLS() && isIOSDevice()) {
    return 'hls-native'
  }
  return 'artplayer'
}
