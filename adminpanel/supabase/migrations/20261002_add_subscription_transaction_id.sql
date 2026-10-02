ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS transaction_id uuid;

CREATE INDEX IF NOT EXISTS subscriptions_transaction_id_idx
  ON public.subscriptions(transaction_id);