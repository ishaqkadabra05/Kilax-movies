import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/referral/redeem
 *
 * Called when a new (or existing) user opens the app via a referral link.
 * Awards 50 coins to the sharer if:
 *   - ref_code is valid
 *   - referee ≠ sharer
 *   - referee has not redeemed any referral before
 *
 * Body: { refCode, deviceId? }
 * Returns: { ok, coins?, error? }
 */
export async function POST(req: NextRequest) {
  try {
    const auth  = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

    // We allow unauthenticated requests to record the ref code cookie-side;
    // coins are only awarded after the user is signed in.
    let userId: string | null = null

    if (token) {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      )
      const { data: { user } } = await client.auth.getUser()
      userId = user?.id ?? null
    }

    const body     = await req.json().catch(() => ({}))
    const refCode  = body.refCode?.trim()
    const deviceId = body.deviceId || null

    if (!refCode) {
      return NextResponse.json({ ok: false, error: 'Missing refCode' }, { status: 400 })
    }

    // Validate the ref code exists regardless of auth
    const { data: link } = await (supabaseAdmin as any)
      .from('referral_links')
      .select('id, user_id')
      .eq('ref_code', refCode)
      .maybeSingle()

    if (!link) {
      return NextResponse.json({ ok: false, error: 'Invalid referral code' }, { status: 404 })
    }

    // Increment click counter
    await (supabaseAdmin as any)
      .from('referral_links')
      .update({ total_clicks: (link.total_clicks || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', link.id)

    // If user is not authenticated yet, return early — frontend will retry
    // after sign-up/sign-in with the stored ref code
    if (!userId) {
      return NextResponse.json({ ok: true, pending: true, message: 'Referral recorded — coins awarded after sign-in' })
    }

    // Record device ID against the user for tracking
    if (deviceId) {
      await recordDeviceId(userId, deviceId)
    }

    // Award coins via the atomic RPC
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

    const { data: result, error: rpcError } = await (supabaseAdmin as any)
      .rpc('award_referral_coins', {
        p_ref_code:    refCode,
        p_referee_id:  userId,
        p_referee_ip:  ip,
        p_coins:       50,
      })

    if (rpcError) {
      console.error('[referral/redeem] RPC error:', rpcError)
      return NextResponse.json({ ok: false, error: 'Failed to process referral' }, { status: 500 })
    }

    const res = result as { ok: boolean; error?: string; coins?: number; new_balance?: number }

    if (!res.ok) {
      // Known non-errors (self-referral, already redeemed) — return silently
      return NextResponse.json({ ok: false, reason: res.error })
    }

    return NextResponse.json({
      ok:          true,
      coins:       res.coins,
      new_balance: res.new_balance,
    })

  } catch (err) {
    console.error('[referral/redeem] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Failed to process referral' }, { status: 500 })
  }
}

async function recordDeviceId(userId: string, deviceId: string) {
  try {
    await (supabaseAdmin as any)
      .from('user_devices')
      .upsert({
        user_id:    userId,
        device_id:  deviceId,
        last_seen:  new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,device_id' })
  } catch {
    // non-critical
  }
}
