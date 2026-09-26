/**
 * Turning each kind's stored fixtures and results into what the competition
 * core reads — so one competitions screen can serve singles and doubles
 * without knowing which it is.
 *
 * EACH KIND COUNTS A RESULT BY ITS OWN TABLE'S RULE, so a competition table
 * can never disagree with the main table of the same kind:
 *   - singles uses countsAsPlayed — a logged result counts at once and is
 *     marked unconfirmed (the rule since 10 Sep, core/matchStatus.ts);
 *   - doubles counts confirmed only, as computeDoubles does.
 */
import { countsAsPlayed } from "../matchStatus";
import { orientToWinner, parseSets } from "../sets";
import type { CompetitionPair, CompetitionResult, KnockoutFixture } from "./competition";

// ---------------------------------------------------------------- singles

/** A singles fixture as the league stores it (gdata.fixtures). */
export interface SinglesFixtureLike {
  id: string; p1: string; p2: string; done?: boolean; matchId?: string;
  competitionId?: string; round?: number;
}
/** A singles match as the league stores it (gdata.matches). */
export interface SinglesMatchLike {
  id: string; p1: string; p2: string; winner: "p1" | "p2" | "draw" | string; score?: string; status?: string;
}

/**
 * A singles entry is one player, so a fixture's p1/p2 ARE its two entries —
 * looked up by player rather than stored twice.
 *
 * The result's winner is resolved against the MATCH's own p1/p2, not the
 * fixture's: they are written the same way round today (resolveFixture
 * copies them), but reading the winner off the match by player id means a
 * match edited the other way round still credits the right entry.
 */
export function singlesCompetitionView(
  competitionId: string,
  entries: CompetitionPair[],
  fixtures: SinglesFixtureLike[],
  matches: SinglesMatchLike[],
) {
  const entryOf = new Map(entries.filter((e) => e.competitionId === competitionId).map((e) => [e.p1, e.id]));
  const byMatch = new Map(matches.map((m) => [m.id, m]));
  const mine = fixtures.filter((f) => f.competitionId === competitionId);

  /** 'A' if the fixture's p1 won, 'B' if its p2 did, 'draw', or null (no counted result). */
  const outcome = (f: SinglesFixtureLike): { winner: string; match: SinglesMatchLike } | null => {
    const m = f.matchId ? byMatch.get(f.matchId) : undefined;
    if (!m || !countsAsPlayed(m)) return null;
    if (m.winner === "draw") return { winner: "draw", match: m };
    const winnerId = m.winner === "p1" ? m.p1 : m.p2;
    return { winner: winnerId === f.p1 ? "A" : "B", match: m };
  };

  const ties: KnockoutFixture[] = mine.map((f) => ({
    id: f.id,
    round: f.round ?? null,
    pairA: entryOf.get(f.p1) ?? null,
    pairB: entryOf.get(f.p2) ?? null,
    winner: outcome(f)?.winner ?? null,
  }));

  const results: CompetitionResult[] = [];
  for (const f of mine) {
    const o = outcome(f);
    const a = entryOf.get(f.p1), b = entryOf.get(f.p2);
    if (!o || !a || !b) continue;
    // Sets from the free-text score, oriented to the MATCH's p1, then turned
    // to the fixture's p1. A score that cannot be reconciled with the result
    // counts its points and no sets, rather than a guess.
    const raw = parseSets(o.match.score);
    const oriented = raw ? orientToWinner(raw, o.match.winner as any) : null;
    const flip = o.match.p1 !== f.p1;
    const sets = (oriented || []).map((s) => (flip ? { a: s.b, b: s.a } : s));
    results.push({ pairA: a, pairB: b, winner: o.winner, sets });
  }

  return {
    ties,
    results,
    counts: { unplayed: mine.filter((f) => !f.done).length, played: mine.filter((f) => f.done).length },
    unplayed: mine.filter((f) => !f.done),
  };
}

// ---------------------------------------------------------------- doubles

export interface DoublesFixtureLike {
  id: string; done: boolean; matchId: string | null; competitionId: string | null;
  round: number | null; pairA: string | null; pairB: string | null;
}
export interface DoublesMatchLike {
  id: string; winner: string; status?: string; sets: Array<{ a: number; b: number }>;
  competitionId: string | null; teamAPairId: string | null; teamBPairId: string | null;
}

const confirmed = (m: { status?: string }) => m.status === undefined || m.status === "confirmed";

export function doublesCompetitionView(
  competitionId: string,
  fixtures: DoublesFixtureLike[],
  matches: DoublesMatchLike[],
) {
  const byMatch = new Map(matches.map((m) => [m.id, m]));
  const mine = fixtures.filter((f) => f.competitionId === competitionId);
  const ties: KnockoutFixture[] = mine.map((f) => {
    const m = f.matchId ? byMatch.get(f.matchId) : undefined;
    return { id: f.id, round: f.round, pairA: f.pairA, pairB: f.pairB, winner: m && confirmed(m) ? m.winner : null };
  });
  const played = matches.filter((m) => m.competitionId === competitionId);
  const results: CompetitionResult[] = played
    .filter((m) => m.teamAPairId && m.teamBPairId)
    .map((m) => ({ pairA: m.teamAPairId as string, pairB: m.teamBPairId as string, winner: m.winner, sets: m.sets, status: m.status }));
  return {
    ties,
    results,
    counts: { unplayed: mine.filter((f) => !f.done).length, played: played.length },
    unplayed: mine.filter((f) => !f.done),
  };
}
