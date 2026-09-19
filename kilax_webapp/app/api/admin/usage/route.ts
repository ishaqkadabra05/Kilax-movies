import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import ReelplexiService from '@/lib/reelplexi-service'

async function authorizeAdmin(request: NextRequest) {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return false

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user } } = await client.auth.getUser()
  if (!user) return false

  const { data: profile } = await (supabaseAdmin as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return profile?.role === 'admin'
}

export async function GET(request: NextRequest) {
  try {
    if (!await authorizeAdmin(request)) {
      return NextResponse.json({ error: 'Administrator access required' }, { status: 403 })
    }

    const [
      { data: metrics, error: metricsError },
      { data: users, error: usersError },
      { data: content, error: contentError },
      { data: daily, error: dailyError },
    ] = await Promise.all([
      (supabaseAdmin as any).from('admin_usage_metrics_view').select('*').single(),
      (supabaseAdmin as any)
        .from('admin_user_usage_view')
        .select('*')
        .order('last_active_at', { ascending: false }),
      (supabaseAdmin as any)
        .from('admin_streaming_content_view')
        .select('*')
        .order('view_count', { ascending: false })
        .limit(20),
      (supabaseAdmin as any)
        .from('admin_streaming_daily_view')
        .select('*')
        .order('usage_date', { ascending: true }),
    ])

    const [reelplexiUsage, reelplexiMovies, reelplexiSeries] = await Promise.all([
      ReelplexiService.getAccountUsage('30d'),
      ReelplexiService.getTopMovieAnalytics(10),
      ReelplexiService.getTopSeriesAnalytics(10),
    ])

    if (metricsError) throw metricsError
    if (usersError) throw usersError
    if (contentError) throw contentError
    if (dailyError) throw dailyError

    const userIds = (users || []).map((user: { user_id: string }) => user.user_id)
    const { data: profiles, error: profilesError } = userIds.length
      ? await (supabaseAdmin as any).from('profiles').select('id, email, full_name').in('id', userIds)
      : { data: [], error: null }
    if (profilesError) throw profilesError

    const profileById = new Map((profiles || []).map((profile: { id: string }) => [profile.id, profile]))
    const usersWithProfiles = (users || []).map((user: { user_id: string }) => ({
      ...user,
      profile: profileById.get(user.user_id) || null,
    }))

    return NextResponse.json({
      metrics,
      users: usersWithProfiles,
      content: content || [],
      daily: daily || [],
      reelplexi: {
        usage: reelplexiUsage,
        top_movies: reelplexiMovies,
        top_series: reelplexiSeries,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[admin/usage] failed:', error)
    return NextResponse.json({ error: 'Unable to load usage reporting' }, { status: 500 })
  }
}