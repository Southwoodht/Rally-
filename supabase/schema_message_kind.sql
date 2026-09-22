-- Rally — tell a message Rally wrote from a message a person typed
--
-- NOT RUN BY A CODING SESSION. Sam runs this.
--
-- ADDITIVE. One nullable column with a default. No existing row is read,
-- rewritten or deleted, no policy changes, and nothing breaks if it is never
-- run — the app falls back to recognising these messages by their text, which
-- is what it does today.
--
-- WHY
--
-- A nudge is delivered as an ordinary message, on purpose: a second delivery
-- mechanism is a second thing that can be out of sync with the first. But
-- that left nothing downstream able to tell it apart from something the
-- sender had written, so a nudge rendered in Sam's own thread as a lime,
-- right-aligned bubble — styled as words he chose, when he had chosen a
-- button.
--
-- The screen now recognises them by matching the text against the templates
-- that produced them. That works, and it is a guess about a row's contents
-- where this is a fact about the row. Reword a template and the old messages
-- stop being recognised; quote one back at somebody and the matcher has to
-- care where in the sentence it sits.
--
-- WHY NO BACKFILL
--
-- The obvious next line is an UPDATE setting kind = 'system' on every row
-- matching those templates, and it is deliberately not here. It would be a
-- write against real conversations to save a fallback that already exists and
-- costs nothing — the app checks the column first and the text second, so
-- messages sent before this runs keep rendering correctly forever. §6's rule
-- is that anything rewriting existing rows gets flagged and argued for first,
-- and there is no argument for this one.
--
-- If you ever DO want the backfill, it is safe to run separately and the
-- shapes are in systemMessage / SYSTEM_SHAPES in src/lib/messages.ts. It
-- would only ever change rows the app is already treating as system.

alter table public.messages
  add column if not exists kind text not null default 'chat';

-- 'chat' or 'system', and nothing else. A typo in a future insert should fail
-- loudly at the write rather than quietly render as somebody's own message,
-- which is the exact bug this column exists to end.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_kind_check'
  ) then
    alter table public.messages
      add constraint messages_kind_check check (kind in ('chat', 'system'));
  end if;
end
$$;

-- What it looks like afterwards. Expect kind text, not null, default 'chat',
-- and every existing row already carrying 'chat'.
select c.column_name,
       c.data_type,
       c.is_nullable,
       c.column_default,
       (select count(*) from public.messages where kind = 'chat')   as rows_chat,
       (select count(*) from public.messages where kind = 'system') as rows_system
  from information_schema.columns c
 where c.table_schema = 'public'
   and c.table_name = 'messages'
   and c.column_name = 'kind';
