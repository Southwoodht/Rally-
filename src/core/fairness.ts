/**
 * The rating fairness check (brief item 3). Investigation only: nothing here
 * changes how anybody is rated.
 *
 * The concern, in the brief's words: "a player who loses about 9 in 10 to
 * the top player may be gaining rating from the volume of those matches."
 * Two questions, answered from the real results rather than argued:
 *
 *   1. For everybody who has played the top player: what is each rating with
 *      their matches against the top player, and what would it be with those
 *      matches taken out? Everybody else's matches stay exactly as they are.
 *   2. Can a loss ever RAISE someone's Official rating? Every loss in the
 *      data is taken out on its own and the rating recomputed; any loss whose
 *      removal lowers the rating is a loss that raised it.
 *
 * All three ratings are reported — Official (the table's default), Elo, and
 * Strength (the network rating) — because they answer differently and the
 * brief asks about "rating" without saying which.
 *
 * Pure: no React, no Supabase.
 */
import { computeStats } from "./elo";
import { countsAsPlayed } from "./matchStatus";
import { computeOfficial } from "./official";
import { computeRatings, type Edge } from "./rating";

export interface Ratings { official: Record<string, number>; elo: Record<string, number>; strength: Record<string, number> }

/** Official, Elo and Strength over one set of matches — the table's three. */
export function ratingsFor(players: any[], matches: any[]): Ratings {
  const counted = matches.filter((m) => countsAsPlayed(m));
  const stats = computeStats(players, counted);
  const official = computeOfficial(players, counted, stats.wdl);
  const edges: Edge[] = [];
  for (const m of counted) {
    if (!m.winner) continue;
    const r1 = m.winner === "draw" ? 0.5 : m.winner === "p1" ? 1 : 0;
    edges.push({ key: m.p1, opp: m.p2, result: r1 });
    edges.push({ key: m.p2, opp: m.p1, result: 1 - r1 });
  }
  const raw = computeRatings(edges);
  const strength: Record<string, number> = {};
  for (const k of Object.keys(raw)) strength[k] = raw[k] * 100; // the table's scale (§10)
  return { official, elo: stats.elo, strength };
}

export interface TopPlayerRow {
  playerId: string;
  /** Their record against the top player. */
  w: number; d: number; l: number;
  with: { official: number; elo: number; strength: number };
  without: { official: number; elo: number; strength: number };
}

export interface FairnessReport {
  topId: string | null;
  rows: TopPlayerRow[];
  /** Every loss that, taken out on its own, LOWERS the loser's Official. */
  lossesThatRaisedOfficial: Array<{ matchId: string; playerId: string; opponentId: string; by: number }>;
  lossesChecked: number;
}

const r1 = (n: number | undefined) => Math.round((n ?? 0) * 10) / 10;

/**
 * The check. "Top" is whoever leads Official over these matches, the table's
 * default order; pass `topId` to ask about somebody else.
 */
export function fairnessReport(players: any[], matches: any[], topId?: string): FairnessReport {
  const counted = matches.filter((m) => countsAsPlayed(m));
  const all = ratingsFor(players, counted);
  const top = topId ?? (Object.entries(all.official).filter(([, v]) => v > -1e5).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null);
  const rows: TopPlayerRow[] = [];
  if (top) {
    const opponents = new Set<string>();
    for (const m of counted) {
      if (m.p1 === top) opponents.add(m.p2);
      if (m.p2 === top) opponents.add(m.p1);
    }
    for (const pid of opponents) {
      const vsTop = (m: any) => (m.p1 === pid && m.p2 === top) || (m.p2 === pid && m.p1 === top);
      const theirs = counted.filter(vsTop);
      const w = theirs.filter((m) => (m.winner === "p1" ? m.p1 : m.winner === "p2" ? m.p2 : null) === pid).length;
      const d = theirs.filter((m) => m.winner === "draw").length;
      const without = ratingsFor(players, counted.filter((m) => !vsTop(m)));
      rows.push({
        playerId: pid, w, d, l: theirs.length - w - d,
        with: { official: r1(all.official[pid]), elo: r1(all.elo[pid]), strength: r1(all.strength[pid]) },
        without: { official: r1(without.official[pid]), elo: r1(without.elo[pid]), strength: r1(without.strength[pid]) },
      });
    }
    rows.sort((a, b) => (b.l + b.w + b.d) - (a.l + a.w + a.d));
  }

  // Question 2, one loss at a time.
  const raised: FairnessReport["lossesThatRaisedOfficial"] = [];
  let checked = 0;
  for (const m of counted) {
    if (m.winner !== "p1" && m.winner !== "p2") continue;
    const loser = m.winner === "p1" ? m.p2 : m.p1;
    const winner = m.winner === "p1" ? m.p1 : m.p2;
    checked++;
    const without = ratingsFor(players, counted.filter((x) => x !== m));
    const delta = (all.official[loser] ?? 0) - (without.official[loser] ?? 0);
    if (delta > 1e-6 && (without.official[loser] ?? 0) > -1e5) raised.push({ matchId: m.id, playerId: loser, opponentId: winner, by: r1(delta) });
  }
  raised.sort((a, b) => b.by - a.by);
  return { topId: top, rows, lossesThatRaisedOfficial: raised, lossesChecked: checked };
}
