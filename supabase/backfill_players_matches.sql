-- Rally — backfill players/matches/fixtures/posts from the shared_storage blob
--
-- Run this AFTER schema_players_matches.sql, in the Supabase SQL editor.
-- Safe to run more than once — every insert is "on conflict do nothing", so
-- re-running just skips rows that already made it across. It reads from
-- shared_storage and writes into the new tables; it never modifies or
-- deletes anything in shared_storage. Your old blob data stays exactly
-- where it is as a fallback until the app is switched over.
--
-- Requires schema_shared_storage_rls.sql to already be applied too (it
-- defines public.shared_storage_league_id(), which this reuses to work out
-- which league each blob row belongs to).

do $$
declare
  r record;
  data jsonb;
  lid uuid;
  p jsonb;
  m jsonb;
  f jsonb;
  po jsonb;
begin
  for r in select key, value from public.shared_storage where key like 'grpc5\_%' escape '\' loop
    lid := public.shared_storage_league_id(r.key);
    if lid is null or not exists (select 1 from public.leagues where id = lid) then
      raise notice 'Skipping %, no matching league', r.key;
      continue;
    end if;

    data := r.value::jsonb;

    for p in select * from jsonb_array_elements(coalesce(data->'players', '[]'::jsonb)) loop
      insert into public.players (
        id, league_id, name, last, nick, age, home, level, level_history,
        avatar, avatar_url, auth_id, claimed_at, inactive, initial_record, initial_elo
      ) values (
        p->>'id', lid, coalesce(p->>'name', ''), p->>'last', p->>'nick', p->>'age', p->>'home',
        p->'level', p->'levelHistory',
        p->>'avatar', p->>'avatarUrl',
        nullif(p->>'auth_id', '')::uuid,
        case when (p->>'claimedAt') is not null then to_timestamp((p->>'claimedAt')::double precision / 1000) else null end,
        coalesce((p->>'inactive')::boolean, false),
        p->'initialRecord',
        nullif(p->>'initialElo', '')::numeric
      )
      on conflict (id) do nothing;
    end loop;

    for m in select * from jsonb_array_elements(coalesce(data->'matches', '[]'::jsonb)) loop
      insert into public.matches (
        id, league_id, p1, p2, date, winner, score, status, reported_by,
        notes, venue, photo_url, category, pending_edit
      ) values (
        m->>'id', lid, m->>'p1', m->>'p2',
        to_timestamp((m->>'date')::double precision / 1000),
        m->>'winner', m->>'score',
        coalesce(m->>'status', 'confirmed'),
        nullif(m->>'reportedBy', ''),
        m->>'notes', m->>'venue', m->>'photoUrl', m->>'category',
        m->'pendingEdit'
      )
      on conflict (id) do nothing;
    end loop;

    for f in select * from jsonb_array_elements(coalesce(data->'fixtures', '[]'::jsonb)) loop
      insert into public.fixtures (id, league_id, p1, p2, done, winner, match_id, booked)
      values (
        f->>'id', lid, f->>'p1', f->>'p2',
        coalesce((f->>'done')::boolean, false),
        f->>'winner', f->>'matchId',
        nullif(f->>'booked', '')::timestamptz
      )
      on conflict (id) do nothing;
    end loop;

    for po in select * from jsonb_array_elements(coalesce(data->'posts', '[]'::jsonb)) loop
      insert into public.posts (id, league_id, by_player_id, text, is_announcement, date)
      values (
        po->>'id', lid, nullif(po->>'by', ''),
        coalesce(po->>'text', ''),
        coalesce((po->>'isAnnouncement')::boolean, false),
        to_timestamp((po->>'date')::double precision / 1000)
      )
      on conflict (id) do nothing;
    end loop;

    raise notice 'Backfilled league %', lid;
  end loop;
end $$;

-- Verify — compare these against what you'd expect (e.g. 16 players, 63
-- matches for the real Seacourt league):
select l.name, l.id,
       (select count(*) from public.players p where p.league_id = l.id) as players,
       (select count(*) from public.matches m where m.league_id = l.id) as matches
from public.leagues l
order by l.created_at;
