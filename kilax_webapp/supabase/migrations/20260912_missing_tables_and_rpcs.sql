-- ============================================================
-- Missing tables & RPCs required for Supabase data capture
-- Run in Supabase SQL Editor for project maijanpfppqteqzlreey
-- ============================================================

-- ── 1. playback_positions ────────────────────────────────────
-- Tracks current resume position per user per content item.
-- Admin panel live-activity queries this for "active now".
create table if not exists public.playback_positions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  content_type text        not null,   -- 'movie' | 'series' | 'episode'
  content_id   text        not null,
  season       integer,
  episode      integer,
  position_sec integer     not null default 0,   -- resume position in seconds
  duration_sec integer,                           -- total content duration
  completed    boolean     not null default false,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (user_id, content_type, content_id, coalesce(season,-1), coalesce(episode,-1))
);

create index if not exists playback_positions_user_idx
  on public.playback_positions(user_id, updated_at desc);
create index if not exists playback_positions_updated_idx
  on public.playback_positions(updated_at desc);

alter table public.playback_positions enable row level security;
revoke all on public.playback_positions from anon, authenticated;
grant  all on public.playback_positions to   service_role;

-- Users can read/write their own playback positions
create policy "Users manage own playback positions"
  on public.playback_positions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 2. history ───────────────────────────────────────────────
-- Simple watch history: one row per content item per user.
-- Admin panel live-activity queries this as a supplementary source.
create table if not exists public.history (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  content_type text        not null,
  content_id   text        not null,
  content_title text,
  season       integer,
  episode      integer,
  watched_at   timestamptz not null default now(),
  unique (user_id, content_type, content_id)
);

create index if not exists history_user_idx
  on public.history(user_id, watched_at desc);
create index if not exists history_watched_idx
  on public.history(watched_at desc);

alter table public.history enable row level security;
revoke all on public.history from anon, authenticated;
grant  all on public.history to   service_role;

create policy "Users manage own history"
  on public.history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 3. record_kilax_usage_activity RPC ──────────────────────
-- Called by /api/usage/activity on every playback event.
-- Writes to user_video_activity, upserts playback_positions,
-- upserts history, and updates user_daily_usage + user_usage_summary.
create or replace function public.record_kilax_usage_activity(
  p_user_id       uuid,
  p_content_type  text,
  p_content_id    text,
  p_event_type    text,
  p_content_title text        default null,
  p_season        integer     default null,
  p_episode       integer     default null,
  p_position_secs integer     default null,
  p_duration_secs integer     default null,
  p_watch_seconds integer     default null,
  p_plan          text        default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now        timestamptz := now();
  v_ws         integer     := coalesce(p_watch_seconds, 0);
  v_completed  boolean     := p_event_type = 'stream_completed';
  v_norm_type  text        := case
                                when p_content_type = 'episode' then 'series'
                                else p_content_type
                              end;
begin
  -- ── a) user_video_activity row ──────────────────────────
  insert into public.user_video_activity(
    user_id, content_type, content_id, content_title,
    season, episode, event_type,
    position_seconds, duration_seconds, watch_seconds,
    plan, created_at
  ) values (
    p_user_id, p_content_type, p_content_id, p_content_title,
    p_season, p_episode, p_event_type,
    p_position_secs, p_duration_secs, p_watch_seconds,
    p_plan, v_now
  );

  -- ── b) playback_positions upsert ─────────────────────────
  insert into public.playback_positions(
    user_id, content_type, content_id,
    season, episode,
    position_sec, duration_sec, completed, updated_at, created_at
  ) values (
    p_user_id, v_norm_type, p_content_id,
    p_season, p_episode,
    coalesce(p_position_secs, 0),
    p_duration_secs,
    v_completed,
    v_now, v_now
  )
  on conflict (user_id, content_type, content_id,
               coalesce(season,-1), coalesce(episode,-1))
  do update set
    position_sec = case
                     when excluded.position_sec > playback_positions.position_sec
                     then excluded.position_sec
                     else playback_positions.position_sec
                   end,
    duration_sec  = coalesce(excluded.duration_sec, playback_positions.duration_sec),
    completed     = greatest(playback_positions.completed, excluded.completed),
    updated_at    = excluded.updated_at;

  -- ── c) history upsert ─────────────────────────────────────
  -- Only insert for meaningful watch events (not card_view)
  if p_event_type in ('stream_started','stream_completed','stream_incomplete','playback_progress') then
    insert into public.history(
      user_id, content_type, content_id, content_title,
      season, episode, watched_at
    ) values (
      p_user_id, v_norm_type, p_content_id, p_content_title,
      p_season, p_episode, v_now
    )
    on conflict (user_id, content_type, content_id)
    do update set
      watched_at    = excluded.watched_at,
      content_title = coalesce(excluded.content_title, history.content_title),
      season        = coalesce(excluded.season,  history.season),
      episode       = coalesce(excluded.episode, history.episode);
  end if;

  -- ── d) user_daily_usage stream stats ─────────────────────
  if p_event_type = 'stream_started' then
    insert into public.user_daily_usage(user_id, usage_date, stream_starts, watch_seconds)
    values (p_user_id, v_now::date, 1, v_ws)
    on conflict (user_id, usage_date) do update set
      stream_starts = stream_starts + 1,
      watch_seconds = watch_seconds + excluded.watch_seconds;

    insert into public.user_usage_summary(
      user_id, total_stream_starts, total_watch_seconds, last_stream_at, updated_at
    ) values (p_user_id, 1, v_ws, v_now, v_now)
    on conflict (user_id) do update set
      total_stream_starts = total_stream_starts + 1,
      total_watch_seconds = total_watch_seconds + excluded.total_watch_seconds,
      last_stream_at      = excluded.last_stream_at,
      updated_at          = excluded.updated_at;
  end if;

end;
$$;

revoke all on function public.record_kilax_usage_activity(uuid,text,text,text,text,integer,integer,integer,integer,integer,text)
  from public, anon, authenticated;
grant execute on function public.record_kilax_usage_activity(uuid,text,text,text,text,integer,integer,integer,integer,integer,text)
  to service_role;

-- Also grant to authenticated so the API route using user context can call it
-- (the API route uses service role so this isn't strictly required, but belt-and-suspenders)
grant execute on function public.record_kilax_usage_activity(uuid,text,text,text,text,integer,integer,integer,integer,integer,text)
  to authenticated;

-- ── 4. Playback progress upsert RPC ─────────────────────────
-- Called by /api/usage/progress to save resume position.
create or replace function public.upsert_playback_position(
  p_user_id       uuid,
  p_content_type  text,
  p_content_id    text,
  p_season        integer     default null,
  p_episode       integer     default null,
  p_position_sec  integer     default 0,
  p_duration_sec  integer     default null,
  p_completed     boolean     default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.playback_positions(
    user_id, content_type, content_id,
    season, episode, position_sec, duration_sec, completed, updated_at, created_at
  ) values (
    p_user_id, p_content_type, p_content_id,
    p_season, p_episode, p_position_sec, p_duration_sec, p_completed, now(), now()
  )
  on conflict (user_id, content_type, content_id,
               coalesce(season,-1), coalesce(episode,-1))
  do update set
    position_sec = greatest(excluded.position_sec, playback_positions.position_sec),
    duration_sec  = coalesce(excluded.duration_sec, playback_positions.duration_sec),
    completed     = greatest(playback_positions.completed, excluded.completed),
    updated_at    = now();
end;
$$;

revoke all on function public.upsert_playback_position(uuid,text,text,integer,integer,integer,integer,boolean)
  from public, anon, authenticated;
grant execute on function public.upsert_playback_position(uuid,text,text,integer,integer,integer,integer,boolean)
  to service_role, authenticated;

-- ── 5. RLS on user_video_activity: let users read their own ─
-- (table already exists from 20260910 migration; just add policy)
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename  = 'user_video_activity'
       and policyname = 'Users view own video activity'
  ) then
    execute $pol$
      create policy "Users view own video activity"
        on public.user_video_activity for select
        using (auth.uid() = user_id)
    $pol$;
  end if;
end;
$$;
