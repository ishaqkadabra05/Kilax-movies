import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

// Matches any plan name that grants download access
const DOWNLOAD_PLANS = /standard|pro|go\s*pro|premium/i

export async function GET(req: NextRequest) {
  try {
    const auth  = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

    if (!token) {
      return NextResponse.json(
        { authenticated: false, plan: 'free', isActive: false, canDownload: false },
        { status: 401 }
      )
    }

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { authenticated: false, plan: 'free', isActive: false, canDownload: false },
        { status: 401 }
      )
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription, subscription_expiry_date, trial_status, trial_expires_at')
      .eq('id', user.id)
      .maybeSingle() as { data: { subscription?: string | null; subscription_expiry_date?: string | null; trial_status?: string | null; trial_expires_at?: string | null } | null }

    const plan   = String(profile?.subscription || 'free')
    const expiry = profile?.subscription_expiry_date
      ? new Date(profile.subscription_expiry_date)
      : null
    const trialActive = profile?.trial_status === 'active' && profile?.trial_expires_at && new Date(profile.trial_expires_at) > new Date()

    const isActive    = (plan.toLowerCase() !== 'free' && !!expiry && expiry > new Date()) || Boolean(trialActive)
    const canDownload = (isActive && DOWNLOAD_PLANS.test(plan)) || Boolean(trialActive)

    return NextResponse.json({
      authenticated: true,
      plan,
      expiryDate:  profile?.subscription_expiry_date || null,
      isActive,
      canDownload,
      trialActive: Boolean(trialActive),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to check subscription' },
      { status: 500 }
    )
  }
}
