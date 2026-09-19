-- Entitlement rules for free users, the Kilax Starter package, and new-user trials.

alter table public.profiles add column if not exists trial_started_at timestamptz;
alter table public.profiles add column if not exists trial_expires_at timestamptz;
alter table public.profiles add column if not exists trial_status text not null default 'none';

insert into public.plans (
  name, tier, tier_label, description, duration, duration_in_days, duration_in_hours,
  amount, currency, stream_limit, download_limit, limit_window_hours,
  active, recommended, sort_order
)
select
  'Kilax Starter', 'basic', 'Kilax Starter',
  '4 hours of access with 2 streams.', '4 Hours', 1, 4,
  500, 'UGX', 2, 0, 4,
  true, false, coalesce((select max(sort_order) from public.plans), 0) + 1
where not exists (select 1 from public.plans where lower(name) = lower('Kilax Starter'));

update public.plans
set amount = 500, duration = '4 Hours', duration_in_days = 1, duration_in_hours = 4,
    stream_limit = 2, download_limit = 0, limit_window_hours = 4,
    tier = 'basic', tier_label = 'Kilax Starter', active = true
where lower(name) = lower('Kilax Starter');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_trial_expires timestamptz := v_now + interval '2 days';
  v_notification_id uuid;
begin
  insert into public.profiles (
    id, email, full_name, avatar_url, phone, created_at, updated_at,
    subscription, trial_started_at, trial_expires_at, trial_status
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'phone', new.phone),
    v_now, v_now, 'trial', v_now, v_trial_expires, 'active'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(profiles.full_name, excluded.full_name),
    avatar_url = coalesce(profiles.avatar_url, excluded.avatar_url),
    phone = coalesce(profiles.phone, excluded.phone),
    updated_at = v_now;

  begin
    insert into public.subscriptions (
      user_id, plan_id, subscription_type, status, start_date, expiry_date, payment_method, created_at, updated_at
    ) values (
      new.id, null, 'trial', 'active', v_now, v_trial_expires, 'trial', v_now, v_now
    );
  exception when others then
    null;
  end;

  begin
    insert into public.notifications (title, body, icon, url, data, created_at)
    values (
      'Your 2-day trial is active',
      'You can watch up to 3 streams during your trial. Subscribe to Premium after the trial for continued access.',
      'play', '/subscribe', jsonb_build_object('type', 'trial_activated', 'expires_at', v_trial_expires), v_now
    ) returning id into v_notification_id;
    insert into public.notification_recipients (notification_id, user_id) values (v_notification_id, new.id);
  exception when others then
    null;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.activate_paid_subscription(
  p_user_id uuid,
  p_plan text,
  p_started_at timestamptz,
  p_expires_at timestamptz
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set subscription = p_plan,
      subscription_start_date = p_started_at,
      subscription_expiry_date = p_expires_at,
      trial_status = 'converted',
      trial_expires_at = null,
      updated_at = now()
  where id = p_user_id;
$$;

revoke all on function public.activate_paid_subscription(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.activate_paid_subscription(uuid, text, timestamptz, timestamptz) to service_role;