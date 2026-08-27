import { levelAt, levelVal } from "@/core/levels";

// How tough the opponent was, at the time — not how the match went. Same
// five-colour scale for a win, a loss, or a draw, because the thing this
// is actually answering is "was this a real test", and that's a property
// of the opponent's level relative to yours, not the result. A profile
// dominated by red — regardless of win/loss — means the competition
// wasn't testing them. Always computed from levelAt(player, matchDate),
// never today's level — an old result is only as impressive as who the
// opponent was back then.

export type Tier = "gold" | "blue" | "green" | "yellow" | "red" | "muted";

export interface DifficultyRating {
  tier: Tier;
  icon: string;
  note: string;
}

const gapNote = (gap: number) => (gap === 0 ? "same level" : gap > 0 ? "above you" : "below you");

// gap = opponent's level value minus yours, both at the time of the match.
// null gap (either player unrated at the time) gets a neutral, honest
// "unrated" badge rather than silently assuming Beginner.
export function ratingForGap(gap: number | null): DifficultyRating {
  if (gap == null) return { tier: "muted", icon: "•", note: "level unrated at the time" };
  const note = gapNote(gap);
  if (gap >= 3) return { tier: "gold", icon: "🥇", note };
  if (gap >= 1) return { tier: "blue", icon: "🔵", note };
  if (gap === 0) return { tier: "green", icon: "🟢", note };
  if (gap >= -2) return { tier: "yellow", icon: "🟡", note };
  return { tier: "red", icon: "🔴", note };
}

// Convenience for a single match: works out both players' levels at the
// match date and rates it from the given player's side of it.
export function ratingForMatch(you: any, opponent: any, matchDate: number): DifficultyRating {
  const myLv = levelVal(levelAt(you, matchDate));
  const oppLv = levelVal(levelAt(opponent, matchDate));
  const gap = myLv != null && oppLv != null ? oppLv - myLv : null;
  return ratingForGap(gap);
}
