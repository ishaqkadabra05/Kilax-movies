import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/referral/device
 *
 * Registers (or updates) a device fingerprint against the authenticated user.
 * Also ensures the user has a kilax_id assigned.
 *
 * Body: { deviceId, deviceName? }
 */
export async function POST(req: NextRequest) {
  try {
    const auth  = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ ok: false }, { status: 401 })

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user } } = await client.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const body       = await req.json().catch(() => ({}))
    const deviceId   = body.deviceId?.trim()
    const deviceName = body.deviceName || null

    if (!deviceId) return NextResponse.json({ ok: false, error: 'Missing deviceId' }, { status: 400 })

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const ua = req.headers.get('user-agent') ?? null

    // Upsert the device record
    await (supabaseAdmin as any)
      .from('user_devices')
      .upsert({
        user_id:     user.id,
        device_id:   deviceId,
        device_name: deviceName,
        platform:    'web',
        ip_address:  ip,
        user_agent:  ua,
        last_seen:   new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'user_id,device_id' })

    // Ensure kilax_id is set (fire-and-forget)
    const { data: profile } = await (supabaseAdmin as any)
      .from('profiles')
      .select('kilax_id')
      .eq('id', user.id)
      .maybeSingle()

    let kilaxId = profile?.kilax_id

    if (!kilaxId) {
      const digits = Math.floor(10_000_000_000 + Math.random() * 89_999_999_999)
      kilaxId      = `klm_${digits}`
      await (supabaseAdmin as any)
        .from('profiles')
        .update({ kilax_id: kilaxId, updated_at: new Date().toISOString() })
        .eq('id', user.id)
    }

    return NextResponse.json({ ok: true, kilaxId })

  } catch (err) {
    console.error('[referral/device] Error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
