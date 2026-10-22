/**
 * Promotion and relegation between divisions, season to season.
 *
 * Sam, 2026-10-22: divisions like football — Division 1 the top tier — and
 * at the end of a season the app should propose next season's divisions so
 * the coach only has to check them and confirm. This is the proposal.
 *
 *   - Divisions are taken top tier first (the caller sorts them by the
 *     number in the name, as the Divisions tab does).
 *   - From every division but the bottom one, the last `moves` go down one.
 *   - From every division but the top one, the first `moves` go up one.
 *   - A small division never swaps more than half its players, so a
 *     division of three with two moves still keeps somebody.
 *   - Within a new division, players are listed in the order they earned:
 *     those relegated into it first (they were in the tier above), then
 *     those who stayed in their finishing order, then those promoted.
 *
 * Nothing is written: the screen shows the proposal, the organiser can move
 * anybody by hand, and only a confirmation creates anything.
 *
 * Pure: no React, no Supabase.
 */

export interface DivisionResult {
  name: string;
  /** Player (or pair) ids in finishing order, first place first. */
  standings: string[];
}

export interface ProposedDivision {
  name: string;
  players: string[];
  /** Arrived from the tier below. */
  up: string[];
  /** Arrived from the tier above. */
  down: string[];
}

export function promotionPlan(divisions: DivisionResult[], moves = 2): ProposedDivision[] {
  const n = divisions.length;
  const moving = divisions.map((d) => Math.max(0, Math.min(moves, Math.floor(d.standings.length / 2))));
  const goingUp = divisions.map((d, i) => (i === 0 ? [] : d.standings.slice(0, moving[i])));
  const goingDown = divisions.map((d, i) => (i === n - 1 ? [] : d.standings.slice(d.standings.length - moving[i])));
  return divisions.map((d, i) => {
    const staying = d.standings.filter((p) => !goingUp[i].includes(p) && !goingDown[i].includes(p));
    const down = i > 0 ? goingDown[i - 1] : [];
    const up = i < n - 1 ? goingUp[i + 1] : [];
    return { name: d.name, players: [...down, ...staying, ...up], up, down };
  });
}

/** Move one player a tier up (-1) or down (+1) in a proposal, by hand. */
export function movePlayer(plan: ProposedDivision[], playerId: string, dir: -1 | 1): ProposedDivision[] {
  const from = plan.findIndex((d) => d.players.includes(playerId));
  const to = from + dir;
  if (from < 0 || to < 0 || to >= plan.length) return plan;
  return plan.map((d, i) => {
    if (i === from) return { ...d, players: d.players.filter((p) => p !== playerId), up: d.up.filter((p) => p !== playerId), down: d.down.filter((p) => p !== playerId) };
    if (i === to) return { ...d, players: dir < 0 ? [...d.players, playerId] : [playerId, ...d.players] };
    return d;
  });
}
