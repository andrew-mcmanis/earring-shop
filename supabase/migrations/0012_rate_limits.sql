-- 0012_rate_limits.sql
-- Durable, per-key request throttling for the checkout (createOrderAndIntent),
-- so abuse can't spam order rows + Stripe PaymentIntents. Counters live in the
-- DB so the limit holds across serverless instances and cold starts.
--
-- Safe to apply before/after the app deploy: the app calls check_rate_limit()
-- fail-open (a missing function just errors and the checkout continues), so the
-- throttle simply becomes active once this migration is run.

create table if not exists rate_limits (
  key          text primary key,          -- e.g. 'checkout:<ip>'
  count        int not null default 0,    -- hits in the current window
  window_start timestamptz not null default now()
);

-- Locked down: no policies + no anon/authenticated grants. Touched only by the
-- service role, and only through check_rate_limit() (SECURITY DEFINER) below.
alter table rate_limits enable row level security;

-- Atomic fixed-window limiter. Increments the key's counter (resetting it when
-- the window has rolled over) and returns TRUE when the request is ALLOWED
-- (count within the window <= p_limit), FALSE when it should be blocked.
create or replace function check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set
      count = case
        when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1
        else rate_limits.count + 1
      end,
      window_start = case
        when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now()
        else rate_limits.window_start
      end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

grant all on rate_limits to service_role;
grant execute on function check_rate_limit(text, int, int) to service_role;
