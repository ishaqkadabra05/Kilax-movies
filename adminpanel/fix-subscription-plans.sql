-- Fix subscriptions by changing subscription_type from 'trial' to 'paid' for users with plan_id
-- This will make them count as paid subscribers

-- Step 1: Update existing subscriptions that have plan_id but are still marked as trial
UPDATE public.subscriptions
SET 
  subscription_type = 'paid',
  updated_at = NOW()
WHERE 
  plan_id IS NOT NULL
  AND subscription_type = 'trial'
  AND status = 'active';

-- Step 2: Update subscriptions that have matching successful transactions
UPDATE public.subscriptions s
SET 
  plan_id = t.plan_id,
  transaction_id = t.id,
  payment_method = t.payment_method,
  subscription_type = 'paid',
  updated_at = NOW()
FROM public.transactions t
WHERE 
  s.user_id = t.user_id
  AND t.status = 'success'
  AND t.plan_id IS NOT NULL
  AND s.plan_id IS NULL;

-- Step 3: Update profiles with plan names
UPDATE public.profiles p
SET 
  subscription = pl.tier_label,
  subscription_start_date = s.start_date,
  subscription_expiry_date = s.expiry_date,
  trial_status = 'none'
FROM public.subscriptions s
JOIN public.plans pl ON s.plan_id = pl.id
WHERE 
  p.id = s.user_id
  AND s.status = 'active'
  AND s.subscription_type = 'paid';

-- Step 3: Check results - show updated subscriptions with plan names
SELECT 
  p.email,
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
