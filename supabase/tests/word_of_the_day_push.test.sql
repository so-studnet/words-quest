-- Word of the Day push: RLS, claim window, and no double sends.
\set ON_ERROR_STOP on

insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

-- A registers two devices (Tokyo 08:00 and New York 21:00).
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \g /dev/null
insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/tokyo', 'p', 'a');
insert into public.push_subscriptions (endpoint, p256dh, auth, time_zone, notify_hour)
  values ('https://push.example/ny', 'p', 'a', 'America/New_York', 21);
do $$ begin
  assert (select count(*) from public.push_subscriptions) = 2, 'A sees own devices';
  assert (select notify_hour from public.push_subscriptions where endpoint = 'https://push.example/tokyo') = 8, 'default hour is 8';
end $$;
do $$ begin
  begin
    insert into public.push_subscriptions (endpoint, p256dh, auth, notify_hour) values ('x', 'p', 'a', 24);
    raise exception 'FAIL: hour 24 accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
      values ('y', '00000000-0000-0000-0000-00000000000b', 'p', 'a');
    raise exception 'FAIL: device registered for another user';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.push_deliveries;
    raise exception 'FAIL: browser can read push_deliveries';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claim_word_of_the_day_push();
    raise exception 'FAIL: browser can call claim_word_of_the_day_push';
  exception when insufficient_privilege then null;
  end;
end $$;

-- B cannot see or delete A's devices.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \g /dev/null
do $$ begin
  assert (select count(*) from public.push_subscriptions) = 0, 'B cannot see A devices';
end $$;
delete from public.push_subscriptions;
reset role;
do $$ begin
  assert (select count(*) from public.push_subscriptions) = 2, 'B could not delete A devices';
end $$;

set role anon;
do $$ begin
  begin
    perform count(*) from public.push_subscriptions;
    raise exception 'FAIL: anon can read push_subscriptions';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Server: claim by local time.
set role service_role;
do $$
declare n int;
begin
  -- 07:59 Tokyo (22:59 UTC the day before): too early
  select count(*) into n from public.claim_word_of_the_day_push('2026-11-05T22:59:00Z');
  assert n = 0, 'nothing before 08:00 Tokyo';

  -- 08:05 Tokyo: the Tokyo device, once, for its local date
  assert (select local_date from public.claim_word_of_the_day_push('2026-11-05T23:05:00Z')) = '2026-11-06', 'Tokyo device at 08:05, local date';
  select count(*) into n from public.claim_word_of_the_day_push('2026-11-06T00:05:00Z');
  assert n = 0, 'not sent twice on the same local day';

  -- 21:30 New York (02:30 UTC next day): the NY device, dated by NY time
  assert (select local_date from public.claim_word_of_the_day_push('2026-11-07T02:30:00Z')) = '2026-11-06', 'NY device at 21:30 NY time';

  -- 11:00 Tokyo next day: outside the 3-hour window -> skipped that day
  select count(*) into n from public.claim_word_of_the_day_push('2026-11-07T02:00:00Z');
  assert n = 0, 'nothing at 11:00 (window is 08:00-10:59)';

  -- 10:59 Tokyo the day after: still inside the window
  select count(*) into n from public.claim_word_of_the_day_push('2026-11-08T01:59:00Z');
  assert n = 1, 'sent at 10:59, end of the window';

  assert (select count(*) from public.push_deliveries) = 3, 'three deliveries recorded';
end $$;

-- Old deliveries are forgotten; deleting a device deletes its deliveries.
do $$
declare n int;
begin
  select count(*) into n from public.claim_word_of_the_day_push('2026-12-31T00:00:00Z');
  assert (select count(*) from public.push_deliveries where local_date < '2026-12-01') = 0, 'deliveries older than 30 days are deleted';
  perform public.delete_push_subscription('https://push.example/tokyo');
  assert (select count(*) from public.push_subscriptions) = 1, 'device deleted';
end $$;
reset role;

\echo 'word_of_the_day_push: ok'
