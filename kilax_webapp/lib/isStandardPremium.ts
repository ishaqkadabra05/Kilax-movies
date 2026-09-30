// Utility: Check if subscription is standard premium
import type { Subscription } from './supabase';

export function isStandardPlanName(value: string | null | undefined) {
  const plan = String(value || '').toLowerCase().replace(/[_\s-]/g, '');
  return plan === 'standard' || plan === 'standardpremium';
}

export function isEligibleStreamingPlanName(value: string | null | undefined) {
  const plan = String(value || '').toLowerCase().replace(/[_\s-]/g, '');
  if (!plan || ['free', 'trial', 'guest', 'none'].some(ineligible => plan.startsWith(ineligible))) return false;
  return !plan.startsWith('basic');
}

export function isStandardPremium(subscription: Subscription | null) {
  if (!subscription) {
    console.log('isStandardPremium: No subscription found');
    return false;
  }
  
  // Normalize to lowercase, remove spaces and underscores
  const plan = subscription.plan?.toLowerCase().replace(/[_ ]/g, '');
  const isStandard = isStandardPlanName(plan);
  
  console.log('isStandardPremium check:', {
    originalPlan: subscription.plan,
    normalizedPlan: plan,
    isStandard
  });
  
  return isStandard;
}

