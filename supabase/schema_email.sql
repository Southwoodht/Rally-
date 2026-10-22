-- Southwood — emails (winter brief item 6, 2026-10-22).
--
-- Back up first (backup_everything.sql). Additive: one column, one table.
-- Touches no existing row. Safe to re-run.
--
-- profiles.email_opt_out: the "Emails" switch on My profile. Off by default
-- means emails ON — the brief: "Players can turn emails off in their profile".
-- The existing "edit your own profile" policy (id = auth.uid()) already lets
-- each person change their own, and nobody else's.
--
-- email_log: one row per email sent, so each one is sent exactly once —
-- the daily job runs every day and the "booked" email fires on every save of
-- a booking. Only the server writes it, with the service-role key, which
-- bypasses RLS; RLS is on with NO policies so no signed-in account can read
-- who was emailed what.

alter table public.profiles
  add column if not exists email_opt_out boolean not null default false;

create table if not exists public.email_log (
  id          uuid primary key default gen_random_uuid(),
  recipient   uuid not null,
  kind        text not null,
  ref         text not null,
  sent_at     timestamptz not null default now(),
  constraint email_log_once unique (recipient, kind, ref)
);

alter table public.email_log enable row level security;

notify pgrst, 'reload schema';

-- Proves what this file did. Expect: email_opt_out, YES, true.
select
  (select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email_opt_out') as opt_out_column,
  (select case when exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'email_log') then 'YES' else 'NO' end) as log_table,
  (select relrowsecurity from pg_class where oid = 'public.email_log'::regclass) as log_locked;
