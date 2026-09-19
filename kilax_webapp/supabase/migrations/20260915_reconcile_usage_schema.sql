-- Reconcile playback columns created by the older 20260912 migration.
-- Run after 20260914_analytics_and_resume.sql so this corrected RPC remains active.

create table if not exists public.user_usage_summary (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_downloads integer not null default 0,
  total_movie_downloads integer not null default 0,
  total_series_downloads integer not null default 0,
  total_stream_starts integer not null default 0,
  total_watch_seconds bigint not null default 0,
  last_download_at timestamptz,
  last_stream_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_usage_summary enable row level security;
revoke all on public.user_usage_summary from anon, authenticated;
grant all on public.user_usage_summary to service_role;

alter table if exists public.playback_positions
  add column if not exists position_seconds integer;
alter table if exists public.playback_positions
  add column if not exists duration_seconds integer;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'playback_positions' and column_name = 'position_sec'
  ) then
    execute 'update public.playback_positions
             set position_seconds = coalesce(position_seconds, position_sec, 0),
                 duration_seconds = coalesce(duration_seconds, duration_sec)
             where position_seconds is null';
  else
    update public.playback_positions
    set position_seconds = coalesce(position_seconds, 0)
    where position_seconds is null;
  end if;
end;
$$;

create or replace function public.record_kilax_usage_activity(
  p_user_id uuid,
  p_content_type text,
  p_content_id text,
  p_event_type text,
  p_content_title text default null,
  p_season integer default null,
  p_episode integer default null,
  p_position_secs integer default null,
  p_duration_secs integer default null,
  p_watch_seconds integer default null,
  p_plan text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_type not in ('card_view', 'stream_started', 'stream_completed', 'stream_incomplete', 'playback_progress') then
    raise exception 'Unsupported usage event type: %', p_event_type using errcode = '22023';
  end if;

  insert into public.user_video_activity(
    user_id, content_type, content_id, content_title,
    season, episode, event_type, position_seconds, duration_seconds,
    watch_seconds, plan, created_at
  ) values (
    p_user_id, p_content_type, p_content_id, p_content_title,
    p_season, p_episode, p_event_type, p_position_secs, p_duration_secs,
    p_watch_seconds, p_plan, now()
  );

  if p_event_type in ('stream_started', 'playback_progress', 'stream_completed', 'stream_incomplete') then
    delete from public.playback_positions
    where user_id = p_user_id
      and content_type = p_content_type
      and content_id = p_content_id
      and coalesce(season, 0) = coalesce(p_season, 0)
      and coalesce(episode, 0) = coalesce(p_episode, 0);

    insert into public.playback_positions(
      user_id, content_type, content_id, content_title, season, episode,
      position_seconds, duration_seconds, completed, updated_at
    ) values (
      p_user_id, p_content_type, p_content_id, p_content_title,
      coalesce(p_season, 0), coalesce(p_episode, 0),
      greatest(coalesce(p_position_secs, 0), 0), p_duration_secs,
      p_event_type = 'stream_completed', now()
    );
  end if;
end;
$$;

revoke all on function public.record_kilax_usage_activity(uuid, text, text, text, text, integer, integer, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.record_kilax_usage_activity(uuid, text, text, text, text, integer, integer, integer, integer, integer, text) to service_role;