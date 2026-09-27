-- Sync profiles to subscriptions where profile has a plan but subscription doesn't
-- This handles cases where profile.subscription is set but subscriptions.plan_id is null

-- First, let's see which users have this mismatch
SELECT 
  p.email,
  p.subscription as profile_plan,
  s.subscription_type,
  s.plan_id,
  pl.name as plan_name
FROM public.profiles p
LEFT JOIN public.subscriptions s ON p.id = s.user_id AND s.status = 'active'
LEFT JOIN public.plans pl ON s.plan_id = pl.id
WHERE 
  p.subscription IS NOT NULL 
  AND p.subscription != 'free'
  AND (s.plan_id IS NULL OR s.subscription_type = 'trial')
ORDER BY p.email;

-- Now update subscriptions to match the profile.subscription field
UPDATE public.subscriptions s
SET 
  plan_id = pl.id,
  subscription_type = 'paid',
  updated_at = NOW()
FROM public.profiles p
JOIN public.plans pl ON (
  LOWER(pl.tier_label) = LOWER(p.subscription) 
  OR LOWER(pl.name) LIKE LOWER(p.subscription || '%')
)
WHERE 
  s.user_id = p.id
  AND s.status = 'active'
  AND p.subscription IS NOT NULL
  AND p.subscription != 'free'
  AND (s.plan_id IS NULL OR s.subscription_type = 'trial');

-- Verify the changes
SELECT 
  p.email,
  p.subscription as profile_plan,
  pl.tier_label as plan,
  pl.name as plan_name,
  s.subscription_type,
  s.status,
  s.start_date,
  s.expiry_date
FROM public.subscriptions s
JOIN public.profiles p ON s.user_id = p.id
LEFT JOIN public.plans pl ON s.plan_id = pl.id
WHERE s.status = 'active'
ORDER BY s.created_at DESC
LIMIT 30;
