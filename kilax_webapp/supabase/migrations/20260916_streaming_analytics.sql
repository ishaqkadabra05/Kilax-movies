-- Streaming history reporting for the admin usage dashboard.
-- Source of truth: one stream_started event represents one viewing session.

-- The live download_events table predates failure auditing.
alter table public.download_events add column if not exists error_message text;

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

create table if not exists public.download_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null,
  content_id text not null,
  content_title text,
  downloaded_at timestamptz not null default now()
);

create index if not exists download_usage_user_date_idx
  on public.download_usage(user_id, downloaded_at desc);
create index if not exists download_usage_content_idx
  on public.download_usage(user_id, content_type, content_id, downloaded_at desc);

alter table public.download_usage enable row level security;
revoke all on public.download_usage from anon, authenticated;
grant all on public.download_usage to service_role;

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

  -- Keep legacy columns compatible while event_type remains canonical for reporting.
  insert into public.user_video_activity(
    user_id, content_type, content_id, content_title, season, episode,
    event_type, activity_type, position_seconds, duration_seconds,
    watch_seconds, watched_seconds, plan, created_at
  ) values (
    p_user_id, p_content_type, p_content_id, p_content_title, p_season, p_episode,
    p_event_type,
    case p_event_type
      when 'stream_started' then 'stream_start'
      when 'stream_completed' then 'stream_complete'
      else 'view'
    end,
    p_position_secs, p_duration_secs,
    coalesce(p_watch_seconds, 0), coalesce(p_watch_seconds, 0), p_plan, now()
  );

  if p_event_type in ('stream_started', 'playback_progress', 'stream_completed', 'stream_incomplete') then
    insert into public.playback_positions(
      user_id, content_type, content_id, content_title, season, episode,
      position_seconds, duration_seconds, completed, updated_at
    ) values (
      p_user_id, p_content_type, p_content_id, p_content_title,
      coalesce(p_season, 0), coalesce(p_episode, 0),
      greatest(coalesce(p_position_secs, 0), 0), p_duration_secs,
      p_event_type = 'stream_completed', now()
    )
    on conflict (user_id, content_type, content_id, season, episode)
    do update set
      content_title = coalesce(excluded.content_title, playback_positions.content_title),
      position_seconds = greatest(excluded.position_seconds, playback_positions.position_seconds),
      duration_seconds = coalesce(excluded.duration_seconds, playback_positions.duration_seconds),
      completed = playback_positions.completed or excluded.completed,
      updated_at = excluded.updated_at;
  end if;

  if p_event_type in ('stream_started', 'playback_progress') then
    insert into public.user_daily_usage(user_id, usage_date, stream_starts, watch_seconds)
    values (p_user_id, current_date, case when p_event_type = 'stream_started' then 1 else 0 end, coalesce(p_watch_seconds, 0))
    on conflict (user_id, usage_date) do update set
      stream_starts = user_daily_usage.stream_starts + excluded.stream_starts,
      watch_seconds = user_daily_usage.watch_seconds + excluded.watch_seconds;
  end if;
end;
$$;

revoke all on function public.record_kilax_usage_activity(uuid, text, text, text, text, integer, integer, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.record_kilax_usage_activity(uuid, text, text, text, text, integer, integer, integer, integer, integer, text) to service_role;

create or replace view public.admin_user_usage_view
with (security_invoker = false)
as
select
  user_id,
  max(created_at) filter (where event_type in ('stream_started', 'stream_completed', 'stream_incomplete', 'playback_progress')) as last_active_at,
  count(*) filter (where event_type = 'stream_started')::bigint as stream_starts,
  count(*) filter (where event_type = 'stream_completed')::bigint as completed_streams,
  count(*) filter (where event_type = 'stream_incomplete')::bigint as incomplete_streams,
  count(distinct content_id) filter (where event_type = 'stream_started' and content_type = 'movie')::bigint as movies_watched,
  count(distinct content_id) filter (where event_type = 'stream_started' and content_type in ('series', 'episode'))::bigint as series_watched,
  count(*) filter (where event_type = 'stream_started' and content_type = 'movie')::bigint as movie_streams,
  count(*) filter (where event_type = 'stream_started' and content_type in ('series', 'episode'))::bigint as series_streams,
  sum(coalesce(watch_seconds, 0))::bigint as watch_seconds
from public.user_video_activity
where event_type in ('stream_started', 'stream_completed', 'stream_incomplete', 'playback_progress')
group by user_id;

revoke all on public.admin_user_usage_view from anon, authenticated;
grant select on public.admin_user_usage_view to service_role;

create or replace view public.admin_usage_metrics_view
with (security_invoker = false)
as
select
  count(*) filter (where last_active_at >= now() - interval '24 hours')::bigint as active_users_24h,
  count(*) filter (where last_active_at >= now() - interval '30 days')::bigint as active_users_30d,
  coalesce(sum(movie_streams), 0)::bigint as movie_streams,
  coalesce(sum(series_streams), 0)::bigint as series_streams,
  count(*) filter (where movies_watched > 0)::bigint as movie_viewers,
  count(*) filter (where series_watched > 0)::bigint as series_viewers,
  coalesce(sum(movie_streams) + sum(series_streams), 0)::bigint as total_views,
  count(*) filter (where stream_starts > 0)::bigint as total_viewers
from public.admin_user_usage_view;

drop view if exists public.admin_streaming_content_view;
create view public.admin_streaming_content_view
with (security_invoker = false)
as
select
  case when content_type = 'episode' then 'series' else content_type end as content_type,
  content_id,
  max(content_title) as content_title,
  count(*)::bigint as view_count,
  count(distinct user_id)::bigint as unique_viewers,
  max(created_at) as last_viewed_at
from public.user_video_activity
where event_type = 'stream_started'
group by case when content_type = 'episode' then 'series' else content_type end, content_id;

drop view if exists public.admin_streaming_daily_view;
create view public.admin_streaming_daily_view
with (security_invoker = false)
as
select
  created_at::date as usage_date,
  count(*)::bigint as view_count,
  count(distinct user_id)::bigint as unique_viewers
from public.user_video_activity
where event_type = 'stream_started'
  and created_at >= current_date - interval '29 days'
group by created_at::date
order by usage_date;

revoke all on public.admin_streaming_content_view, public.admin_streaming_daily_view from anon, authenticated;
grant select on public.admin_streaming_content_view, public.admin_streaming_daily_view to service_role;

-- Repair the legacy download RPC so its daily upsert is unambiguous in PL/pgSQL.
create or replace function public.record_kilax_download(
  p_user_id uuid,
  p_content_type text,
  p_content_id text,
  p_content_title text default null,
  p_season integer default null,
  p_episode integer default null,
  p_filename text default null,
  p_download_url text default null,
  p_plan text default null,
  p_expires_at timestamptz default null
)
returns table(allowed boolean, reason text, movie_used integer, series_used integer, movie_remaining integer, series_remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_cutoff timestamptz := v_now - interval '24 hours';
  v_movie_used integer;
  v_series_used integer;
  v_already_exists boolean;
  v_next_reset timestamptz;
  v_norm_type text := case when p_content_type = 'episode' then 'series' else p_content_type end;
  v_movie_inc integer;
  v_series_inc integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 781233));

  select exists(
    select 1 from public.download_usage
    where user_id = p_user_id and content_type = v_norm_type
      and content_id = p_content_id and downloaded_at >= v_cutoff
  ) into v_already_exists;

  select count(*) into v_movie_used from (
    select distinct content_id from public.download_usage
    where user_id = p_user_id and content_type = 'movie' and downloaded_at >= v_cutoff
  ) q;
  select count(*) into v_series_used from (
    select distinct content_id from public.download_usage
    where user_id = p_user_id and content_type = 'series' and downloaded_at >= v_cutoff
  ) q;

  if not v_already_exists and v_norm_type = 'movie' and v_movie_used >= 5 then
    select min(downloaded_at + interval '24 hours') into v_next_reset from public.download_usage
    where user_id = p_user_id and content_type = 'movie' and downloaded_at >= v_cutoff;
    insert into public.download_events(user_id, content_type, content_id, content_title, season, episode, plan, status, error_message, created_at)
    values (p_user_id, p_content_type, p_content_id, p_content_title, p_season, p_episode, p_plan, 'limit_reached', 'movie_limit', v_now);
    return query select false, 'movie_limit'::text, v_movie_used, v_series_used, 0, greatest(0, 1 - v_series_used), v_next_reset;
    return;
  end if;

  if not v_already_exists and v_norm_type = 'series' and v_series_used >= 1 then
    select min(downloaded_at + interval '24 hours') into v_next_reset from public.download_usage
    where user_id = p_user_id and content_type = 'series' and downloaded_at >= v_cutoff;
    insert into public.download_events(user_id, content_type, content_id, content_title, season, episode, plan, status, error_message, created_at)
    values (p_user_id, p_content_type, p_content_id, p_content_title, p_season, p_episode, p_plan, 'limit_reached', 'series_limit', v_now);
    return query select false, 'series_limit'::text, v_movie_used, v_series_used, greatest(0, 5 - v_movie_used), 0, v_next_reset;
    return;
  end if;

  if not v_already_exists then
    insert into public.download_usage(user_id, content_type, content_id, content_title, downloaded_at)
    values (p_user_id, v_norm_type, p_content_id, p_content_title, v_now);
    v_movie_used := v_movie_used + case when v_norm_type = 'movie' then 1 else 0 end;
    v_series_used := v_series_used + case when v_norm_type = 'series' then 1 else 0 end;
  end if;

  v_movie_inc := case when v_norm_type = 'movie' then 1 else 0 end;
  v_series_inc := case when v_norm_type = 'series' then 1 else 0 end;

  insert into public.download_events(user_id, content_type, content_id, content_title, season, episode, filename, download_url, plan, status, expires_at, created_at)
  values (p_user_id, p_content_type, p_content_id, p_content_title, p_season, p_episode, p_filename, p_download_url, p_plan, 'success', p_expires_at, v_now);

  insert into public.user_daily_usage as daily_usage(user_id, usage_date, movie_downloads, series_downloads)
  values (p_user_id, v_now::date, v_movie_inc, v_series_inc)
  on conflict (user_id, usage_date) do update set
    movie_downloads = daily_usage.movie_downloads + excluded.movie_downloads,
    series_downloads = daily_usage.series_downloads + excluded.series_downloads;

  insert into public.user_usage_summary(user_id, total_downloads, total_movie_downloads, total_series_downloads, last_download_at, updated_at)
  values (p_user_id, 1, v_movie_inc, v_series_inc, v_now, v_now)
  on conflict (user_id) do update set
    total_downloads = user_usage_summary.total_downloads + 1,
    total_movie_downloads = user_usage_summary.total_movie_downloads + excluded.total_movie_downloads,
    total_series_downloads = user_usage_summary.total_series_downloads + excluded.total_series_downloads,
    last_download_at = excluded.last_download_at,
    updated_at = excluded.updated_at;

  return query select true, case when v_already_exists then 'already_counted' else 'counted' end::text,
    v_movie_used, v_series_used, greatest(0, 5 - v_movie_used), greatest(0, 1 - v_series_used), v_now + interval '24 hours';
end;
$$;