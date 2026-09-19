-- ============================================================
-- Migration: profiles email column + sync trigger
--
-- Assumes the profiles table already exists with column: full_name
-- (not "name"). Adds email if missing, creates trigger on auth.users
-- to keep profiles in sync, and backfills existing users.
-- ============================================================

-- ── 1. Add email column if missing ──────────────────────────
alter table public.profiles
  add column if not exists email text;

-- ── 2. Trigger function ──────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    phone,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(
      new.raw_user_meta_data->>'phone',
      new.phone
    ),
    now(),
    now()
  )
  on conflict (id) do update
    set
      email     = excluded.email,
      full_name = coalesce(profiles.full_name, excluded.full_name),
      avatar_url = coalesce(profiles.avatar_url, excluded.avatar_url),
      phone      = coalesce(profiles.phone,      excluded.phone),
      updated_at = now();

  return new;
end;
$$;

-- ── 3. Attach trigger on INSERT ──────────────────────────────
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ── 4. Attach trigger on email UPDATE ───────────────────────
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_new_user();

-- ── 5. Backfill email for existing profiles ──────────────────
update public.profiles p
set
  email      = u.email,
  full_name  = coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  updated_at = now()
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

-- ── 6. Insert profiles for auth users with no row yet ────────
insert into public.profiles (id, email, full_name, avatar_url, phone, created_at, updated_at)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.raw_user_meta_data->>'avatar_url',
  coalesce(u.raw_user_meta_data->>'phone', u.phone),
  u.created_at,
  now()
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
)
on conflict (id) do nothing;

-- ── 7. RLS policies ──────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile"   on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Service role full access"     on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Service role full access"
  on public.profiles for all
  using (true)
  with check (true);

-- ── 8. Auto updated_at ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
