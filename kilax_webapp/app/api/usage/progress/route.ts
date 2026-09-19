import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

async function getUser(request: NextRequest) {
  const authorization = request.headers.get('authorization') || ''
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

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const params = request.nextUrl.searchParams
    const contentType = params.get('content_type')
    const contentId = params.get('content_id')
    const season = Number(params.get('season') || 0)
    const episode = Number(params.get('episode') || 0)
    if (!contentType || !contentId) return NextResponse.json({ error: 'content_type and content_id are required' }, { status: 400 })

    const { data, error } = await (supabaseAdmin as any)
      .from('playback_positions')
      .select('content_type, content_id, content_title, season, episode, position_seconds, duration_seconds, completed, updated_at')
      .eq('user_id', user.id)
      .eq('content_type', contentType)
      .eq('content_id', contentId)
      .eq('season', season)
      .eq('episode', episode)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json({ position: data || null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[usage/progress] GET failed:', error)
    return NextResponse.json({ error: 'Unable to load playback progress' }, { status: 500 })
  }
}
