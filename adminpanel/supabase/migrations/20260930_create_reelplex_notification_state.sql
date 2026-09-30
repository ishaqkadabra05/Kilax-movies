CREATE TABLE IF NOT EXISTS public.reelplex_notification_state (
  content_type text PRIMARY KEY CHECK (content_type IN ('movie', 'series')),
  last_content_id text NOT NULL,
  last_content_title text,
  last_vj text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reelplex_notification_state_updated_at_idx
  ON public.reelplex_notification_state(updated_at DESC);

ALTER TABLE public.reelplex_notification_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reelplex_notification_state'
      AND policyname = 'admins can manage reelplex notification state'
  ) THEN
    CREATE POLICY "admins can manage reelplex notification state"
      ON public.reelplex_notification_state
      FOR ALL
      TO authenticated
      USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
      WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  END IF;
END;
$$;