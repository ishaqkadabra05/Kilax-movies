-- User-level usage reporting for the admin API.
-- Run after the activity tables and record_kilax_usage_activity migrations.

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

create or replace view public.admin_usage_metrics_view
with (security_invoker = false)
as
select
  count(*) filter (where last_active_at >= now() - interval '24 hours')::bigint as active_users_24h,
  count(*) filter (where last_active_at >= now() - interval '30 days')::bigint as active_users_30d,
  coalesce(sum(movie_streams), 0)::bigint as movie_streams,
  coalesce(sum(series_streams), 0)::bigint as series_streams,
  count(*) filter (where movies_watched > 0)::bigint as movie_viewers,
  count(*) filter (where series_watched > 0)::bigint as series_viewers
from public.admin_user_usage_view;

revoke all on public.admin_user_usage_view, public.admin_usage_metrics_view from anon, authenticated;
grant select on public.admin_user_usage_view, public.admin_usage_metrics_view to service_role;

create or replace view public.admin_usage_summary_view
with (security_invoker = false)
as
select
  coalesce((select count(*) from public.user_video_activity where event_type = 'stream_started'), 0)::bigint as total_stream_starts,
  coalesce((select count(*) from public.user_video_activity where event_type = 'stream_started' and content_type = 'movie'), 0)::bigint as total_movie_streams,
  coalesce((select count(*) from public.user_video_activity where event_type = 'stream_started' and content_type in ('series', 'episode')), 0)::bigint as total_series_streams,
  coalesce((select count(*) from public.user_video_activity where event_type = 'stream_completed'), 0)::bigint as total_completed_streams,
  coalesce((select count(*) from public.user_video_activity where event_type = 'stream_incomplete'), 0)::bigint as total_incomplete_streams,
  coalesce((select sum(coalesce(watch_seconds, 0)) from public.user_video_activity), 0)::bigint as total_watch_seconds,
  coalesce((select count(*) from public.download_events where status = 'success'), 0)::bigint as total_downloads,
  coalesce((select count(*) from public.analytics_events where event_type = 'search'), 0)::bigint as total_searches,
  coalesce((select count(*) from public.analytics_events where event_type = 'reelplexi_request'), 0)::bigint as total_reelplexi_requests;

revoke all on public.admin_usage_summary_view from anon, authenticated;
grant select on public.admin_usage_summary_view to service_role;