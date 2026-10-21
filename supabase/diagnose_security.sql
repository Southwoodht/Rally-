-- Southwood — what the database ACTUALLY allows, table by table.
--
-- Reads only. One statement. The repo holds several files that change the
-- same policies, and nothing records which were run; this asks the database
-- itself, which is the only answer that counts (CLAUDE.md §6: a rule in a
-- file is not a rule in the database).
--
-- One row per policy on the tables the winter pilot touches or that the
-- 2026-10-21 audit flagged, plus whether a signed-out visitor can read
-- `leagues` at all.

select p.tablename,
       p.cmd,
       p.policyname,
       p.roles::text                          as roles,
       coalesce(p.qual, '')                   as using_clause,
       coalesce(p.with_check, '')             as with_check_clause,
       has_table_privilege('anon', 'public.' || p.tablename, 'select') as anon_can_select_table
  from pg_policies p
 where p.schemaname = 'public'
   and p.tablename in ('shared_storage', 'leagues', 'league_members', 'players', 'fixtures', 'matches')
 order by p.tablename, p.cmd, p.policyname;
