// Set-by-set scores.
//
// These live inside the existing free-text `score` column as "6-2, 6-3, 6-2"
// rather than a new column, which means no migration and no schema change:
// the string is still readable everywhere it's already displayed, and the
// four scores that existed before this ("6-4", "7-3", "8-0", "12-2") parse
// as a single set for free.
//
// Direction is the one trap. Going forward the UI always writes p1's games
// first. But the old free-text scores had no convention — "6-4" is stored on
// a match p2 won, so reading it p1-first would say the loser took more games
// than the winner. So nothing here assumes direction: parseSets returns the
// numbers as written, and orientToWinner works out which way round they must
// have been meant. A score that can't be reconciled with the result is
// treated as unusable rather than guessed at.

export interface SetScore { a: number; b: number }

const SET_RE = /^\s*(\d{1,3})\s*[-–—]\s*(\d{1,3})\s*$/;

/** The numbers exactly as written, or null if this isn't a set score. */
export function parseSets(score: string | null | undefined): SetScore[] | null {
  if (!score || !score.trim()) return null;
  const parts = score.split(",");
  const out: SetScore[] = [];
  for (const part of parts) {
    const m = SET_RE.exec(part);
    if (!m) return null;
    out.push({ a: parseInt(m[1], 10), b: parseInt(m[2], 10) });
  }
  return out.length ? out : null;
}

export const formatSets = (sets: SetScore[]): string => sets.map((s) => `${s.a}-${s.b}`).join(", ");

/** Total games each side took across every set. */
export function gameTotals(sets: SetScore[]): { a: number; b: number } {
  return sets.reduce((acc, s) => ({ a: acc.a + s.a, b: acc.b + s.b }), { a: 0, b: 0 });
}

/**
 * Sets oriented so `a` is p1, using the recorded winner to resolve which way
 * round a legacy score was written. Returns null when the two can't be
 * reconciled — a 6-4, 6-4 on a drawn match, say — because a score that
 * disagrees with the result is more likely mistyped than meaningful, and
 * guessing at it would quietly put a wrong number into someone's record.
 */
export function orientToWinner(sets: SetScore[], winner: "p1" | "p2" | "draw"): SetScore[] | null {
  const t = gameTotals(sets);
  if (winner === "draw") return t.a === t.b ? sets : null;
  if (t.a === t.b) return null;
  const p1Ahead = t.a > t.b;
  if (winner === "p1") return p1Ahead ? sets : sets.map((s) => ({ a: s.b, b: s.a }));
  return p1Ahead ? sets.map((s) => ({ a: s.b, b: s.a })) : sets;
}

/**
 * How much of the match a player actually took, 0 to 1, or null when the
 * score is missing or unusable. 0.5 is dead even.
 *
 * This is a share rather than a difference on purpose: Rally covers several
 * racket sports and a game means a different thing in each, so 11-0 squash,
 * 21-0 badminton and 6-0 tennis all have to land on the same number. A ratio
 * does that; a margin in games would rate the badminton player highest for
 * doing the same thing.
 */
export function gamesShare(sets: SetScore[], forP1: boolean): number | null {
  const t = gameTotals(sets);
  const total = t.a + t.b;
  if (!total) return null;
  return (forP1 ? t.a : t.b) / total;
}

/**
 * The share for a player who knows their own result but not which side of
 * the match they were written as — an edge row from global_edges() is one
 * player, one opponent and a 1/0.5/0, with no p1 or p2 in it.
 *
 * Same discipline as orientToWinner: the numbers are read as written and
 * resolved against the result, and a score that can't be reconciled with it
 * is refused rather than guessed at.
 */
export function shareForResult(score: string | null | undefined, result: number): number | null {
  const parsed = parseSets(score);
  if (!parsed) return null;
  const t = gameTotals(parsed);
  const total = t.a + t.b;
  if (!total) return null;
  if (result === 0.5) return t.a === t.b ? 0.5 : null;
  if (t.a === t.b) return null;
  const hi = Math.max(t.a, t.b), lo = Math.min(t.a, t.b);
  return (result === 1 ? hi : lo) / total;
}

/** The share for one player id on a match, or null if it can't be worked out. */
export function shareForPlayer(match: any, playerId: string): number | null {
  const raw = parseSets(match?.score);
  if (!raw) return null;
  const oriented = orientToWinner(raw, match.winner);
  if (!oriented) return null;
  if (match.p1 === playerId) return gamesShare(oriented, true);
  if (match.p2 === playerId) return gamesShare(oriented, false);
  return null;
}
