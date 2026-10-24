-- Southwood — a club logo (2026-10-24)
--
-- Then run fix_function_grants.sql. Adds one column and touches no existing
-- row. Safe to re-run.
--
-- Sam: "an admin should be able to choose a profile pic for it, so the
-- Seacourt club logo". The logo replaces the letter in the club's circle on
-- the start page and in the club switcher.
--
-- It is written through set_league_logo(), not a plain update, because the
-- leagues UPDATE policy is the club's creator only and the logo is for any
-- owner or organiser. The function checks is_league_staff and writes that
-- one column, nothing else. Members already read their own clubs' rows
-- ("read leagues you belong to"), so nothing about reading changes.
--
-- The logo is a small square JPEG data URL the app makes (256px, about
-- 20-40 KB), stored on the row like a player's photo. The length check stops
-- anything enormous being pasted in.

alter table public.leagues add column if not exists logo_url text;

create or replace function public.set_league_logo(p_league_id uuid, p_logo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only an organiser of this club can change its logo.';
  end if;
  if p_logo is not null and length(p_logo) > 300000 then
    raise exception 'That logo is too large.';
  end if;
  update public.leagues set logo_url = p_logo where id = p_league_id;
end;
$$;

revoke all on function public.set_league_logo(uuid, text) from public, anon;
grant execute on function public.set_league_logo(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- Proves what this file did. Expect: text, true, false.
select
  (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'leagues' and column_name = 'logo_url') as logo_column,
  exists (select 1 from pg_proc where proname = 'set_league_logo') as organiser_function,
  has_function_privilege('anon', 'public.set_league_logo(uuid, text)', 'execute') as anon_may_call;
