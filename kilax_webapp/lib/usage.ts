import { supabase } from '@/lib/supabase'

export type UsageEventType =
  | 'card_view'
  | 'stream_started'
  | 'stream_completed'
  | 'stream_incomplete'
  | 'playback_progress'

export async function recordUsageActivity(input: {
  eventType: UsageEventType
  contentType: string
  contentId: string
  contentTitle?: string | null
  season?: number | null
  episode?: number | null
  positionSeconds?: number | null
  durationSeconds?: number | null
  watchSeconds?: number | null
}): Promise<{ ok: boolean; code?: string; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { ok: false, error: 'Authentication required' }

  try {
    const response = await fetch('/api/usage/activity', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: input.eventType,
        content_type: input.contentType,
        content_id: input.contentId,
        content_title: input.contentTitle || null,
        season: input.season ?? null,
        episode: input.episode ?? null,
        position_seconds: input.positionSeconds ?? null,
        duration_seconds: input.durationSeconds ?? null,
        watch_seconds: input.watchSeconds ?? null,
      }),
      keepalive: true,
    })

    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      if (process.env.NODE_ENV === 'development') console.warn('[usage] activity request failed:', response.status, result)
      return { ok: false, code: result.code, error: result.error }
    }
    return { ok: true }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[usage] activity request unavailable:', error)
    }
    return { ok: false, error: error instanceof Error ? error.message : 'Activity request unavailable' }
  }
}
