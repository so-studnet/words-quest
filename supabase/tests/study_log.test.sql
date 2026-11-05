-- Study log: RLS and constraints. Any failure raises and stops the run.
\set ON_ERROR_STOP on

insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

-- User A writes their own rows; user_id is filled in automatically.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \g /dev/null
insert into public.study_items (id, key, text, kind, result, stage, due_on)
  values ('i1', 'happy', 'happy', 'word', '{"query":"happy"}', 0, '2026-11-05');
insert into public.study_events (id, item_id, type, at) values ('e1', 'i1', 'search', '2026-11-04T01:00Z');

do $$ begin
  assert (select count(*) from public.study_items) = 1, 'A reads own items';
  assert (select user_id from public.study_items where id = 'i1') = '00000000-0000-0000-0000-00000000000a', 'user_id defaults to auth.uid()';
end $$;

-- updated_at changes on update
do $$ declare before timestamptz; begin
  select updated_at into before from public.study_items where id = 'i1';
  perform pg_sleep(0.01);
  update public.study_items set stage = 1, due_on = '2026-11-08' where id = 'i1';
  assert (select updated_at from public.study_items where id = 'i1') > before, 'updated_at is refreshed';
end $$;

-- Constraints
do $$ begin
  begin
    insert into public.study_items (id, key, text, kind, due_on) values ('dup', 'happy', 'Happy', 'word', '2026-11-05');
    raise exception 'FAIL: duplicate key for the same user accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.study_items (id, key, text, kind, stage, due_on) values ('m', 'm', 'm', 'word', 6, '2026-11-05');
    raise exception 'FAIL: mastered item with a due date accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.study_items (id, key, text, kind, stage, due_on) values ('n', 'n', 'n', 'word', 2, null);
    raise exception 'FAIL: unmastered item without a due date accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.study_items (id, key, text, kind, stage, due_on) values ('s', 's', 's', 'word', 7, null);
    raise exception 'FAIL: stage 7 accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.study_events (id, item_id, type) values ('bad', 'i1', 'quiz');
    raise exception 'FAIL: unknown event type accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.study_events (id, item_id, type) values ('orphan', 'missing', 'search');
    raise exception 'FAIL: event for a missing item accepted';
  exception when foreign_key_violation then null;
  end;
end $$;

-- A cannot write rows for B.
do $$ begin
  begin
    insert into public.study_items (id, user_id, key, text, kind, due_on)
      values ('x', '00000000-0000-0000-0000-00000000000b', 'x', 'x', 'word', '2026-11-05');
    raise exception 'FAIL: wrote an item for another user';
  exception when insufficient_privilege then null;
  end;
end $$;

-- User B: sees nothing of A, cannot change or attach to A's rows.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \g /dev/null
do $$ begin
  assert (select count(*) from public.study_items) = 0, 'B cannot see A items';
  assert (select count(*) from public.study_events) = 0, 'B cannot see A events';
end $$;
update public.study_items set text = 'hacked' where id = 'i1';
delete from public.study_events where id = 'e1';
do $$ begin
  begin
    -- B's own user_id with A's item: the (item_id, user_id) foreign key refuses it
    insert into public.study_events (id, item_id, type) values ('e-b', 'i1', 'search');
    raise exception 'FAIL: B attached an event to A''s item';
  exception when foreign_key_violation then null;
  end;
end $$;
-- B can use the same key as A (unique per user)
insert into public.study_items (id, key, text, kind, due_on) values ('i2', 'happy', 'happy', 'word', '2026-11-05');

-- Signed-out visitors get nothing.
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false) \g /dev/null
do $$ begin
  begin
    perform count(*) from public.study_items;
    raise exception 'FAIL: anon can read study_items';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- A's rows are untouched; deleting an item deletes its events.
do $$ begin
  assert (select text from public.study_items where id = 'i1') = 'happy', 'B could not update A item';
  assert (select count(*) from public.study_events where id = 'e1') = 1, 'B could not delete A event';
end $$;
delete from public.study_items where id = 'i1';
do $$ begin
  assert (select count(*) from public.study_events where item_id = 'i1') = 0, 'events are deleted with their item';
end $$;

\echo 'study_log: ok'
