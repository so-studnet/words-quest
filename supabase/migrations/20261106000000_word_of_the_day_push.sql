-- Words Quest: Word of the Day push notifications.
--
-- push_subscriptions : one row per device; the signed-in owner adds and removes it (RLS)
-- push_deliveries    : which device got which day's word; server-only, prevents double sends
-- claim_word_of_the_day_push(now) : returns devices due now and marks them as sent (server-only)

create table public.push_subscriptions (
  endpoint     text primary key check (char_length(endpoint) between 1 and 2048),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh       text not null check (char_length(p256dh) between 1 and 200),
  auth         text not null check (char_length(auth) between 1 and 100),
  time_zone    text not null default 'Asia/Tokyo' check (char_length(time_zone) between 1 and 64),
  -- local hour (0-23) to send the Word of the Day
  notify_hour  integer not null default 8 check (notify_hour between 0 and 23),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create trigger push_subscriptions_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create table public.push_deliveries (
  endpoint    text not null references public.push_subscriptions (endpoint) on delete cascade,
  local_date  date not null,
  sent_at     timestamptz not null default now(),
  primary key (endpoint, local_date)
);

-- Server-only: RLS on with no policies, and no grants for the browser roles.
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from anon, authenticated;
grant select, insert, update, delete on public.push_deliveries to service_role;

/*
 * Devices whose local time is within 3 hours after their notify_hour and that have
 * not had today's word yet. Each is recorded as sent before it is returned, so two
 * overlapping calls never send the same day twice (primary key). The 3-hour window
 * covers a missed cron run without surprising a device that subscribes late in the day.
 * Also forgets deliveries older than 30 days.
 */
create function public.claim_word_of_the_day_push(p_now timestamptz default now())
returns table (endpoint text, p256dh text, auth text, local_date date)
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.push_deliveries d where d.sent_at < p_now - interval '30 days';

  return query
  with due as (
    select s.endpoint, s.p256dh, s.auth, (p_now at time zone s.time_zone)::date as local_date
    from public.push_subscriptions s
    where extract(hour from (p_now at time zone s.time_zone))::int >= s.notify_hour
      and extract(hour from (p_now at time zone s.time_zone))::int < s.notify_hour + 3
  ),
  claimed as (
    insert into public.push_deliveries as d (endpoint, local_date)
    select due.endpoint, due.local_date from due
    on conflict do nothing
    returning d.endpoint, d.local_date
  )
  select due.endpoint, due.p256dh, due.auth, due.local_date
  from claimed c
  join due on due.endpoint = c.endpoint and due.local_date = c.local_date;
end;
$$;

-- Remove a device the push service says is gone (404 / 410).
create function public.delete_push_subscription(target_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = target_endpoint;
$$;

revoke all on function public.claim_word_of_the_day_push(timestamptz) from public, anon, authenticated;
revoke all on function public.delete_push_subscription(text) from public, anon, authenticated;
grant execute on function public.claim_word_of_the_day_push(timestamptz) to service_role;
grant execute on function public.delete_push_subscription(text) to service_role;
