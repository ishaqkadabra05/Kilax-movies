'use client'

/**
 * DeviceProvider
 *
 * Detects device capabilities once on first client render and makes the result
 * available everywhere via `useDevice()`.  Components never need to re-run UA
 * sniffing themselves — they just read the shared context.
 *
 * Capabilities detected:
 *  - isIOS          — iPad / iPhone / iPod (UA-based)
 *  - isAndroid      — Android UA
 *  - isMobile       — any phone/tablet UA
 *  - nativeHLS      — browser can play application/vnd.apple.mpegurl natively
 *                     (true on Safari / WKWebView, false everywhere else)
 *  - playerStrategy — 'hls-native' when on iOS with native HLS, 'artplayer' otherwise
 *                     NOTE: this is the default strategy; ArtPlayer.tsx may override
 *                     it per-URL (e.g. always use 'artplayer' for non-HLS streams)
 *  - ready          — false until the above are populated (avoids SSR mismatch)
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import {
  isIOSDevice,
  isAndroidDevice,
  isMobileDevice,
  canUseNativeHLS,
  PlayerStrategy,
} from '@/lib/device-utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeviceCapabilities {
  /** True once detection has run (always false on the server / first SSR pass). */
  ready: boolean
  isIOS: boolean
  isAndroid: boolean
  isMobile: boolean
  /** Browser supports application/vnd.apple.mpegurl natively (Safari / WKWebView). */
  nativeHLS: boolean
  /**
   * Default player strategy for HLS streams on this device.
   * 'hls-native'  → use a plain <video> element; Safari handles HLS without JS.
   * 'artplayer'   → use ArtPlayer (bundles hls.js internally for non-Safari).
   */
  defaultStrategy: PlayerStrategy
}

const defaultCapabilities: DeviceCapabilities = {
  ready: false,
  isIOS: false,
  isAndroid: false,
  isMobile: false,
  nativeHLS: false,
  defaultStrategy: 'artplayer',
}

// ─── Context ──────────────────────────────────────────────────────────────────

const DeviceContext = createContext<DeviceCapabilities>(defaultCapabilities)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [caps, setCaps] = useState<DeviceCapabilities>(defaultCapabilities)

  useEffect(() => {
    // This runs exactly once on the client, after hydration.
    const ios     = isIOSDevice()
    const android = isAndroidDevice()
    const mobile  = isMobileDevice()
    const hlsNative = canUseNativeHLS()

    // Use native HLS path only on iOS where Safari handles it without any JS
    // overhead.  On every other platform — including Android Chrome, desktop
    // Safari, and Firefox — ArtPlayer's built-in hls.js is the safer choice.
    const defaultStrategy: PlayerStrategy =
      ios && hlsNative ? 'hls-native' : 'artplayer'

    setCaps({ ready: true, isIOS: ios, isAndroid: android, isMobile: mobile, nativeHLS: hlsNative, defaultStrategy })
  }, [])

  return (
    <DeviceContext.Provider value={caps}>
      {children}
    </DeviceContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the detected device capabilities.
 *
 * `caps.ready` is false on the first SSR/hydration render and becomes true
 * after the first client-side effect runs.  Guard any strategy-switching UI
 * behind `caps.ready` to avoid hydration mismatches.
 *
 * @example
 *   const caps = useDevice()
 *   if (!caps.ready) return <Skeleton />
 *   return caps.defaultStrategy === 'hls-native' ? <NativePlayer /> : <ArtPlayer />
 */
export function useDevice(): DeviceCapabilities {
  return useContext(DeviceContext)
}
