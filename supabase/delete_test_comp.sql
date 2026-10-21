-- Southwood — remove Sam's test competition from Seacourt (2026-10-21).
--
-- DELETES DATA. Approved by Sam after he saw the list from
-- diagnose_test_comp.sql: 30 matches, every one of them a Test comp result,
-- and nothing else logged in Seacourt that day. Back up first
-- (backup_everything.sql).
--
-- The 30 matches go by their exact ids, and only from Seacourt. The
-- competition goes by name, kind and club, and its fixtures and entries go
-- with it (on delete cascade). One transaction: all of it or none.
-- Expect: 0, 0 — none of the 30 left, no Test comp left.

begin;

delete from public.doubles_competitions c
 using public.leagues l
 where l.id = c.league_id and l.name ilike 'seacourt%'
   and c.kind = 'singles' and c.name ilike 'test comp';

delete from public.matches m
 using public.leagues l
 where l.id = m.league_id and l.name ilike 'seacourt%'
   and m.id in (
     'rwfr8or4','18tikk00','tcyc6gae','d27zy7ri','npemnlo9','m9u7ba4a',
     't1qqhaih','5bx80pkq','9xx32nrd','31u9s1lw','yaetzw3f','iwbw1sq9',
     '6y1j5jdz','szrc7x2f','o3o2jtcl','0m4fxneh','3vqms44c','09igi5o4',
     'fthk5pzi','3qxugffe','0wb87158','0f9trxwk','4vzcm46y','3thzoq8b',
     'qvlflxu9','sanapldf','l6k9ihyu','g3y8uchd','waa06mbc','gl6l98z0'
   );

commit;

select
  (select count(*) from public.matches where id in (
     'rwfr8or4','18tikk00','tcyc6gae','d27zy7ri','npemnlo9','m9u7ba4a',
     't1qqhaih','5bx80pkq','9xx32nrd','31u9s1lw','yaetzw3f','iwbw1sq9',
     '6y1j5jdz','szrc7x2f','o3o2jtcl','0m4fxneh','3vqms44c','09igi5o4',
     'fthk5pzi','3qxugffe','0wb87158','0f9trxwk','4vzcm46y','3thzoq8b',
     'qvlflxu9','sanapldf','l6k9ihyu','g3y8uchd','waa06mbc','gl6l98z0'
   )) as test_matches_left,
  (select count(*) from public.doubles_competitions c join public.leagues l on l.id = c.league_id
    where l.name ilike 'seacourt%' and c.kind = 'singles' and c.name ilike 'test comp') as test_comp_left;
