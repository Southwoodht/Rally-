-- Rally — private messages
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Additive: two new tables and three functions. Touches nothing existing.
-- Safe to re-run.
--
-- THE RULE, AND WHY
--
-- Facebook's shape: anyone can send you a first message, but if you're not
-- friends it lands as a *request* — you decide whether it becomes a
-- conversation. Friends skip that step.
--
-- The reason this matters here rather than being a nicety: coaches will set
-- up leagues, and leagues will contain juniors. "Anyone in a league with you
-- can DM you" is the wrong default the first time that happens. But walling
-- messages off to friends-only stops the thing people actually want, which
-- is "fancy a game Thursday?" to someone they just played. Requests give you
-- both — the message gets through, the conversation doesn't start until the
-- recipient says so.
--
-- Enforced in RLS, not in the app: while a thread is pending only the person
-- who started it can add to it. The recipient physically cannot be replied
-- at until they accept, and nobody can get round that with a crafted client.

-- ------------------------------------------------------------------ threads
-- One row per pair of people, ever. user_a/user_b are stored in a fixed
-- order (least/greatest) so a pair can only ever produce one thread — the
-- unique constraint then does the work, rather than the app having to check
-- both directions and race with itself.
create table if not exists public.message_threads (
  id              uuid primary key default gen_random_uuid(),
  user_a          uuid not null references auth.users(id) on delete cascade,
  user_b          uuid not null references auth.users(id) on delete cascade,
  started_by      uuid not null references auth.users(id) on delete cascade,
  status          text not null default 'pending',   -- pending | accepted
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  last_message_at timestamptz,
  constraint message_threads_ordered check (user_a < user_b),
  constraint message_threads_not_self check (user_a <> user_b),
  constraint message_threads_unique_pair unique (user_a, user_b)
);

create index if not exists message_threads_a_idx on public.message_threads(user_a);
create index if not exists message_threads_b_idx on public.message_threads(user_b);

-- ----------------------------------------------------------------- messages
-- read_at is "the other person has seen this". Two-person threads only, so a
-- single column says everything a per-recipient table would.
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.message_threads(id) on delete cascade,
  sender_id  uuid not null references auth.users(id) on delete cascade,
  body       text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index if not exists messages_thread_idx on public.messages(thread_id, created_at);

-- --------------------------------------------------------------- predicates
create or replace function public.in_thread(t_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.message_threads t
    where t.id = t_id and (t.user_a = auth.uid() or t.user_b = auth.uid())
  );
$$;

-- ---------------------------------------------------------------- threads RLS
alter table public.message_threads enable row level security;

drop policy if exists "read your own threads" on public.message_threads;
create policy "read your own threads"
  on public.message_threads for select
  using (user_a = auth.uid() or user_b = auth.uid());

-- Threads are only ever created through start_thread() below, which is where
-- the friends-or-request decision is made. No direct inserts.
drop policy if exists "accept a request sent to you" on public.message_threads;
create policy "accept a request sent to you"
  on public.message_threads for update
  using (
    status = 'pending'
    and started_by <> auth.uid()
    and (user_a = auth.uid() or user_b = auth.uid())
  )
  with check (status = 'accepted');

-- Either side can walk away; deleting the thread takes its messages with it.
drop policy if exists "leave a thread" on public.message_threads;
create policy "leave a thread"
  on public.message_threads for delete
  using (user_a = auth.uid() or user_b = auth.uid());

-- --------------------------------------------------------------- messages RLS
alter table public.messages enable row level security;

drop policy if exists "read messages in your threads" on public.messages;
create policy "read messages in your threads"
  on public.messages for select
  using (public.in_thread(thread_id));

-- The rule, enforced here rather than in the app: while a thread is pending
-- only the person who started it may write. Accepting is what opens it up.
drop policy if exists "write in your threads" on public.messages;
create policy "write in your threads"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and public.in_thread(thread_id)
    and exists (
      select 1 from public.message_threads t
      where t.id = thread_id
        and (t.status = 'accepted' or t.started_by = auth.uid())
    )
  );

-- Marking read is the only update, and only on messages you received.
drop policy if exists "mark messages you received as read" on public.messages;
create policy "mark messages you received as read"
  on public.messages for update
  using (public.in_thread(thread_id) and sender_id <> auth.uid())
  with check (public.in_thread(thread_id) and sender_id <> auth.uid());

-- ------------------------------------------------------------ start_thread
-- Find or create the thread with someone, and decide up front whether it's a
-- conversation or a request. Security definer because working out whether
-- you two are friends means reading a friends row from the other person's
-- side, and because the ordered-pair insert should not be the client's job.
create or replace function public.start_thread(other_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  t_id uuid;
  are_friends boolean;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  if other_id is null or other_id = me then raise exception 'Pick someone else.'; end if;

  a := least(me, other_id);
  b := greatest(me, other_id);

  select id into t_id from public.message_threads where user_a = a and user_b = b;
  if t_id is not null then return t_id; end if;

  select exists (
    select 1 from public.friends f
    where f.status = 'accepted'
      and ((f.requester_id = me and f.addressee_id = other_id)
        or (f.requester_id = other_id and f.addressee_id = me))
  ) into are_friends;

  insert into public.message_threads (user_a, user_b, started_by, status, accepted_at)
  values (a, b, me, case when are_friends then 'accepted' else 'pending' end,
          case when are_friends then now() else null end)
  returning id into t_id;

  return t_id;
end;
$$;

-- ----------------------------------------------------- housekeeping helpers
-- Keeps threads sortable by activity without the client having to write to
-- the thread row (which its RLS deliberately doesn't allow).
create or replace function public.touch_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.message_threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_thread on public.messages;
create trigger messages_touch_thread
  after insert on public.messages
  for each row execute function public.touch_thread();

create or replace function public.unread_message_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.messages m
  join public.message_threads t on t.id = m.thread_id
  where (t.user_a = auth.uid() or t.user_b = auth.uid())
    and t.status = 'accepted'
    and m.sender_id <> auth.uid()
    and m.read_at is null;
$$;

grant execute on function public.start_thread(uuid) to authenticated;
grant execute on function public.unread_message_count() to authenticated;
grant execute on function public.in_thread(uuid) to authenticated;
