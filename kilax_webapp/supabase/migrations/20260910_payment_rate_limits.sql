-- ============================================================
-- payment_rate_limits — server-side per-user payment throttle
-- Run in Supabase SQL Editor for project maijanpfppqteqzlreey
-- ============================================================

create table if not exists public.payment_rate_limits (
  user_id        uuid        primary key references auth.users(id) on delete cascade,
  attempt_count  integer     not null default 0,
  window_start   timestamptz not null default now(),
  blocked_until  timestamptz,
  last_attempt   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.payment_rate_limits enable row level security;
revoke all on public.payment_rate_limits from anon, authenticated;
grant  all on public.payment_rate_limits to   service_role;

-- ── RPC: check + increment in one atomic operation ────────────────────────────
-- Returns:
--   allowed        boolean  — false when the user must wait
--   attempt_count  integer  — how many attempts in this window
--   retry_after_s  integer  — seconds until unblocked (0 when allowed)
--   blocked_until  timestamptz
create or replace function public.check_payment_rate_limit(
  p_user_id      uuid,
  p_window_secs  integer default 600,   -- 10-minute window
  p_max_attempts integer default 5,     -- max attempts per window
  p_block_secs   integer default 1800   -- 30-min block after exceeding
)
returns table(
  allowed        boolean,
  attempt_count  integer,
  retry_after_s  integer,
  blocked_until  timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now          timestamptz := now();
  v_window_start timestamptz := v_now - (p_window_secs || ' seconds')::interval;
  v_block_end    timestamptz;
  v_count        integer;
  v_new_start    timestamptz;
begin
  -- Lock this user's row to prevent race conditions
  perform pg_advisory_xact_lock(hashtext('prl:' || p_user_id::text));

  -- Upsert the rate-limit row
  insert into public.payment_rate_limits(user_id, attempt_count, window_start, last_attempt, updated_at)
  values (p_user_id, 1, v_now, v_now, v_now)
  on conflict (user_id) do update set
    -- Reset window if it has expired
    window_start  = case
                      when payment_rate_limits.window_start < v_window_start
                      then v_now
                      else payment_rate_limits.window_start
                    end,
    attempt_count = case
                      when payment_rate_limits.window_start < v_window_start
                      then 1
                      else payment_rate_limits.attempt_count + 1
                    end,
    blocked_until = case
                      when payment_rate_limits.window_start < v_window_start
                      then null   -- reset block when window resets
                      when (payment_rate_limits.attempt_count + 1) > p_max_attempts
                      then v_now + (p_block_secs || ' seconds')::interval
                      else payment_rate_limits.blocked_until
                    end,
    last_attempt  = v_now,
    updated_at    = v_now;

  -- Read back the updated row
  select r.attempt_count, r.blocked_until
    into v_count, v_block_end
    from public.payment_rate_limits r
   where r.user_id = p_user_id;

  if v_block_end is not null and v_block_end > v_now then
    return query select
      false,
      v_count,
      extract(epoch from (v_block_end - v_now))::integer,
      v_block_end;
  else
    return query select
      true,
      v_count,
      0::integer,
      null::timestamptz;
  end if;
end;
$$;

revoke all on function public.check_payment_rate_limit(uuid,integer,integer,integer)
  from public, anon, authenticated;
grant execute on function public.check_payment_rate_limit(uuid,integer,integer,integer)
  to service_role;

-- ── RPC: reset a user's rate limit (admin use / after successful payment) ─────
create or replace function public.reset_payment_rate_limit(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.payment_rate_limits
     set attempt_count = 0,
         blocked_until = null,
         window_start  = now(),
         updated_at    = now()
   where user_id = p_user_id;
$$;

revoke all on function public.reset_payment_rate_limit(uuid)
  from public, anon, authenticated;
grant execute on function public.reset_payment_rate_limit(uuid)
  to service_role;
