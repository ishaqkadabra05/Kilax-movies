import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import { userHasActivePaidSubscription } from '@/lib/subscriptions'

const EVENT_TYPES = new Set([
  'card_view',
  'stream_started',
  'stream_completed',
  'stream_incomplete',
  'playback_progress',
])
const FREE_MOVIE_LIMIT_SECONDS = 40 * 60
const FREE_SERIES_LIMIT_EPISODES = 2
const TRIAL_STREAM_LIMIT = 2

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const body = await request.json()
    const eventType = String(body.event_type || '')
    const contentType = String(body.content_type || '')
    const contentId = String(body.content_id || '')

    if (!EVENT_TYPES.has(eventType) || !contentType || !contentId) {
      return NextResponse.json({ error: 'Invalid usage event' }, { status: 400 })
    }

    const activity = {
      user_id: user.id,
      content_type: contentType,
      content_id: contentId,
      content_title: body.content_title ? String(body.content_title) : null,
      season: Number.isInteger(body.season) ? body.season : 0,
      episode: Number.isInteger(body.episode) ? body.episode : 0,
      event_type: eventType,
      position_seconds: Number.isInteger(body.position_seconds) ? body.position_seconds : null,
      duration_seconds: Number.isInteger(body.duration_seconds) ? body.duration_seconds : null,
      watch_seconds: Number.isInteger(body.watch_seconds) ? body.watch_seconds : null,
      plan: body.plan ? String(body.plan) : null,
    }

    if (eventType === 'playback_progress') {
      const { data: profile } = await (supabaseAdmin as any)
        .from('profiles')
        .select('subscription, trial_status, trial_expires_at')
        .eq('id', user.id)
        .maybeSingle()
      const hasActivePaidSubscription = await userHasActivePaidSubscription(user.id)
      const isTrial = profile?.trial_status === 'active' && profile?.trial_expires_at && new Date(profile.trial_expires_at) > new Date()
      const isFree = !hasActivePaidSubscription && !isTrial && (!profile?.subscription || profile.subscription.toLowerCase() === 'free')

      if (isTrial) {
        const { data: trialEvents } = await (supabaseAdmin as any)
          .from('user_video_activity')
          .select('created_at')
          .eq('user_id', user.id)
          .eq('event_type', 'stream_started')
        const dayStart = Date.now() - 24 * 60 * 60 * 1000
        const recentStreams = (trialEvents || []).filter((row: { created_at: string }) => new Date(row.created_at).getTime() >= dayStart).length
        if (recentStreams >= TRIAL_STREAM_LIMIT) {
          return NextResponse.json({ error: 'Your trial stream limit is reached. View your profile to continue watching.', code: 'TRIAL_STREAM_LIMIT', limitReached: true, subscribeUrl: '/profile' }, { status: 403 })
        }
      }

      if (isFree) {
        const { data: usageEvents } = await (supabaseAdmin as any)
          .from('user_video_activity')
          .select('content_type, watch_seconds, created_at')
          .eq('user_id', user.id)
          .in('content_type', ['movie', 'series', 'episode'])
          .eq('event_type', 'playback_progress')
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)

        if (contentType === 'movie') {
          const watchedToday = (usageEvents || [])
            .filter((row: { created_at: string; content_type: string }) => row.content_type === 'movie' && new Date(row.created_at) >= today)
            .reduce((total: number, row: { watch_seconds?: number }) => total + Number(row.watch_seconds || 0), 0)
          if (watchedToday >= FREE_MOVIE_LIMIT_SECONDS) {
            return NextResponse.json({ error: 'Your free movie limit is reached. View your profile to continue watching.', code: 'FREE_MOVIE_LIMIT', limitReached: true, subscribeUrl: '/profile' }, { status: 403 })
          }
        }

        if (contentType === 'series' || contentType === 'episode') {
          const episodesToday = (usageEvents || [])
            .filter((row: { created_at: string; content_type: string }) => ['series', 'episode'].includes(row.content_type) && new Date(row.created_at) >= today)
            .length
          if (episodesToday >= FREE_SERIES_LIMIT_EPISODES) {
            return NextResponse.json({ error: 'Your free series limit is reached. View your profile to continue watching.', code: 'FREE_SERIES_LIMIT', limitReached: true, subscribeUrl: '/profile' }, { status: 403 })
          }
        }
      }
    }

    const { error } = await (supabaseAdmin as any).rpc('record_kilax_usage_activity', {
      p_user_id: user.id,
      p_content_type: contentType,
      p_content_id: contentId,
      p_event_type: eventType,
      p_content_title: body.content_title ? String(body.content_title) : null,
      p_season: Number.isInteger(body.season) ? body.season : 0,
      p_episode: Number.isInteger(body.episode) ? body.episode : 0,
      p_position_secs: Number.isInteger(body.position_seconds) ? body.position_seconds : null,
      p_duration_secs: Number.isInteger(body.duration_seconds) ? body.duration_seconds : null,
      p_watch_seconds: Number.isInteger(body.watch_seconds) ? body.watch_seconds : null,
      p_plan: body.plan ? String(body.plan) : null,
    })

    if (error) {
      console.error('[usage] record activity RPC error; using direct insert fallback:', error)
      const fallback = await (supabaseAdmin as any).from('user_video_activity').insert(activity)
      if (fallback.error) {
        console.error('[usage] direct activity insert error:', fallback.error)
        return NextResponse.json({ error: 'Unable to record usage activity' }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[usage] unexpected error:', error)
    return NextResponse.json({ error: 'Unable to record usage activity' }, { status: 500 })
  }
}
