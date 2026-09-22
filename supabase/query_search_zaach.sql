-- Rally — why doesn't searching "zaach" find him?
--
-- READ ONLY. One statement, no auth.uid() — see §6.
--
-- WHAT SEARCH ACTUALLY MATCHES ON, which is narrower than it looks:
--
--   1. profiles.display_name ILIKE '%zaach%'   — the name on the ACCOUNT,
--      set at sign-up. Not the name on his league row.
--   2. profiles.friend_code = 'ZAACH'          — exact, so irrelevant here.
--   3. players.nick ILIKE '%zaach%'            — via search_player_accounts(),
--      and ONLY for player rows where auth_id is not null.
--
-- It never looks at players.name or players.last. So a player row reading
-- "Zaach Rodriguez" is invisible to search unless his account's display name
-- or his nickname also says it.
--
-- WHAT TO LOOK FOR IN THE OUTPUT
--
--   * has_account — false means nothing can find him and no SQL fixes that.
--     Search returns accounts, deliberately: there is no profile to open for
--     somebody who has never signed up.
--   * display_name — if this is null or blank or says something else ("Z",
--     "zr", an email), that is the bug, and it is the common case: nothing
--     has ever backfilled display_name from the league row.
--   * would_match_today — the whole question, answered per row.
--
-- Widened past Zaach on purpose: every player whose name, surname or nick
-- looks like "zaach", plus their account if they have one. If he appears
-- twice, that is worth knowing too.

select p.name                                    as player_name,
       p.last                                    as player_last,
       p.nick                                    as player_nick,
       (p.auth_id is not null)                   as has_account,
       pr.display_name                           as account_display_name,
       l.name                                    as league,
       (
         coalesce(pr.display_name, '') ilike '%zaach%'
         or coalesce(p.nick, '') ilike '%zaach%' and p.auth_id is not null
       )                                         as would_match_today
  from public.players p
  left join public.profiles pr on pr.id = p.auth_id
  left join public.leagues  l  on l.id  = p.league_id
 where coalesce(p.name, '') ilike '%zaach%'
    or coalesce(p.last, '') ilike '%zaach%'
    or coalesce(p.nick, '') ilike '%zaach%'
    or coalesce(pr.display_name, '') ilike '%zaach%'
 order by has_account desc, p.name;
