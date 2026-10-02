CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE OR REPLACE FUNCTION public.expire_trial_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH expired_trials AS (
    UPDATE public.subscriptions
    SET status = 'expired',
        updated_at = now()
    WHERE subscription_type = 'trial'
      AND status = 'active'
      AND expiry_date IS NOT NULL
      AND expiry_date <= now()
    RETURNING user_id
  )
  UPDATE public.profiles AS profile
  SET subscription = 'free',
      subscription_start_date = NULL,
      subscription_expiry_date = NULL,
      trial_status = 'expired',
      updated_at = now()
  WHERE profile.id IN (SELECT user_id FROM expired_trials)
    AND (
      profile.subscription IS NULL
      OR lower(profile.subscription) IN ('free', 'trial')
      OR profile.trial_status = 'active'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.subscriptions AS paid
      WHERE paid.user_id = profile.id
        AND paid.subscription_type = 'paid'
        AND paid.status = 'active'
        AND paid.expiry_date > now()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.expire_trial_subscriptions() FROM PUBLIC, anon, authenticated;

SELECT public.expire_trial_subscriptions();

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'expire-trial-subscriptions';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'expire-trial-subscriptions',
    '*/5 * * * *',
    'SELECT public.expire_trial_subscriptions();'
  );
END;
$$;