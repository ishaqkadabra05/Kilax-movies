"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Artplayer from "artplayer"
import { isIOSDevice } from "@/lib/device-utils"
import { EpisodeWithSeason } from '@/lib/supabase'
import { useAuthCheck } from './AuthRequiredModal'
import { useDevice } from './DeviceProvider'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ArtPlayerProps {
  url: string
  poster?: string
  title?: string
  className?: string
  onEnded?: () => void
  onProgress?: (positionSeconds: number, durationSeconds: number) => void
  initialPosition?: number
  onLoad?: () => void
  onError?: (error: any) => void
  maxWatchSeconds?: number
  onLimitReached?: () => void
  episodes?: EpisodeWithSeason[]
  currentEpisodeIndex?: number
  onEpisodeSelect?: (episode: EpisodeWithSeason) => void
  contentType?: string
}

// ─── Orientation helpers ──────────────────────────────────────────────────────

function lockLandscape() {
  if (typeof window === 'undefined') return
  try {
    const o = window.screen?.orientation as any
    o?.lock?.('landscape-primary')?.catch?.(() => o?.lock?.('landscape')?.catch?.(() => null))
  } catch { /* noop */ }
  try { (screen as any).lockOrientation?.('landscape-primary') } catch { /* noop */ }
  try { (screen as any).webkitLockOrientation?.('landscape-primary') } catch { /* noop */ }
}

function unlockOrientation() {
  if (typeof window === 'undefined') return
  try { (window.screen?.orientation as any)?.unlock?.() } catch { /* noop */ }
  try { (screen as any).unlockOrientation?.() } catch { /* noop */ }
  try { (screen as any).webkitUnlockOrientation?.() } catch { /* noop */ }
}

// ─── Logo watermark (top-right corner) ───────────────────────────────────────

function KilaxLogo() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 14,
        zIndex: 50,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <img
          src="/logo-512.png"
        alt="Kilax Movies"
        style={{
          height: 40,
          width: 'auto',
          objectFit: 'contain',
          borderRadius: 4,
          opacity: 0.88,
          filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.7))',
        }}
      />
    </div>
  )
}

// ─── Episodes overlay ─────────────────────────────────────────────────────────

interface EpisodesOverlayProps {
  episodes: EpisodeWithSeason[]
  currentEpisodeIndex: number
  isFullscreen: boolean
  onClose: () => void
  onSelect: (episode: EpisodeWithSeason) => void
}

function EpisodesOverlay({ episodes, currentEpisodeIndex, isFullscreen, onClose, onSelect }: EpisodesOverlayProps) {
  const { checkAuth } = useAuthCheck()

  return (
    <div className={`fixed inset-0 bg-black/90 flex ${isFullscreen ? 'z-999999' : 'z-99999'}`}>
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-8">
        <div className="text-center text-white">
          <h1 className="text-3xl font-bold mb-2">Episodes</h1>
          <p className="text-gray-400">Select an episode to continue watching</p>
        </div>
      </div>
      <div className="w-full lg:w-1/2 bg-gray-900/95 backdrop-blur-sm flex flex-col">
        <div className="flex items-center justify-between p-4 lg:p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-white">Episodes</h2>
            <p className="text-sm text-gray-400 mt-1">Season 1</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 hover:bg-gray-800 rounded-full" aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="space-y-3">
            {episodes.map((ep, i) => {
              const isCurrent = i === currentEpisodeIndex
              const isPremium = ep.premium
              const canAccess = checkAuth(isPremium).allowed
              return (
                <div
                  key={ep.id}
                  role="button"
                  tabIndex={canAccess ? 0 : -1}
                  aria-current={isCurrent ? 'true' : undefined}
                  className={`p-3 lg:p-4 rounded-lg cursor-pointer transition-colors ${isCurrent ? 'bg-orange-500/20 border border-orange-500/30' : canAccess ? 'hover:bg-gray-800' : 'opacity-60 cursor-not-allowed'}`}
                  onClick={() => { if (canAccess) onSelect(ep) }}
                  onKeyDown={(e) => { if (canAccess && (e.key === 'Enter' || e.key === ' ')) onSelect(ep) }}
                >
                  <div className="flex items-center gap-3 lg:gap-4">
                    <div className="relative w-16 h-10 lg:w-20 lg:h-12 bg-gray-700 rounded overflow-hidden shrink-0">
                      {ep.thumbnail_url
                        ? <img src={ep.thumbnail_url} alt={ep.title} className="w-full h-full object-cover" />
                        : <div className="absolute inset-0 flex items-center justify-center">
                            <div className={`w-8 h-6 rounded flex items-center justify-center text-xs font-bold ${isCurrent ? 'bg-orange-500 text-white' : 'bg-gray-600 text-gray-300'}`}>{ep.episode_number}</div>
                          </div>
                      }
                      {isCurrent && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-sm lg:text-base font-medium truncate">{ep.title}</span>
                        {isPremium && <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded shrink-0">Premium</span>}
                      </div>
                      <div className="text-xs lg:text-sm text-gray-400">{ep.seasonName} • Episode {ep.episode_number}</div>
                      {!canAccess && <div className="text-xs text-red-400 mt-1">{isPremium ? 'Premium Required' : 'Login Required'}</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Error / loading shell ────────────────────────────────────────────────────

function PlayerShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative w-full ${className ?? ''}`}>
      <div className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}

// ─── ArtPlayer core ───────────────────────────────────────────────────────────

interface ArtPlayerCoreProps extends ArtPlayerProps {
  resolvedUrl: string
}

function ArtPlayerCore({
  resolvedUrl,
  poster,
  title,
  className,
  onEnded,
  onProgress,
  initialPosition = 0,
  onLoad,
  onError,
  maxWatchSeconds,
  onLimitReached,
  episodes = [],
  currentEpisodeIndex = -1,
  onEpisodeSelect,
  contentType,
}: ArtPlayerCoreProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const artRef       = useRef<HTMLDivElement>(null)
  const playerRef    = useRef<Artplayer | null>(null)
  const [authError, setAuthError]       = useState<string | null>(null)
  const [showEpisodes, setShowEpisodes] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPlaying, setIsPlaying]       = useState(false)
  const controlsHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stableOnEnded = useCallback(() => { onEnded?.() }, [onEnded])
  const onLoadRef = useRef(onLoad)
  const onErrorRef = useRef(onError)
  const onProgressRef = useRef(onProgress)
  const onEpisodeSelectRef = useRef(onEpisodeSelect)

  useEffect(() => { onLoadRef.current = onLoad }, [onLoad])
  useEffect(() => { onErrorRef.current = onError }, [onError])
  useEffect(() => { onProgressRef.current = onProgress }, [onProgress])
  useEffect(() => { onEpisodeSelectRef.current = onEpisodeSelect }, [onEpisodeSelect])

  const getStreamErrorMessage = useCallback((error: any) => {
    const rawMessage = typeof error?.message === 'string' ? error.message.trim() : ''
    if (rawMessage && /(stream|limit|premium|trial|subscription|plan|watching|continue)/i.test(rawMessage)) {
      return rawMessage
    }

    if ((error as any)?.type === 'network') {
      return 'The stream is temporarily unavailable. Please check your connection and refresh the page.'
    }

    return 'Video stream failed to load. Please refresh the page or upgrade your plan to continue watching.'
  }, [])

  useEffect(() => {
    const restoreSavedPositionIfNeeded = () => {
      const video = playerRef.current?.video
      if (!video || video.seeking || (!video.paused && !video.ended) || video.currentTime > 3) return
      try {
        const saved = Number(localStorage.getItem(`kilax-resume:${resolvedUrl}`) || 0)
        const duration = Number.isFinite(video.duration) ? video.duration : 0
        if (saved > 0 && saved < duration && video.currentTime < 1) {
          video.currentTime = Math.max(saved, 0)
        }
      } catch { /* storage is optional */ }
    }

    const handlePageExit = () => {
      const video = playerRef.current?.video
      if (!video || video.paused || video.ended || video.seeking) return
      const resumeKey = `kilax-resume:${resolvedUrl}`
      try { localStorage.setItem(resumeKey, String(Math.floor(video.currentTime))) } catch { /* storage is optional */ }
      if (document.pictureInPictureElement || !document.pictureInPictureEnabled) {
        video.pause()
        return
      }
      void video.requestPictureInPicture?.().catch(() => video.pause())
    }
    const handleReturn = () => {
      restoreSavedPositionIfNeeded()
    }
    const handleVisibility = () => { if (document.hidden) handlePageExit(); else handleReturn() }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', handlePageExit)
    window.addEventListener('pageshow', handleReturn)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', handlePageExit)
      window.removeEventListener('pageshow', handleReturn)
    }
  }, [resolvedUrl])

  // ── Keyboard / remote control ──────────────────────────────────────────────
  useEffect(() => {
    const art = playerRef.current
    const handler = (e: KeyboardEvent) => {
      // Close episodes overlay first
      if (showEpisodes) {
        if (e.key === 'Escape' || e.key === 'Backspace') { setShowEpisodes(false); e.preventDefault(); return }
        return
      }

      const player = playerRef.current
      if (!player) return

      switch (e.key) {
        // ── Playback ──────────────────────────────────────────────────────
        case ' ':
        case 'Enter':
        case 'k':
        case 'K':
          e.preventDefault()
          player.toggle()
          break

        // ── Seek ──────────────────────────────────────────────────────────
        case 'ArrowRight':
        case 'l':
        case 'L':
          if (contentType === 'series' && currentEpisodeIndex < episodes.length - 1) {
            e.preventDefault()
            onEpisodeSelect?.(episodes[currentEpisodeIndex + 1])
          } else if (contentType !== 'series') {
            e.preventDefault()
            player.currentTime = Math.min(player.currentTime + 10, player.duration)
          }
          break

        case 'ArrowLeft':
        case 'j':
        case 'J':
          if (contentType === 'series' && currentEpisodeIndex > 0) {
            e.preventDefault()
            onEpisodeSelect?.(episodes[currentEpisodeIndex - 1])
          } else if (contentType !== 'series') {
            e.preventDefault()
            player.currentTime = Math.max(player.currentTime - 10, 0)
          }
          break

        case 'MediaTrackNext':
        case 'ChannelUp':
        case 'n':
        case 'N':
          if (contentType === 'series' && currentEpisodeIndex < episodes.length - 1) {
            e.preventDefault()
            onEpisodeSelect?.(episodes[currentEpisodeIndex + 1])
          }
          break

        case 'MediaTrackPrevious':
        case 'ChannelDown':
        case 'p':
        case 'P':
          if (contentType === 'series' && currentEpisodeIndex > 0) {
            e.preventDefault()
            onEpisodeSelect?.(episodes[currentEpisodeIndex - 1])
          }
          break

        // ── Volume ────────────────────────────────────────────────────────
        case 'ArrowUp':
          e.preventDefault()
          player.volume = Math.min(player.volume + 0.1, 1)
          break

        case 'ArrowDown':
          e.preventDefault()
          player.volume = Math.max(player.volume - 0.1, 0)
          break

        // ── Mute ─────────────────────────────────────────────────────────
        case 'm':
        case 'M':
          e.preventDefault()
          player.muted = !player.muted
          break

        // ── Fullscreen ────────────────────────────────────────────────────
        case 'f':
        case 'F':
          e.preventDefault()
          player.fullscreen = !player.fullscreen
          break

        // ── Episodes (series only) ────────────────────────────────────────
        case 'e':
        case 'E':
          if (contentType === 'series' && episodes.length > 0) {
            e.preventDefault()
            setShowEpisodes(true)
          }
          break

        // ── Number keys 0-9 — seek to % of duration ───────────────────────
        default:
          if (e.key >= '0' && e.key <= '9') {
            e.preventDefault()
            const pct = parseInt(e.key) / 10
            player.currentTime = player.duration * pct
          }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showEpisodes, contentType, episodes, currentEpisodeIndex, onEpisodeSelect])

  useEffect(() => {
    const showControls = () => {
      const player = playerRef.current
      if (!player) return
      player.controls.show = true
      window.dispatchEvent(new Event('kilax-player-interaction'))
      if (controlsHideTimer.current) clearTimeout(controlsHideTimer.current)
      controlsHideTimer.current = setTimeout(() => {
        if (playerRef.current?.playing) playerRef.current.controls.show = false
      }, 3500)
    }
    const events = ['pointermove', 'pointerdown', 'touchstart', 'mousemove']
    events.forEach((event) => artRef.current?.addEventListener(event, showControls, { passive: true }))
    window.addEventListener('keydown', showControls)
    return () => {
      events.forEach((event) => artRef.current?.removeEventListener(event, showControls))
      window.removeEventListener('keydown', showControls)
      if (controlsHideTimer.current) clearTimeout(controlsHideTimer.current)
    }
  }, [])

  // ── Build the player ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!artRef.current) return

    const videoType = resolvedUrl.toLowerCase().includes('.m3u8') ? 'm3u8' : undefined

    if (playerRef.current) {
      if (controlsHideTimer.current) {
        clearTimeout(controlsHideTimer.current)
        controlsHideTimer.current = null
      }
      try { playerRef.current.destroy(false) } catch { /* noop */ }
      playerRef.current = null
    }

    // ── Rewind / Forward custom controls ──────────────────────────────────
    const rewindHtml = `
      <button title="Rewind 10s (←)" style="
        background:none;border:none;cursor:pointer;padding:4px 6px;
        display:flex;align-items:center;justify-content:center;color:white;opacity:.85">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 17l-5-5 5-5"/><path d="M18 17l-5-5 5-5"/>
        </svg>
        <span style="font-size:10px;margin-left:2px;font-weight:700">10</span>
      </button>`

    const forwardHtml = `
      <button title="Forward 10s (→)" style="
        background:none;border:none;cursor:pointer;padding:4px 6px;
        display:flex;align-items:center;justify-content:center;color:white;opacity:.85">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 17l5-5-5-5"/><path d="M6 17l5-5-5-5"/>
        </svg>
        <span style="font-size:10px;margin-left:2px;font-weight:700">10</span>
      </button>`

    const previousEpisode = currentEpisodeIndex > 0 ? episodes[currentEpisodeIndex - 1] : null
    const nextEpisode = currentEpisodeIndex >= 0 && currentEpisodeIndex < episodes.length - 1
      ? episodes[currentEpisodeIndex + 1]
      : null
    const previousHtml = `
      <button title="Previous episode (←)" style="background:none;border:none;cursor:${previousEpisode ? 'pointer' : 'default'};padding:4px 6px;display:flex;align-items:center;justify-content:center;color:white;opacity:${previousEpisode ? '.85' : '.3'}">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 6v12"/><path d="M5 12l9-7v14z"/></svg>
      </button>`
    const nextHtml = `
      <button title="Next episode (→)" style="background:none;border:none;cursor:${nextEpisode ? 'pointer' : 'default'};padding:4px 6px;display:flex;align-items:center;justify-content:center;color:white;opacity:${nextEpisode ? '.85' : '.3'}">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6v12"/><path d="M19 12l-9-7v14z"/></svg>
      </button>`

    const art = new Artplayer({
      container: artRef.current,
      url: resolvedUrl,
      ...(poster ? { poster } : {}),
      volume: 0.5,
      isLive: false,
      muted: false,
      autoplay: true,
      pip: true,
      // autoSize MUST be false — it overrides container dimensions and hides controls
      autoSize: false,
      autoMini: false,
      screenshot: true,
      setting: true,
      loop: false,
      flip: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      mutex: true,
      backdrop: true,
      playsInline: true,
      autoPlayback: false,
      airplay: true,
      theme: '#f97316',
      lang: 'en',
      moreVideoAttr: { preload: 'metadata', crossOrigin: 'anonymous' } as any,
      fastForward: true,
      ...(videoType ? { type: videoType } : {}),
      controls: [
        ...(contentType === 'series' && episodes.length > 0 ? [
          {
            name: 'previousEpisode',
            position: 'left' as const,
            index: 13,
            html: previousHtml,
            tooltip: 'Previous episode',
            click: () => { if (previousEpisode) onEpisodeSelect?.(previousEpisode) },
          },
          {
            name: 'nextEpisode',
            position: 'left' as const,
            index: 14,
            html: nextHtml,
            tooltip: 'Next episode',
            click: () => { if (nextEpisode) onEpisodeSelect?.(nextEpisode) },
          },
        ] : []),
        // Rewind button — left side, after play button
        {
          name: 'rewind',
          position: 'left',
          index: 11,   // right after the built-in play (10) button
          html: rewindHtml,
          tooltip: 'Rewind 10s',
          click: function (_, event) {
            art.currentTime = Math.max(art.currentTime - 10, 0)
          },
        },
        // Forward button — left side, after rewind
        {
          name: 'forward',
          position: 'left',
          index: 12,
          html: forwardHtml,
          tooltip: 'Forward 10s',
          click: function (_, event) {
            art.currentTime = Math.min(art.currentTime + 10, art.duration)
          },
        },
      ],
    })

    // ── Events ────────────────────────────────────────────────────────────

    art.on('error', (error) => {
      const message = getStreamErrorMessage(error)
      setAuthError(message)
      onErrorRef.current?.(error)
    })

    art.on('play',  () => {
      setIsPlaying(true)
      document.body.style.overflow = 'hidden'
      window.dispatchEvent(new Event('kilax-player-playing'))
    })
    art.on('pause', () => { setIsPlaying(false); document.body.style.overflow = 'auto'; window.dispatchEvent(new Event('kilax-player-paused')) })
    art.on('video:ended', () => stableOnEnded())
    art.on('video:timeupdate', () => {
      onProgressRef.current?.(Math.floor(art.currentTime || 0), Math.floor(art.duration || 0))
      if (maxWatchSeconds && art.currentTime >= maxWatchSeconds) {
        art.pause()
        onLimitReached?.()
      }
    })

    art.on('ready', () => {
      onLoadRef.current?.()
      const hasResumePosition = initialPosition > 0 && art.duration > initialPosition + 3
      const hasPlaybackProgress = Number.isFinite(art.currentTime) && art.currentTime > 3
      if (hasResumePosition && !hasPlaybackProgress) {
        art.currentTime = initialPosition
      }

      const tryPlay = async () => {
        try { await art.play() } catch {
          try { art.muted = true; await art.play() } catch { /* user taps play */ }
        }
      }
      void tryPlay()

      // Swallow AbortError from play-then-immediate-pause
      if (art.video) {
        art.video.preload = 'metadata'
        const origPlay = art.video.play.bind(art.video)
        art.video.play = function () {
          const p = origPlay()
          p?.catch?.((e: Error) => { if (e.name !== 'AbortError') throw e })
          return p
        }
      }

      // Episodes button in control bar
      if (contentType === 'series' && episodes.length > 0) {
        art.controls.add({
          name: 'episodes',
          position: 'right',
          html: `<div style="padding:6px 10px;cursor:pointer;display:flex;align-items:center;
                   color:white;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.3);
                   border-radius:6px;font-size:12px;font-weight:600;gap:5px"
                 onmouseover="this.style.background='rgba(249,115,22,.25)'"
                 onmouseout="this.style.background='rgba(249,115,22,.1)'">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                     <rect x="3" y="3" width="18" height="18" rx="2"/>
                     <line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                   </svg>
                   Episodes
                 </div>`,
          tooltip: 'Episodes (E)',
          click: () => setShowEpisodes(true),
        })
      }
    })

    art.on('destroy', () => {
      setIsPlaying(false)
      document.body.style.overflow = 'auto'
      unlockOrientation()
    })

    art.on('fullscreen', (state: boolean) => {
      setIsFullscreen(state)
      document.body.style.overflow = state ? 'hidden' : 'auto'
      if (state) {
        lockLandscape()
        setTimeout(() => {
          if (art?.controls) {
            art.controls.show = true
          }
        }, 500)
      } else {
        unlockOrientation()
      }
    })

    art.on('fullscreenWeb', (state: boolean) => {
      document.body.style.overflow = state ? 'hidden' : 'auto'
      if (state) {
        setTimeout(() => {
          if (art?.controls) {
            art.controls.show = true
          }
        }, 300)
      }
    })

    const onOrientationChange = () => {
      setTimeout(() => {
        if (art?.controls) {
          art.controls.show = true
        }
      }, 300)
    }
    window.screen.orientation?.addEventListener('change', onOrientationChange)
    window.addEventListener('orientationchange', onOrientationChange)

    playerRef.current = art
    controlsHideTimer.current = setTimeout(() => {
      if (art.playing) art.controls.show = false
    }, 3500)

    return () => {
      if (controlsHideTimer.current) {
        clearTimeout(controlsHideTimer.current)
        controlsHideTimer.current = null
      }
      window.screen.orientation?.removeEventListener('change', onOrientationChange)
      window.removeEventListener('orientationchange', onOrientationChange)
      try { art.destroy(false) } catch { /* noop */ }
      document.body.style.overflow = 'auto'
      unlockOrientation()
    }
  }, [resolvedUrl, poster, stableOnEnded, initialPosition, contentType, episodes, currentEpisodeIndex, getStreamErrorMessage])

  if (authError) {
    return (
      <PlayerShell className={className}>
        <div className="text-center max-w-md px-4">
          <p className="text-red-400 mb-2">Stream Error</p>
          <p className="text-gray-400 text-sm mb-3">{authError}</p>
          <p className="text-gray-500 text-xs">Verify your connection or refresh the page.</p>
        </div>
      </PlayerShell>
    )
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className ?? ''}`}>
      {/* The artplayer container — aspect-video gives it its own height, never
          inheriting from the parent. autoSize is OFF so ArtPlayer won't resize
          the container and push the controls out of view. */}
      <div
        ref={artRef}
        className="w-full h-full bg-black rounded-lg"
        style={{ aspectRatio: '16/9', maxHeight: '100dvh' }}
      />

      {/* Kilax logo watermark */}
      <KilaxLogo />

      {/* Episodes overlay */}
      {showEpisodes && contentType === 'series' && episodes.length > 0 && (
        <EpisodesOverlay
          episodes={episodes}
          currentEpisodeIndex={currentEpisodeIndex}
          isFullscreen={isFullscreen}
          onClose={() => setShowEpisodes(false)}
          onSelect={(ep) => { onEpisodeSelect?.(ep); setShowEpisodes(false) }}
        />
      )}
    </div>
  )
}

// ─── Native HLS player (iOS / Safari) ────────────────────────────────────────

function NativeHLSPlayer({
  url,
  poster,
  title,
  className,
  onEnded,
  onProgress,
  initialPosition = 0,
  onLoad,
  onError,
  episodes = [],
  currentEpisodeIndex = -1,
  onEpisodeSelect,
  contentType,
}: ArtPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [showEpisodes, setShowEpisodes] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [streamError, setStreamError]   = useState<string | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (showEpisodes && (e.key === 'Escape' || e.key === 'Backspace')) { setShowEpisodes(false); e.preventDefault(); return }
      if (!showEpisodes && contentType === 'series' && episodes.length > 0 && (e.key === 'e' || e.key === 'E')) setShowEpisodes(true)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [showEpisodes, contentType, episodes.length])

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => { document.removeEventListener('fullscreenchange', onChange); document.removeEventListener('webkitfullscreenchange', onChange) }
  }, [])

  useEffect(() => {
    if (isFullscreen) { document.body.style.overflow = 'hidden'; lockLandscape() }
    else { document.body.style.overflow = 'auto'; unlockOrientation() }
  }, [isFullscreen])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !url || url === '#') return
    setStreamError(null)
    v.load()
    if (initialPosition > 0 && v.currentTime < 3 && (!Number.isFinite(v.duration) || v.duration > initialPosition + 3)) {
      v.currentTime = initialPosition
    }
    const tryPlay = async () => {
      try { await v.play() } catch {
        try { v.muted = true; await v.play() } catch { /* user taps */ }
      }
    }
    void tryPlay()
  }, [url])

  useEffect(() => {
    const handlePageExit = () => {
      const video = videoRef.current
      if (!video || video.paused || video.ended || video.seeking) return
      const resumeKey = `kilax-resume:${url}`
      try { localStorage.setItem(resumeKey, String(Math.floor(video.currentTime))) } catch { /* storage is optional */ }
      if (document.pictureInPictureElement || !document.pictureInPictureEnabled) {
        video.pause()
        return
      }
      void video.requestPictureInPicture?.().catch(() => video.pause())
    }
    const handleReturn = () => {
      const video = videoRef.current
      if (!video || video.seeking || (!video.paused && !video.ended) || video.currentTime > 3) return
      try {
        const saved = Number(localStorage.getItem(`kilax-resume:${url}`) || 0)
        const duration = Number.isFinite(video.duration) ? video.duration : 0
        if (saved > 0 && saved < duration && video.currentTime < 1) video.currentTime = saved
      } catch { /* storage is optional */ }
    }
    const handleVisibility = () => { if (document.hidden) handlePageExit(); else handleReturn() }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', handlePageExit)
    window.addEventListener('pageshow', handleReturn)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', handlePageExit)
      window.removeEventListener('pageshow', handleReturn)
    }
  }, [url])

  useEffect(() => () => { document.body.style.overflow = 'auto'; unlockOrientation() }, [])

  if (streamError) return (
    <PlayerShell className={className}>
      <div className="text-center max-w-md px-4">
        <p className="text-red-400 mb-2">Stream Error</p>
        <p className="text-gray-400 text-sm">{streamError}</p>
      </div>
    </PlayerShell>
  )

  return (
    <div className={`relative w-full ${className ?? ''}`}>
      <div className="w-full bg-black rounded-lg" style={{ aspectRatio: '16/9' }}>
        <video
          ref={videoRef}
          src={url}
          poster={poster}
          title={title}
          playsInline
          controls
          preload="metadata"
          crossOrigin="anonymous"
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
          onLoadedData={() => onLoad?.()}
          onTimeUpdate={() => { const video = videoRef.current; if (video) onProgress?.(Math.floor(video.currentTime || 0), Math.floor(video.duration || 0)) }}
          onEnded={() => onEnded?.()}
          onError={(e) => {
            const rawMessage = typeof (e as any)?.target?.error?.message === 'string' ? (e as any).target.error.message.trim() : ''
            const message = rawMessage && /(stream|limit|premium|trial|subscription|plan|watching|continue)/i.test(rawMessage)
              ? rawMessage
              : 'Video failed to load. Please check your connection, refresh the page, or upgrade your plan to continue watching.'
            setStreamError(message)
            onError?.(e)
          }}
        />
      </div>

      {/* Logo */}
      <KilaxLogo />

      {contentType === 'series' && episodes.length > 0 && (
        <button
          onClick={() => setShowEpisodes(true)}
          className="absolute bottom-14 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded text-white text-xs font-medium"
          style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.35)', backdropFilter: 'blur(4px)' }}
          aria-label="View episodes"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          Episodes
        </button>
      )}

      {showEpisodes && contentType === 'series' && episodes.length > 0 && (
        <EpisodesOverlay
          episodes={episodes}
          currentEpisodeIndex={currentEpisodeIndex}
          isFullscreen={isFullscreen}
          onClose={() => setShowEpisodes(false)}
          onSelect={(ep) => { onEpisodeSelect?.(ep); setShowEpisodes(false) }}
        />
      )}
    </div>
  )
}

// ─── Public export ────────────────────────────────────────────────────────────

export function ArtPlayer(props: ArtPlayerProps) {
  const { url, poster, title, className, onEnded, onProgress, initialPosition, onLoad, onError, episodes, currentEpisodeIndex, onEpisodeSelect, contentType } = props
  const device = useDevice()

  const [resolvedUrl, setResolvedUrl]   = useState<string | null>(null)
  const [formatError, setFormatError]   = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!url || url === '#') { setResolvedUrl(null); setFormatError(null); return }

    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }

    setFormatError(null)

    if (device.isIOS && url.toLowerCase().includes('.mkv')) {
      setFormatError('MKV format is not supported on iOS. Please use the download option to watch with VLC player.')
      setResolvedUrl(null)
      return
    }

    setResolvedUrl(url)
    return () => { if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null } }
  }, [url, device.isIOS])

  if (formatError) return (
    <PlayerShell className={className}>
      <div className="text-center max-w-md px-4">
        <p className="text-red-400 mb-2">Unsupported Video Format</p>
        <p className="text-gray-400 text-sm mb-3">{formatError}</p>
        <p className="text-gray-500 text-xs">iOS cannot play MKV in-browser. Use the download option to watch with VLC.</p>
      </div>
    </PlayerShell>
  )

  if (!resolvedUrl) return (
    <PlayerShell className={className}>
      <div className="text-center">
        <p className="text-white mb-2">Video not available</p>
        <p className="text-gray-400 text-sm">No valid video source found</p>
      </div>
    </PlayerShell>
  )

  const isHLS = resolvedUrl.toLowerCase().includes('.m3u8')

  if (device.defaultStrategy === 'hls-native' && isHLS) {
    return (
      <NativeHLSPlayer
        url={resolvedUrl} poster={poster} title={title} className={className}
        onEnded={onEnded} onProgress={onProgress} initialPosition={initialPosition} onLoad={onLoad} onError={onError}
        episodes={episodes} currentEpisodeIndex={currentEpisodeIndex}
        onEpisodeSelect={onEpisodeSelect} contentType={contentType}
      />
    )
  }

  return (
    <ArtPlayerCore
      url={resolvedUrl} resolvedUrl={resolvedUrl} poster={poster} title={title} className={className}
      onEnded={onEnded} onProgress={onProgress} initialPosition={initialPosition} onLoad={onLoad} onError={onError}
      episodes={episodes} currentEpisodeIndex={currentEpisodeIndex}
      onEpisodeSelect={onEpisodeSelect} contentType={contentType}
    />
  )
}
