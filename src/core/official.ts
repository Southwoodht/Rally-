import { countsAsPlayed } from "./matchStatus";
import { OFFICIAL_LEVEL_TRUST, OFFICIAL_LOSS_MAX, OFFICIAL_LOSS_MIN } from "./constants";
import { levelAt, levelVal } from "./levels";
import { computeRatings, type Edge } from "./rating";

/**
 * The league's Official points: every result judged by how strong the
 * opponent actually is.
 *
 * REBUILT 2026-09-27, Sam's ruling. The old formula was the mean of your five
 * best wins by the opponent's LEVEL, times win rate SQUARED, times activity.
 * Two things were wrong with it, and Sam found both from his own record:
 *
 *  - Level is a dropdown. Zaach was down as Intermediate/Low in January and
 *    his results say he plays like an Advanced, so Charlie's wins over him
 *    counted as ordinary wins, and "a win Jamie or George wouldn't get in
 *    loads of games" was worth the same as beating Jamie.
 *  - Squaring the win rate meant winning OFTEN beat winning WELL. Sam 14-3-6
 *    against mostly easier opponents scored 1.39x Charlie's 11-3-15 against
 *    the hardest schedule in the club, where on Strength they are level.
 *
 * Now:
 *
 *   strength(opp) = (their results x their matches + their level x TRUST)
 *                   / (their matches + TRUST)
 *
 * — the network rating (core/rating.ts, the Strength table) blended with the
 * level they had AT THE TIME, the level counting for OFFICIAL_LEVEL_TRUST
 * matches of evidence. Somebody who has played three times is judged mostly on
 * their level; Zaach, with twenty-five, almost entirely on his results. No
 * level recorded: results only (the 2026-09-06 no-guessing rule).
 *
 *   q        = strength(opp) / club average         (1 = an average opponent)
 *   a win    earns q                                 (beating Zaach ~1.6, Jamie ~0.85)
 *   a loss   costs clamp(2 - q, 0.4, 1.6)           (losing to Zaach is cheap)
 *   a draw   half of each
 *
 *   points   = (earned + 1) / (earned + cost + 2) x n/(n+10) x 100
 *
 * where n is wins plus draws: a loss is not activity (2026-10-21, below).
 *
 * so a win over somebody good is worth more, a loss to somebody good costs
 * less, and playing the best player in the club PAYS rather than costs: on
 * Seacourt 2026 Charlie's thirteen matches against Zaach (3-10) are worth +5.
 *
 * Measured on Seacourt 2026 before shipping (every confirmed match, levels at
 * the date), old → new:
 *
 *   Zaach   18-0-7   85.4 → 59.9
 *   Sam     14-3-6   55.4 → 51.5
 *   Charlie 11-3-15  39.8 → 43.3
 *   Adrian   4-0-5   20.5 → 34.6
 *
 * Nobody changes place; Sam/Charlie goes from 1.39x to 1.19x. The numbers are
 * smaller overall because nothing is squared any more.
 *
 * Only matches between two players in `players` count, the same rule as
 * computeStats — narrowing the roster scopes the results.
 */
/**
 * How strong an opponent was when you played them — the network rating over
 * ALL their results, blended with their level at that date. Hindsight on
 * purpose: by the time anyone reads it, the app knows what a 2019 opponent
 * turned out to be, which a rating-at-the-time cannot (Adrian in 2019 had
 * barely played, so Glicko then called him a guess). Official points and
 * Best wins both read this, so the two can never disagree about who was good.
 */
export function opponentStrength(players: any[], matches: any[]): { strength: (oppId: string, at: number) => number; mean: number } {
  const byId: Record<string, any> = {};
  players.forEach((p) => { byId[p.id] = p; });
  const counted = matches.filter((m) => countsAsPlayed(m) && m.winner && byId[m.p1] && byId[m.p2]);
  const edges: Edge[] = [];
  const played: Record<string, number> = {};
  for (const m of counted) {
    const r1 = m.winner === "draw" ? 0.5 : m.winner === "p1" ? 1 : 0;
    edges.push({ key: m.p1, opp: m.p2, result: r1 });
    edges.push({ key: m.p2, opp: m.p1, result: 1 - r1 });
    played[m.p1] = (played[m.p1] || 0) + 1;
    played[m.p2] = (played[m.p2] || 0) + 1;
  }
  const results = computeRatings(edges);
  const rated = Object.keys(results);
  const mean = rated.length ? rated.reduce((a, k) => a + results[k], 0) / rated.length : 6;
  const strength = (oppId: string, at: number): number => {
    const r = results[oppId];
    const lv = levelVal(levelAt(byId[oppId], at));
    if (lv == null) return r;
    const n = played[oppId] || 0;
    return (n * r + OFFICIAL_LEVEL_TRUST * lv) / (n + OFFICIAL_LEVEL_TRUST);
  };
  return { strength, mean };
}

export function computeOfficial(players: any[], matches: any[], wdl: Record<string, any>): Record<string, number> {
  const byId: Record<string, any> = {};
  players.forEach((p) => { byId[p.id] = p; });
  const counted = matches.filter((m) => countsAsPlayed(m) && m.winner && byId[m.p1] && byId[m.p2]);

  // Strength from results, exactly as the Strength table builds it
  // (opponentStrength above). Win, draw or loss only: scores feed
  // predictions, never ratings (Sam, 2026-10-22).
  const { strength, mean } = opponentStrength(players, matches);

  const earned: Record<string, number> = {};
  const cost: Record<string, number> = {};
  const seen: Record<string, { w: number; d: number; l: number }> = {};
  players.forEach((p) => { earned[p.id] = 0; cost[p.id] = 0; seen[p.id] = { w: 0, d: 0, l: 0 }; });

  for (const m of counted) {
    for (const [me, opp, side] of [[m.p1, m.p2, "p1"], [m.p2, m.p1, "p2"]] as const) {
      const q = strength(opp, m.date) / mean;
      const res = m.winner === "draw" ? 0.5 : m.winner === side ? 1 : 0;
      earned[me] += res * q;
      cost[me] += (1 - res) * Math.max(OFFICIAL_LOSS_MIN, Math.min(OFFICIAL_LOSS_MAX, 2 - q));
      if (res === 1) seen[me].w++; else if (res === 0) seen[me].l++; else seen[me].d++;
    }
  }

  const score: Record<string, number> = {};
  players.forEach((p) => {
    const r = wdl[p.id] || { w: 0, d: 0, l: 0, gp: 0 };
    // Nothing played: the sentinel the table's bar scale reads.
    if (!r.gp) { score[p.id] = -1e6; return; }
    // A carried-in record from onboarding has no matches and so no opponent
    // to weigh: each of those results counts as against an average player.
    const s = seen[p.id];
    const extraW = Math.max(0, r.w - s.w), extraD = Math.max(0, r.d - s.d), extraL = Math.max(0, r.l - s.l);
    // Plus one imaginary win and one imaginary loss against an average
    // player — the same +1/+2 the old formula's win rate carried. Without it
    // an unbeaten record scores 100% whoever it was against: 3-0 over
    // beginners and 3-0 over the best in the club would be the same number,
    // which is exactly the unfairness this rebuild exists to remove. With it,
    // real results pull you away from the middle, harder the better they are.
    const e = earned[p.id] + extraW + 0.5 * extraD + 1;
    const c = cost[p.id] + extraL + 0.5 * extraD + 1;
    // Activity counts what you got something from — wins and draws, carried-in
    // ones included. Not losses: a loss to somebody strong costs as little as
    // 0.4, and while it also added a game of activity, 7 of Seacourt's 115
    // losses RAISED the loser's points (Jamie gained from losing to Sam three
    // times). Sam's ruling, 2026-10-21: "a loss can never raise your Official
    // points". A loss now only ever adds to cost. Measured on the real export
    // first: 0 of 115 such losses after, the 2026 order unchanged, two swaps
    // at the foot of the all-time table, and everyone with losses a little
    // lower (Charlie 40.5 → 32.2, Zaach 64.4 → 60.3).
    const counted = r.w + r.d;
    const activity = counted / (counted + 10);
    // Losses only, and nothing to set against them: zero, as before.
    score[p.id] = earned[p.id] + extraW + extraD > 0 ? (e / (e + c)) * activity * 100 : 0;
  });
  return score;
}
