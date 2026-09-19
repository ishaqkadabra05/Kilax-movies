import { createHash, createHmac, timingSafeEqual } from 'crypto'

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

function getSecret(): string {
  const secret = process.env.GIFT_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Gift payment signing secret is not configured')
  return secret
}

function encode(value: string): string {
  return Buffer.from(value).toString('base64url')
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export type GiftToken = {
  recipientId: string
  planId: string
  expiresAt: number
}

export function createGiftToken(recipientId: string, planId: string): string {
  const payload = encode(JSON.stringify({
    recipientId,
    planId,
    expiresAt: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }))
  return `${payload}.${sign(payload)}`
}

export function verifyGiftToken(token: string, planId?: string): GiftToken | null {
  try {
    const [payload, signature] = token.split('.')
    if (!payload || !signature) return null
    const expected = sign(payload)
    const providedBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expected)
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) return null

    const value = JSON.parse(Buffer.from(payload, 'base64url').toString()) as GiftToken
    if (!value.recipientId || !value.planId || value.expiresAt < Math.floor(Date.now() / 1000)) return null
    if (planId && value.planId !== planId) return null
    return value
  } catch {
    return null
  }
}

export function giftTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}