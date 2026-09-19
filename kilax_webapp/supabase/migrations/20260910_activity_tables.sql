-- ============================================================
-- Migration: download_events, user_daily_usage,
--            user_usage_summary, user_video_activity
--
-- Run in Supabase SQL Editor for project maijanpfppqteqzlreey
-- ============================================================

-- ── 1. download_events ───────────────────────────────────────
-- These names may already be used by reporting views in an older schema.
-- Rename those views first so the activity tables can be created safely.
do $$
declare
  relation_name text;
  relation_kind "char";
  legacy_name text;
begin
  foreach relation_name in array array[
    'download_events',
    'user_daily_usage',
    'user_usage_summary',
    'user_video_activity'
  ] loop
    select c.relkind
      into relation_kind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = relation_name;

    if relation_kind in ('v', 'm') then
      legacy_name := relation_name || '_legacy_view_20260910';
      while to_regclass('public.' || legacy_name) is not null loop
        legacy_name := legacy_name || '_old';
      end loop;
      execute format(
        'alter %s public.%I rename to %I',
        case when relation_kind = 'm' then 'materialized view' else 'view' end,
        relation_name,
        legacy_name
      );
    end if;
  end loop;
end;
$$;

create table if not exists public.download_events (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  content_type  text        not null,
  content_id    text        not null,
  content_title text,
  season        integer,
  episode       integer,
  filename      text,
  download_url  text,
  plan          text,
  ip_address    text,
  user_agent    text,
  status        text        not null default 'success',
  error_message text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- The table may already exist from an earlier activity migration.  CREATE TABLE
-- IF NOT EXISTS does not reconcile its columns, so add the fields required by
-- the indexes and RPC below before using them.
alter table public.download_events add column if not exists user_id uuid;
alter table public.download_events add column if not exists content_type text;
alter table public.download_events add column if not exists content_id text;
alter table public.download_events add column if not exists content_title text;
alter table public.download_events add column if not exists season integer;
alter table public.download_events add column if not exists episode integer;
alter table public.download_events add column if not exists filename text;
alter table public.download_events add column if not exists download_url text;
alter table public.download_events add column if not exists plan text;
alter table public.download_events add column if not exists status text default 'success';
alter table public.download_events add column if not exists expires_at timestamptz;
alter table public.download_events add column if not exists created_at timestamptz default now();

create index if not exists download_events_user_idx
  on public.download_events(user_id, created_at desc);
create index if not exists download_events_content_idx
  on public.download_events(content_type, content_id);
create index if not exists download_events_created_idx
  on public.download_events(created_at desc);

alter table public.download_events enable row level security;
revoke all on table public.download_events from anon, authenticated;
grant all  on table public.download_events to service_role;

-- ── 2. user_daily_usage ──────────────────────────────────────
create table if not exists public.user_daily_usage (
  id               uuid    primary key default gen_random_uuid(),
  user_id          uuid    not null references auth.users(id) on delete cascade,
  usage_date       date    not null default current_date,
  movie_downloads  integer not null default 0,
  series_downloads integer not null default 0,
  stream_starts    integer not null default 0,
  watch_seconds    bigint  not null default 0,
  unique (user_id, usage_date)
);

alter table public.user_daily_usage add column if not exists user_id uuid;
alter table public.user_daily_usage add column if not exists usage_date date default current_date;
alter table public.user_daily_usage add column if not exists movie_downloads integer default 0;
alter table public.user_daily_usage add column if not exists series_downloads integer default 0;
alter table public.user_daily_usage add column if not exists stream_starts integer default 0;
alter table public.user_daily_usage add column if not exists watch_seconds bigint default 0;

create index if not exists user_daily_usage_user_date_idx
  on public.user_daily_usage(user_id, usage_date desc);

alter table public.user_daily_usage enable row level security;
revoke all on table public.user_daily_usage from anon, authenticated;
grant all  on table public.user_daily_usage to service_role;

-- ── 3. user_usage_summary ────────────────────────────────────
create table if not exists public.user_usage_summary (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  total_downloads        integer     not null default 0,
  total_movie_downloads  integer     not null default 0,
  total_series_downloads integer     not null default 0,
  total_stream_starts    integer     not null default 0,
  total_watch_seconds    bigint      not null default 0,
  last_download_at       timestamptz,
  last_stream_at         timestamptz,
  updated_at             timestamptz not null default now()
);

alter table public.user_usage_summary add column if not exists user_id uuid;
alter table public.user_usage_summary add column if not exists total_downloads integer default 0;
alter table public.user_usage_summary add column if not exists total_movie_downloads integer default 0;
alter table public.user_usage_summary add column if not exists total_series_downloads integer default 0;
alter table public.user_usage_summary add column if not exists total_stream_starts integer default 0;
alter table public.user_usage_summary add column if not exists total_watch_seconds bigint default 0;
alter table public.user_usage_summary add column if not exists last_download_at timestamptz;
alter table public.user_usage_summary add column if not exists last_stream_at timestamptz;
alter table public.user_usage_summary add column if not exists updated_at timestamptz default now();

alter table public.user_usage_summary enable row level security;
revoke all on table public.user_usage_summary from anon, authenticated;
grant all  on table public.user_usage_summary to service_role;

-- ── 4. user_video_activity ───────────────────────────────────
create table if not exists public.user_video_activity (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  content_type     text        not null,
  content_id       text        not null,
  content_title    text,
  season           integer,
  episode          integer,
  event_type       text        not null default 'play',
  position_seconds integer,
  duration_seconds integer,
  watch_seconds    integer,
  quality          text,
  plan             text,
  ip_address       text,
  user_agent       text,
  created_at       timestamptz not null default now()
);

-- Reconcile an existing user_video_activity table before creating indexes.
alter table public.user_video_activity add column if not exists user_id uuid;
alter table public.user_video_activity add column if not exists content_type text;
alter table public.user_video_activity add column if not exists content_id text;
alter table public.user_video_activity add column if not exists content_title text;
alter table public.user_video_activity add column if not exists season integer;
alter table public.user_video_activity add column if not exists episode integer;
alter table public.user_video_activity add column if not exists event_type text default 'play';
alter table public.user_video_activity add column if not exists position_seconds integer;
alter table public.user_video_activity add column if not exists duration_seconds integer;
alter table public.user_video_activity add column if not exists watch_seconds integer;
alter table public.user_video_activity add column if not exists quality text;
alter table public.user_video_activity add column if not exists plan text;
alter table public.user_video_activity add column if not exists created_at timestamptz default now();

create index if not exists user_video_activity_user_idx
  on public.user_video_activity(user_id, created_at desc);
create index if not exists user_video_activity_content_idx
  on public.user_video_activity(content_type, content_id);
create index if not exists user_video_activity_created_idx
  on public.user_video_activity(created_at desc);

alter table public.user_video_activity enable row level security;
revoke all on table public.user_video_activity from anon, authenticated;
grant all  on table public.user_video_activity to service_role;

-- ── 5. record_kilax_download RPC ─────────────────────────────
-- Replaces the version from 20260904_subscription_download_limits.sql.
-- Adds: download_events log, user_daily_usage upsert, user_usage_summary upsert.
--
-- Key fix: ON CONFLICT DO UPDATE SET must NOT reference the table name
-- as a qualifier (causes "column does not exist" in PostgreSQL).
-- Use plain column names on the left and EXCLUDED.col on the right.
create or replace function public.record_kilax_download(
  p_user_id       uuid,
  p_content_type  text,
  p_content_id    text,
  p_content_title text        default null,
  p_season        integer     default null,
  p_episode       integer     default null,
  p_filename      text        default null,
  p_download_url  text        default null,
  p_plan          text        default null,
  p_expires_at    timestamptz default null
)
returns table(
  allowed          boolean,
  reason           text,
  movie_used       integer,
  series_used      integer,
  movie_remaining  integer,
  series_remaining integer,
  reset_at         timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now             timestamptz := now();
  v_cutoff          timestamptz := v_now - interval '24 hours';
  v_movie_used      integer;
  v_series_used     integer;
  v_already_exists  boolean;
  v_next_reset      timestamptz;
  -- normalise: treat 'episode' as 'series' for limit purposes
  v_norm_type       text := case when p_content_type = 'episode' then 'series' else p_content_type end;
  v_movie_inc       integer;
  v_series_inc      integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 781233));

  -- Has this exact content been downloaded in the last 24 h?
  select exists(
    select 1 from public.download_usage
     where user_id      = p_user_id
       and content_type = v_norm_type
       and content_id   = p_content_id
       and downloaded_at >= v_cutoff
  ) into v_already_exists;

  -- Count distinct items downloaded today
  select count(*) into v_movie_used from (
    select distinct content_id
      from public.download_usage
     where user_id = p_user_id and content_type = 'movie' and downloaded_at >= v_cutoff
  ) q;

  select count(*) into v_series_used from (
    select distinct content_id
      from public.download_usage
     where user_id = p_user_id and content_type = 'series' and downloaded_at >= v_cutoff
  ) q;

  -- ── Limit checks (only for new downloads) ──────────────────
  if not v_already_exists then

    if v_norm_type = 'movie' and v_movie_used >= 5 then
      select min(downloaded_at + interval '24 hours') into v_next_reset
        from public.download_usage
       where user_id = p_user_id and content_type = 'movie' and downloaded_at >= v_cutoff;

      insert into public.download_events(
        user_id, content_type, content_id, content_title,
        season, episode, plan, status, error_message, created_at
      ) values (
        p_user_id, p_content_type, p_content_id, p_content_title,
        p_season, p_episode, p_plan, 'limit_reached', 'movie_limit', v_now
      );

      return query
        select false, 'movie_limit'::text,
               v_movie_used, v_series_used,
               0, greatest(0, 1 - v_series_used),
               v_next_reset;
      return;
    end if;

    if v_norm_type = 'series' and v_series_used >= 1 then
      select min(downloaded_at + interval '24 hours') into v_next_reset
        from public.download_usage
       where user_id = p_user_id and content_type = 'series' and downloaded_at >= v_cutoff;

      insert into public.download_events(
        user_id, content_type, content_id, content_title,
        season, episode, plan, status, error_message, created_at
      ) values (
        p_user_id, p_content_type, p_content_id, p_content_title,
        p_season, p_episode, p_plan, 'limit_reached', 'series_limit', v_now
      );

      return query
        select false, 'series_limit'::text,
               v_movie_used, v_series_used,
               greatest(0, 5 - v_movie_used), 0,
               v_next_reset;
      return;
    end if;

  end if;

  -- ── Record in rate-limit table ──────────────────────────────
  if not v_already_exists then
    insert into public.download_usage(user_id, content_type, content_id, content_title, downloaded_at)
    values (p_user_id, v_norm_type, p_content_id, p_content_title, v_now);

    v_movie_used  := v_movie_used  + case when v_norm_type = 'movie'  then 1 else 0 end;
    v_series_used := v_series_used + case when v_norm_type = 'series' then 1 else 0 end;
  end if;

  -- Increment values (precompute so DO UPDATE SET stays simple)
  v_movie_inc  := case when v_norm_type = 'movie'  then 1 else 0 end;
  v_series_inc := case when v_norm_type = 'series' then 1 else 0 end;

  -- ── a) download_events ─────────────────────────────────────
  insert into public.download_events(
    user_id, content_type, content_id, content_title,
    season, episode, filename, download_url,
    plan, status, expires_at, created_at
  ) values (
    p_user_id, p_content_type, p_content_id, p_content_title,
    p_season, p_episode, p_filename, p_download_url,
    p_plan, 'success', p_expires_at, v_now
  );

  -- ── b) user_daily_usage (upsert) ───────────────────────────
  -- LEFT side: bare column name   RIGHT side: EXCLUDED.col + increment
  insert into public.user_daily_usage(
    user_id, usage_date, movie_downloads, series_downloads
  ) values (
    p_user_id, v_now::date, v_movie_inc, v_series_inc
  )
  on conflict (user_id, usage_date) do update set
    movie_downloads  = movie_downloads  + EXCLUDED.movie_downloads,
    series_downloads = series_downloads + EXCLUDED.series_downloads;

  -- ── c) user_usage_summary (upsert) ─────────────────────────
  insert into public.user_usage_summary(
    user_id,
    total_downloads,
    total_movie_downloads,
    total_series_downloads,
    last_download_at,
    updated_at
  ) values (
    p_user_id, 1, v_movie_inc, v_series_inc, v_now, v_now
  )
  on conflict (user_id) do update set
    total_downloads        = total_downloads        + 1,
    total_movie_downloads  = total_movie_downloads  + EXCLUDED.total_movie_downloads,
    total_series_downloads = total_series_downloads + EXCLUDED.total_series_downloads,
    last_download_at       = EXCLUDED.last_download_at,
    updated_at             = EXCLUDED.updated_at;

  return query
    select true,
           case when v_already_exists then 'already_counted' else 'counted' end::text,
           v_movie_used, v_series_used,
           greatest(0, 5 - v_movie_used),
           greatest(0, 1 - v_series_used),
           v_now + interval '24 hours';
end;
$$;

-- ── 6. log_video_activity RPC ────────────────────────────────
create or replace function public.log_video_activity(
  p_user_id       uuid,
  p_content_type  text,
  p_content_id    text,
  p_content_title text    default null,
  p_season        integer default null,
  p_episode       integer default null,
  p_event_type    text    default 'play',
  p_position_secs integer default null,
  p_duration_secs integer default null,
  p_watch_seconds integer default null,
  p_quality       text    default null,
  p_plan          text    default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_ws  integer     := coalesce(p_watch_seconds, 0);
begin
  insert into public.user_video_activity(
    user_id, content_type, content_id, content_title,
    season, episode, event_type,
    position_seconds, duration_seconds, watch_seconds,
    quality, plan, created_at
  ) values (
    p_user_id, p_content_type, p_content_id, p_content_title,
    p_season, p_episode, p_event_type,
    p_position_secs, p_duration_secs, p_watch_seconds,
    p_quality, p_plan, v_now
  );

  if p_event_type = 'play' then
    -- daily usage
    insert into public.user_daily_usage(user_id, usage_date, stream_starts, watch_seconds)
    values (p_user_id, v_now::date, 1, v_ws)
    on conflict (user_id, usage_date) do update set
      stream_starts = stream_starts + 1,
      watch_seconds = watch_seconds + EXCLUDED.watch_seconds;

    -- summary
    insert into public.user_usage_summary(
      user_id, total_stream_starts, total_watch_seconds, last_stream_at, updated_at
    ) values (
      p_user_id, 1, v_ws, v_now, v_now
    )
    on conflict (user_id) do update set
      total_stream_starts = total_stream_starts + 1,
      total_watch_seconds = total_watch_seconds + EXCLUDED.total_watch_seconds,
      last_stream_at      = EXCLUDED.last_stream_at,
      updated_at          = EXCLUDED.updated_at;
  end if;
end;
$$;

-- ── Permissions ───────────────────────────────────────────────
do $$
begin
  -- record_kilax_download — revoke old signature too if it exists
  begin
    revoke all on function public.record_kilax_download(uuid,text,text,text)
      from public, anon, authenticated;
  exception when undefined_function then null;
  end;
  begin
    revoke all on function public.record_kilax_download(uuid,text,text,text,integer,integer,text,text,text,timestamptz)
      from public, anon, authenticated;
  exception when undefined_function then null;
  end;
end;
$$;

grant execute on function public.record_kilax_download(uuid,text,text,text,integer,integer,text,text,text,timestamptz)
  to service_role;

grant execute on function public.log_video_activity(uuid,text,text,text,integer,integer,text,integer,integer,integer,text,text)
  to service_role;
