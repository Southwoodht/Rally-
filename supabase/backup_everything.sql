-- Southwood — copy every app table into ONE cell, before running a migration.
--
-- Reads only. Changes nothing. One statement, so the SQL editor shows its
-- answer (it only ever shows the last statement's).
--
-- How to use: paste, Run, then use the editor's Export / "Download CSV"
-- button on the result and keep the file somewhere safe (not in the repo —
-- it holds real names and private messages, same rule as backups/).
--
-- Why this rather than Supabase's own backup: the free plan has no
-- downloadable backups, and the official CLI dump needs Docker. Southwood's
-- data is small enough to fit in one JSON value, and every row of every
-- table the app uses is in it, so any change can be undone row for row.

select json_build_object(
  'taken_at',                  now(),
  'leagues',                   (select coalesce(json_agg(t), '[]') from public.leagues t),
  'league_members',            (select coalesce(json_agg(t), '[]') from public.league_members t),
  'players',                   (select coalesce(json_agg(t), '[]') from public.players t),
  'matches',                   (select coalesce(json_agg(t), '[]') from public.matches t),
  'fixtures',                  (select coalesce(json_agg(t), '[]') from public.fixtures t),
  'posts',                     (select coalesce(json_agg(t), '[]') from public.posts t),
  'doubles_matches',           (select coalesce(json_agg(t), '[]') from public.doubles_matches t),
  'doubles_fixtures',          (select coalesce(json_agg(t), '[]') from public.doubles_fixtures t),
  'doubles_competitions',      (select coalesce(json_agg(t), '[]') from public.doubles_competitions t),
  'doubles_competition_pairs', (select coalesce(json_agg(t), '[]') from public.doubles_competition_pairs t),
  'profiles',                  (select coalesce(json_agg(t), '[]') from public.profiles t),
  'friends',                   (select coalesce(json_agg(t), '[]') from public.friends t),
  'clubs',                     (select coalesce(json_agg(t), '[]') from public.clubs t),
  'club_members',              (select coalesce(json_agg(t), '[]') from public.club_members t),
  'trophies',                  (select coalesce(json_agg(t), '[]') from public.trophies t),
  'message_threads',           (select coalesce(json_agg(t), '[]') from public.message_threads t),
  'messages',                  (select coalesce(json_agg(t), '[]') from public.messages t),
  'shared_storage',            (select coalesce(json_agg(t), '[]') from public.shared_storage t),
  'user_storage',              (select coalesce(json_agg(t), '[]') from public.user_storage t)
) as southwood_backup;
