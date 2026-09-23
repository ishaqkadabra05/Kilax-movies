import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import ReelplexiService from '@/lib/reelplexi-service'

// Plans that are allowed to download
const DOWNLOAD_PLANS = /standard|pro|go\s*pro|premium/i

function canPlanDownload(plan: string): boolean {
  return DOWNLOAD_PLANS.test(plan)
}

async function authorize(req: NextRequest) {
  const auth  = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return { ok: false as const, status: 401, message: 'Authentication required' }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return { ok: false as const, status: 401, message: 'Authentication required' }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('subscription, subscription_expiry_date, trial_status, trial_expires_at')
    .eq('id', user.id)
    .maybeSingle() as { data: { subscription?: string | null; subscription_expiry_date?: string | null; trial_status?: string | null; trial_expires_at?: string | null } | null }

  const plan   = String(profile?.subscription || 'free')
  const expiry = profile?.subscription_expiry_date ? new Date(profile.subscription_expiry_date) : null
  const trialActive = profile?.trial_status === 'active' && profile?.trial_expires_at && new Date(profile.trial_expires_at) > new Date()
  const active = (plan.toLowerCase() !== 'free' && !!expiry && expiry > new Date()) || Boolean(trialActive)

  if ((!active || !canPlanDownload(plan)) && !trialActive) {
    return {
      ok: false as const,
      status: 403,
      message: 'Downloads are available on Standard and Pro packages only.',
    }
  }

  return { ok: true as const, userId: user.id, plan, trialActive: Boolean(trialActive) }
}

async function resolveDownload(req: NextRequest, userId: string, plan: string) {
  const id      = req.nextUrl.searchParams.get('id')
  const type    = req.nextUrl.searchParams.get('type') || 'movie'
  const season  = req.nextUrl.searchParams.get('season')
  const episode = req.nextUrl.searchParams.get('episode')
  const title   = req.nextUrl.searchParams.get('title') || null

  const logEvent = async (status: string, errorMessage?: string) => {
    const { error } = await (supabaseAdmin as any).from('download_events').insert({
      user_id: userId,
      content_type: type === 'movie' ? 'movie' : 'series',
      content_id: id || 'unknown',
      content_title: title,
      season: season ? Number(season) : null,
      episode: episode ? Number(episode) : null,
      plan,
      status,
      error_message: errorMessage || null,
    })
    if (error) console.error('[download] request audit insert error:', error)
  }

  if (!id) {
    await logEvent('invalid_request', 'id is required')
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  if (type !== 'movie' && type !== 'episode') {
    await logEvent('invalid_request', 'Unsupported download type')
    return NextResponse.json({ error: 'Unsupported download type' }, { status: 400 })
  }

  const contentType = type === 'movie' ? 'movie' : 'series'

  // ── 1. Resolve Reelplexi signed URL ────────────────────────
  let resolvedUrl: string
  let filename: string | null = null
  let expiresAt: string | null = null

  try {
    if (type === 'movie') {
      const result = await ReelplexiService.getMovieDownloadUrl(id)
      // getMovieDownloadUrl currently returns just the URL string;
      // if the API ever returns the full object we handle both shapes
      if (typeof result === 'string') {
        resolvedUrl = result
      } else {
        const r = result as any
        resolvedUrl = r.download_url
        filename    = r.filename   ?? null
        expiresAt   = r.expires_at ?? null
      }
    } else {
      if (!season || !episode) {
        await logEvent('invalid_request', 'season and episode are required')
        return NextResponse.json({ error: 'season and episode are required for episode downloads' }, { status: 400 })
      }
      const result = await ReelplexiService.getEpisodeDownloadUrl(id, Number(season), Number(episode))
      if (typeof result === 'string') {
        resolvedUrl = result
      } else {
        const r = result as any
        resolvedUrl = r.download_url
        filename    = r.filename   ?? null
        expiresAt   = r.expires_at ?? null
      }
    }
  } catch (err: any) {
    console.error('[download] Reelplexi URL error:', err?.message)
    await logEvent('provider_error', err?.message || 'Download URL unavailable')
    return NextResponse.json({ error: err?.message || 'Download URL unavailable' }, { status: 502 })
  }

  if (!resolvedUrl) {
    await logEvent('provider_error', 'Download URL unavailable from provider')
    return NextResponse.json({ error: 'Download URL unavailable from provider' }, { status: 404 })
  }

  // ── 2. Rate-limit check + activity logging via RPC ─────────
  const usage = await (supabaseAdmin as any).rpc('record_kilax_download', {
    p_user_id:       userId,
    p_content_type:  contentType,
    p_content_id:    id,
    p_content_title: title,
    p_season:        season  ? Number(season)  : null,
    p_episode:       episode ? Number(episode) : null,
    p_filename:      filename,
    p_download_url:  resolvedUrl,
    p_plan:          plan,
    p_expires_at:    expiresAt ? new Date(expiresAt).toISOString() : null,
  })

  if (usage.error) {
    console.error('[download] record_kilax_download RPC error; using direct insert fallback:', usage.error)
    const fallback = await (supabaseAdmin as any).from('download_events').insert({
      user_id: userId,
      content_type: contentType,
      content_id: id,
      content_title: title,
      season: season ? Number(season) : null,
      episode: episode ? Number(episode) : null,
      filename,
      download_url: resolvedUrl,
      plan,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      status: 'success',
    })
    if (fallback.error) {
      console.error('[download] direct download insert error:', fallback.error)
    }
    return NextResponse.json({ url: resolvedUrl, filename, expiresAt, usage: null })
  }

  const row = Array.isArray(usage.data) ? usage.data[0] : usage.data

  if (row && !row.allowed) {
    const limitMsg =
      contentType === 'movie'
        ? 'You have reached your 5-movie download limit for the last 24 hours.'
        : 'You have reached your 1-series download limit for the last 24 hours.'
    return NextResponse.json({ error: limitMsg, limitReached: true, usage: row }, { status: 429 })
  }

  return NextResponse.json({ url: resolvedUrl, filename, expiresAt, usage: row })
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorize(req)
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })
    if (auth.trialActive) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count, error } = await (supabaseAdmin as any)
        .from('download_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', auth.userId)
        .eq('status', 'success')
        .gte('created_at', since)
      if (error) throw error
      if ((count || 0) >= 1) {
        return NextResponse.json({ error: 'Your trial allows 1 download every 24 hours. Upgrade via your profile to continue downloading.', code: 'TRIAL_DOWNLOAD_LIMIT', limitReached: true, subscribeUrl: '/profile' }, { status: 429 })
      }
    }
    return resolveDownload(req, auth.userId, auth.plan)
  } catch (error: any) {
    console.error('[download] Unexpected error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to resolve download URL' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST with a signed-in session for downloads.' }, { status: 405 })
}
