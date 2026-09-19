import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import { MarzPayService } from '@/lib/marzpay'
import { giftTokenHash, verifyGiftToken } from '@/lib/gift-payment'

export async function GET(req: NextRequest) {
  try {
    // Auth
    const auth  = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    const giftToken = req.nextUrl.searchParams.get('gift') || ''
    const gift = giftToken ? verifyGiftToken(giftToken) : null
    if (!token && !gift) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user } } = token ? await client.auth.getUser() : { data: { user: null } }

    const id        = req.nextUrl.searchParams.get('transactionId') || ''
    const reference = req.nextUrl.searchParams.get('reference')      || ''
    if (!id && !reference) {
      return NextResponse.json({ error: 'transactionId or reference required' }, { status: 400 })
    }

    // Find our DB record — MarzPay uuid is stored in metadata->marzpay_uuid
    let dbQuery = (supabaseAdmin as any)
      .from('transactions')
      .select('id, user_id, reference, metadata, amount')

    const { data: dbTx } = id
      ? await dbQuery.eq('metadata->>marzpay_uuid', id).maybeSingle()
      : await dbQuery.eq('reference', reference).maybeSingle()

    const giftAuthorized = !!gift && dbTx?.metadata?.gift_token_hash === giftTokenHash(giftToken) && dbTx.user_id === gift.recipientId
    if (!dbTx || (!giftAuthorized && (!user || dbTx.user_id !== user.id))) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Use the MarzPay uuid for the live status check
    const marzpayUuid = dbTx.metadata?.marzpay_uuid || id
    const marzTx      = await MarzPayService.status(marzpayUuid)

    // Extract plan name
    const planName = dbTx.metadata?.plan_name
      || String(dbTx.metadata?.description || '')
           .replace(/^subscription:\s*/i, '').trim()
      || ''

    // Duration lookup
    const { data: planRow } = await (supabaseAdmin as any)
      .from('plans')
      .select('duration_in_days, duration_in_hours')
      .ilike('name', planName)
      .maybeSingle()

    const durationDays = planRow?.duration_in_hours
      ? Number(planRow.duration_in_hours) / 24
      : Number(planRow?.duration_in_days || 30)

    return NextResponse.json({
      uuid:      marzTx.uuid,
      reference: marzTx.reference || dbTx.reference,
      status:    marzTx.status,
      error:     marzTx.error,
      amount:    marzTx.amount,
      plan:      planName,
      duration:  durationDays,
    })
  } catch (error) {
    console.error('[marzpay/status]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    )
  }
}
