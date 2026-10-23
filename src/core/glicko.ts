/**
 * Glicko-2 (Glickman, 2012) — a rating with a ± for how sure it is.
 *
 * Sam, 2026-10-22, after the four systems were compared on Seacourt's real
 * history: add it as a table mode beside Official, levels only as the
 * starting point, show the ± and mark a big ± as provisional. Official is
 * not replaced.
 *
 * Why this one: on the real export Official, Elo, Glicko-2 and whole-history
 * all predicted the next result about equally well (68-71% of 115 decided
 * matches — inside the noise), so it was chosen on behaviour. It moves with
 * form, it knows how much it knows (the ± shrinks as you play and grows
 * while you don't), and a level is a starting point and nothing more —
 * none of elo.ts's level-gap multiplier, which §9 of CLAUDE.md measures as
 * lopsided.
 *
 * Three choices that are this app's rather than Glickman's:
 *
 *  - The start. 1500 is the middle, Intermediate/Low (the NEUTRAL the Global
 *    table uses), and each step of the 18-point level scale is 50, so a whole
 *    category is 150 — about a 70% favourite. The level read is the one AT
 *    THE FIRST MATCH, from levelAt(); with none recorded you start at 1500
 *    and a ± of 350, the widest there is, rather than being guessed at.
 *  - Time, not rating periods. Glickman batches results into periods; a club
 *    plays a few times a month, so here every match is its own update and the
 *    ± grows by the volatility for every week you don't play. That is the
 *    recency: a regular's rating is sure of itself, somebody back after two
 *    years is not, and their next few results move them a lot.
 *  - Win, draw or loss only. The score feeds predictions (core/predict.ts),
 *    never a rating — Sam's ruling the same day.
 *
 * Pure: no React, no Supabase.
 */
import { countsAsPlayed } from "./matchStatus";
import { levelAt, levelNow, levelVal } from "./levels";
import { assignRanks, buildH2H } from "./tiebreak";

export const GLICKO_START = 1500;
/** Per step of the 18-point level scale; a category is three steps. */
export const GLICKO_PER_LEVEL = 50;
/** The level that sits at GLICKO_START: 6 is Intermediate/Low. */
export const GLICKO_MIDDLE_LEVEL = 6;
/** Starting ± with a level recorded at your first match, and without. */
export const GLICKO_RD_LEVEL = 200;
export const GLICKO_RD_NO_LEVEL = 350;
export const GLICKO_RD_MAX = 350;
/** Glickman's suggested defaults. */
export const GLICKO_VOLATILITY = 0.06;
export const GLICKO_TAU = 0.5;
/**
 * Above this ± a rating is provisional.
 *
 * 130, Sam's ruling 2026-10-22, once the Table became Glicko only. It was 110
 * (Lichess's line on the same scale), which on Seacourt's real results placed
 * exactly three people — Zaach, Charlie and Sam at ± 87-95 — and listed the
 * rest as provisional, George at 111 and Adrian at 121 among them. At 130 it
 * places 7 of 9 all time and 6 of 9 in the 2026 season; the two left over
 * (± 158 and up) have three or fewer matches in the period.
 */
export const GLICKO_PROVISIONAL_RD = 130;

const SCALE = 173.7178;
const WEEK_MS = 7 * 864e5;

export interface GlickoState { rating: number; rd: number; vol: number }

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));

/**
 * One Glicko-2 update: a player's state after a set of results, each against
 * an opponent as they were before it. Glickman's steps 2-8, unchanged. With
 * no results only the ± grows (step 6), by one period's volatility.
 */
export function glickoUpdate(me: GlickoState, results: Array<{ opp: GlickoState; score: number }>, tau = GLICKO_TAU): GlickoState {
  const mu = (me.rating - GLICKO_START) / SCALE, phi = me.rd / SCALE, sigma = me.vol;
  if (!results.length) return { rating: me.rating, rd: Math.min(GLICKO_RD_MAX, Math.sqrt(phi * phi + sigma * sigma) * SCALE), vol: sigma };
  let vInv = 0, dSum = 0;
  for (const r of results) {
    const muJ = (r.opp.rating - GLICKO_START) / SCALE, gJ = g(r.opp.rd / SCALE);
    const E = 1 / (1 + Math.exp(-gJ * (mu - muJ)));
    vInv += gJ * gJ * E * (1 - E);
    dSum += gJ * (r.score - E);
  }
  const v = 1 / vInv, delta = v * dSum;
  // Step 5: the new volatility, by the Illinois algorithm.
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x), q = phi * phi + v + ex;
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * q * q) - (x - a) / (tau * tau);
  };
  let A = a, B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else { let k = 1; while (f(a - k * tau) < 0) k++; B = a - k * tau; }
  let fA = f(A), fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > 1e-6; i++) {
    const C = A + ((A - B) * fA) / (fB - fA), fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2;
    B = C; fB = fC;
  }
  const vol = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  return { rating: GLICKO_START + SCALE * (mu + phiNew * phiNew * dSum), rd: Math.min(GLICKO_RD_MAX, phiNew * SCALE), vol };
}

/** The ± after `ms` without playing: the volatility, once per week. */
function aged(s: GlickoState, ms: number): GlickoState {
  const weeks = Math.max(0, ms) / WEEK_MS;
  const phi = s.rd / SCALE;
  return { ...s, rd: Math.min(GLICKO_RD_MAX, Math.sqrt(phi * phi + s.vol * s.vol * weeks) * SCALE) };
}

export interface GlickoTable {
  rating: Record<string, number>;
  /** The ± — one standard deviation, Glickman's RD. */
  rd: Record<string, number>;
  provisional: Record<string, boolean>;
}

/**
 * Everybody's Glicko-2 rating over these matches, as of `now`.
 *
 * Only matches between two players in `players` count, the same rule as
 * computeStats — narrowing the roster scopes the results. Matches are taken
 * in date order (then the order they were logged), and both sides of one
 * match are updated from the ratings they walked on court with.
 */
/**
 * Where somebody who has not played yet stands, for predicting games they
 * have not played: their level TODAY as the seed (levelNow — a prediction
 * asks about now, CLAUDE.md §2), or the middle with the widest ± when they
 * have none. For the division prediction, so an unplayed Beginner is not
 * given a made-up 1500.
 */
export function glickoSeed(player: any): { rating: number; rd: number } {
  const lv = levelVal(levelNow(player));
  return lv == null
    ? { rating: GLICKO_START, rd: GLICKO_RD_NO_LEVEL }
    : { rating: GLICKO_START + GLICKO_PER_LEVEL * (lv - GLICKO_MIDDLE_LEVEL), rd: GLICKO_RD_LEVEL };
}

export function computeGlicko(players: any[], matches: any[], now: number = Date.now()): GlickoTable {
  const byId: Record<string, any> = {};
  players.forEach((p) => { byId[p.id] = p; });
  const counted = matches
    .filter((m) => countsAsPlayed(m) && m.winner && byId[m.p1] && byId[m.p2] && m.p1 !== m.p2)
    .sort((x, y) => x.date - y.date || (x.loggedAt || 0) - (y.loggedAt || 0));

  const state: Record<string, GlickoState & { at: number }> = {};
  const at = (id: string, when: number): GlickoState => {
    if (!state[id]) {
      const lv = levelVal(levelAt(byId[id], when));
      state[id] = lv == null
        ? { rating: GLICKO_START, rd: GLICKO_RD_NO_LEVEL, vol: GLICKO_VOLATILITY, at: when }
        : { rating: GLICKO_START + GLICKO_PER_LEVEL * (lv - GLICKO_MIDDLE_LEVEL), rd: GLICKO_RD_LEVEL, vol: GLICKO_VOLATILITY, at: when };
    }
    const s = state[id];
    return aged(s, when - s.at);
  };

  for (const m of counted) {
    const a = at(m.p1, m.date), b = at(m.p2, m.date);
    const s1 = m.winner === "draw" ? 0.5 : m.winner === "p1" ? 1 : 0;
    state[m.p1] = { ...glickoUpdate(a, [{ opp: b, score: s1 }]), at: m.date };
    state[m.p2] = { ...glickoUpdate(b, [{ opp: a, score: 1 - s1 }]), at: m.date };
  }

  const out: GlickoTable = { rating: {}, rd: {}, provisional: {} };
  for (const id of Object.keys(state)) {
    const s = aged(state[id], now - state[id].at);
    out.rating[id] = s.rating;
    out.rd[id] = s.rd;
    out.provisional[id] = s.rd > GLICKO_PROVISIONAL_RD;
  }
  return out;
}

export interface GlickoStandings {
  table: GlickoTable;
  /** Place among the established, ties shared (3, 3, 5) — exactly as the Table prints it. */
  place: Record<string, number>;
  /** How many hold a place. */
  of: number;
  /** placed | provisional (enough matches, ± too wide) | short (too few matches). */
  status: Record<string, "placed" | "provisional" | "short">;
  /** Matches counted per player, for "2 more to rank". */
  played: Record<string, number>;
}

/**
 * Who holds a place, and which, over these matches — the Table's own rules,
 * for anything that prints a place away from the Table (the Home card, your
 * places in other clubs). Same Glicko, same match count, same ± line, same
 * head-to-head tiebreak on the rounded rating, so a place on Home is the place
 * on the Table.
 *
 * `eligible` is who the view lists at all: the Table's default is people who
 * are not marked inactive and have played in the last twelve months.
 */
export function glickoStandings(
  players: any[], matches: any[],
  opts: { minGames: number; eligible?: (id: string) => boolean; now?: number },
): GlickoStandings {
  const table = computeGlicko(players, matches, opts.now);
  const ids = new Set(players.map((p) => p.id));
  const played: Record<string, number> = {};
  const w: Record<string, number> = {}, d: Record<string, number> = {}, l: Record<string, number> = {};
  for (const m of matches) {
    if (!countsAsPlayed(m) || !m.winner || !ids.has(m.p1) || !ids.has(m.p2)) continue;
    for (const [me, side] of [[m.p1, "p1"], [m.p2, "p2"]] as const) {
      played[me] = (played[me] || 0) + 1;
      if (m.winner === "draw") d[me] = (d[me] || 0) + 1;
      else if (m.winner === side) w[me] = (w[me] || 0) + 1;
      else l[me] = (l[me] || 0) + 1;
    }
  }
  const status: GlickoStandings["status"] = {};
  const placed: string[] = [];
  for (const id of Object.keys(table.rating)) {
    if (opts.eligible && !opts.eligible(id)) continue;
    if ((played[id] || 0) < opts.minGames) status[id] = "short";
    else if (table.provisional[id]) status[id] = "provisional";
    else { status[id] = "placed"; placed.push(id); }
  }
  const ranked = assignRanks(
    placed.map((id) => ({ id, name: id, score: Math.round(table.rating[id]), w: w[id] || 0, d: d[id] || 0, l: l[id] || 0 })),
    buildH2H(matches),
  );
  const place: Record<string, number> = {};
  for (const r of ranked) place[r.id] = r.rank;
  return { table, place, of: placed.length, status, played };
}
