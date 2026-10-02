DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'transaction_id'
      AND data_type = 'bigint'
  ) THEN
    IF EXISTS (SELECT 1 FROM public.subscriptions WHERE transaction_id IS NOT NULL) THEN
      RAISE EXCEPTION 'subscriptions.transaction_id contains bigint values; review and migrate these references before changing the column type';
    END IF;

    ALTER TABLE public.subscriptions
      ALTER COLUMN transaction_id TYPE uuid USING NULL::uuid;
  END IF;
END $$;