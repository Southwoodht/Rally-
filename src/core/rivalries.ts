// A rivalry is a repeated head-to-head that's actually meaningful — not
// every opponent someone has faced once. Everything here is derived live
// from confirmed matches; nothing is persisted or invented.
export const MIN_RIVALRY_MATCHES = 3;

export interface HeadToHeadStats {
  oid: string;
  total: number;
  w: number;
  d: number;
  l: number;
  streak: { holder: "me" | "opp" | null; count: number };
  lastMeeting: number;
}

function h2hFor(playerId: string, oppId: string, matches: any[]): HeadToHeadStats {
  const ms = matches
    .filter((m) => m.status !== "pending" && ((m.p1 === playerId && m.p2 === oppId) || (m.p1 === oppId && m.p2 === playerId)))
    .sort((a, b) => a.date - b.date);
  let w = 0, d = 0, l = 0;
  ms.forEach((m) => {
    if (m.winner === "draw") d++;
    else if ((m.winner === "p1" && m.p1 === playerId) || (m.winner === "p2" && m.p2 === playerId)) w++;
    else l++;
  });
  let holder: "me" | "opp" | null = null, count = 0;
  for (let i = ms.length - 1; i >= 0; i--) {
    const m = ms[i];
    if (m.winner === "draw") break;
    const thisHolder: "me" | "opp" = (m.winner === "p1" && m.p1 === playerId) || (m.winner === "p2" && m.p2 === playerId) ? "me" : "opp";
    if (holder == null) { holder = thisHolder; count = 1; }
    else if (thisHolder === holder) count++;
    else break;
  }
  return { oid: oppId, total: ms.length, w, d, l, streak: { holder, count }, lastMeeting: ms.length ? ms[ms.length - 1].date : 0 };
}

// Every opponent this player has faced at least MIN_RIVALRY_MATCHES times, most-played first.
export function computeRivalries(playerId: string, matches: any[]): HeadToHeadStats[] {
  const oppIds = new Set<string>();
  matches.forEach((m) => {
    if (m.status === "pending") return;
    if (m.p1 === playerId) oppIds.add(m.p2);
    else if (m.p2 === playerId) oppIds.add(m.p1);
  });
  return Array.from(oppIds)
    .map((oid) => h2hFor(playerId, oid, matches))
    .filter((r) => r.total >= MIN_RIVALRY_MATCHES)
    .sort((a, b) => b.total - a.total);
}

// The single pairing's stats, for the Compare screen — same threshold gate,
// just for the two currently-selected players rather than one player's full list.
export function computeRivalry(a: string, b: string, matches: any[]): HeadToHeadStats | null {
  const r = h2hFor(a, b, matches);
  return r.total >= MIN_RIVALRY_MATCHES ? r : null;
}

// ---------------------------------------------------------------- selection
//
// Which opponents are worth showing as rivalries, as opposed to which you
// have simply played most.
//
// Most-played is what computeRivalries above does, and on real data it puts
// a 4-0 whitewash from 2020 third — a fixture nobody has played in six years
// and which was never close. A rivalry is a repeated, recent, competitive
// pairing, so the score says exactly that and nothing else.

/** Below this it is not a rivalry, it is a couple of games. */
export const RIVALRY_MIN_MEETINGS = 4;
/** Older than this and it is history, however good it was. */
export const RIVALRY_MAX_AGE_MONTHS = 12;
/** How fast an old pairing fades: half its weight every 18 months. */
export const RIVALRY_HALF_LIFE_MONTHS = 18;
/** How much of the score a total whitewash keeps. */
export const RIVALRY_FLOOR = 0.35;

const MONTH = 30.44 * 86400000;

export interface RivalryScore extends HeadToHeadStats {
  score: number;
  /** Most recent meetings, oldest first, up to five. */
  recent: Array<"W" | "D" | "L">;
}

/**
 * The rivalries worth a card, best first.
 *
 * Deliberately returns fewer than `limit` rather than filling the space.
 * Padding a third slot with a 3-0 somebody played twice undermines the
 * section more than a short list does — it teaches the reader that the
 * cards do not mean anything in particular.
 */
export function topRivalries(
  playerId: string,
  matches: any[],
  limit = 3,
  now: number = Date.now(),
): RivalryScore[] {
  // computeRivalries already walks every opponent once; calling it per
  // opponent instead would be the same work squared for no gain.
  const out: RivalryScore[] = [];
  for (const h of computeRivalries(playerId, matches)) {
    if (h.total < RIVALRY_MIN_MEETINGS) continue;
    const months = (now - h.lastMeeting) / MONTH;
    if (months > RIVALRY_MAX_AGE_MONTHS) continue;

    // Closeness, from 1 at dead level to 0 at a whitewash. Draws count as
    // half a win, the same as everywhere else in this app.
    const share = (h.w + h.d * 0.5) / h.total;
    const balance = 1 - 2 * Math.abs(share - 0.5);
    const recency = Math.pow(0.5, months / RIVALRY_HALF_LIFE_MONTHS);
    const score = h.total * (RIVALRY_FLOOR + (1 - RIVALRY_FLOOR) * balance) * recency;

    out.push({ ...h, score, recent: recentOutcomes(playerId, h.oid, matches, 5) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

function recentOutcomes(playerId: string, oppId: string, matches: any[], n: number): Array<"W" | "D" | "L"> {
  return matches
    .filter((m) => m.status !== "pending" && ((m.p1 === playerId && m.p2 === oppId) || (m.p1 === oppId && m.p2 === playerId)))
    .sort((a, b) => a.date - b.date)
    .slice(-n)
    .map((m) => (m.winner === "draw" ? "D" : ((m.winner === "p1" ? m.p1 : m.p2) === playerId ? "W" : "L")));
}
