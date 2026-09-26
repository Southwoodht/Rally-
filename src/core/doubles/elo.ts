/**
 * Doubles Elo.
 *
 * A SEPARATE ENGINE, NOT A GENERALISED ONE. 39 files and 361 references in
 * this codebase assume a match has exactly p1 and p2; widening that would
 * touch every rating, every screen and every test at once, on a live app with
 * no CI. So doubles is built beside singles and shares nothing mutable with
 * it. Singles behaviour is unchanged by construction: nothing here is
 * imported by anything singles reads.
 *
 * IT IS ALSO A DIFFERENT SCALE FROM SINGLES, deliberately. Singles Elo starts
 * at START_ELO = 0 and carries a level-gap multiplier with LV_MIN 0.05 and
 * LV_MAX 4.0 — the asymmetry CLAUDE.md section 9 calls genuinely broken.
 * Doubles starts at 1500, uses plain Elo with no level term at all, and is
 * therefore not comparable to a singles number. Never put the two in the same
 * column.
 *
 * NOTHING IS STORED. Ratings are derived from the match list in played_at
 * order, exactly as computeStats derives singles. That is Sam's ruling and it
 * has a consequence worth stating: "recompute after an edit" is not a special
 * path here, it is the only path. A stored rating can disagree with the
 * replay after a failed write and give no way to tell which is wrong; a
 * derived one cannot.
 */

/** Everyone starts here. Not START_ELO, which is 0 — see the header. */
export const DOUBLES_START = 1500;

/** Under this many confirmed doubles matches you are provisional. */
export const DOUBLES_PROVISIONAL_GAMES = 5;

/** K while provisional, and after. */
export const K_PROVISIONAL = 32;
export const K_ESTABLISHED = 24;

/**
 * A player slot. NULL MEANS "SOMEBODY NOBODY COULD NAME" -- an opponent's
 * partner you had never met. Sam's ruling, 26 Sep 2026: an unknown player
 * counts as DOUBLES_START (where every new player begins) in their team's
 * average, so the three people who ARE known move exactly as they would
 * against any newcomer, and the unknown gets no rating, no record, and no
 * row on any table. Only the second seat on a team can be empty: the entry
 * screen enforces it and so does the database.
 *
 * Not a shared "Unknown" player row, which would be the thing the doubles
 * plan says never to do: one fake id collecting a rating from every stranger
 * in the club, and rising up the table as if it were a person.
 */
export type DoublesSlot = string | null;

export interface DoublesMatch {
  id: string;
  playedAt: number;
  teamA: [string, DoublesSlot];
  teamB: [string, DoublesSlot];
  /** 'A' | 'B' | 'draw' */
  winner: string;
  status?: string;
}

export interface DoublesDelta {
  matchId: string;
  playerId: string;
  before: number;
  after: number;
  delta: number;
  k: number;
}

export interface DoublesStats {
  /** Current rating per player. Every player who has played appears. */
  elo: Record<string, number>;
  played: Record<string, number>;
  won: Record<string, number>;
  lost: Record<string, number>;
  drawn: Record<string, number>;
  currentStreak: Record<string, number>;
  bestStreak: Record<string, number>;
  /** Every rating change, in order — the audit trail, derived not stored. */
  deltas: DoublesDelta[];
}

/**
 * The expected score for team A.
 *
 * Standard Elo on the two team averages. Both partners share this number —
 * they played the same match against the same opposition — and then each
 * applies their OWN K, which is what lets a provisional player move faster
 * than their established partner off the same result.
 */
export function expectedA(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

const scoreFor = (winner: string, team: "A" | "B"): number => {
  if (winner === "draw") return 0.5;
  return winner === team ? 1 : 0;
};

/**
 * Only confirmed matches count, which is the rule everywhere else in the app.
 * A pending result is one person's claim, and CLAUDE.md section 7 records what
 * it costs when a list and its total disagree about that.
 */
const counts = (m: DoublesMatch): boolean =>
  m.status === undefined || m.status === "confirmed";

/**
 * Replay every doubles match in played_at order.
 *
 * Ties on played_at are broken by id so the result is deterministic — two
 * matches logged in the same second must not rank differently depending on
 * what order the database handed them back.
 */
export interface DoublesSeed {
  /** Rating a player walks in on, instead of DOUBLES_START. */
  elo?: Record<string, number>;
  /** Matches already played, which is what decides their K. */
  played?: Record<string, number>;
}

/**
 * `seed` mirrors what singles does with players.initial_elo and
 * initial_record: a club that has been playing doubles for years can carry a
 * starting position in rather than pretending everyone began at 1500 today.
 * It is also what makes the brief's worked example testable exactly, instead
 * of by constructing a history that happens to land on those four numbers.
 */
export function computeDoubles(matches: DoublesMatch[], seed?: DoublesSeed): DoublesStats {
  const elo: Record<string, number> = { ...(seed?.elo || {}) };
  const played: Record<string, number> = { ...(seed?.played || {}) };
  const won: Record<string, number> = {};
  const lost: Record<string, number> = {};
  const drawn: Record<string, number> = {};
  const currentStreak: Record<string, number> = {};
  const bestStreak: Record<string, number> = {};
  const deltas: DoublesDelta[] = [];

  const rating = (id: DoublesSlot): number => (id != null && id in elo ? elo[id] : DOUBLES_START);
  const bump = (r: Record<string, number>, id: string, by = 1) => {
    r[id] = (r[id] || 0) + by;
  };

  const order = matches
    .filter(counts)
    .slice()
    .sort((x, y) => (x.playedAt - y.playedAt) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

  for (const m of order) {
    const a = m.teamA;
    const b = m.teamB;
    for (const id of [...a, ...b]) if (id != null && !(id in elo)) elo[id] = DOUBLES_START;

    const ratingA = (rating(a[0]) + rating(a[1])) / 2;
    const ratingB = (rating(b[0]) + rating(b[1])) / 2;
    const eA = expectedA(ratingA, ratingB);
    const eB = 1 - eA;

    // Every K is read BEFORE any rating moves, from the match counts as they
    // stood walking on court. Applying A's change and then computing B's K
    // from an updated count would make the result depend on which team the
    // loop happened to handle first.
    const sides: Array<{ ids: [string, DoublesSlot]; e: number; s: number; team: "A" | "B" }> = [
      { ids: a, e: eA, s: scoreFor(m.winner, "A"), team: "A" },
      { ids: b, e: eB, s: scoreFor(m.winner, "B"), team: "B" },
    ];

    const pending: DoublesDelta[] = [];
    for (const side of sides) {
      for (const id of side.ids) {
        if (id == null) continue; // an unknown player is never rated
        const k = (played[id] || 0) < DOUBLES_PROVISIONAL_GAMES ? K_PROVISIONAL : K_ESTABLISHED;
        const before = rating(id);
        const delta = k * (side.s - side.e);
        pending.push({ matchId: m.id, playerId: id, before, after: before + delta, delta, k });
      }
    }

    for (const d of pending) {
      elo[d.playerId] = d.after;
      deltas.push(d);
    }

    for (const side of sides) {
      for (const id of side.ids) {
        if (id == null) continue;
        bump(played, id);
        if (m.winner === "draw") {
          bump(drawn, id);
          // A draw ends a streak without starting one the other way. Singles
          // does the same: a streak is a run of the same outcome, and a draw
          // is neither.
          currentStreak[id] = 0;
        } else if (m.winner === side.team) {
          bump(won, id);
          currentStreak[id] = Math.max(0, currentStreak[id] || 0) + 1;
          bestStreak[id] = Math.max(bestStreak[id] || 0, currentStreak[id]);
        } else {
          bump(lost, id);
          currentStreak[id] = Math.min(0, currentStreak[id] || 0) - 1;
        }
      }
    }
  }

  return { elo, played, won, lost, drawn, currentStreak, bestStreak, deltas };
}

/** Whether a player is still provisional, given the stats above. */
export const isProvisional = (s: DoublesStats, id: string): boolean =>
  (s.played[id] || 0) < DOUBLES_PROVISIONAL_GAMES;

/**
 * What a match WOULD do, without recording it — for the live rating strip on
 * the entry screen.
 *
 * It replays the real history and then appends the hypothetical, so the
 * preview cannot drift from what saving actually produces: it is the same
 * function on the same data with one more row.
 */
export function previewDoubles(
  history: DoublesMatch[],
  hypothetical: Omit<DoublesMatch, "id" | "playedAt"> & { playedAt?: number },
  seed?: DoublesSeed,
): DoublesDelta[] {
  const probe: DoublesMatch = {
    id: "￿-preview",
    playedAt: hypothetical.playedAt ?? Date.now(),
    teamA: hypothetical.teamA,
    teamB: hypothetical.teamB,
    winner: hypothetical.winner,
    status: "confirmed",
  };
  const full = computeDoubles([...history, probe], seed);
  return full.deltas.filter((d) => d.matchId === probe.id);
}

/** Displayed deltas are whole numbers; stored ones are not. */
export const showDelta = (d: number): string =>
  (d > 0 ? "+" : d < 0 ? "−" : "") + Math.abs(Math.round(d)).toString();

/**
 * The odds for a booked doubles match.
 *
 * DOUBLES RATING ONLY — no head-to-head blend, which is what singles does.
 * Sam's instruction, and the reason is sample size: singles H2H asks "how do
 * these two players do against each other" and a club has years of that.
 * Doubles H2H asks about a PAIR against a PAIR, and with four people per
 * match the number of distinct pairings explodes while the matches stay the
 * same — most pair-versus-pair records are zero or one game, which is noise
 * that would swamp the rating rather than refine it.
 *
 * Returns team A's probability. Identical maths to expectedA, which is also
 * what actually moves the ratings afterwards, so the prediction and the
 * consequence cannot disagree.
 */
export function predictDoubles(
  teamA: [string, DoublesSlot],
  teamB: [string, DoublesSlot],
  stats: DoublesStats,
): number {
  const r = (id: DoublesSlot) => (id != null && stats.elo[id] !== undefined ? stats.elo[id] : DOUBLES_START);
  return expectedA((r(teamA[0]) + r(teamA[1])) / 2, (r(teamB[0]) + r(teamB[1])) / 2);
}
