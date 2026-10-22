-- Southwood — the singles ladder.
--
-- A ladder is a singles competition with format 'ladder': its entries are the
-- rungs (seed = starting place), and every challenge is an ordinary
-- competition fixture. So this file only has to do two things.
--
-- No existing row changes. Back up first anyway (backup_everything.sql).
-- No new function, so no grants sweep is needed afterwards.

-- 1. A competition may be a ladder ------------------------------------------
alter table public.doubles_competitions drop constraint if exists doubles_competitions_format;
alter table public.doubles_competitions
  add constraint doubles_competitions_format check (format in ('league', 'knockout', 'ladder'));

-- 2. Players join and leave a ladder themselves -----------------------------
--
-- Entries are otherwise organiser-only ("staff enter competition pairs"),
-- which is right for a league or a knockout and wrong for a ladder, where
-- anybody in the club may put their own name at the bottom. These widen it
-- for exactly that: your OWN player row, one player (no partner), in a ladder
-- of a club you belong to. Joining needs the ladder to be running. The staff
-- policy is untouched, so organisers still add and remove anyone.
drop policy if exists "players join a ladder" on public.doubles_competition_pairs;
create policy "players join a ladder"
  on public.doubles_competition_pairs for insert
  with check (
    p2 is null
    and exists (select 1 from public.players pl where pl.id = doubles_competition_pairs.p1 and pl.auth_id = auth.uid())
    and exists (select 1 from public.doubles_competitions c
                where c.id = doubles_competition_pairs.competition_id
                  and c.format = 'ladder' and c.status = 'running'
                  and public.is_league_member(c.league_id))
  );

drop policy if exists "players leave a ladder" on public.doubles_competition_pairs;
create policy "players leave a ladder"
  on public.doubles_competition_pairs for delete
  using (
    exists (select 1 from public.players pl where pl.id = doubles_competition_pairs.p1 and pl.auth_id = auth.uid())
    and exists (select 1 from public.doubles_competitions c
                where c.id = doubles_competition_pairs.competition_id and c.format = 'ladder')
  );

-- Check. Should come back: YES, 2
--   ladder_allowed  YES  — the format check now names 'ladder'
--   policies        2    — join and leave
select
  (select case when pg_get_constraintdef(oid) like '%ladder%' then 'YES' else 'NO' end
     from pg_constraint where conname = 'doubles_competitions_format') as ladder_allowed,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'doubles_competition_pairs'
       and policyname in ('players join a ladder', 'players leave a ladder')) as policies;
