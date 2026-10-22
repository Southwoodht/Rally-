/**
 * Fill a division's unplayed ties from matches already played.
 *
 * Sam, 2026-10-22, setting up a division part-way through the year: "can I
 * use already played matches to fill the division? I played Zaach 3 times
 * ... and Charlie like 13 times — would we use the first 3 or the last 3?"
 *
 * The first, in order: ties are filled round by round, each with the EARLIEST
 * match between those two players that falls inside the window (the season's
 * dates) and is not already settling another tie. So thirteen matches
 * against Charlie fill a play-each-twice division with the first two, as if
 * they had been played in turn. Only matches that count (countsAsPlayed:
 * not disputed, not short) are used, and nothing outside the window.
 *
 * Pure: returns which match settles which tie; the caller writes it.
 */
import { countsAsPlayed } from "./matchStatus";

export interface BackfillTie { id: string; p1: string; p2: string; round?: number | null; done?: boolean; outcome?: string | null }
export interface BackfillMatch { id: string; p1: string; p2: string; winner: string; date: number; status?: string; loggedAt?: number }

export function backfillTies(
  ties: BackfillTie[], matches: BackfillMatch[], window: { from: number; to: number }, alreadyUsed: Set<string> = new Set(),
): Array<{ tieId: string; match: BackfillMatch }> {
  const used = new Set(alreadyUsed);
  const pool = matches
    .filter((m) => countsAsPlayed(m) && m.winner && m.date >= window.from && m.date <= window.to && !used.has(m.id))
    .sort((a, b) => a.date - b.date || (a.loggedAt ?? 0) - (b.loggedAt ?? 0));
  const open = ties.filter((t) => !t.done && !t.outcome).sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
  const out: Array<{ tieId: string; match: BackfillMatch }> = [];
  for (const t of open) {
    const m = pool.find((x) => !used.has(x.id) && ((x.p1 === t.p1 && x.p2 === t.p2) || (x.p1 === t.p2 && x.p2 === t.p1)));
    if (!m) continue;
    used.add(m.id);
    out.push({ tieId: t.id, match: m });
  }
  return out;
}
