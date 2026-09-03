import { levelAt, levelVal } from "@/core/levels";

// How tough the opponent was, at the time — not how the match went. Same
// six-colour scale for a win, a loss, or a draw, because the thing this is
// actually answering is "was this a real test", and that's a property of
// the opponent's level relative to yours, not the result. A profile
// dominated by red — regardless of win/loss — means the competition wasn't
// testing them. Always computed from levelAt(player, matchDate), never
// today's level — an old result is only as impressive as who the opponent
// was back then.

export type Tier = "gold" | "silver" | "blue" | "green" | "orange" | "red" | "muted";

// Hex, not a design-system token — these are a fixed six-colour vocabulary
// distinct from the app's brand accent (BALL/CLAY stay what they mean
// everywhere else), chosen to read clearly as a thin bar with no glow.
export const TIER_COLOR: Record<Tier, string> = {
  gold: "#d4af37",
  silver: "#a7b4bf",
  blue: "#5b93c9",
  green: "#8fd19e",
  // Orange pushed warmer/more amber and red pushed darker/cooler so the two
  // separate by brightness as well as hue on a thin bar — the previous pair
  // (#cb6d47 / #c94f4f) were nearly the same lightness and read as one blur.
  orange: "#d98a2b",
  red: "#9c3b4a",
  muted: "#5c6b7a",
};

// Ties tier to a fixed rank so a list can sort "toughest opponent first"
// without re-deriving it — 0 is the most impressive tier, 6 is unrated.
export const TIER_RANK: Record<Tier, number> = { gold: 0, silver: 1, blue: 2, green: 3, orange: 4, red: 5, muted: 6 };

export const TIER_LABEL: Record<Tier, string> = {
  gold: "Gold", silver: "Silver", blue: "Blue", green: "Green", orange: "Orange", red: "Red", muted: "Unrated",
};

export interface DifficultyRating {
  tier: Tier;
  color: string;
  note: string;
}

const gapNote = (gap: number) => (gap === 0 ? "your level" : gap > 0 ? "above you" : "below you");

// gap = opponent's level value minus yours (see core/levels.ts's 18-point
// scale), both at the time in question. null (either side unrated) gets a
// neutral "unrated" badge rather than silently assuming Beginner.
//
// The thresholds are deliberately unchanged from the 12-point scale, and no
// rescale of them is possible rather than merely unwanted. Inserting Amateur
// and Semi-pro adds +3 only to pairs that straddle them, so the same old gap
// maps to two different new gaps: a within-category gap of 2 is still 2 and
// must stay silver, while Beginner/High vs Intermediate/Medium goes 2 -> 5
// and must also stay silver, and Advanced/High vs Pro/Low goes 1 -> 4 and
// must stay blue. That needs new-gap 2 silver, 4 blue, 5 silver — not
// monotonic, so no threshold set produces it. Some bars therefore change
// colour, which is the intended reading: under six tiers a Beginner beating
// an Intermediate is a two-tier upset and should look like one.
export function ratingForGap(gap: number | null): DifficultyRating {
  if (gap == null) return { tier: "muted", color: TIER_COLOR.muted, note: "level unrated" };
  const note = gapNote(gap);
  let tier: Tier;
  if (gap >= 3) tier = "gold";
  else if (gap === 2) tier = "silver";
  else if (gap === 1) tier = "blue";
  else if (gap === 0) tier = "green";
  else if (gap >= -2) tier = "orange";
  else tier = "red";
  return { tier, color: TIER_COLOR[tier], note };
}

// Convenience for a single match: works out both players' levels at the
// match date and rates it from the given player's side of it.
export function ratingForMatch(you: any, opponent: any, matchDate: number): DifficultyRating {
  const myLv = levelVal(levelAt(you, matchDate));
  const oppLv = levelVal(levelAt(opponent, matchDate));
  const gap = myLv != null && oppLv != null ? oppLv - myLv : null;
  return ratingForGap(gap);
}

// Convenience for "how tough is this opponent right now" — used to sort the
// aggregate Winning/Losing/Even lists, as distinct from ratingForMatch's
// at-the-time rating used on individual match rows.
export function ratingNow(you: any, opponent: any): DifficultyRating {
  const myLv = levelVal(you?.level ?? null);
  const oppLv = levelVal(opponent?.level ?? null);
  const gap = myLv != null && oppLv != null ? oppLv - myLv : null;
  return ratingForGap(gap);
}
