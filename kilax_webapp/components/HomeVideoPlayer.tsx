"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArtPlayer } from '@/components/ArtPlayer'
import type { EpisodeWithSeason } from '@/lib/supabase'
import type { Episode, MediaItem } from '@/lib/types/media'
import { ORANGE } from '@/lib/ui-config'
import { normalizeVideoUrl } from '@/lib/utils'

interface HomeVideoPlayerProps {
  item: MediaItem
  episodes?: Episode[]
  initialEpisodeIndex?: number
  onClose: () => void
  onBack?: () => void
  onReady?: () => void
  freeLimitSeconds?: number
  onLimitReached?: () => void
}

export default function HomeVideoPlayer({
  item,
  episodes,
  initialEpisodeIndex = 0,
  onClose,
  onBack,
  onReady,
  freeLimitSeconds,
  onLimitReached,
}: HomeVideoPlayerProps) {
  const [episodeIndex, setEpisodeIndex] = useState(initialEpisodeIndex)
  const [playerReady, setPlayerReady] = useState(false)
  const [hasError, setHasError] = useState(false)
  const nextEpisode = episodes?.[episodeIndex + 1]
  const currentEpisode = episodes?.[episodeIndex]
  const rawSource = currentEpisode?.videoUrl || item.embedUrl || ''
  const isEmbed = rawSource.includes('embed.reelplexi.com')
  const source = isEmbed ? rawSource : normalizeVideoUrl(rawSource)

  useEffect(() => {
    setEpisodeIndex(Math.max(0, Math.min(initialEpisodeIndex, (episodes?.length || 1) - 1)))
  }, [initialEpisodeIndex, episodes?.length])

  useEffect(() => {
    setPlayerReady(false)
    setHasError(false)
  }, [source])

  useEffect(() => {
    if (!freeLimitSeconds || !isEmbed) return
    const timer = window.setTimeout(() => onLimitReached?.(), freeLimitSeconds * 1000)
    return () => window.clearTimeout(timer)
  }, [freeLimitSeconds, isEmbed, onLimitReached, source])

  const markPlayerReady = useCallback(() => {
    setPlayerReady(true)
    setHasError(false)
    onReady?.()
  }, [onReady])

  const markPlayerError = useCallback((error: any) => {
    console.error('Player error:', error)
    setPlayerReady(true) // Clear loading state so error is visible
    setHasError(true)
  }, [])

  const playerEpisodes: EpisodeWithSeason[] = useMemo(() => (episodes || []).map((episode, index) => ({
    id: `kilax-${item.id}-${index}`,
    season_id: `kilax-season-${item.id}-${episode.season}`,
    title: episode.title || `Episode ${episode.ep}`,
    episode_number: episode.ep,
    video_url: episode.videoUrl || undefined,
    videolink_url: episode.videoUrl || undefined,
    published: true,
    premium: false,
    duration: undefined,
    thumbnail_url: episode.thumbnail || item.image,
    created_at: '',
    seasonName: `Season ${episode.season}`,
    seasonOrder: episode.season,
  })), [episodes, item.id, item.image])

  const handleEpisodeSelect = useCallback((episode: EpisodeWithSeason) => {
    const index = playerEpisodes.findIndex(candidate => candidate.id === episode.id)
    if (index >= 0) setEpisodeIndex(index)
  }, [playerEpisodes])

  const handleEnded = useCallback(() => {
    if (nextEpisode) setEpisodeIndex(index => index + 1)
  }, [nextEpisode])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 100000 }}>
        <button
          onClick={onBack ?? onClose}
          aria-label="Back"
          style={{ background: 'rgba(0,0,0,.62)', color: 'white', border: '1px solid rgba(255,255,255,.16)', borderRadius: 9, padding: '8px 14px', fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(10px)' }}
        >
          Back
        </button>
      </div>

      <div style={{ width: '100%', background: '#000' }}>
        {source ? (
          <div style={{ position: 'relative', width: '100%' }}>
            {isEmbed ? (
              <iframe
                key={`kilax-embed-${source}`}
                src={`${source}${source.includes('?') ? '&' : '?'}autoplay=1`}
                title={item.title}
                onLoad={markPlayerReady}
                style={{ width: '100%', aspectRatio: '16/9', border: 0, display: 'block' }}
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <ArtPlayer
                key={`kilax-artplayer-${source}`}
                url={source}
                title={currentEpisode ? `${item.title} - S${currentEpisode.season} E${currentEpisode.ep}: ${currentEpisode.title}` : item.title}
                poster={currentEpisode?.thumbnail || item.image}
                className="w-full"
                onEnded={handleEnded}
                onLoad={markPlayerReady}
                onError={markPlayerError}
                maxWatchSeconds={freeLimitSeconds}
                onLimitReached={onLimitReached}
                episodes={item.type === 'series' ? playerEpisodes : []}
                currentEpisodeIndex={item.type === 'series' ? episodeIndex : -1}
                onEpisodeSelect={item.type === 'series' ? handleEpisodeSelect : undefined}
                contentType={item.type}
              />
            )}
            {!playerReady && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.86)', color: 'white', textAlign: 'center' }}>
                <div>
                  <div className="spin" style={{ width: 34, height: 34, border: '3px solid rgba(255,255,255,.2)', borderTopColor: ORANGE, borderRadius: '50%', margin: '0 auto 16px' }} />
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Kilax is preparing your video...</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>
            <p style={{ color: 'white', fontWeight: 700, marginBottom: 6 }}>Video stream unavailable</p>
            <p style={{ fontSize: 13 }}>Please try again or choose another title.</p>
          </div>
        )}
      </div>
    </div>
  )
}
