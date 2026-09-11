-- Rally — pictures in messages
--
-- One nullable column. Nothing is added, deleted or rewritten, and no
-- policy changes: the existing message policies already decide who can read
-- and write a row, and this is just another field on it.
--
-- WHY A COLUMN AND NOT A STORAGE BUCKET
--
-- Profile photos and match photos are already stored as data URLs in text
-- columns. Putting message images anywhere else would mean a second place
-- images live, a second set of access rules to keep in step with the message
-- policies, and a second way for them to go missing. One mechanism is worth
-- more here than the bytes it costs.
--
-- The cost is real though: an image is capped at 1200px on its longest edge
-- and JPEG quality 0.72 before it is encoded, which lands around 150-250KB
-- of base64 on the row. If messages ever carry albums rather than the odd
-- photo, this is the decision to revisit first.

alter table public.messages
  add column if not exists image_url text;
