-- Quick fix for Kilax Starter users
-- Updates subscriptions for users whose profile shows "Kilax Starter"

-- Step 1: Get the Kilax Starter plan ID
DO $$
DECLARE
  starter_plan_id uuid;
BEGIN
  -- Find Kilax Starter plan
  SELECT id INTO starter_plan_id
  FROM public.plans
  WHERE LOWER(name) LIKE '%kilax starter%' OR LOWER(tier_label) LIKE '%kilax starter%'
  LIMIT 1;

  -- Update subscriptions for users with Kilax Starter in profile
  UPDATE public.subscriptions s
  SET 
    plan_id = starter_plan_id,
    subscription_type = 'paid',
    updated_at = NOW()
  FROM public.profiles p
  WHERE 
    s.user_id = p.id
    AND LOWER(p.subscription) LIKE '%starter%'
    AND starter_plan_id IS NOT NULL;

  RAISE NOTICE 'Updated subscriptions with Kilax Starter plan_id: %', starter_plan_id;
END $$;

-- Verify the results
SELECT 
  p.email,
  p.subscription as profile_plan,
  pl.tier_label as plan,
  pl.name as plan_name,
  s.subscription_type,
  s.status
FROM public.subscriptions s
JOIN public.profiles p ON s.user_id = p.id
LEFT JOIN public.plans pl ON s.plan_id = pl.id
WHERE LOWER(p.subscription) LIKE '%starter%'
ORDER BY s.created_at DESC;
