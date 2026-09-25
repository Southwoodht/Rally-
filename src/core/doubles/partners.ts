import { type DoublesMatch } from "./elo";

/**
 * Who you play doubles with, and how it goes.
 *
 * Drives the Partners card on Profile. Pure, like the rest of core: it takes
 * matches and a player id and returns rows, and knows nothing about a screen.
 */

/** A partner has to have played this many with you to be called your best. */
export const BEST_PARTNER_MINIMUM = 3;

export interface PartnerRow {
  partnerId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  /** 0..1. Draws count as half, as they do everywhere else in the app. */
  winRate: number;
  /** Exactly one row can carry this, and only with enough matches. */
  best: boolean;
}

const counts = (m: DoublesMatch): boolean =>
  m.status === undefined || m.status === "confirmed";

/**
 * One row per partner, most-played first.
 *
 * THE MINIMUM IS WHY `best` IS COMPUTED HERE rather than by the card taking
 * the top row. Sorting is by matches played, so the first row is the person
 * you play most — usually not the person you win most with. Picking "best" by
 * win rate without a floor hands the badge to whoever you happened to win
 * your one match with, which is the same mistake as ranking a player on a
 * single result. Three is the floor the brief sets.
 */
export function partnersOf(matches: DoublesMatch[], playerId: string): PartnerRow[] {
  const acc = new Map<string, { played: number; won: number; drawn: number; lost: number }>();

  for (const m of matches) {
    if (!counts(m)) continue;

    let partner: string | null = null;
    let side: "A" | "B" | null = null;
    if (m.teamA[0] === playerId) { partner = m.teamA[1]; side = "A"; }
    else if (m.teamA[1] === playerId) { partner = m.teamA[0]; side = "A"; }
    else if (m.teamB[0] === playerId) { partner = m.teamB[1]; side = "B"; }
    else if (m.teamB[1] === playerId) { partner = m.teamB[0]; side = "B"; }
    if (!partner || !side) continue;

    const row = acc.get(partner) || { played: 0, won: 0, drawn: 0, lost: 0 };
    row.played++;
    if (m.winner === "draw") row.drawn++;
    else if (m.winner === side) row.won++;
    else row.lost++;
    acc.set(partner, row);
  }

  const rows: PartnerRow[] = Array.from(acc.entries()).map(([partnerId, r]) => ({
    partnerId,
    played: r.played,
    won: r.won,
    drawn: r.drawn,
    lost: r.lost,
    winRate: r.played ? (r.won + r.drawn * 0.5) / r.played : 0,
    best: false,
  }));

  // Most played first; ties broken by win rate, then by id so the order never
  // depends on what order the matches arrived in.
  rows.sort((a, b) =>
    (b.played - a.played) ||
    (b.winRate - a.winRate) ||
    (a.partnerId < b.partnerId ? -1 : a.partnerId > b.partnerId ? 1 : 0));

  let bestIdx = -1;
  let bestRate = -1;
  rows.forEach((r, i) => {
    if (r.played >= BEST_PARTNER_MINIMUM && r.winRate > bestRate) { bestRate = r.winRate; bestIdx = i; }
  });
  if (bestIdx >= 0) rows[bestIdx].best = true;

  return rows;
}

/** The partner you have played most with, for the card's header. Null if none. */
export const mostPlayedWith = (rows: PartnerRow[]): string | null =>
  rows.length ? rows[0].partnerId : null;

/** The partner the Home card calls "Best with" — the badge, not the top row. */
export const bestPartner = (rows: PartnerRow[]): string | null =>
  rows.find((r) => r.best)?.partnerId ?? null;
