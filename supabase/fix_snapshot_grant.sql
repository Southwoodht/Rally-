-- Rally — close the snapshot to anon, and the reason it was open
--
-- RUN THIS ONE. Two lines and a check.
--
-- public_league_snapshot exists now, and the report says anon can call it —
-- even though the file that created it ends with
--
--     revoke all on function public.public_league_snapshot(uuid) from public;
--
-- and that line demonstrably ran, because the select after it returned a row.
--
-- THE REVOKES WERE NEVER FAILING TO RUN. They were running and not doing what
-- the file assumed.
--
-- Supabase ships `alter default privileges in schema public grant all on
-- functions to anon, authenticated, service_role`. So a new function is
-- granted to anon **directly**, not through PUBLIC. `revoke ... from public`
-- removes a grant that was never the one doing the work, reports success, and
-- leaves anon exactly as it was.
--
-- That explains all six of the functions found open earlier, every one of
-- which had a `revoke ... from public` sitting at the bottom of its file. It
-- also explains why the three fix files worked: they said
-- `from public, anon`. Nobody's paste was being truncated — the earlier
-- theory in this repo's notes, now withdrawn.
--
-- **The standing rule: every new function needs `revoke ... from public,
-- anon` explicitly.** A file that revokes only from public will leave the
-- function open, with no error and nothing visible to notice.

revoke all on function public.public_league_snapshot(uuid) from public, anon;
grant execute on function public.public_league_snapshot(uuid) to authenticated;

-- Expect: authenticated true, anon false.
select f.proname                                 as function,
       has_function_privilege('authenticated', f.oid, 'execute') as authenticated_may_call,
       has_function_privilege('anon', f.oid, 'execute')          as anon_may_call
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace
 where n.nspname = 'public' and f.proname = 'public_league_snapshot';
