-- Cache and rate-limit tests. Any failure raises and stops the run.
\set ON_ERROR_STOP on

-- The browser roles cannot touch the tables or call the functions.
set role anon;
do $$ begin
  begin
    perform count(*) from public.lookups;
    raise exception 'FAIL: anon can read lookups';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.rate_limits (bucket, window_start) values ('x', now());
    raise exception 'FAIL: anon can write rate_limits';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.consume_quota('x', now(), 10);
    raise exception 'FAIL: anon can call consume_quota';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role authenticated;
do $$ begin
  begin
    perform count(*) from public.lookups;
    raise exception 'FAIL: authenticated can read lookups';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- The server (service_role) can use everything.
set role service_role;

insert into public.lookups (key, version, kind, result, model)
values ('happy', 1, 'word', '{"query":"happy"}', 'm');
do $$ begin perform public.touch_lookup('happy'); perform public.touch_lookup('happy'); end $$;
do $$ begin
  assert (select hits from public.lookups where key = 'happy') = 2, 'touch_lookup counts hits';
  assert (select last_hit_at from public.lookups where key = 'happy') is not null, 'touch_lookup sets last_hit_at';
end $$;

-- Constraints
do $$ begin
  begin
    insert into public.lookups (key, version, kind, result, model) values ('x', 1, 'poem', '{}', 'm');
    raise exception 'FAIL: unknown kind accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.lookups (key, version, kind, result, model) values ('y', 1, 'word', '[]', 'm');
    raise exception 'FAIL: non-object result accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.lookups (key, version, kind, result, model) values ('', 1, 'word', '{}', 'm');
    raise exception 'FAIL: empty key accepted';
  exception when check_violation then null;
  end;
end $$;

-- consume_quota: allows up to the limit, then refuses without counting.
do $$
declare w timestamptz := date_trunc('hour', now());
begin
  assert public.consume_quota('ip:a', w, 3), 'use 1 allowed';
  assert public.consume_quota('ip:a', w, 3), 'use 2 allowed';
  assert public.consume_quota('ip:a', w, 3), 'use 3 allowed';
  assert not public.consume_quota('ip:a', w, 3), 'use 4 refused';
  assert not public.consume_quota('ip:a', w, 3), 'use 5 refused';
  assert (select count from public.rate_limits where bucket = 'ip:a' and window_start = w) = 3, 'refused uses are not counted';
  -- Other buckets and the next window are separate.
  assert public.consume_quota('ip:b', w, 3), 'other bucket allowed';
  assert public.consume_quota('ip:a', w + interval '1 hour', 3), 'next window allowed';
  -- A limit of 0 refuses everything.
  assert not public.consume_quota('ip:c', w, 0), 'limit 0 refuses';
end $$;

-- Old windows are cleaned up.
insert into public.rate_limits (bucket, window_start, count) values ('old', now() - interval '3 days', 5);
do $$ begin perform public.consume_quota('ip:z', date_trunc('hour', now()), 10); end $$;
do $$ begin
  assert (select count(*) from public.rate_limits where bucket = 'old') = 0, 'old windows are deleted';
end $$;

reset role;
\echo 'cache_and_rate_limits: ok'
