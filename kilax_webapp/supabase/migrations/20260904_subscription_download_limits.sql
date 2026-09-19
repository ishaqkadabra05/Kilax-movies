alter table if exists public.makypay_transactions add column if not exists subscription_activated_at timestamptz;
alter table if exists public.subscriptions add column if not exists transaction_uuid text;

create table if not exists public.download_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('movie','series')),
  content_id text not null,
  content_title text,
  downloaded_at timestamptz not null default now()
);
create index if not exists download_usage_user_time_idx on public.download_usage(user_id, downloaded_at desc);
create index if not exists download_usage_user_content_idx on public.download_usage(user_id, content_type, content_id, downloaded_at desc);
alter table public.download_usage enable row level security;
revoke all on table public.download_usage from anon, authenticated;

create or replace function public.record_kilax_download(
  p_user_id uuid,
  p_content_type text,
  p_content_id text,
  p_content_title text default null
)
returns table(allowed boolean, reason text, movie_used integer, series_used integer, movie_remaining integer, series_remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  cutoff timestamptz := now_ts - interval '24 hours';
  movie_used_count integer;
  series_used_count integer;
  already_exists boolean;
  next_movie_reset timestamptz;
  next_series_reset timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 781233));

  select exists(
    select 1 from public.download_usage
    where user_id=p_user_id and content_type=p_content_type and content_id=p_content_id and downloaded_at >= cutoff
  ) into already_exists;

  select count(*) into movie_used_count from (
    select distinct content_id from public.download_usage
    where user_id=p_user_id and content_type='movie' and downloaded_at >= cutoff
  ) q;
  select count(*) into series_used_count from (
    select distinct content_id from public.download_usage
    where user_id=p_user_id and content_type='series' and downloaded_at >= cutoff
  ) q;

  if already_exists then
    return query select true, 'already_counted', movie_used_count, series_used_count,
      greatest(0,5-movie_used_count), greatest(0,1-series_used_count),
      least(coalesce((select min(downloaded_at + interval '24 hours') from public.download_usage where user_id=p_user_id and downloaded_at >= cutoff and content_type=p_content_type), now_ts + interval '24 hours'), now_ts + interval '24 hours');
    return;
  end if;

  if p_content_type='movie' and movie_used_count >= 5 then
    select min(downloaded_at + interval '24 hours') into next_movie_reset from public.download_usage where user_id=p_user_id and content_type='movie' and downloaded_at >= cutoff;
    return query select false, 'movie_limit', movie_used_count, series_used_count, 0, greatest(0,1-series_used_count), next_movie_reset;
    return;
  end if;
  if p_content_type='series' and series_used_count >= 1 then
    select min(downloaded_at + interval '24 hours') into next_series_reset from public.download_usage where user_id=p_user_id and content_type='series' and downloaded_at >= cutoff;
    return query select false, 'series_limit', movie_used_count, series_used_count, greatest(0,5-movie_used_count), 0, next_series_reset;
    return;
  end if;

  insert into public.download_usage(user_id, content_type, content_id, content_title, downloaded_at)
  values(p_user_id,p_content_type,p_content_id,p_content_title,now_ts);

  movie_used_count := movie_used_count + case when p_content_type='movie' then 1 else 0 end;
  series_used_count := series_used_count + case when p_content_type='series' then 1 else 0 end;
  return query select true, 'counted', movie_used_count, series_used_count,
    greatest(0,5-movie_used_count), greatest(0,1-series_used_count), now_ts + interval '24 hours';
end;
$$;

create or replace function public.get_kilax_download_status(p_user_id uuid)
returns table(movie_used integer, series_used integer, movie_remaining integer, series_remaining integer, movie_reset_at timestamptz, series_reset_at timestamptz)
language sql
security definer
set search_path = public
as $$
  with m as (
    select count(*) used, min(first_seen + interval '24 hours') reset_at from (
      select content_id, min(downloaded_at) first_seen from public.download_usage
      where user_id=p_user_id and content_type='movie' and downloaded_at >= now()-interval '24 hours'
      group by content_id
    ) q
  ), s as (
    select count(*) used, min(first_seen + interval '24 hours') reset_at from (
      select content_id, min(downloaded_at) first_seen from public.download_usage
      where user_id=p_user_id and content_type='series' and downloaded_at >= now()-interval '24 hours'
      group by content_id
    ) q
  )
  select m.used::integer, s.used::integer, greatest(0,5-m.used)::integer, greatest(0,1-s.used)::integer, m.reset_at, s.reset_at from m,s;
$$;

revoke all on function public.record_kilax_download(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.get_kilax_download_status(uuid) from public, anon, authenticated;
grant execute on function public.record_kilax_download(uuid,text,text,text) to service_role;
grant execute on function public.get_kilax_download_status(uuid) to service_role;
