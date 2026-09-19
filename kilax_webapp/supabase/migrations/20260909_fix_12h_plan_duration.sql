-- Fix: plans whose name contains "12" and "hour" (case-insensitive) should have
-- duration_in_days = 0.5 (half a day = 12 hours).
-- The subscriptions code now multiplies duration_in_days * 86400000ms, so 0.5
-- correctly produces a 43 200 000ms (12-hour) expiry window.
--
-- We also add a duration_in_hours column so the UI can display "12 hours" instead
-- of "0.5 days" without any floating-point rendering issues.

-- 1. Add duration_in_hours if it doesn't exist
alter table public.plans
  add column if not exists duration_in_hours numeric default null;

-- 2. Update any plan whose name signals 12 hours
update public.plans
set
  duration_in_days  = 0.5,
  duration_in_hours = 12
where lower(name) like '%12%hour%'
   or lower(name) like '%12h%'
   or lower(name) like '%half%day%';

-- 3. Backfill duration_in_hours for existing day-based plans that don't have it set
update public.plans
set duration_in_hours = duration_in_days * 24
where duration_in_hours is null
  and duration_in_days is not null;
