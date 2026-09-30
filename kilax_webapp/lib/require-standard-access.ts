import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { isEligibleStreamingPlanName } from '@/lib/isStandardPremium'
import { supabaseAdmin } from '@/lib/supabase'

type StreamingAccessResult =
  | { allowed: true; userId: string }
  | { allowed: false; response: NextResponse }

export async function requireStreamingPackageAccess(request: Request): Promise<StreamingAccessResult> {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) {
    return {
      allowed: false,
      response: NextResponse.json({ error: 'Sign in to access this content.', code: 'AUTH_REQUIRED' }, { status: 401 }),
    }
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) {
    return {
      allowed: false,
      response: NextResponse.json({ error: 'Your session has expired. Sign in again.', code: 'AUTH_REQUIRED' }, { status: 401 }),
    }
  }

  const { data: profile, error } = await (supabaseAdmin as any)
    .from('profiles')
    .select('subscription, subscription_expiry_date')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return {
      allowed: false,
      response: NextResponse.json({ error: 'Unable to verify your subscription right now.' }, { status: 503 }),
    }
  }

  const expiry = profile?.subscription_expiry_date ? new Date(profile.subscription_expiry_date).getTime() : 0
  const activeEligiblePlan = isEligibleStreamingPlanName(profile?.subscription) && Number.isFinite(expiry) && expiry > Date.now()
  if (!activeEligiblePlan) {
    return {
      allowed: false,
      response: NextResponse.json({ error: 'An active paid package other than Basic is required to access this content.', code: 'ELIGIBLE_PLAN_REQUIRED' }, { status: 403 }),
    }
  }

  return { allowed: true, userId: user.id }
}