import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

const EVENT_TYPES = new Set([
  'card_view',
  'stream_started',
  'stream_completed',
  'stream_incomplete',
  'playback_progress',
])

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

    if (eventType === 'playback_progress' && contentType === 'movie') {
      const { data: profile } = await (supabaseAdmin as any)
        .from('profiles')
        .select('subscription, trial_status, trial_expires_at')
        .eq('id', user.id)
        .maybeSingle()
      const isTrial = profile?.trial_status === 'active' && profile?.trial_expires_at && new Date(profile.trial_expires_at) > new Date()
      const isFree = !isTrial && (!profile?.subscription || profile.subscription.toLowerCase() === 'free')
      if (isFree) {
        const { data: movieEvents } = await (supabaseAdmin as any)
          .from('user_video_activity')
          .select('watch_seconds, created_at')
          .eq('user_id', user.id)
          .eq('content_type', 'movie')
          .eq('event_type', 'playback_progress')
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)
        const watchedToday = (movieEvents || [])
          .filter((row: { created_at: string }) => new Date(row.created_at) >= today)
          .reduce((total: number, row: { watch_seconds?: number }) => total + Number(row.watch_seconds || 0), 0)
        if (watchedToday >= 30 * 60) {
          return NextResponse.json({ error: 'Your free 30-minute movie allowance has been reached today. Subscribe to Premium to continue watching.', code: 'FREE_MOVIE_LIMIT', limitReached: true, subscribeUrl: '/subscribe' }, { status: 403 })
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
