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
  /** An organiser's decision on a tie nobody played (schema_seasons.sql). */
  outcome?: string | null;
  playBy?: string | null;
}

/**
 * Still to be played: no result, no walkover, not void. A walkover is
 * decided and a void is cancelled, so neither is "to play" — they leave the
 * fixtures list and the "left" count.
 */
const isOpen = (f: { done?: boolean; outcome?: string | null }) => !f.done && !f.outcome;

/** Ties still to play, per entry — the table's "Left" column. */
function remainingByEntry(open: Array<{ a: string | null | undefined; b: string | null | undefined }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of open) {
    if (t.a) out[t.a] = (out[t.a] || 0) + 1;
    if (t.b) out[t.b] = (out[t.b] || 0) + 1;
  }
  return out;
}
/** A singles match as the league stores it (gdata.matches). */
export interface SinglesMatchLike {
  id: string; p1: string; p2: string; winner: "p1" | "p2" | "draw" | string; score?: string; status?: string;
  date?: number;
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
  const outcome = (f: SinglesFixtureLike): { winner: string; match: SinglesMatchLike | null } | null => {
    // A walkover is a result for the competition and nothing else: there is
    // no match, so it reaches no rating (Sam, 2026-10-21).
    if (f.outcome === "walkover_p1") return { winner: "A", match: null };
    if (f.outcome === "walkover_p2") return { winner: "B", match: null };
    if (f.outcome === "void") return null;
    const m = f.matchId ? byMatch.get(f.matchId) : undefined;
    if (!m || !countsAsPlayed(m)) return null;
    if (m.winner === "draw") return { winner: "draw", match: m };
    const winnerId = m.winner === "p1" ? m.p1 : m.p2;
    return { winner: winnerId === f.p1 ? "A" : "B", match: m };
  };

  // Sets from the free-text score, oriented to the MATCH's p1, then turned
  // to the fixture's p1. A score that cannot be reconciled with the result
  // counts its points and no sets, rather than a guess.
  const setsOf = (f: SinglesFixtureLike, m: SinglesMatchLike) => {
    const raw = parseSets(m.score);
    const oriented = raw ? orientToWinner(raw, m.winner as any) : null;
    const flip = m.p1 !== f.p1;
    return (oriented || []).map((s) => (flip ? { a: s.b, b: s.a } : s));
  };

  const ties: KnockoutFixture[] = mine.map((f) => {
    const o = outcome(f);
    return {
      id: f.id,
      round: f.round ?? null,
      pairA: entryOf.get(f.p1) ?? null,
      pairB: entryOf.get(f.p2) ?? null,
      winner: o?.winner ?? null,
      ...(o && !o.match ? { walkover: true } : {}),
      ...(o?.match ? { sets: setsOf(f, o.match), ...(o.match.date != null ? { date: o.match.date } : {}) } : {}),
    };
  });

  const results: CompetitionResult[] = [];
  for (const f of mine) {
    const o = outcome(f);
    const a = entryOf.get(f.p1), b = entryOf.get(f.p2);
    if (!o || !a || !b) continue;
    if (!o.match) { results.push({ pairA: a, pairB: b, winner: o.winner, sets: [], walkover: true }); continue; }
    const sets = setsOf(f, o.match);
    results.push({ pairA: a, pairB: b, winner: o.winner, sets, ...(o.match.date != null ? { date: o.match.date } : {}) });
  }

  const open = mine.filter(isOpen);
  return {
    ties,
    results,
    counts: { unplayed: open.length, played: mine.filter((f) => f.done || f.outcome === "walkover_p1" || f.outcome === "walkover_p2").length },
    unplayed: open,
    remaining: remainingByEntry(open.map((f) => ({ a: entryOf.get(f.p1), b: entryOf.get(f.p2) }))),
  };
}

// ---------------------------------------------------------------- doubles

export interface DoublesFixtureLike {
  id: string; done: boolean; matchId: string | null; competitionId: string | null;
  round: number | null; pairA: string | null; pairB: string | null;
  outcome?: string | null;
  playBy?: string | null;
}
export interface DoublesMatchLike {
  id: string; winner: string; status?: string; sets: Array<{ a: number; b: number }>;
  competitionId: string | null; teamAPairId: string | null; teamBPairId: string | null;
  playedAt?: number;
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
    const wo = f.outcome === "walkover_a" ? "A" : f.outcome === "walkover_b" ? "B" : null;
    const counted = !wo && m && confirmed(m) ? m : null;
    // Read the same way round as the winner always has been: the tie's A is
    // the match's team A (DoublesEntry writes them so).
    return {
      id: f.id, round: f.round, pairA: f.pairA, pairB: f.pairB, winner: wo ?? (counted ? counted.winner : null),
      ...(wo ? { walkover: true } : {}),
      ...(counted ? { sets: counted.sets, ...(counted.playedAt != null ? { date: counted.playedAt } : {}) } : {}),
    };
  });
  const played = matches.filter((m) => m.competitionId === competitionId);
  const results: CompetitionResult[] = played
    .filter((m) => m.teamAPairId && m.teamBPairId)
    .map((m) => ({ pairA: m.teamAPairId as string, pairB: m.teamBPairId as string, winner: m.winner, sets: m.sets, status: m.status, ...(m.playedAt != null ? { date: m.playedAt } : {}) }));
  // Walkovers: points in the competition, nothing anywhere else.
  for (const f of mine) {
    if ((f.outcome === "walkover_a" || f.outcome === "walkover_b") && f.pairA && f.pairB) {
      results.push({ pairA: f.pairA, pairB: f.pairB, winner: f.outcome === "walkover_a" ? "A" : "B", sets: [], walkover: true });
    }
  }
  const open = mine.filter(isOpen);
  return {
    ties,
    results,
    counts: { unplayed: open.length, played: played.length + mine.filter((f) => f.outcome === "walkover_a" || f.outcome === "walkover_b").length },
    unplayed: open,
    remaining: remainingByEntry(open.map((f) => ({ a: f.pairA, b: f.pairB }))),
  };
}
