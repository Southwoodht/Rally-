/**
 * The doubles Mixer — a club night's rotation.
 *
 * Sam, 2026-10-23: "Southwood vs Rallio" — Rallio's Mixer rotates partners
 * and courts set by set, and about 70% of Seacourt plays doubles. Give it
 * who turned up, how many courts and how many rounds, and it says who plays
 * with whom on which court, and who sits out.
 *
 * What it tries for, in order of how much each costs:
 *   1. Sitting out is shared: whoever has played most sits next, and nobody
 *      sits twice before everybody has sat once.
 *   2. A new partner every round, as far as the numbers allow.
 *   3. New opponents.
 *   4. Close games: the two pairs' average ratings as near as possible, so a
 *      strong player is paired with a weaker one rather than with another
 *      strong one.
 *
 * Seeded and pure: the same night with the same seed gives the same
 * rotation (so a reload doesn't reshuffle the courts), and "Shuffle" is a
 * new seed. No React, no Supabase, nothing stored — the results people log
 * from it are ordinary doubles matches.
 */

export interface MixerCourt { a: [string, string]; b: [string, string] }
export interface MixerRound { courts: MixerCourt[]; out: string[] }

const PARTNER_REPEAT = 100;
const OPPONENT_REPEAT = 12;
const RATING_GAP = 1 / 40; // per rating point between the two pairs' averages

/** mulberry32: small, fast, good enough to shuffle a club night. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (x: string, y: string) => (x < y ? x + "|" + y : y + "|" + x);

export function mixerRounds(
  players: string[],
  opts: { courts: number; rounds: number; rating?: (id: string) => number; seed?: number; tries?: number },
): MixerRound[] {
  const ids = [...new Set(players)];
  const courts = Math.max(0, Math.min(opts.courts, Math.floor(ids.length / 4)));
  if (!courts) return [];
  const rating = opts.rating || (() => 1500);
  const rand = rng(opts.seed ?? 1);
  const tries = opts.tries ?? 300;

  const played = new Map(ids.map((id) => [id, 0]));
  const sat = new Map(ids.map((id) => [id, 0]));
  const partners = new Map<string, number>();
  const opponents = new Map<string, number>();
  const count = (m: Map<string, number>, x: string, y: string) => m.get(key(x, y)) || 0;

  const pairCost = (a: [string, string], b: [string, string]) =>
    count(partners, a[0], a[1]) * PARTNER_REPEAT + count(partners, b[0], b[1]) * PARTNER_REPEAT
    + (count(opponents, a[0], b[0]) + count(opponents, a[0], b[1]) + count(opponents, a[1], b[0]) + count(opponents, a[1], b[1])) * OPPONENT_REPEAT
    + Math.abs((rating(a[0]) + rating(a[1])) / 2 - (rating(b[0]) + rating(b[1])) / 2) * RATING_GAP;

  /** The best of the three ways to split four players into two pairs. */
  const bestSplit = (q: string[]): { court: MixerCourt; cost: number } => {
    const splits: Array<[[string, string], [string, string]]> = [
      [[q[0], q[1]], [q[2], q[3]]],
      [[q[0], q[2]], [q[1], q[3]]],
      [[q[0], q[3]], [q[1], q[2]]],
    ];
    let best = { court: { a: splits[0][0], b: splits[0][1] }, cost: Infinity };
    for (const [a, b] of splits) {
      const c = pairCost(a, b);
      if (c < best.cost) best = { court: { a, b }, cost: c };
    }
    return best;
  };

  const out: MixerRound[] = [];
  for (let r = 0; r < opts.rounds; r++) {
    // Who sits: whoever has sat out least so far, and among them whoever
    // has played most — so nobody sits twice before everyone has sat once.
    // Ties broken at random, so the same people don't always fill the gap.
    const sitting = ids.length - courts * 4;
    const order = ids
      .map((id) => ({ id, sat: sat.get(id)!, played: played.get(id)!, r: rand() }))
      .sort((x, y) => x.sat - y.sat || y.played - x.played || x.r - y.r);
    const bench = order.slice(0, sitting).map((x) => x.id);
    const benchSet = new Set(bench);
    const on = ids.filter((id) => !benchSet.has(id));

    let best: { courts: MixerCourt[]; cost: number } = { courts: [], cost: Infinity };
    for (let t = 0; t < tries; t++) {
      const shuffled = [...on];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const cs: MixerCourt[] = [];
      let cost = 0;
      for (let c = 0; c < courts; c++) {
        const s = bestSplit(shuffled.slice(c * 4, c * 4 + 4));
        cs.push(s.court);
        cost += s.cost;
      }
      if (cost < best.cost) best = { courts: cs, cost };
    }

    for (const c of best.courts) {
      partners.set(key(c.a[0], c.a[1]), count(partners, c.a[0], c.a[1]) + 1);
      partners.set(key(c.b[0], c.b[1]), count(partners, c.b[0], c.b[1]) + 1);
      for (const x of c.a) for (const y of c.b) opponents.set(key(x, y), count(opponents, x, y) + 1);
      for (const p of [...c.a, ...c.b]) played.set(p, played.get(p)! + 1);
    }
    for (const p of bench) sat.set(p, sat.get(p)! + 1);
    out.push({ courts: best.courts, out: bench });
  }
  return out;
}

/** How many times each pair partnered across the night — for the summary line. */
export function partnerRepeats(rounds: MixerRound[]): number {
  const seen = new Map<string, number>();
  let repeats = 0;
  for (const r of rounds) for (const c of r.courts) for (const p of [c.a, c.b]) {
    const k = key(p[0], p[1]);
    const n = (seen.get(k) || 0) + 1;
    seen.set(k, n);
    if (n > 1) repeats++;
  }
  return repeats;
}
