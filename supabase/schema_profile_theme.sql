-- Rally — remember which theme somebody picked
--
-- NOT RUN BY A CODING SESSION. Sam runs this.
--
-- ADDITIVE. One column with a default, on a table that already exists. No row
-- is rewritten: `add column ... default` gives every existing profile 'rally',
-- which is what they are all looking at today. Nothing breaks if it is never
-- run — the picker works from localStorage and simply does not follow you to
-- a second device.
--
-- THE FIVE VALUES ARE DUPLICATED HERE and that is unavoidable. src/lib/themes.ts
-- is the list the app reads; SQL cannot import it. **If a sixth theme is ever
-- added, this constraint has to change with that file or the write will fail
-- with a constraint violation and the theme will appear to "not save".**

alter table public.profiles
  add column if not exists theme text not null default 'rally';

-- The check is added separately and guarded, so re-running the file is safe
-- and so an existing bad value surfaces as an error here rather than silently
-- later.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_theme_check') then
    alter table public.profiles
      add constraint profiles_theme_check
      check (theme in ('rally', 'paris', 'sw19', 'flushing', 'melbourne'));
  end if;
end
$$;

-- RLS: nothing to add.
--
-- profiles already carries "edit your own profile" for update, qualified
-- `id = auth.uid()`, which is exactly the rule this column needs — you may
-- change your own theme and nobody else's. Verified rather than assumed; the
-- select below prints it so the same thing can be checked after running.
--
-- Deliberately NOT widened: the existing select policy is "any signed in user
-- can search profiles", so another account can read your theme. That is true
-- of your display name and photo already and a colour preference is not more
-- sensitive than either.

select p.policyname,
       p.cmd,
       p.qual        as using_clause,
       p.with_check  as with_check_clause
  from pg_policies p
 where p.schemaname = 'public'
   and p.tablename = 'profiles'
 order by p.cmd, p.policyname;
