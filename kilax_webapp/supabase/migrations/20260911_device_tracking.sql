-- ============================================================
-- Device tracking + kilax_id on profiles
-- Run in Supabase SQL Editor for project maijanpfppqteqzlreey
-- ============================================================

-- ── 1. Add kilax_id to profiles ──────────────────────────────
-- Format: klm_<11 digits>  e.g. klm_32724489201
alter table public.profiles
  add column if not exists kilax_id text unique;

-- ── 2. Backfill kilax_id for existing users ──────────────────
-- Uses a deterministic suffix derived from the user's UUID so it's
-- stable across re-runs and unique per user.
update public.profiles
set kilax_id = 'klm_' || lpad(
    (abs(hashtext(id::text)) % 100000000000)::text,
    11, '0'
  )
where kilax_id is null;

-- ── 3. Auto-assign kilax_id on new profile insert ────────────
create or replace function public.assign_kilax_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kilax_id is null then
    new.kilax_id := 'klm_' || lpad(
      (abs(hashtext(new.id::text)) % 100000000000)::text,
      11, '0'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists assign_kilax_id_trigger on public.profiles;
create trigger assign_kilax_id_trigger
  before insert on public.profiles
  for each row execute function public.assign_kilax_id();

-- ── 4. user_devices table ────────────────────────────────────
-- Captures every unique device that accesses the platform.
-- device_id is generated client-side (see lib/deviceId.ts) and
-- stored in localStorage + IndexedDB for persistence.
create table if not exists public.user_devices (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  device_id     text        not null,   -- client-generated unique device fingerprint
  device_name   text,                   -- browser/OS label e.g. "Chrome on Android"
  platform      text,                   -- 'web', 'android', 'ios'
  ip_address    text,
  user_agent    text,
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, device_id)
);

create index if not exists user_devices_user_idx     on public.user_devices(user_id, last_seen desc);
create index if not exists user_devices_device_idx   on public.user_devices(device_id);

alter table public.user_devices enable row level security;
revoke all on public.user_devices from anon, authenticated;
grant  all on public.user_devices to   service_role;

-- Users can view their own devices
create policy "Users view own devices"
  on public.user_devices for select
  using (auth.uid() = user_id);

-- ── 5. Permissions ───────────────────────────────────────────
revoke all on function public.assign_kilax_id() from public, anon, authenticated;
