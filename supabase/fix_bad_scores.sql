-- Southwood — correct the two scores that don't match their result.
-- CHANGES SEACOURT DATA: two match rows, by id, nothing else.
--
-- Back up first (backup_everything.sql). Then fill in the five FILL_IN values
-- below and run the whole file. While any FILL_IN is left, it stops with an
-- error and changes nothing.
--
-- Scores are written from PLAYER 1's side, sets separated by commas:
--   xefu1o73  14 Sep 2026  player 1 = Charlie Henry, player 2 = Zaach Rodriguez
--             stored: Zaach won, "6-6"
--             e.g. Zaach won 6-4 6-3  ->  score '4-6, 3-6', winner 'p2'
--   me3n6foy  20 Mar 2026  player 1 = Will Allen, player 2 = George Henry
--             stored: a draw, "6-0 George - 6-3 Will"
--             e.g. George won the first 6-0, Will the second 6-3 -> score
--             '0-6, 6-3'. One set each, but George won more games (9-6), so
--             the app counts that as George's win: winner 'p2'. A draw is
--             only accepted when the games are level too.
--
-- winner is 'p1', 'p2' or 'draw'.
--
-- Each update also checks the row still holds today's bad score, so running
-- the file twice, or after the row has been edited in the app, changes
-- nothing and says so.

do $$
declare
  charlie_zaach_score  text := 'FILL_IN';
  charlie_zaach_winner text := 'FILL_IN';
  will_george_score    text := 'FILL_IN';
  will_george_winner   text := 'FILL_IN';
  i_have_a_backup      text := 'FILL_IN';  -- write yes
  n int;
begin
  if 'FILL_IN' in (charlie_zaach_score, charlie_zaach_winner, will_george_score, will_george_winner, i_have_a_backup) then
    raise exception 'Fill in every FILL_IN first. Nothing was changed.';
  end if;
  if lower(i_have_a_backup) <> 'yes' then
    raise exception 'Run backup_everything.sql first. Nothing was changed.';
  end if;
  if charlie_zaach_winner not in ('p1', 'p2', 'draw') or will_george_winner not in ('p1', 'p2', 'draw') then
    raise exception 'winner must be p1, p2 or draw. Nothing was changed.';
  end if;

  update public.matches set score = charlie_zaach_score, winner = charlie_zaach_winner
  where id = 'xefu1o73' and p1 = 'charlie' and p2 = 'zaach' and score = '6-6';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Charlie v Zaach (14 Sep) is no longer "6-6". Nothing was changed.'; end if;

  update public.matches set score = will_george_score, winner = will_george_winner
  where id = 'me3n6foy' and p1 = 'ovoqirka' and p2 = 'vnxs2t56' and score = '6-0 George - 6-3 Will';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Will v George (20 Mar) is no longer the stored score. Nothing was changed.'; end if;
end $$;

-- Should show the two rows with the scores and winners you typed.
select m.id, m.date::date, p1.name || ' ' || coalesce(p1.last, '') as player_1,
       p2.name || ' ' || coalesce(p2.last, '') as player_2, m.winner, m.score
from public.matches m
join public.players p1 on p1.id = m.p1
join public.players p2 on p2.id = m.p2
where m.id in ('xefu1o73', 'me3n6foy')
order by m.date;
