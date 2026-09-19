import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/referral/balance
 *
 * Returns the authenticated user's coin balance, kilax_id,
 * referral link stats, and recent ledger entries.
 */
export async function GET(req: NextRequest) {
  try {
    const auth  = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user } } = await client.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    // Fetch profile for coins + kilax_id
    const { data: profile } = await (supabaseAdmin as any)
      .from('profiles')
      .select('coins, kilax_id')
      .eq('id', user.id)
      .maybeSingle()

    // Fetch referral stats
    const { data: links } = await (supabaseAdmin as any)
      .from('referral_links')
      .select('ref_code, content_title, total_clicks, total_signups, total_coins, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    // Fetch recent ledger entries
    const { data: ledger } = await (supabaseAdmin as any)
      .from('coins_ledger')
      .select('amount, balance_after, reason, created_at, metadata')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      coins:    profile?.coins    ?? 0,
      kilaxId:  profile?.kilax_id ?? null,
      links:    links    ?? [],
      ledger:   ledger   ?? [],
    })

  } catch (err) {
    console.error('[referral/balance] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 })
  }
}
