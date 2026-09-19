import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/referral/generate
 *
 * Creates (or returns existing) a referral code for the authenticated user
 * tied to a specific piece of content.
 *
 * Body: { contentId?, contentType?, contentTitle? }
 * Returns: { refCode, shareUrl }
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}))
    const contentId    = body.contentId    || null
    const contentType  = body.contentType  || null
    const contentTitle = body.contentTitle || null

    // Call the DB RPC which generates or returns an existing code
    const { data: refCode, error } = await (supabaseAdmin as any).rpc(
      'get_or_create_referral_link',
      {
        p_user_id:       user.id,
        p_content_id:    contentId,
        p_content_type:  contentType,
        p_content_title: contentTitle,
      }
    )

    if (error) {
      console.error('[referral/generate] RPC error:', error)
      return NextResponse.json({ error: 'Failed to generate referral link' }, { status: 500 })
    }

    const appUrl   = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
    const shareUrl = `${appUrl}/?ref=${refCode}`

    // Also record this user's kilax_id if not set yet
    await ensureKilaxId(user.id)

    return NextResponse.json({ refCode, shareUrl })

  } catch (err) {
    console.error('[referral/generate] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to generate referral link' }, { status: 500 })
  }
}

/**
 * Ensure the user has a kilax_id assigned (format: klm_<digits>).
 * Fire-and-forget — never blocks the response.
 */
async function ensureKilaxId(userId: string) {
  try {
    const { data: profile } = await (supabaseAdmin as any)
      .from('profiles')
      .select('kilax_id')
      .eq('id', userId)
      .maybeSingle()

    if (!profile?.kilax_id) {
      // Generate: klm_ + 11 random digits
      const digits = Math.floor(10_000_000_000 + Math.random() * 89_999_999_999)
      const kilaxId = `klm_${digits}`
      await (supabaseAdmin as any)
        .from('profiles')
        .update({ kilax_id: kilaxId, updated_at: new Date().toISOString() })
        .eq('id', userId)
    }
  } catch {
    // non-critical
  }
}
