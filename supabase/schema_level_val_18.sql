-- Rally — level_val() for the 18-point, six-category level scale
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- SAFE: replaces one function. It creates no tables, changes no rows, drops
-- nothing and touches no policies. Re-running it is harmless.
--
-- RUN THIS BEFORE the app deploy that offers the new categories, not after.
-- The reason is below.
--
-- WHAT CHANGED
--
-- src/core/constants.ts went from four categories to six, inserting Amateur
-- between Beginner and Intermediate, and Semi-pro between Advanced and Pro.
-- The four original names are unchanged, so every level already stored keeps
-- resolving and nobody is reclassified.
--
-- level_val() below is the SQL mirror of levelVal() in src/core/levels.ts.
-- The old version's own comment warned that this array has to change in step
-- with LEVELS. This is that change.
--
-- WHY THE ORDER MATTERS
--
-- array_position() returns NULL for a category not in its array, and
-- NULL - 1 is NULL, so on the old function level_val('Amateur') and
-- level_val('Semi-pro') are both NULL. global_standings() counts a quality
-- game only when `my_lv is not null and opp_lv is not null`. So against the
-- old function:
--
--   anyone who picks Amateur or Semi-pro records zero quality games, their
--   trust term never decays, and the Global table treats them as permanently
--   unproven however much they play.
--
-- There is no error and nothing in the UI looks wrong — the quality column
-- just quietly stops counting the people who took up the new tiers. So this
-- has to be in place before anyone can choose one.
--
-- WHAT DOESN'T CHANGE
--
-- global_standings() itself is untouched and does not need re-running. Its
-- quality test is `opp_lv >= my_lv` — an ordering, not a distance — and
-- inserting categories preserves the order of the existing four. So no
-- historical W/D/L or quality count changes as a result of this file.

create or replace function public.level_val(lv jsonb)
returns int
language sql
immutable
as $$
  select (array_position(
            array['Beginner','Amateur','Intermediate','Advanced','Semi-pro','Pro'],
            lv->>'cat'
          ) - 1) * 3
       + (array_position(array['Low','Medium','High'], lv->>'sub') - 1);
$$;

grant execute on function public.level_val(jsonb) to authenticated;

-- Sanity checks — run these after, they should all come back as stated.
--
--   select public.level_val('{"cat":"Beginner","sub":"Low"}'::jsonb);       -- 0
--   select public.level_val('{"cat":"Amateur","sub":"Medium"}'::jsonb);     -- 4
--   select public.level_val('{"cat":"Intermediate","sub":"Medium"}'::jsonb);-- 7
--   select public.level_val('{"cat":"Semi-pro","sub":"Low"}'::jsonb);       -- 12
--   select public.level_val('{"cat":"Pro","sub":"High"}'::jsonb);           -- 17
--   select public.level_val('{"cat":"Nonsense","sub":"Low"}'::jsonb);       -- null
