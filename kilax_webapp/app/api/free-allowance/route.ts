import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

const DAILY_UNITS = 5
const WATCH_LIMIT_SECONDS = 30 * 60

type ContentType = 'movie' | 'series'

function todayStart() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

async function getUser(req: NextRequest) {
  const authorization = req.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return null
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user } } = await client.auth.getUser()
  return user || null
}

async function getAllowance(userId: string) {
  const start = todayStart().toISOString()
  const { data, error } = await (supabaseAdmin as any)
    .from('user_video_activity')
    .select('content_type, content_id, watch_seconds')
    .eq('user_id', userId)
    .eq('event_type', 'stream_started')
    .gte('created_at', start)

  if (error) throw error

  const movieIds = new Set<string>()
  const seriesIds = new Set<string>()
  let watchSeconds = 0
  for (const row of data || []) {
    if (row.content_type === 'movie') movieIds.add(String(row.content_id))
    if (row.content_type === 'series') seriesIds.add(String(row.content_id))
    watchSeconds += Number(row.watch_seconds || 0)
  }

  const resetAt = new Date(todayStart().getTime() + 24 * 60 * 60 * 1000)
  return {
    dailyUnits: DAILY_UNITS,
    unitsUsed: Math.min(DAILY_UNITS, movieIds.size + seriesIds.size),
    movieUsed: movieIds.size,
    seriesUsed: seriesIds.size,
    movieRemaining: Math.max(0, 1 - movieIds.size),
    seriesRemaining: Math.max(0, 1 - seriesIds.size),
    watchSeconds: Math.min(WATCH_LIMIT_SECONDS, watchSeconds),
    watchLimitSeconds: WATCH_LIMIT_SECONDS,
    resetAt: resetAt.toISOString(),
    referralCreditsUsableForFreeViewing: false,
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json(await getAllowance(user.id), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[free-allowance] status error:', error)
    return NextResponse.json({ error: 'Unable to load free allowance' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const contentType = String(body.contentType || '') as ContentType
    const contentId = String(body.contentId || '')
    if (!['movie', 'series'].includes(contentType) || !contentId) {
      return NextResponse.json({ error: 'A valid content type and ID are required' }, { status: 400 })
    }

    const allowance = await getAllowance(user.id)
    const alreadyUsed = contentType === 'movie' ? allowance.movieUsed > 0 : allowance.seriesUsed > 0
    const remaining = contentType === 'movie' ? allowance.movieRemaining : allowance.seriesRemaining
    if (!alreadyUsed && remaining <= 0) {
      return NextResponse.json({ error: `Your free ${contentType} allowance has been used today`, allowance }, { status: 403 })
    }

    if (!alreadyUsed) {
      const { error } = await (supabaseAdmin as any).from('user_video_activity').insert({
        user_id: user.id,
        content_type: contentType,
        content_id: contentId,
        event_type: 'stream_started',
        watch_seconds: 0,
        plan: 'free',
      })
      if (error) throw error
    }

    return NextResponse.json({ ok: true, allowance: await getAllowance(user.id) })
  } catch (error) {
    console.error('[free-allowance] consume error:', error)
    return NextResponse.json({ error: 'Unable to use free allowance' }, { status: 500 })
  }
}
