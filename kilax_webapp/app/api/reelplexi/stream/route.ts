import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import ReelplexiService from '@/lib/reelplexi-service'

const MOVIE_FREE_SECONDS = 30 * 60

async function getEntitlement(userId: string, type: string) {
  const [{ data: profile, error: profileError }, { data: activity, error: activityError }] = await Promise.all([
    (supabaseAdmin as any).from('profiles').select('subscription, subscription_start_date, subscription_expiry_date, trial_started_at, trial_expires_at, trial_status').eq('id', userId).maybeSingle(),
    (supabaseAdmin as any).from('user_video_activity').select('content_type, content_id, watch_seconds, created_at').eq('user_id', userId).eq('event_type', 'stream_started').order('created_at', { ascending: false }),
  ])
  if (profileError) throw profileError
  if (activityError) throw activityError

  const now = Date.now()
  const profileData = profile || {}
  const subscription = String(profileData.subscription || 'free')
  const expiry = profileData.subscription_expiry_date ? new Date(profileData.subscription_expiry_date).getTime() : 0
  const isStarter = /starter/i.test(subscription) && expiry > now
  const isPaid = subscription.toLowerCase() !== 'free' && subscription.toLowerCase() !== 'trial' && !isStarter && expiry > now
  if (isPaid) return null

  const events = activity || []
  const trialActive = profileData.trial_status === 'active' && profileData.trial_expires_at && new Date(profileData.trial_expires_at).getTime() > now
  if (trialActive) {
    const trialStart = profileData.trial_started_at ? new Date(profileData.trial_started_at).toISOString() : new Date(0).toISOString()
    const used = events.filter((row: any) => row.created_at >= trialStart).length
    if (used >= 3) return { code: 'TRIAL_STREAM_LIMIT', message: 'Your 2-day trial has reached its 3-stream limit. Subscribe to Premium to keep watching.' }
    return null
  }

  if (isStarter) {
    const startedAt = profileData.subscription_start_date || new Date(0).toISOString()
    const used = events.filter((row: any) => row.created_at >= startedAt).length
    if (used >= 2) return { code: 'STARTER_STREAM_LIMIT', message: 'Kilax Starter includes 2 streams. Subscribe to Premium for continued access.' }
    return null
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayEvents = events.filter((row: any) => new Date(row.created_at).getTime() >= today.getTime())
  if (type === 'episode' || type === 'series') {
    if (todayEvents.some((row: any) => row.content_type === 'series' || row.content_type === 'episode')) {
      return { code: 'FREE_EPISODE_LIMIT', message: 'Your free daily episode has been used. Subscribe to Premium to watch more.' }
    }
  } else {
    const movieSeconds = todayEvents.filter((row: any) => row.content_type === 'movie').reduce((sum: number, row: any) => sum + Number(row.watch_seconds || 0), 0)
    if (movieSeconds >= MOVIE_FREE_SECONDS) {
      return { code: 'FREE_MOVIE_LIMIT', message: 'Your free 30-minute movie allowance has been reached today. Subscribe to Premium to continue watching.' }
    }
  }
  return null
}

/**
 * GET /api/reelplexi/stream?type=movie|episode&id=...&season=...&episode=...
 *
 * Returns:
 *   { stream_url: string, is_embed: boolean }
 *
 * stream_url  — the URL to play (embed URL or direct stream URL)
 * is_embed    — true when stream_url is an iframe embed (use <iframe>),
 *               false when it's a direct media URL (use <video>)
 */
export async function GET(request: NextRequest) {
  try {
    const params  = request.nextUrl.searchParams
    const type    = params.get('type')
    const id      = params.get('id')
    const season  = Number(params.get('season')  || '1')
    const episode = Number(params.get('episode') || '1')

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Missing required parameters: type and id' },
        { status: 400 }
      )
    }

    const authorization = request.headers.get('authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: { user } } = await client.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const entitlementError = await getEntitlement(user.id, type)
    if (entitlementError) {
      return NextResponse.json({ error: entitlementError.message, code: entitlementError.code, limitReached: true, subscribeUrl: '/subscribe' }, { status: 403 })
    }

    const result = type === 'movie'
      ? await ReelplexiService.getMovieStream(id)
      : await ReelplexiService.getEpisodeStream(id, season, episode)

    if (!result?.stream_url) {
      return NextResponse.json(
        { error: 'Stream URL unavailable for this content' },
        { status: 404 }
      )
    }

    {
        const title = type === 'movie' ? 'Movie' : `Episode ${episode}`
        const { error } = await (supabaseAdmin as any).rpc('record_kilax_usage_activity', {
          p_user_id: user.id,
          p_content_type: type === 'episode' ? 'series' : type,
          p_content_id: id,
          p_event_type: 'stream_started',
          p_content_title: title,
          p_season: type === 'episode' ? season : 0,
          p_episode: type === 'episode' ? episode : 0,
          p_position_secs: 0,
          p_duration_secs: null,
          p_watch_seconds: 0,
          p_plan: null,
        })
        if (error) console.error('[stream route] usage tracking failed:', error)
    }

    return NextResponse.json({
      stream_url: result.stream_url,
      is_embed:   result.is_embed,
    })

  } catch (error) {
    console.error('[stream route] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Stream request failed' },
      { status: 502 }
    )
  }
}
