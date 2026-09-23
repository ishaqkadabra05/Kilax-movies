import { supabase } from './supabase'
import type { Subscription, SubscriptionPlan } from './supabase'

// Generated database types are not present yet; keep the compatibility cast
// inside this legacy subscription adapter.
const subscriptionDb = supabase as any

// Get all subscription plans
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await subscriptionDb
    .from('plans')
    .select('*')
    .order('amount', { ascending: true })

  if (error) {
    console.error('Error fetching subscription plans:', error)
    return []
  }

  return data || []
}

export async function userHasActivePaidSubscription(userId: string): Promise<boolean> {
  try {
    const now = Date.now()
    const { data: profile, error: profileError } = await subscriptionDb
      .from('profiles')
      .select('subscription, subscription_expiry_date, trial_status, trial_expires_at')
      .eq('id', userId)
      .maybeSingle()

    if (!profileError && profile) {
      const planName = String(profile.subscription || '').trim().toLowerCase()
      const expiry = profile.subscription_expiry_date ? new Date(profile.subscription_expiry_date).getTime() : 0
      const isPaidProfile = Boolean(planName) && !['free', 'trial', 'none', ''].includes(planName) && expiry > now
      if (isPaidProfile) return true
    }

    const { data: subscriptions, error: subscriptionsError } = await subscriptionDb
      .from('subscriptions')
      .select('status, subscription_type, expiry_date, plan, plan_id, start_date, subscribed_at, created_at')
      .eq('user_id', userId)

    if (subscriptionsError) {
      return false
    }

    return (subscriptions || []).some((row: any) => {
      const status = String(row?.status || '').trim().toLowerCase()
      const type = String(row?.subscription_type || row?.plan || row?.plan_id || '').trim().toLowerCase()
      const expiry = row?.expiry_date ? new Date(row.expiry_date).getTime() : 0
      const fallbackExpiry = row?.start_date || row?.subscribed_at || row?.created_at
        ? new Date(row.start_date || row.subscribed_at || row.created_at).getTime() + (30 * 24 * 60 * 60 * 1000)
        : 0
      const validExpiry = expiry > now || (fallbackExpiry > now && !['free', 'trial'].includes(type))
      const activeStatus = ['active', 'paid', 'completed', 'success', 'successful', 'approved', 'processing'].includes(status)
      const paidType = Boolean(type) && !['free', 'trial', 'none', ''].includes(type) && !type.includes('free') && !type.includes('trial')
      const legacyPlan = Boolean(row?.plan) && !['free', 'trial', 'none', ''].includes(String(row.plan).trim().toLowerCase())

      return validExpiry && (activeStatus || paidType || legacyPlan)
    })
  } catch (error) {
    console.error('Error checking active paid subscription:', error)
    return false
  }
}

// Get user's current subscription
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  try {
    const today = new Date();
    // Query the profiles table for subscription_expiry_date
    const { data, error } = await subscriptionDb
      .from('profiles')
      .select('subscription, subscription_start_date, subscription_expiry_date')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user profile for subscription:', error);
      return null;
    }

    if (!data || !data.subscription_expiry_date) return null;
    const expiry = new Date(data.subscription_expiry_date);
    if (expiry >= today) {
      // Return a subscription-like object for compatibility
      return {
        id: 0,
        user_id: userId,
        plan: data.subscription || '',
        payment_method: '',
        subscribed_at: data.subscription_start_date || '',
      };
    }
    return null;
  } catch (error) {
    console.error('Unexpected error fetching user subscription:', error);
    return null;
  }
}

// Create a new subscription
export async function createSubscription(
  userId: string,
  plan: string,
  paymentMethod: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await subscriptionDb
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan,
        payment_method: paymentMethod,
        subscribed_at: new Date().toISOString()
      })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Check if user has active subscription (not expired)
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  try {
    const { data: profile, error } = await subscriptionDb
      .from('profiles')
      .select('subscription, subscription_expiry_date')
      .eq('id', userId)
      .single()

    if (profile && profile.subscription && profile.subscription.toLowerCase() !== 'free' && profile.subscription_expiry_date && new Date(profile.subscription_expiry_date) > new Date()) {
      return true
    }

    const activePaid = await userHasActivePaidSubscription(userId)
    if (activePaid) return true

    if (error || !profile) {
      return false
    }

    return false
  } catch (error) {
    console.error('Error checking active subscription:', error)
    return false
  }
}

// Get user's subscription status with expiry information
export async function getUserSubscriptionStatus(userId: string): Promise<{
  hasSubscription: boolean;
  isActive: boolean;
  isExpired: boolean;
  subscription?: string;
  expiryDate?: string;
  daysRemaining?: number;
}> {
  try {
    const { data: profile, error } = await subscriptionDb
      .from('profiles')
      .select('subscription, subscription_expiry_date')
      .eq('id', userId)
      .single()

    const fallbackPaid = await userHasActivePaidSubscription(userId)

    if (profile && profile.subscription && profile.subscription.toLowerCase() !== 'free' && profile.subscription_expiry_date) {
      const expiryDate = new Date(profile.subscription_expiry_date)
      const now = new Date()
      const isNotExpired = expiryDate > now
      return {
        hasSubscription: true,
        isActive: isNotExpired || fallbackPaid,
        isExpired: !isNotExpired && !fallbackPaid,
        subscription: profile.subscription,
        expiryDate: profile.subscription_expiry_date,
        daysRemaining: isNotExpired ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : undefined
      }
    }

    if (fallbackPaid) {
      const { data: row } = await subscriptionDb
        .from('subscriptions')
        .select('subscription_type, plan, expiry_date')
        .eq('user_id', userId)
        .order('expiry_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      const expiryDate = row?.expiry_date ? new Date(row.expiry_date) : null
      return {
        hasSubscription: true,
        isActive: Boolean(expiryDate && expiryDate > new Date()),
        isExpired: Boolean(expiryDate && expiryDate <= new Date()),
        subscription: String(row?.plan || row?.subscription_type || 'paid'),
        expiryDate: row?.expiry_date || undefined,
      }
    }

    if (error || !profile) {
      return {
        hasSubscription: false,
        isActive: false,
        isExpired: false
      }
    }

    return {
      hasSubscription: false,
      isActive: false,
      isExpired: false
    }
  } catch (error) {
    console.error('Error getting subscription status:', error)
    return {
      hasSubscription: false,
      isActive: false,
      isExpired: false
    }
  }
}

// Force refresh subscription status for immediate access after payment
export async function forceRefreshSubscription(userId: string): Promise<boolean> {
  try {
    // Clear any cached subscription data and fetch fresh from database
    const { data: profile, error } = await subscriptionDb
      .from('profiles')
      .select('subscription, subscription_expiry_date')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      console.error('Error refreshing subscription:', error)
      return false
    }

    // Check if subscription is active
    const hasSubscription = profile.subscription && profile.subscription !== 'free'
    const isNotExpired = profile.subscription_expiry_date && 
                        new Date(profile.subscription_expiry_date) > new Date()
    
    console.log('✅ Subscription refreshed - access granted immediately')
    return hasSubscription && isNotExpired
  } catch (error) {
    console.error('Error force refreshing subscription:', error)
    return false
  }
}

// Get all subscriptions
export async function getAllSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await subscriptionDb
    .from('subscriptions')
    .select('*')

  if (error) {
    console.error('Error fetching subscriptions:', error)
    return []
  }

  return data || []
}