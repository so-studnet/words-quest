-- Words Quest: lookup cache and rate limits.
-- Both tables are server-only: RLS is on with no policies, so the browser
-- (anon / authenticated) can never read or write them. The server uses the
-- Secret key (service_role), which bypasses RLS.

-- Cached lookup results. `key` is the lowercased query; `version` is the
-- prompt/result format version, so old entries are ignored after a change.
create table public.lookups (
  key text primary key check (char_length(key) between 1 and 300),
  version integer not null check (version > 0),
  kind text not null check (kind in ('word', 'phrase', 'sentence')),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  model text not null,
  hits integer not null default 0 check (hits >= 0),
  created_at timestamptz not null default now(),
  last_hit_at timestamptz
);

alter table public.lookups enable row level security;
revoke all on public.lookups from anon, authenticated;

-- Fixed-window counters, e.g. bucket 'ip:<hash>' per hour, 'ai' per day.
create table public.rate_limits (
  bucket text not null check (char_length(bucket) between 1 and 200),
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (bucket, window_start)
);

create index rate_limits_window_start_idx on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Count one use of `p_bucket` in the window starting at `p_window_start`.
-- Returns true if the use is allowed (count after it is <= p_limit).
-- A refused use is not counted. Atomic, so parallel requests cannot overshoot.
create function public.consume_quota(p_bucket text, p_window_start timestamptz, p_limit integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  new_count integer;
begin
  -- Forget windows older than two days (cheap thanks to the index).
  delete from public.rate_limits where window_start < now() - interval '2 days';

  insert into public.rate_limits as r (bucket, window_start, count)
  values (p_bucket, p_window_start, 1)
  on conflict (bucket, window_start)
  do update set count = r.count + 1
    where r.count < p_limit
  returning count into new_count;

  return new_count is not null and new_count <= p_limit;
end;
$$;

-- Record a cache hit without reading the row back.
create function public.touch_lookup(p_key text)
returns void
language sql
set search_path = ''
as $$
  update public.lookups set hits = hits + 1, last_hit_at = now() where key = p_key;
$$;

-- Explicit grants for the server, in case the project does not expose new tables automatically.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.lookups, public.rate_limits to service_role;

revoke all on function public.consume_quota(text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.touch_lookup(text) from public, anon, authenticated;
grant execute on function public.consume_quota(text, timestamptz, integer) to service_role;
grant execute on function public.touch_lookup(text) to service_role;
