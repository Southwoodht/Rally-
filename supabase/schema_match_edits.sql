-- Southwood — the organiser edit log (2026-10-30)
--
-- Additive: one new table, no existing row or policy changed. Safe to re-run.
-- Then run fix_function_grants.sql as after any migration (no function here,
-- but it costs nothing).
--
-- Sam: club owners and editors can edit or delete ANY result in their club,
-- including between two players with accounts, and every such change is
-- logged — who, when, old → new — and both players are told.
--
-- The matches policies already let owner/editor update and delete any match
-- in their club ("participants and league staff can edit matches" and the
-- staff branch of the delete policy), so no policy on matches changes. What
-- was missing is the record of it: a correction that rewrites somebody's
-- result should leave a trail they can read.
--
-- Append-only: staff may add a row (as themselves), members of the club may
-- read them, and nobody may change or remove one. p1/p2 are copied in so a
-- deleted match's log row still says whose result it was.

create table if not exists public.match_edits (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references public.leagues(id) on delete cascade,
  match_id    text not null,
  p1          text not null,
  p2          text not null,
  edited_by   uuid not null default auth.uid(),
  edited_at   timestamptz not null default now(),
  action      text not null check (action in ('edit', 'delete')),
  before      jsonb not null,
  after       jsonb
);

create index if not exists match_edits_league_time on public.match_edits (league_id, edited_at desc);

alter table public.match_edits enable row level security;

drop policy if exists "club members read the edit log" on public.match_edits;
create policy "club members read the edit log"
  on public.match_edits for select
  using (public.is_league_member(league_id));

drop policy if exists "organisers log their own edits" on public.match_edits;
create policy "organisers log their own edits"
  on public.match_edits for insert
  with check (public.is_league_staff(league_id) and edited_by = auth.uid());

notify pgrst, 'reload schema';

-- Proves what this file did. Expect: YES, 2, true.
select
  (select case when exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'match_edits') then 'YES' else 'NO' end) as edit_log_table,
  (select count(*) from pg_policies where tablename = 'match_edits') as policies,
  (select relrowsecurity from pg_class where oid = 'public.match_edits'::regclass) as rls_on;
