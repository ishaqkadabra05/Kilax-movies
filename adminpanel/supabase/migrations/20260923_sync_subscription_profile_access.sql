ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS subscription text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_start_date date,
  ADD COLUMN IF NOT EXISTS subscription_expiry_date date,
  ADD COLUMN IF NOT EXISTS trial_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_id uuid,
  ADD COLUMN IF NOT EXISTS subscription_type text NOT NULL DEFAULT 'premium',
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS subscriptions_status_idx
  ON public.subscriptions(status);

CREATE INDEX IF NOT EXISTS subscriptions_expiry_idx
  ON public.subscriptions(expiry_date);

CREATE INDEX IF NOT EXISTS profiles_subscription_idx
  ON public.profiles(subscription);

CREATE INDEX IF NOT EXISTS profiles_trial_status_idx
  ON public.profiles(trial_status);
