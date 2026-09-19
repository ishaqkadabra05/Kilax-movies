-- ============================================================
-- security_events — honeypot + intrusion detection log
-- Run in Supabase SQL Editor for project maijanpfppqteqzlreey
-- ============================================================

create table if not exists public.security_events (
  id                uuid        primary key default gen_random_uuid(),
  event_type        text        not null,   -- 'honeypot_hit', 'blocked_ua', 'scanner_path', etc.
  method            text,                   -- HTTP method
  path              text,                   -- requested path + query
  ip_address        text,
  user_agent        text,
  referer           text,
  origin            text,
  host              text,
  body_preview      text,                   -- first 500 chars of POST body
  headers_snapshot  jsonb,                  -- key headers at time of hit
  notes             text,                   -- optional admin notes
  reviewed          boolean     not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists security_events_created_idx
  on public.security_events(created_at desc);

create index if not exists security_events_ip_idx
  on public.security_events(ip_address, created_at desc);

create index if not exists security_events_type_idx
  on public.security_events(event_type, created_at desc);

-- Only service_role (server-side API routes) can write/read
alter table public.security_events enable row level security;
revoke all on table public.security_events from anon, authenticated;
grant  all on table public.security_events to   service_role;

-- ── Convenience view: unreviewed hits in the last 7 days ──────
create or replace view public.security_events_recent as
  select
    id,
    event_type,
    method,
    path,
    ip_address,
    user_agent,
    created_at
  from public.security_events
  where reviewed  = false
    and created_at >= now() - interval '7 days'
  order by created_at desc;
