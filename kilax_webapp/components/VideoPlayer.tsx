"use client";

import React, { useEffect, useRef, useState } from 'react';
import OPlayer from '@oplayer/core';
import OUI from '@oplayer/ui';
import OHls from '@oplayer/hls';
import type { Player, PlayerEvent, Source } from '@oplayer/core';
import type { EpisodeWithSeason } from '@/lib/supabase';

interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  onError?: (error: any) => void;
  onLoad?: () => void;
  onEnded?: () => void;
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
  initialPosition?: number;
  subscriptionPlan?: string | null;
  isPremiumContent?: boolean;
  episodes?: EpisodeWithSeason[];
  currentEpisodeIndex?: number;
  onEpisodeSelect?: (episode: EpisodeWithSeason) => void;
  contentType?: string;
  userId?: string;
}

function sourceFor(url: string, title?: string, poster?: string): Source {
  const isHls = /\.m3u8(?:$|[?#])/i.test(url);
  return { src: url, title, poster, ...(isHls ? { format: 'hls', type: 'application/vnd.apple.mpegurl' } : {}) };
}

export default function VideoPlayer({
  src, title, poster, onError, onLoad, onEnded, onProgress, initialPosition = 0,
  episodes = [], currentEpisodeIndex = -1, onEpisodeSelect, contentType, userId,
}: VideoPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [castAvailable, setCastAvailable] = useState(false);
  const [pipAvailable, setPipAvailable] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !src) return;

    const player = OPlayer.make(host, { source: sourceFor(src, title, poster), autoplay: true, playsinline: true, preload: 'metadata' });
    player.use([
      OUI({ pictureInPicture: true, screenshot: false, keyboard: { global: true } }),
      OHls({ forceHLS: false }),
    ]).create();
    playerRef.current = player;

    const handleEvent = (event: PlayerEvent) => {
      const video = (player as any).$video as HTMLVideoElement | undefined;
      if (event.type === 'loadeddata' || event.type === 'canplay') {
        if (initialPosition > 0 && video && video.currentTime < 1) video.currentTime = initialPosition;
        setPipAvailable(Boolean((player as any).isPipEnabled));
        onLoad?.();
      }
      if (event.type === 'timeupdate' && video) onProgress?.(Math.floor(video.currentTime || 0), Math.floor(video.duration || 0));
      if (event.type === 'ended') onEnded?.();
      if (event.type === 'error') onError?.(event.payload);
    };
    player.on('*' as any, handleEvent as any);

    try {
      if (!localStorage.getItem(`kilax-player-tour-seen:${userId || 'guest'}`)) setShowTour(true);
    } catch { /* storage is optional */ }

    return () => {
      try { player.destroy(); } catch { /* noop */ }
      playerRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const canAirplay = Boolean((HTMLVideoElement.prototype as any).webkitShowPlaybackTargetPicker);
    const canCast = Boolean((window as any).chrome?.cast);
    setCastAvailable(canAirplay || canCast);
  }, []);

  const cast = () => {
    const video = (playerRef.current as any)?.$video as HTMLVideoElement | undefined;
    const picker = (video as any)?.webkitShowPlaybackTargetPicker;
    if (picker) picker.call(video);
    else if ((window as any).chrome?.cast) (window as any).chrome.cast.requestSession?.(() => undefined, () => undefined);
  };

  const togglePip = () => {
    const player = playerRef.current as any;
    if (player?.isPipEnabled) void player.togglePip();
  };

  const dismissTour = () => {
    setShowTour(false);
    try { localStorage.setItem(`kilax-player-tour-seen:${userId || 'guest'}`, '1'); } catch { /* storage is optional */ }
  };

  return (
    <div className="relative h-full w-full bg-black">
      <div ref={hostRef} className="w-full aspect-video overflow-hidden rounded-lg bg-black" />
      <img src="/logo-512.png" alt="Kilax Movies" className="pointer-events-none absolute right-3 top-3 z-20 h-10 w-auto rounded opacity-90 drop-shadow-lg" />

      <div className="absolute bottom-16 right-3 z-30 flex gap-2">
        {contentType === 'series' && episodes.length > 0 && <button onClick={() => setShowEpisodes(true)} className="rounded bg-orange-500/90 px-3 py-1.5 text-xs font-semibold text-white shadow" aria-label="View episodes">Episodes</button>}
        {pipAvailable && <button onClick={togglePip} className="rounded bg-black/70 px-3 py-1.5 text-xs font-semibold text-white shadow" aria-label="Picture in picture">PiP</button>}
        {castAvailable && <button onClick={cast} className="rounded bg-black/70 px-3 py-1.5 text-xs font-semibold text-white shadow" aria-label="Cast video">Cast</button>}
      </div>

      {showTour && <div className="absolute inset-0 z-40 grid place-items-center bg-black/75 p-4" role="dialog" aria-label="Player guide"><div className="w-full max-w-sm rounded-xl border border-white/15 bg-gray-900 p-5 text-white shadow-2xl"><h2 className="mb-3 text-lg font-bold">Player guide</h2><p className="mb-2 text-sm text-gray-300"><strong>Play:</strong> start or pause the video.</p><p className="mb-2 text-sm text-gray-300"><strong>Episodes:</strong> choose another series episode.</p><p className="mb-4 text-sm text-gray-300"><strong>Cast:</strong> send playback to a supported TV or AirPlay device.</p><button onClick={dismissTour} className="w-full rounded bg-orange-500 px-4 py-2 text-sm font-bold text-white">Got it</button></div></div>}

      {showEpisodes && <div className="fixed inset-0 z-50 flex justify-end bg-black/80" onClick={() => setShowEpisodes(false)}><div className="h-full w-full max-w-md overflow-y-auto bg-gray-900 p-5" onClick={event => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-white">Episodes</h2><button onClick={() => setShowEpisodes(false)} className="text-2xl text-gray-400" aria-label="Close episodes">×</button></div><div className="space-y-2">{episodes.map((episode, index) => <button key={episode.id} onClick={() => { onEpisodeSelect?.(episode); setShowEpisodes(false); }} className={`flex w-full items-center gap-3 rounded-lg p-3 text-left ${index === currentEpisodeIndex ? 'bg-orange-500/20 ring-1 ring-orange-500' : 'bg-white/5'}`}><span className="text-sm font-bold text-orange-400">{episode.episode_number}</span><span className="truncate text-sm text-white">{episode.title}</span></button>)}</div></div></div>}
    </div>
  );
}
