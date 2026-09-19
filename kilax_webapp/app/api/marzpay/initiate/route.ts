import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import { MarzPayService } from '@/lib/marzpay'
import { giftTokenHash, verifyGiftToken } from '@/lib/gift-payment'

// ─── Rate-limit config (mirrors middleware values) ────────────────────────────
const WINDOW_SECS  = 600   // 10-minute window
const MAX_ATTEMPTS = 5     // max initiations per window
const BLOCK_SECS   = 1800  // 30-min block after exceeding

// ─── Auth helper ─────────────────────────────────────────────────────────────
async function getAuthUser(req: NextRequest) {
  const auth  = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await client.auth.getUser()
  return user ?? null
}

// ─── Per-user DB rate limit ───────────────────────────────────────────────────
async function checkUserRateLimit(userId: string): Promise<{
  allowed: boolean
  retryAfter: number
  attemptCount: number
}> {
  try {
    const { data, error } = await (supabaseAdmin as any).rpc(
      'check_payment_rate_limit',
      {
        p_user_id:      userId,
        p_window_secs:  WINDOW_SECS,
        p_max_attempts: MAX_ATTEMPTS,
        p_block_secs:   BLOCK_SECS,
      }
    )
    if (error) {
      // RPC missing (migration not yet run) — fail open so payments work
      console.warn('[rate-limit] check_payment_rate_limit RPC error:', error.message)
      return { allowed: true, retryAfter: 0, attemptCount: 0 }
    }
    const row = Array.isArray(data) ? data[0] : data
    return {
      allowed:      row?.allowed      ?? true,
      retryAfter:   row?.retry_after_s ?? 0,
      attemptCount: row?.attempt_count ?? 0,
    }
  } catch (err) {
    console.error('[rate-limit] Unexpected error:', err)
    return { allowed: true, retryAfter: 0, attemptCount: 0 }
  }
}

// ─── Duplicate-transaction guard ─────────────────────────────────────────────
// Prevent the same user from initiating two payments for the same plan within
// 5 minutes. Catches double-taps and impatient repeated submissions.
async function hasPendingTransaction(userId: string, description: string): Promise<boolean> {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data } = await supabaseAdmin
      .from('transactions')
      .select('id, status, created_at')
      .eq('user_id', userId)
      .gte('created_at', fiveMinAgo)
      .not('status', 'in', '("failed","cancelled","rejected","declined","expired")')
      .order('created_at', { ascending: false })
      .limit(1) as { data: Array<{ id: string; status: string; created_at: string }> | null }

    return !!(data && data.length > 0)
  } catch {
    return false // fail open
  }
}

// ─── Reset rate limit after successful payment ───────────────────────────────
async function resetRateLimit(userId: string) {
  try {
    await (supabaseAdmin as any).rpc('reset_payment_rate_limit', { p_user_id: userId })
  } catch {
    // non-critical
  }
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, amount, description, paymentMethod, phoneNumber, giftToken, planId } = body

    // ── 1. Auth check ─────────────────────────────────────────
    const authUser = await getAuthUser(req)
    const gift = typeof giftToken === 'string' ? verifyGiftToken(giftToken, planId ? String(planId) : undefined) : null
    const isGiftPayment = !!gift
    if (!isGiftPayment && (!authUser || authUser.id !== userId)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    // ── 2. Input validation ───────────────────────────────────
    if (!amount || !description || !paymentMethod) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!['mobile_money', 'card'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Unsupported payment method' }, { status: 400 })
    }
    const paymentAmount = Number(amount)
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > 10_000_000) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 })
    }
    if (isGiftPayment && gift.planId !== String(planId || '')) {
      return NextResponse.json({ error: 'Gift link does not match the selected plan' }, { status: 400 })
    }
    if (isGiftPayment) {
      const { data: plan } = await supabaseAdmin.from('plans').select('amount, name').eq('id', gift.planId).maybeSingle() as { data: { amount: number; name: string } | null }
      const requestedPlan = String(description).replace(/^subscription:\s*/i, '').trim()
      if (!plan || Number(plan.amount) !== paymentAmount || requestedPlan.toLowerCase() !== String(plan.name).toLowerCase()) {
        return NextResponse.json({ error: 'Gift link does not match the selected plan' }, { status: 400 })
      }
    }

    // ── 3. Per-user DB rate limit ─────────────────────────────
    const paymentUserId = isGiftPayment ? gift.recipientId : userId
    const rateLimit = await checkUserRateLimit(paymentUserId)
    if (!rateLimit.allowed) {
      const minutes = Math.ceil(rateLimit.retryAfter / 60)
      console.warn(`[rate-limit] User ${userId} blocked for payment. attempts=${rateLimit.attemptCount}`)
      return NextResponse.json(
        {
          error: `Too many payment attempts. Your account has been temporarily locked for ${minutes} minute${minutes === 1 ? '' : 's'}. Please try again later.`,
          retryAfter: rateLimit.retryAfter,
          locked: true,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter),
            'X-RateLimit-Limit':     String(MAX_ATTEMPTS),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }

    // ── 4. Duplicate transaction guard ────────────────────────
    // Only block duplicates when the user already has a pending transaction
    // for ANY plan within the last 5 minutes. This prevents double-taps and
    // impatient re-submissions while still allowing legitimate retries after
    // a payment fails.
    const hasPending = await hasPendingTransaction(paymentUserId, description)
    if (hasPending) {
      return NextResponse.json(
        {
          error: 'You already have a payment in progress. Please wait for it to complete or check your subscription status before trying again.',
          duplicate: true,
        },
        { status: 409 }
      )
    }

    // ── 5. Initiate payment ───────────────────────────────────
    const appUrl      = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
    const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1')
    const callbackUrl = isLocalhost ? undefined : `${appUrl}/api/payment/callback${isGiftPayment ? `?gift=${encodeURIComponent(giftToken)}` : ''}`

    const result = await MarzPayService.collect({
      userId: paymentUserId,
      amount: paymentAmount,
      description,
      method:      paymentMethod,
      phoneNumber,
      callbackUrl,
      metadata: isGiftPayment ? { recipient_user_id: gift.recipientId, gift_token_hash: giftTokenHash(giftToken) } : undefined,
    })

    // ── 6. Reset rate limit on success ────────────────────────
    // A successful initiation resets the counter so the user is not penalised
    // for a completed flow. The limit only accumulates on failed/spammed calls.
    if (result?.uuid) {
      await resetRateLimit(paymentUserId)
    }

    return NextResponse.json(result)

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Payment initiation failed' },
      { status: 500 }
    )
  }
}
