-- Check recent successful transactions to see if they have user_id and plan_id
SELECT 
  t.id,
  t.reference,
  t.phone_number,
  t.amount,
  t.status,
  t.user_id,
  t.plan_id,
  t.package_name,
  t.metadata,
  t.created_at,
  pl.name as plan_name
FROM public.transactions t
LEFT JOIN public.plans pl ON t.plan_id = pl.id
WHERE t.status = 'success'
  AND t.created_at > NOW() - INTERVAL '7 days'
ORDER BY t.created_at DESC
LIMIT 10;

-- Also check if there are profiles matching the phone numbers
SELECT 
  t.phone_number,
  t.amount,
  t.status,
  t.user_id as tx_user_id,
  p.id as profile_user_id,
  p.email,
  p.subscription
FROM public.transactions t
LEFT JOIN public.profiles p ON t.phone_number = p.phone
WHERE t.status = 'success'
  AND t.created_at > NOW() - INTERVAL '7 days'
ORDER BY t.created_at DESC;
