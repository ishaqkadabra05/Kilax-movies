/**
 * MarzPay integration — Uganda mobile money & card payments.
 *
 * Real DB schema (public.transactions):
 *   id uuid PK, user_id uuid, subscription_id uuid, plan_id uuid,
 *   package_name text, amount numeric, currency text, payment_method text,
 *   status text, reference text, provider_reference text,
 *   provider_transaction_id text, phone_number text,
 *   metadata jsonb, raw_payload jsonb,
 *   created_at timestamptz, updated_at timestamptz
 *
 * Because the table has no dedicated transaction_uuid / description columns,
 * we store the MarzPay uuid and plan description inside metadata.
 */

import { supabaseAdmin } from '@/lib/supabase'

// Keep payment-provider writes behind one boundary until generated Supabase
// database types are introduced for the project.
const paymentDb = supabaseAdmin as any

const BASE_URL = 'https://wallet.wearemarz.com/api/v1'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authHeader(): string {
  const basic = process.env.MARZPAY_BASE64_AUTH?.trim()
  if (basic) return `Basic ${basic}`
  const key    = process.env.MARZPAY_API_KEY
  const secret = process.env.MARZPAY_API_SECRET
  if (!key || !secret) throw new Error('MarzPay credentials are not configured')
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', authHeader())
  headers.set('Accept', 'application/json')
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers, cache: 'no-store' })
  const text     = await response.text()
  let data: any  = {}
  try { data = JSON.parse(text) } catch { data = { message: text } }
  if (!response.ok) throw new Error(data?.message || data?.error || `MarzPay HTTP ${response.status}`)
  return data
}

// ─── Normalise a MarzPay transaction object ───────────────────────────────────

interface MarzTx {
  uuid:      string
  reference: string
  status:    string
  amount:    number
  type?:     string
  error?:    string
}

function normalizeTx(raw: any): MarzTx {
  const tx = raw?.transaction ?? raw?.data?.transaction ?? raw?.data ?? raw
  return {
    uuid:      String(tx?.uuid      || ''),
    reference: String(tx?.reference || ''),
    status:    String(tx?.status    || '').toLowerCase(),
    amount:    Number(tx?.amount?.raw ?? tx?.amount ?? 0),
    type:      tx?.type ?? undefined,
    error:     String(tx?.error || tx?.error_message || tx?.failure_reason || tx?.message || ''),
  }
}

function isCompleted(status: string): boolean {
  return ['completed', 'successful', 'success', 'sandbox', 'paid'].includes(status.toLowerCase())
}

function isFailed(status: string): boolean {
  return ['failed', 'cancelled', 'rejected', 'declined', 'expired'].includes(status.toLowerCase())
}

// ─── Phone formatting ─────────────────────────────────────────────────────────

export function formatUgandaPhone(phone: string): string {
  const digits     = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('256')
    ? digits
    : `256${digits.startsWith('0') ? digits.slice(1) : digits}`
  if (!/^256\d{9}$/.test(normalized))
    throw new Error('Invalid Uganda mobile-money number. Use format: 07XXXXXXXX or +2567XXXXXXXX')
  return `+${normalized}`
}

// ─── MarzPay service ──────────────────────────────────────────────────────────

export class MarzPayService {

  /**
   * Initiate a payment and record it in Supabase.
   */
  static async collect(params: {
    userId:      string
    amount:      number
    description: string   // "Subscription: Plan Name"
    method:      'mobile_money' | 'card'
    phoneNumber?: string
    callbackUrl?: string
    metadata?: Record<string, unknown>
  }) {
    const reference       = crypto.randomUUID()
    const cleanDescription = params.description.slice(0, 255)

    // Extract plan name: "Subscription: Basic Premium - 12 Hours" → "Basic Premium - 12 Hours"
    const planName = cleanDescription.replace(/^subscription:\s*/i, '').trim()

    const body: Record<string, string> = {
      amount:      String(Math.round(params.amount)),
      country:     'UG',
      reference,
      description: cleanDescription,
      method:      params.method,
    }
    if (params.method === 'mobile_money') {
      body.phone_number = formatUgandaPhone(params.phoneNumber || '')
    }
    if (params.callbackUrl) {
      body.callback_url = params.callbackUrl
    }

    const isCard = params.method === 'card'
    const response = await request('/collect-money', {
      method:  'POST',
      headers: { 'Content-Type': isCard ? 'application/json' : 'application/x-www-form-urlencoded' },
      body:    isCard ? JSON.stringify(body) : new URLSearchParams(body).toString(),
    })

    // collect-money returns { data: { transaction: { uuid, reference, status }, redirect_url } }
    const txData      = response?.data?.transaction ?? response?.transaction ?? response?.data ?? {}
    const marzpayUuid = String(txData?.uuid || txData?.id || '')
    const txStatus    = String(txData?.status || 'processing').toLowerCase()
    const redirectUrl = response?.data?.redirect_url ?? response?.redirect_url ?? null

    if (!marzpayUuid) {
      console.error('[marzpay] collect-money response:', JSON.stringify(response))
      throw new Error('Payment service did not return a transaction id')
    }

    // Insert into transactions table using the actual schema
    const { data: inserted, error: insertError } = await paymentDb
      .from('transactions')
      .insert({
        user_id:        params.userId,
        reference,
        amount:         params.amount,
        currency:       'UGX',
        payment_method: params.method === 'card' ? 'card' : 'mobile_money',
        status:         txStatus,
        phone_number:   body.phone_number || null,
        metadata: {
          marzpay_uuid:  marzpayUuid,
          description:   cleanDescription,
          plan_name:     planName,
          activated_at:  null,
          ...(params.metadata || {}),
        },
        raw_payload: txData,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[marzpay] Supabase insert failed:', insertError.message, '| uuid:', marzpayUuid)
      // Don't abort — payment already initiated
    } else {
      console.log(`[marzpay] Transaction recorded: db_id=${inserted?.id} marzpay_uuid=${marzpayUuid}`)
    }

    return { uuid: marzpayUuid, reference, status: txStatus, redirectUrl }
  }

  /**
   * Fetch live status from MarzPay.
   * Accepts both the MarzPay uuid and our internal reference.
   */
  static async status(transactionId: string): Promise<MarzTx> {
    try {
      const response = await request(`/transactions/${encodeURIComponent(transactionId)}`)
      const tx = normalizeTx(response)
      if (tx.uuid) return tx
    } catch (e) {
      console.warn(`[marzpay] /transactions/${transactionId} failed:`, (e as Error).message)
    }
    // Fallback: search by reference
    try {
      const response = await request(`/transactions?reference=${encodeURIComponent(transactionId)}`)
      const list: any[] = response?.data?.transactions ?? []
      const credit = list.find(t => t.type === 'credit') ?? list[0]
      if (credit) return normalizeTx(credit)
    } catch (e) {
      console.warn(`[marzpay] /transactions?reference= failed:`, (e as Error).message)
    }
    throw new Error(`Transaction not found on MarzPay: ${transactionId}`)
  }

  /**
   * Look up our DB record by the MarzPay uuid (stored in metadata).
   */
  private static async findDbRow(marzpayUuid: string): Promise<any> {
    // Primary: search by metadata->marzpay_uuid
    const { data } = await paymentDb
      .from('transactions')
      .select('id, user_id, metadata, amount, status, payment_method')
      .eq('metadata->>marzpay_uuid', marzpayUuid)
      .maybeSingle()
    return data
  }

  /**
   * Activate the user's subscription after a confirmed payment.
   */
  static async activateSubscription(
    userId:        string,
    marzpayUuid:   string,
    plan:          string,
    durationDays:  number
  ): Promise<{ expiryDate: string; plan: string }> {

    const tx = await this.status(marzpayUuid)
    if (!isCompleted(tx.status))
      throw new Error(`Payment not completed. Current status: ${tx.status}`)

    const now = new Date()

    // Find our DB record
    const dbRow = await this.findDbRow(marzpayUuid)
    if (dbRow?.user_id && dbRow.user_id !== userId) {
      throw new Error('Payment transaction does not belong to this recipient')
    }
    const beneficiaryId = dbRow?.metadata?.recipient_user_id || userId

    // Extract plan from metadata or fall back to parameter
    const storedPlan = dbRow?.metadata?.plan_name
      || String(dbRow?.metadata?.description || '')
           .replace(/^subscription:\s*/i, '').trim()
      || plan

    // Idempotency
    if (dbRow?.metadata?.activated_at) {
      const { data: profile } = await paymentDb
        .from('profiles')
        .select('subscription_expiry_date')
        .eq('id', beneficiaryId)
        .maybeSingle()
      const { data: planRow } = await paymentDb
        .from('plans').select('name').ilike('name', storedPlan).maybeSingle()
      return {
        expiryDate: profile?.subscription_expiry_date || new Date().toISOString(),
        plan:       planRow?.name || storedPlan,
      }
    }

    // Look up plan duration
    const { data: planRow } = await paymentDb
      .from('plans')
      .select('id, duration_in_days, duration_in_hours, name')
      .ilike('name', storedPlan)
      .maybeSingle()

    const effectivePlan = planRow?.name || storedPlan
    const effectiveDurationMs = planRow?.duration_in_hours
      ? Number(planRow.duration_in_hours) * 3_600_000
      : Number(planRow?.duration_in_days || durationDays || 30) * 86_400_000
    const expiry = new Date(now.getTime() + effectiveDurationMs)

    await paymentDb
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', beneficiaryId)
      .eq('subscription_type', 'trial')
      .eq('status', 'active')

    // Write subscription history
    const { error: subError } = await paymentDb
      .from('subscriptions')
      .upsert({
        user_id:           userId,
        plan_id:           planRow?.id ?? null,
        subscription_type: 'paid',
        status:            'active',
        start_date:        now.toISOString(),
        expiry_date:       expiry.toISOString(),
        payment_method:    dbRow?.payment_method || dbRow?.metadata?.payment_method || 'mobile_money',
        transaction_id:    dbRow?.id ?? null,
      }, { onConflict: 'user_id,plan_id' })
    if (subError) console.warn('[marzpay] subscriptions upsert warning:', subError.message)

    // Activate profile
    const { error: profileError } = await paymentDb
      .from('profiles')
      .update({
        subscription:             effectivePlan,
        subscription_start_date:  now.toISOString(),
        subscription_expiry_date: expiry.toISOString(),
        trial_status:             'converted',
        trial_expires_at:         null,
      })
      .eq('id', beneficiaryId)
    if (profileError) throw new Error(`Failed to activate subscription: ${profileError.message}`)

    // Mark as activated in metadata
    if (dbRow?.id) {
      await paymentDb
        .from('transactions')
        .update({
          status:     'completed',
          updated_at: new Date().toISOString(),
          metadata:   { ...dbRow.metadata, activated_at: now.toISOString() },
        })
        .eq('id', dbRow.id)
    }

    console.log(`[marzpay] ✅ user=${beneficiaryId} plan=${effectivePlan} expiry=${expiry.toISOString()}`)

    // ── Send subscription confirmation notification (fire-and-forget) ──────
    // We do NOT await this — a notification failure must never block or roll
    // back a successful payment activation.
    MarzPayService.notifySubscriptionActivated(beneficiaryId, effectivePlan, expiry).catch(
      (err) => console.error('[marzpay] Notification failed (non-fatal):', err)
    )

    return { expiryDate: expiry.toISOString(), plan: effectivePlan }
  }

  /**
   * Handle a webhook POST from MarzPay.
   */
  static async webhook(payload: any): Promise<void> {
    console.log('[marzpay] Webhook:', JSON.stringify(payload))

    const tx = normalizeTx(payload)
    if (!tx.uuid) {
      console.error('[marzpay] Webhook missing uuid:', JSON.stringify(payload))
      throw new Error('Invalid webhook: missing transaction uuid')
    }

    // Sync status in DB
    const dbRow = await this.findDbRow(tx.uuid)
    if (dbRow?.id) {
      await paymentDb
        .from('transactions')
        .update({ status: tx.status, updated_at: new Date().toISOString() })
        .eq('id', dbRow.id)
    }

    if (!isCompleted(tx.status)) {
      console.log(`[marzpay] Webhook: not completion. status="${tx.status}"`)
      return
    }

    if (!dbRow?.user_id) {
      console.error('[marzpay] Webhook: no DB record for uuid=%s', tx.uuid)
      return
    }

    const planName = dbRow?.metadata?.plan_name
      || String(dbRow?.metadata?.description || '')
           .replace(/^subscription:\s*/i, '').trim()
    if (!planName) {
      console.error('[marzpay] Webhook: cannot extract plan from metadata:', dbRow?.metadata)
      return
    }

    const { data: planRow } = await paymentDb
      .from('plans')
      .select('duration_in_days, duration_in_hours')
      .ilike('name', planName)
      .maybeSingle()

    const durationDays = planRow?.duration_in_hours
      ? planRow.duration_in_hours / 24
      : (planRow?.duration_in_days || 30)

    await this.activateSubscription(dbRow.user_id, tx.uuid, planName, durationDays)
  }

  /**
   * Send an in-app notification + OneSignal push to the user after their
   * subscription is activated.  Always fire-and-forget — never throws.
   */
  static async notifySubscriptionActivated(
    userId:      string,
    planName:    string,
    expiryDate:  Date
  ): Promise<void> {
    const title = '🎉 Subscription Activated!'
    const expiryStr = expiryDate.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
    const body = `Thank you for subscribing to ${planName}! Your access is now active until ${expiryStr}. Enjoy unlimited streaming on Kilax Movies.`
    const url  = '/profile'

    try {
      // ── 1. Insert into notifications table ──────────────────
      const { data: notification, error: notifError } = await paymentDb
        .from('notifications')
        .insert({
          title,
          body,
          url,
          data: { source: 'subscription', plan: planName, expiry: expiryDate.toISOString() },
        })
        .select('id')
        .single()

      if (notifError) {
        console.error('[marzpay] Failed to insert notification:', notifError.message)
      } else if (notification?.id) {
        // ── 2. Insert recipient row ────────────────────────────
        await paymentDb
          .from('notification_recipients')
          .insert({ notification_id: notification.id, user_id: userId })
      }
    } catch (err) {
      console.error('[marzpay] In-app notification insert failed:', err)
    }

    // ── 3. Send OneSignal push ────────────────────────────────
    try {
      const { sendOneSignalNotification } = await import('@/lib/onesignal')
      await sendOneSignalNotification(
        {
          title,
          body,
          url,
          data: { type: 'subscription_activated', plan: planName },
        },
        [userId]
      )
      console.log(`[marzpay] Push notification sent to user=${userId}`)
    } catch (err) {
      // OneSignal push failure is non-fatal — in-app notification already saved
      console.warn('[marzpay] Push notification failed (non-fatal):', (err as Error).message)
    }
  }
}
