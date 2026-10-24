-- Everyone on London moves to the new Southwood theme (Sam, 2026-10-24).
--
-- THIS FILE CHANGES DATA. schema_theme_london.sql moved everyone on 'rally'
-- to 'sw19' this morning; this moves everyone on 'sw19' back to 'rally', which
-- is now cream, brass and ink. The database cannot tell somebody moved by that
-- file from somebody who has picked London themselves since, so Sam chose to
-- move everyone; anyone who wants London picks it again from the menu.
--
-- Run it AFTER the theme is merged, or people see the old dark green Southwood
-- until the deploy. The app reads this on sign-in and repaints each device.

update public.profiles set theme = 'rally' where theme = 'sw19';

-- Expect: 0.
select count(*) as still_on_london from public.profiles where theme = 'sw19';
