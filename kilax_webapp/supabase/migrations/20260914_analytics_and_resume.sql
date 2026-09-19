-- Analytics and resume support for project maijanpfppqteqzlreey.
-- Keeps the existing activity/download tables because the app's allowance and
-- download RPCs depend on them. Adds one event ledger and one resume table.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('search', 'reelplexi_request')),
  query_text text,
  endpoint text,
  method text,
  content_type text,
  content_id text,
  status_code integer,
  response_time_ms integer,
  result_count integer,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_type_created_idx
  on public.analytics_events(event_type, created_at desc);
create index if not exists analytics_events_user_created_idx
  on public.analytics_events(user_id, created_at desc);
create index if not exists analytics_events_endpoint_created_idx
  on public.analytics_events(endpoint, created_at desc);

create table if not exists public.playback_positions (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null,
  content_id text not null,
  content_title text,
  season integer,
  episode integer,
  position_seconds integer not null default 0,
  duration_seconds integer,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, content_type, content_id, season, episode)
);

create index if not exists playback_positions_updated_idx
  on public.playback_positions(updated_at desc);
create index if not exists playback_positions_content_idx
  on public.playback_positions(content_type, content_id);

alter table public.analytics_events enable row level security;
alter table public.playback_positions enable row level security;
revoke all on public.analytics_events from anon, authenticated;
revoke all on public.playback_positions from anon, authenticated;
grant all on public.analytics_events to service_role;
grant all on public.playback_positions to service_role;

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
    insert into public.playback_positions(
      user_id, content_type, content_id, content_title, season, episode,
      position_seconds, duration_seconds, completed, updated_at
    ) values (
      p_user_id, p_content_type, p_content_id, p_content_title, coalesce(p_season, 0), coalesce(p_episode, 0),
      greatest(coalesce(p_position_secs, 0), 0), p_duration_secs,
      p_event_type = 'stream_completed', now()
    )
    on conflict (user_id, content_type, content_id, season, episode)
    do update set
      content_title = coalesce(excluded.content_title, playback_positions.content_title),
      position_seconds = greatest(excluded.position_seconds, 0),
      duration_seconds = coalesce(excluded.duration_seconds, playback_positions.duration_seconds),
      completed = excluded.completed,
      updated_at = excluded.updated_at;
  end if;
  
    if p_event_type in ('stream_started', 'playback_progress') then
      insert into public.user_daily_usage(user_id, usage_date, stream_starts, watch_seconds)
      values (p_user_id, current_date, case when p_event_type = 'stream_started' then 1 else 0 end, coalesce(p_watch_seconds, 0))
      on conflict (user_id, usage_date) do update set
        stream_starts = user_daily_usage.stream_starts + excluded.stream_starts,
        watch_seconds = user_daily_usage.watch_seconds + excluded.watch_seconds;

      insert into public.user_usage_summary(user_id, total_stream_starts, total_watch_seconds, last_stream_at, updated_at)
      values (p_user_id, case when p_event_type = 'stream_started' then 1 else 0 end, coalesce(p_watch_seconds, 0), now(), now())
      on conflict (user_id) do update set
        total_stream_starts = user_usage_summary.total_stream_starts + excluded.total_stream_starts,
        total_watch_seconds = user_usage_summary.total_watch_seconds + excluded.total_watch_seconds,
        last_stream_at = excluded.last_stream_at,
        updated_at = excluded.updated_at;
    end if;
end;
$$;

revoke all on function public.record_kilax_usage_activity(uuid, text, text, text, text, integer, integer, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.record_kilax_usage_activity(uuid, text, text, text, text, integer, integer, integer, integer, integer, text) to service_role;

create or replace function public.record_kilax_analytics_event(
  p_user_id uuid,
  p_event_type text,
  p_query_text text default null,
  p_endpoint text default null,
  p_method text default null,
  p_content_type text default null,
  p_content_id text default null,
  p_status_code integer default null,
  p_response_time_ms integer default null,
  p_result_count integer default null,
  p_ip_address text default null,
  p_user_agent text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_type not in ('search', 'reelplexi_request') then
    raise exception 'Unsupported analytics event type: %', p_event_type using errcode = '22023';
  end if;
  insert into public.analytics_events(
    user_id, event_type, query_text, endpoint, method, content_type, content_id,
    status_code, response_time_ms, result_count, ip_address, user_agent, metadata
  ) values (
    p_user_id, p_event_type, p_query_text, p_endpoint, p_method, p_content_type, p_content_id,
    p_status_code, p_response_time_ms, p_result_count, p_ip_address, p_user_agent, coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.record_kilax_analytics_event(uuid, text, text, text, text, text, text, integer, integer, integer, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_kilax_analytics_event(uuid, text, text, text, text, text, text, integer, integer, integer, text, text, jsonb) to service_role;

create or replace view public.admin_usage_summary_view
with (security_invoker = false)
as
select
  coalesce((select count(*) from public.user_video_activity where event_type = 'stream_started'), 0)::bigint as total_stream_starts,
  coalesce((select count(*) from public.user_video_activity where event_type = 'stream_started' and content_type = 'movie'), 0)::bigint as total_movie_streams,
  coalesce((select count(*) from public.user_video_activity where event_type = 'stream_started' and content_type = 'series'), 0)::bigint as total_series_streams,
  coalesce((select count(*) from public.user_video_activity where event_type = 'stream_completed'), 0)::bigint as total_completed_streams,
  coalesce((select count(*) from public.user_video_activity where event_type = 'stream_incomplete'), 0)::bigint as total_incomplete_streams,
  coalesce((select sum(coalesce(watch_seconds, 0)) from public.user_video_activity), 0)::bigint as total_watch_seconds,
  coalesce((select count(*) from public.download_events where status = 'success'), 0)::bigint as total_downloads,
  coalesce((select count(*) from public.analytics_events where event_type = 'search'), 0)::bigint as total_searches,
  coalesce((select count(*) from public.analytics_events where event_type = 'reelplexi_request'), 0)::bigint as total_reelplexi_requests;

create or replace view public.admin_daily_usage_view
with (security_invoker = false)
as
select
  calendar.day::date as usage_date,
  coalesce(streams.total_views, 0)::bigint as views,
  coalesce(streams.watch_seconds, 0)::bigint as watch_seconds,
  coalesce(downloads.total_downloads, 0)::bigint as downloads,
  coalesce(searches.total_searches, 0)::bigint as searches,
  coalesce(requests.total_requests, 0)::bigint as reelplexi_requests
from generate_series(current_date - 29, current_date, interval '1 day') as calendar(day)
left join (
  select created_at::date as day, count(*) filter (where event_type = 'stream_started') as total_views, sum(coalesce(watch_seconds, 0)) as watch_seconds
  from public.user_video_activity group by created_at::date
) streams on streams.day = calendar.day::date
left join (
  select created_at::date as day, count(*) as total_downloads
  from public.download_events where status = 'success' group by created_at::date
) downloads on downloads.day = calendar.day::date
left join (
  select created_at::date as day, count(*) as total_searches
  from public.analytics_events where event_type = 'search' group by created_at::date
) searches on searches.day = calendar.day::date
left join (
  select created_at::date as day, count(*) as total_requests
  from public.analytics_events where event_type = 'reelplexi_request' group by created_at::date
) requests on requests.day = calendar.day::date
order by usage_date;

create or replace view public.admin_top_content_view
with (security_invoker = false)
as
select content_type, content_id, max(content_title) as content_title,
       count(*) filter (where event_type = 'stream_started')::bigint as views,
       sum(coalesce(watch_seconds, 0))::bigint as watch_seconds
from public.user_video_activity
group by content_type, content_id
order by views desc;

revoke all on public.admin_usage_summary_view, public.admin_daily_usage_view, public.admin_top_content_view from anon, authenticated;
grant select on public.admin_usage_summary_view, public.admin_daily_usage_view, public.admin_top_content_view to service_role;
