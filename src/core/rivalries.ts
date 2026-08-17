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
