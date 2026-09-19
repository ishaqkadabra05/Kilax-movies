-- ============================================================
-- Referral & Coins system
-- Run in Supabase SQL Editor for project maijanpfppqteqzlreey
-- ============================================================

-- ── 1. Add coins column to profiles ──────────────────────────
alter table public.profiles
  add column if not exists coins integer not null default 0;

-- ── 2. referral_links ────────────────────────────────────────
-- One row per sharer. The ref_code is the short code appended to URLs.
create table if not exists public.referral_links (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  ref_code     text        not null unique,
  content_id   text,                        -- optional: the movie/series shared
  content_type text,                        -- 'movie' | 'series'
  content_title text,
  total_clicks integer     not null default 0,
  total_signups integer    not null default 0,
  total_coins  integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists referral_links_user_idx    on public.referral_links(user_id);
create index if not exists referral_links_ref_code_idx on public.referral_links(ref_code);

alter table public.referral_links enable row level security;
revoke all on public.referral_links from anon, authenticated;
grant  all on public.referral_links to   service_role;
-- Users can view their own links
create policy "Users view own referral links"
  on public.referral_links for select
  using (auth.uid() = user_id);

-- ── 3. referral_events ───────────────────────────────────────
-- One row per redemption (when a new user signs up via a referral link).
create table if not exists public.referral_events (
  id              uuid        primary key default gen_random_uuid(),
  referral_link_id uuid       not null references public.referral_links(id) on delete cascade,
  sharer_id       uuid        not null references auth.users(id) on delete cascade,
  referee_id      uuid        references auth.users(id) on delete set null,
  referee_ip      text,
  coins_awarded   integer     not null default 0,
  status          text        not null default 'pending'
                              check (status in ('pending','completed','rejected')),
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists referral_events_sharer_idx  on public.referral_events(sharer_id, created_at desc);
create index if not exists referral_events_referee_idx on public.referral_events(referee_id);
create index if not exists referral_events_link_idx    on public.referral_events(referral_link_id);

alter table public.referral_events enable row level security;
revoke all on public.referral_events from anon, authenticated;
grant  all on public.referral_events to   service_role;
-- Users can view events where they are the sharer
create policy "Users view own referral events"
  on public.referral_events for select
  using (auth.uid() = sharer_id);

-- ── 4. coins_ledger ──────────────────────────────────────────
-- Immutable audit trail. profiles.coins = sum of all ledger entries.
create table if not exists public.coins_ledger (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  amount      integer     not null,          -- positive = credit, negative = debit
  balance_after integer   not null,
  reason      text        not null,          -- 'referral_signup', 'manual_credit', etc.
  ref_event_id uuid       references public.referral_events(id),
  metadata    jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists coins_ledger_user_idx    on public.coins_ledger(user_id, created_at desc);
create index if not exists coins_ledger_created_idx on public.coins_ledger(created_at desc);

alter table public.coins_ledger enable row level security;
revoke all on public.coins_ledger from anon, authenticated;
grant  all on public.coins_ledger to   service_role;
-- Users can view their own ledger
create policy "Users view own coins ledger"
  on public.coins_ledger for select
  using (auth.uid() = user_id);

-- ── 5. award_referral_coins RPC ──────────────────────────────
-- Called after a new user signs up via a referral link.
-- Awards coins to the sharer, writes ledger entry, updates referral totals.
-- Returns false (silently) if already redeemed by this referee.
--
-- Parameters:
--   p_ref_code    — the referral code from the URL
--   p_referee_id  — the newly signed-up user's UUID
--   p_referee_ip  — IP address for duplicate detection
--   p_coins       — how many coins to award (default 50)
create or replace function public.award_referral_coins(
  p_ref_code   text,
  p_referee_id uuid,
  p_referee_ip text    default null,
  p_coins      integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link        public.referral_links%rowtype;
  v_event_id    uuid;
  v_new_balance integer;
begin
  -- Look up the referral link
  select * into v_link
    from public.referral_links
   where ref_code = p_ref_code;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_ref_code');
  end if;

  -- Prevent self-referral
  if v_link.user_id = p_referee_id then
    return jsonb_build_object('ok', false, 'error', 'self_referral');
  end if;

  -- Prevent a user from redeeming multiple referral codes
  if exists (
    select 1 from public.referral_events
     where referee_id = p_referee_id
       and status = 'completed'
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_redeemed');
  end if;

  -- Lock the sharer row to prevent races
  perform pg_advisory_xact_lock(hashtext('coins:' || v_link.user_id::text));

  -- Create the referral event
  insert into public.referral_events(
    referral_link_id, sharer_id, referee_id,
    referee_ip, coins_awarded, status, completed_at
  ) values (
    v_link.id, v_link.user_id, p_referee_id,
    p_referee_ip, p_coins, 'completed', now()
  )
  returning id into v_event_id;

  -- Add coins to sharer's profile
  update public.profiles
     set coins = coins + p_coins,
         updated_at = now()
   where id = v_link.user_id
  returning coins into v_new_balance;

  -- Write ledger entry
  insert into public.coins_ledger(
    user_id, amount, balance_after, reason, ref_event_id, metadata
  ) values (
    v_link.user_id, p_coins, v_new_balance, 'referral_signup',
    v_event_id,
    jsonb_build_object(
      'ref_code',     p_ref_code,
      'referee_id',   p_referee_id,
      'content_id',   v_link.content_id,
      'content_type', v_link.content_type,
      'content_title',v_link.content_title
    )
  );

  -- Update referral link stats
  update public.referral_links
     set total_signups = total_signups + 1,
         total_coins   = total_coins   + p_coins,
         updated_at    = now()
   where id = v_link.id;

  return jsonb_build_object(
    'ok',          true,
    'coins',       p_coins,
    'new_balance', v_new_balance,
    'sharer_id',   v_link.user_id,
    'event_id',    v_event_id
  );
end;
$$;

revoke all on function public.award_referral_coins(text,uuid,text,integer)
  from public, anon, authenticated;
grant execute on function public.award_referral_coins(text,uuid,text,integer)
  to service_role;

-- ── 6. generate_ref_code helper ──────────────────────────────
-- Generates or returns an existing referral code for (user, content).
create or replace function public.get_or_create_referral_link(
  p_user_id      uuid,
  p_content_id   text    default null,
  p_content_type text    default null,
  p_content_title text   default null
)
returns text  -- returns the ref_code
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_existing text;
begin
  -- Return existing code for same user+content
  select ref_code into v_existing
    from public.referral_links
   where user_id    = p_user_id
     and content_id = p_content_id
   limit 1;

  if found then
    return v_existing;
  end if;

  -- Generate a unique 8-char alphanumeric code
  loop
    v_code := upper(
      translate(
        encode(gen_random_bytes(6), 'base64'),
        '+/=', ''
      )
    );
    v_code := left(v_code, 8);
    exit when not exists (
      select 1 from public.referral_links where ref_code = v_code
    );
  end loop;

  insert into public.referral_links(
    user_id, ref_code, content_id, content_type, content_title
  ) values (
    p_user_id, v_code, p_content_id, p_content_type, p_content_title
  );

  return v_code;
end;
$$;

revoke all on function public.get_or_create_referral_link(uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.get_or_create_referral_link(uuid,text,text,text)
  to service_role;

-- ── 7. Seed coins = 0 for existing profiles ──────────────────
update public.profiles set coins = 0 where coins is null;
