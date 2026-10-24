-- Southwood (cream, brass and ink) is the default theme again (Sam, 2026-10-24).
--
-- Additive only: new accounts get 'rally' (shown as "Southwood") from the
-- column default. Nobody's stored choice is changed by this file.
--
-- Earlier the same day schema_theme_london.sql moved everyone on 'rally' to
-- 'sw19' (London). Whether to move them back is a separate question for Sam
-- and a separate file, because the database cannot tell who picked London
-- from who was moved there.

alter table public.profiles alter column theme set default 'rally';

-- Proves the default. Expect: 'rally'::text.
select column_default from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles' and column_name = 'theme';
