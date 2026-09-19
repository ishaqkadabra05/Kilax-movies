import { NextRequest, NextResponse } from 'next/server'
import { MarzPayService } from '@/lib/marzpay'

/**
 * POST /api/payment/callback
 *
 * MarzPay calls this URL when a payment completes (webhook).
 * We log the raw payload, then pass it to MarzPayService.webhook()
 * which updates the DB and activates the subscription.
 */
export async function POST(req: NextRequest) {
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    // Some providers send form-encoded bodies
    try {
      const text = await req.text()
      body = Object.fromEntries(new URLSearchParams(text))
    } catch {
      return NextResponse.json({ error: 'Unreadable request body' }, { status: 400 })
    }
  }

  console.log('[callback] Received webhook body:', JSON.stringify(body))

  try {
    await MarzPayService.webhook(body)
    return NextResponse.json({ status: 'success' })
  } catch (error) {
    console.error('[callback] Webhook processing failed:', error)
    // Return 200 anyway so MarzPay doesn't keep retrying on logic errors.
    // Real infrastructure errors (5xx) will trigger retries.
    return NextResponse.json({ status: 'received', warning: error instanceof Error ? error.message : 'Processing error' })
  }
}

/**
 * GET /api/payment/callback
 *
 * MarzPay card payments redirect the browser here after the user
 * finishes on their payment page.  We forward to /payment/complete
 * with whatever params arrived.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  const target  = new URL('/payment/complete', appUrl || req.url)

  // Forward all params MarzPay appended (transactionId, reference, status, etc.)
  params.forEach((value, key) => target.searchParams.set(key, value))

  // Normalise common field names so /payment/complete can find them
  const txId   = params.get('transactionId') || params.get('transaction_id') || params.get('uuid')
  const ref    = params.get('reference')      || params.get('ref')
  if (txId) target.searchParams.set('transactionId', txId)
  if (ref)  target.searchParams.set('reference', ref)

  return NextResponse.redirect(target)
}
