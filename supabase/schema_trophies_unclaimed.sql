-- Rally — trophies for players who don't have an account yet
--
-- Additive migration. Run once in Supabase: SQL Editor -> New query -> paste
-- -> Run. It adds one column, relaxes one NOT NULL, and adds two policies.
-- It rewrites no existing rows and deletes nothing.
--
-- Why: until now a trophy could only ever hang off `claimed_by`, an auth
-- user id. But most of a club's history belongs to people who have never
-- opened Rally — Hugh won the 2019 Men's Singles and has no account. The
-- club admin knows it happened and should be able to record it, and it
-- should be waiting for Hugh on the day he claims his player row.
--
-- So a trophy can now hang off a `players` row instead of an auth user.
-- Nothing rewrites the trophy when the row is claimed: the profile reads
-- "trophies for this player row OR for this auth id", so setting
-- players.auth_id is the whole of the transfer.

-- ------------------------------------------------------------------ column
alter table public.trophies
  add column if not exists player_id text references public.players(id) on delete cascade;

-- text, not uuid: players.id is the app's own short id ("96zp33j8", from
-- uid() in src/lib/format.ts), kept as text so the original backfill could
-- carry every existing player id over unchanged. Everything else in this
-- table is a uuid because everything else in it points at auth.users or
-- clubs, which aren't. A uuid here fails outright — the foreign key can't
-- be built across the two types.

-- Cascade rather than set null: a trophy recorded against a player row has
-- no other owner, so orphaning it would leave a row belonging to nobody
-- (and would break trophies_subject below).

create index if not exists trophies_player_idx on public.trophies(player_id);

-- An admin-recorded trophy has no claimant — nobody has claimed it because
-- nobody has an account to claim it with.
alter table public.trophies alter column claimed_by drop not null;

-- ...but every trophy still belongs to somebody: either an auth user or a
-- player row. Existing rows all have claimed_by, so this validates as-is.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'trophies_subject' and conrelid = 'public.trophies'::regclass
  ) then
    alter table public.trophies
      add constraint trophies_subject
      check (claimed_by is not null or player_id is not null);
  end if;
end $$;

-- ------------------------------------------------------------------ helper
-- Who an admin may record against: a player row that (a) they can see,
-- meaning it's in a league they're in, and (b) nobody has claimed. Once a
-- row is claimed its owner uses the normal claim-and-review flow instead —
-- an admin doesn't get to write honours onto a live account behind its
-- owner's back. Checked at insert time only, so a trophy recorded today
-- survives Hugh claiming the row tomorrow.
create or replace function public.can_record_trophy_for(p_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.players p
    where p.id = p_id
      and p.auth_id is null
      and public.is_league_member(p.league_id)
  );
$$;

-- ---------------------------------------------------------------- policies
-- Recording is the club admin's own act of verification, so it lands
-- 'approved' with them stamped on it — there's no second person to review
-- it and asking them to approve their own entry would be theatre. The
-- existing "submit your own pending claim" policy is untouched and still
-- requires claimed_by = auth.uid(), so this new path can't be used to
-- self-award: it demands claimed_by IS NULL and a player row that has no
-- account behind it.
drop policy if exists "club admin records a trophy for an unclaimed player" on public.trophies;
create policy "club admin records a trophy for an unclaimed player"
  on public.trophies for insert
  with check (
    kind = 'trophy'
    and claimed_by is null
    and player_id is not null
    and status = 'approved'
    and verified_by = auth.uid()
    and public.is_club_admin(club_id)
    and public.can_record_trophy_for(player_id)
  );

-- And can take it back if they typed the wrong year. Deliberately narrow:
-- only rows with no claimant, so this never becomes a way for an admin to
-- delete somebody else's approved claim.
drop policy if exists "club admin removes a trophy they recorded" on public.trophies;
create policy "club admin removes a trophy they recorded"
  on public.trophies for delete
  using (
    public.is_club_admin(club_id)
    and claimed_by is null
    and player_id is not null
  );
