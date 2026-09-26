/**
 * Doubles competitions — the schedule, the draw and the table.
 *
 * Pure: no React, no Supabase. Every function here takes what is stored and
 * derives what is shown, so the bracket and the table are never stored
 * anywhere to go stale — the same principle as the ratings themselves.
 */

export type CompetitionFormat = "league" | "knockout";
/** Singles competitions use exactly the same schedule, draw and table. */
export type CompetitionKind = "doubles" | "singles";

export interface Competition {
  id: string;
  leagueId: string;
  name: string;
  kind: CompetitionKind;
  format: CompetitionFormat;
  /** League: how many times each pair plays each other. */
  legs: number;
  pointsWin: number;
  pointsDraw: number;
  status: "running" | "finished";
  createdBy: string | null;
  createdAt: number;
}

export interface CompetitionPair {
  id: string;
  competitionId: string;
  p1: string;
  /** Null for a singles entry, which is one player. */
  p2: string | null;
  /** 1 is top. */
  seed: number;
}

/** A tie to create: pairs by id, and the round it belongs to. */
export interface Tie { round: number; pairA: string; pairB: string }

// ---------------------------------------------------------------------------
// League: round robin
// ---------------------------------------------------------------------------

/**
 * Every pair plays every other pair `legs` times, in rounds where nobody
 * plays twice — the circle method. An odd field gets a rest each round
 * rather than a phantom opponent.
 *
 * On the second leg the sides swap, so "home" (team A, whose games are
 * written first) alternates. It only affects which way round a scoreline
 * reads, but a fixture list that always puts the same pair first looks like
 * a mistake.
 */
export function roundRobin(pairIds: string[], legs = 1): Tie[] {
  if (pairIds.length < 2) return [];
  const slots: Array<string | null> = pairIds.slice();
  if (slots.length % 2) slots.push(null);
  const n = slots.length;
  const rounds = n - 1;
  const ties: Tie[] = [];

  for (let leg = 0; leg < legs; leg++) {
    const rot = slots.slice();
    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < n / 2; i++) {
        const a = rot[i], b = rot[n - 1 - i];
        if (a === null || b === null) continue;
        // Alternate within a leg too, so the first slot is not "home" in
        // every single round.
        const flip = (r % 2 === 1 && i === 0) !== (leg % 2 === 1);
        ties.push({ round: leg * rounds + r + 1, pairA: flip ? b : a, pairB: flip ? a : b });
      }
      // Keep the first slot fixed, rotate the rest one place.
      rot.splice(1, 0, rot.pop() as string | null);
    }
  }
  return ties;
}

// ---------------------------------------------------------------------------
// Knockout: a seeded draw with byes
// ---------------------------------------------------------------------------

/**
 * Seed positions in a bracket of `size` (a power of two): 1 and 2 can only
 * meet in the final, 1-4 only in the semis, and so on. [1,8,4,5,2,7,3,6] for 8.
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const s = order.length * 2;
    order = order.flatMap((x) => [x, s + 1 - x]);
  }
  return order;
}

export const bracketSize = (n: number): number => {
  let s = 1;
  while (s < n) s *= 2;
  return Math.max(s, 2);
};

/** One tie in the bracket as it currently stands. */
export interface BracketTie {
  round: number;
  /** Pair id; null for a bye; undefined while the previous tie is unplayed. */
  a: string | null | undefined;
  b: string | null | undefined;
  /** The pair that went through, once known. A bye walks the other side through. */
  winner: string | null | undefined;
  /** The stored fixture for this tie, if it has been drawn. */
  fixtureId?: string;
}

export interface KnockoutFixture {
  id: string;
  round: number | null;
  pairA: string | null;
  pairB: string | null;
  /** 'A' | 'B' | 'draw' | null — from the result, when there is one. */
  winner: string | null;
}

/**
 * The whole bracket, derived from the pairs and the fixtures played so far.
 *
 * Nothing about the bracket is stored beyond the fixtures themselves: round
 * one is the seeding, and every later slot is simply "whoever won the tie
 * feeding it". So correcting a result corrects the bracket, with nothing to
 * repair by hand.
 *
 * A drawn knockout result advances nobody — the screen refuses to save one,
 * but if one arrives from elsewhere the tie simply stays open.
 */
export function knockoutBracket(pairs: CompetitionPair[], fixtures: KnockoutFixture[]): BracketTie[][] {
  if (pairs.length < 2) return [];
  const bySeed = pairs.slice().sort((x, y) => x.seed - y.seed);
  const size = bracketSize(bySeed.length);
  let slots: Array<string | null | undefined> = seedOrder(size).map((s) => bySeed[s - 1]?.id ?? null);

  const findFixture = (round: number, a: string, b: string) =>
    fixtures.find((f) => f.round === round &&
      ((f.pairA === a && f.pairB === b) || (f.pairA === b && f.pairB === a)));

  const rounds: BracketTie[][] = [];
  for (let round = 1; slots.length > 1; round++) {
    const ties: BracketTie[] = [];
    for (let i = 0; i < slots.length; i += 2) {
      const a = slots[i], b = slots[i + 1];
      let winner: string | null | undefined;
      let fixtureId: string | undefined;
      if (a === undefined || b === undefined) winner = undefined;       // waiting on an earlier tie
      else if (a === null && b === null) winner = null;                 // two byes: nobody
      else if (a === null) winner = b;                                  // bye
      else if (b === null) winner = a;
      else {
        const f = findFixture(round, a, b);
        fixtureId = f?.id;
        if (!f || !f.winner || f.winner === "draw") winner = undefined;
        else winner = f.winner === "A" ? f.pairA : f.pairB;
      }
      ties.push({ round, a, b, winner, fixtureId });
    }
    rounds.push(ties);
    slots = ties.map((t) => t.winner);
  }
  return rounds;
}

/** Ties whose two pairs are both known and which have no fixture yet. */
export function tiesReadyToDraw(bracket: BracketTie[][]): Tie[] {
  const out: Tie[] = [];
  for (const round of bracket) {
    for (const t of round) {
      if (typeof t.a === "string" && typeof t.b === "string" && !t.fixtureId) {
        out.push({ round: t.round, pairA: t.a, pairB: t.b });
      }
    }
  }
  return out;
}

/** The winner of the final, once there is one. */
export const champion = (bracket: BracketTie[][]): string | null => {
  const last = bracket[bracket.length - 1];
  const w = last?.[0]?.winner;
  return typeof w === "string" ? w : null;
};

/** "Final", "Semi-finals", "Quarter-finals", else "Round 2". */
export function roundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi-finals";
  if (fromEnd === 2) return "Quarter-finals";
  return `Round ${round}`;
}

// ---------------------------------------------------------------------------
// League table
// ---------------------------------------------------------------------------

export interface CompetitionResult {
  /** Pair ids as stored on the match: team A's pair and team B's. */
  pairA: string;
  pairB: string;
  winner: string; // 'A' | 'B' | 'draw'
  sets: Array<{ a: number; b: number }>;
  status?: string;
}

export interface TableRow {
  pairId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
}

/**
 * Points, then set difference, then games difference. Pairs that cannot be
 * separated by any of those share a place — `place` on each row says so,
 * the 3, 3, 5 convention the singles table uses.
 *
 * A result entered with no score (Sam's "don't know the score") counts its
 * points and nothing towards sets or games, which is the honest reading:
 * it happened, and nobody knows by how much.
 *
 * Confirmed only, as everywhere else.
 */
export function leagueTable(
  pairs: CompetitionPair[], results: CompetitionResult[], pointsWin: number, pointsDraw: number,
): Array<TableRow & { place: number }> {
  const rows = new Map<string, TableRow>();
  for (const p of pairs) {
    rows.set(p.id, { pairId: p.id, played: 0, won: 0, drawn: 0, lost: 0, points: 0, setsFor: 0, setsAgainst: 0, gamesFor: 0, gamesAgainst: 0 });
  }
  for (const r of results) {
    if (r.status !== undefined && r.status !== "confirmed") continue;
    const A = rows.get(r.pairA), B = rows.get(r.pairB);
    if (!A || !B) continue;
    A.played++; B.played++;
    if (r.winner === "draw") { A.drawn++; B.drawn++; A.points += pointsDraw; B.points += pointsDraw; }
    else if (r.winner === "A") { A.won++; B.lost++; A.points += pointsWin; }
    else { B.won++; A.lost++; B.points += pointsWin; }
    for (const s of r.sets || []) {
      if (s.a > s.b) { A.setsFor++; B.setsAgainst++; }
      else if (s.b > s.a) { B.setsFor++; A.setsAgainst++; }
      A.gamesFor += s.a; A.gamesAgainst += s.b;
      B.gamesFor += s.b; B.gamesAgainst += s.a;
    }
  }
  const seedOf = new Map(pairs.map((p) => [p.id, p.seed]));
  const key = (r: TableRow) => [r.points, r.setsFor - r.setsAgainst, r.gamesFor - r.gamesAgainst];
  const sorted = Array.from(rows.values()).sort((x, y) => {
    const kx = key(x), ky = key(y);
    for (let i = 0; i < kx.length; i++) if (kx[i] !== ky[i]) return ky[i] - kx[i];
    // Orders but never ranks: entry order, so the list is stable.
    return (seedOf.get(x.pairId) ?? 0) - (seedOf.get(y.pairId) ?? 0);
  });
  let place = 0;
  return sorted.map((r, i) => {
    const prev = sorted[i - 1];
    const tied = prev && key(prev).every((v, j) => v === key(r)[j]);
    if (!tied) place = i + 1;
    return { ...r, place };
  });
}
