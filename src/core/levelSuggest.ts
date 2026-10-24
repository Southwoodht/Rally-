// When somebody's results say their stars are wrong — a suggestion for an
// organiser, never a change. Sam, 2026-10-24: "it needs to be very accurate".
//
// The Glicko rating already moves on its own with every result; that part is
// earned. The level (and so the stars) is a claim that feeds how every match
// is weighed, so changing it is a person's call. This only says when the
// evidence is strong enough to ask.
//
// Glicko and the level share a scale: a level seeds the rating at
// 1500 + 50 per step from Intermediate / Low (core/glicko.ts), so a rating
// reads straight back as a level. Each level owns the 50 points around its
// seed. A suggestion needs ALL of:
//
//   * a level set (somebody with none has nothing to correct);
//   * SUGGEST_MIN_MATCHES counted matches since their level last changed, so
//     a fresh change is given time and three good wins are not a trend;
//   * the WHOLE of rating ± rd outside their level's band, on one side. With
//     the ± at a typical 90, that means about 115 points (two levels and a
//     bit) clear of the seed: the results are not merely leaning, they rule
//     the current level out.
//
// What it suggests is the level the rating itself sits in.

import { LEVELS, SUBS } from "./constants";
import { levelNow, levelVal, startIndex } from "./levels";
import { countsAsPlayed } from "./matchStatus";

export const SUGGEST_MIN_MATCHES = 5;
const START = 1500, PER_LEVEL = 50, MIDDLE = 6;
const TOP = LEVELS.length * SUBS.length - 1;

const levelOfValue = (v: number) => ({ cat: LEVELS[Math.floor(v / SUBS.length)], sub: SUBS[v % SUBS.length] });

/** The level a rating sits in. */
export function levelForRating(rating: number): { cat: string; sub: string } {
  return levelOfValue(Math.max(0, Math.min(TOP, Math.round(MIDDLE + (rating - START) / PER_LEVEL))));
}

export interface LevelSuggestion {
  playerId: string;
  from: { cat: string; sub: string };
  to: { cat: string; sub: string };
  up: boolean;
  /** Counted matches since the level last changed. */
  matches: number;
  rating: number;
  rd: number;
}

const monthOf = (ts: number) => { const d = new Date(ts); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };

/** When the current level started: the open period of their history, else the beginning. */
function levelSince(player: any): number {
  const h = player?.levelHistory || [];
  const open = h.find((p: any) => p && p.to == null) || h[h.length - 1];
  return open ? startIndex(open.from) : -Infinity;
}

export function levelSuggestion(player: any, rating: number | undefined, rd: number | undefined, matches: any[]): LevelSuggestion | null {
  const cur = levelVal(levelNow(player));
  if (cur == null || rating == null || rd == null) return null;
  const since = levelSince(player);
  const n = matches.filter((m) => countsAsPlayed(m) && (m.p1 === player.id || m.p2 === player.id) && monthOf(m.date) >= since).length;
  if (n < SUGGEST_MIN_MATCHES) return null;
  const seed = START + PER_LEVEL * (cur - MIDDLE);
  const bandLo = seed - PER_LEVEL / 2, bandHi = seed + PER_LEVEL / 2;
  const up = rating - rd > bandHi;
  const down = rating + rd < bandLo;
  if (!up && !down) return null;
  const to = levelForRating(rating);
  if (levelVal(to) === cur) return null;
  return { playerId: player.id, from: levelNow(player), to, up, matches: n, rating, rd };
}

/** Every suggestion in a club, biggest gap first. */
export function levelSuggestions(players: any[], table: { rating: Record<string, number>; rd: Record<string, number> }, matches: any[]): LevelSuggestion[] {
  return players
    .filter((p) => !p.inactive)
    .map((p) => levelSuggestion(p, table.rating[p.id], table.rd[p.id], matches))
    .filter((s): s is LevelSuggestion => !!s)
    .sort((a, b) => Math.abs(levelVal(b.to)! - levelVal(b.from)!) - Math.abs(levelVal(a.to)! - levelVal(a.from)!));
}
