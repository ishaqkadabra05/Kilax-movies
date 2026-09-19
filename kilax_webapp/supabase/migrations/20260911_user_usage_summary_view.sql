-- Usage reporting view for project maijanpfppqteqzlreey.
-- Source events are kept in the existing activity tables so this view stays live.

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
  if p_event_type not in ('card_view', 'stream_started', 'stream_completed', 'stream_incomplete') then
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
end;
$$;

revoke all on function public.record_kilax_usage_activity(
  uuid, text, text, text, text, integer, integer, integer, integer, integer, text
) from public, anon, authenticated;
grant execute on function public.record_kilax_usage_activity(
  uuid, text, text, text, text, integer, integer, integer, integer, integer, text
) to service_role;

drop view if exists public.user_usage_summary_view;

create view public.user_usage_summary_view
with (security_invoker = false)
as
select
  u.id as user_id,
  coalesce(card_views.total_movie_card_views, 0)::bigint as total_movie_card_views,
  coalesce(card_views.total_card_views, 0)::bigint as total_card_views,
  coalesce(streams.total_streams, 0)::bigint as total_streams,
  coalesce(streams.completed_streams, 0)::bigint as completed_streams,
  coalesce(streams.incomplete_streams, 0)::bigint as incomplete_streams,
  coalesce(downloads.total_downloads, 0)::bigint as total_downloads,
  greatest(
    coalesce(streams.last_stream_at, '-infinity'::timestamptz),
    coalesce(downloads.last_download_at, '-infinity'::timestamptz),
    coalesce(card_views.last_card_view_at, '-infinity'::timestamptz)
  ) as last_activity_at
from auth.users u
left join (
  select
    user_id,
    count(*) filter (where event_type = 'card_view' and content_type = 'movie') as total_movie_card_views,
    count(*) filter (where event_type = 'card_view') as total_card_views,
    max(created_at) filter (where event_type = 'card_view') as last_card_view_at
  from public.user_video_activity
  group by user_id
) card_views on card_views.user_id = u.id
left join (
  select
    user_id,
    count(*) filter (where event_type in ('stream_completed', 'stream_incomplete')) as total_streams,
    count(*) filter (where event_type = 'stream_completed') as completed_streams,
    count(*) filter (where event_type = 'stream_incomplete') as incomplete_streams,
    max(created_at) filter (where event_type in ('stream_started', 'stream_completed', 'stream_incomplete')) as last_stream_at
  from public.user_video_activity
  group by user_id
) streams on streams.user_id = u.id
left join (
  select
    user_id,
    count(*) filter (where status = 'success') as total_downloads,
    max(created_at) filter (where status = 'success') as last_download_at
  from public.download_events
  group by user_id
) downloads on downloads.user_id = u.id;

comment on view public.user_usage_summary_view is
  'Per-user movie card views, completed/incomplete streams, and successful downloads.';

revoke all on public.user_usage_summary_view from anon, authenticated;
grant select on public.user_usage_summary_view to service_role;
