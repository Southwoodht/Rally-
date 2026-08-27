import { levelAt, levelVal } from "@/core/levels";

// A win/loss is only as impressive as who the opponent was *at the time* —
// showing someone's current level next to an old result overstates or
// understates it once either player has moved level since. Always compute
// the gap from levelAt(player, matchDate), never from player.level today.

export type Tier = "gold" | "blue" | "green" | "yellow" | "red" | "muted";

export interface DifficultyRating {
  tier: Tier;
  icon: string;
  note: string;
}

const gapNote = (gap: number) => {
  if (gap === 0) return "your level";
  const dir = gap > 0 ? "above you" : "below you";
  const abs = Math.abs(gap);
  if (abs <= 2) return "just " + dir;
  if (abs <= 5) return "a level " + dir;
  return "well " + dir;
};

// gap = opponent's level value minus yours, both at the time of the match.
// null gap (either player unrated at the time) gets a neutral, honest
// "unrated" badge rather than silently assuming Beginner.
export function ratingForResult(gap: number | null, won: boolean): DifficultyRating {
  if (gap == null) return { tier: "muted", icon: "•", note: "level unrated at the time" };
  const note = gapNote(gap);
  if (won) {
    if (gap >= 3) return { tier: "gold", icon: "🥇", note };
    if (gap >= 1) return { tier: "blue", icon: "🔵", note };
    if (gap === 0) return { tier: "green", icon: "🟢", note };
    if (gap >= -2) return { tier: "yellow", icon: "🟡", note };
    return { tier: "red", icon: "🔴", note };
  }
  // Losses stay quiet on purpose — losing to someone above you is how you
  // climb, not a bad result, so it never gets a bright win-tier colour.
  // Only losing well below your own level actually looks bad.
  if (gap >= 0) return { tier: "muted", icon: "•", note };
  if (gap >= -2) return { tier: "muted", icon: "•", note };
  return { tier: "red", icon: "🔴", note };
}

// Convenience for a single match: works out both players' levels at the
// match date and returns the rating from the given player's side of it.
export function ratingForMatch(you: any, opponent: any, matchDate: number, youWon: boolean): DifficultyRating {
  const myLv = levelVal(levelAt(you, matchDate));
  const oppLv = levelVal(levelAt(opponent, matchDate));
  const gap = myLv != null && oppLv != null ? oppLv - myLv : null;
  return ratingForResult(gap, youWon);
}
