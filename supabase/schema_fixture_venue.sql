-- Southwood — where a booked match is played (2026-10-24)
--
-- One column, nothing existing touched, safe to re-run. No function, so no
-- grants sweep needed.
--
-- Sam: "location of the match, then it says the nearest clubs, like LTA
-- Rally". A booking's venue is a public place — a club, a leisure centre, a
-- park's courts — never a person, so its name, town and pin are kept:
--   { "name": "Hayling Park courts", "place": "Hayling Island",
--     "lat": 50.79, "lng": -0.98, "url": null, "club": false }
-- Read and written by the fixture policies that already exist; the app only
-- sends it when a booking has one, so saving works before this is run.

alter table public.fixtures add column if not exists venue jsonb;

notify pgrst, 'reload schema';

-- Proves what this file did. Expect: jsonb.
select data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'fixtures' and column_name = 'venue';
