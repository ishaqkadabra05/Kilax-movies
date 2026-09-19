create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  icon text,
  url text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_recipients (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  primary key (notification_id, user_id)
);

create index if not exists notification_recipients_user_idx
  on public.notification_recipients(user_id, read_at, notification_id);
create index if not exists notifications_created_idx
  on public.notifications(created_at desc);

alter table public.notifications enable row level security;
alter table public.notification_recipients enable row level security;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.notification_recipients from anon, authenticated;
