-- London is the default theme (Sam, 2026-10-24).
--
-- THIS FILE CHANGES DATA: everyone whose stored theme is the old default
-- ('rally', shown as "Southwood") moves to London ('sw19'). The database
-- cannot tell somebody who chose Southwood from somebody who never opened the
-- picker, and Sam chose to move everyone; anyone who wants Southwood back
-- picks it again from the menu. Theme ids and names are unchanged — only the
-- default and the rows holding it.
--
-- New accounts get London from the column default.

alter table public.profiles alter column theme set default 'sw19';

update public.profiles set theme = 'sw19' where theme = 'rally';

-- Proves the default and the move. Expect: 'sw19'::text, 0.
select
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'theme') as theme_default,
  (select count(*) from public.profiles where theme = 'rally') as still_on_southwood;
