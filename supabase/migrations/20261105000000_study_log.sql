-- Words Quest: study log and spaced review (signed-in owner only).
-- The browser reads and writes these tables directly with the Publishable key;
-- RLS limits every row to its owner.

create table public.study_items (
  id          text primary key check (char_length(id) between 1 and 64),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key         text not null check (char_length(key) between 1 and 300),
  text        text not null check (char_length(text) between 1 and 300),
  kind        text not null check (kind in ('word', 'phrase', 'sentence')),
  result      jsonb check (result is null or jsonb_typeof(result) = 'object'),
  stage       integer not null default 0 check (stage between 0 and 6),
  due_on      date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- mastered (stage 6) <=> no next review
  constraint study_items_due check ((stage = 6) = (due_on is null)),
  constraint study_items_user_key unique (user_id, key),
  -- lets study_events reference (id, user_id) so an event can only point at its owner's item
  constraint study_items_id_user unique (id, user_id)
);

create table public.study_events (
  id       text primary key check (char_length(id) between 1 and 64),
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id  text not null,
  type     text not null check (type in ('search', 'review_ok', 'review_ng')),
  at       timestamptz not null default now(),
  constraint study_events_item foreign key (item_id, user_id)
    references public.study_items (id, user_id) on delete cascade
);

create index study_items_user_due_idx on public.study_items (user_id, due_on);
create index study_events_user_at_idx on public.study_events (user_id, at);
create index study_events_item_idx on public.study_events (item_id);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger study_items_updated_at before update on public.study_items
  for each row execute function public.set_updated_at();

alter table public.study_items enable row level security;
alter table public.study_events enable row level security;

create policy "own study items" on public.study_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own study events" on public.study_events for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Signed-out visitors get nothing.
revoke all on public.study_items, public.study_events from anon;
grant select, insert, update, delete on public.study_items, public.study_events to authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
