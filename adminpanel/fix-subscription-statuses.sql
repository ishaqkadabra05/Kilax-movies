-- Fix subscription statuses based on expiry dates
-- Sets status to 'active' if not expired, 'expired' if past expiry date

UPDATE public.subscriptions
SET 
  status = CASE
    WHEN expiry_date IS NULL THEN 'active'
    WHEN expiry_date > NOW() THEN 'active'
    ELSE 'expired'
  END,
  updated_at = NOW()
WHERE status IN ('cancelled', 'active', 'expired');

-- Verify the changes
SELECT 
  p.email,
  pl.tier_label as plan,
  s.subscription_type,
  s.status,
  s.expiry_date,
  CASE 
    WHEN s.expiry_date IS NULL THEN 'No expiry'
    WHEN s.expiry_date > NOW() THEN 'Still valid'
    ELSE 'Expired'
  END as calculated_status
FROM public.subscriptions s
JOIN public.profiles p ON s.user_id = p.id
LEFT JOIN public.plans pl ON s.plan_id = pl.id
WHERE s.plan_id IS NOT NULL
ORDER BY s.status, s.expiry_date DESC;
