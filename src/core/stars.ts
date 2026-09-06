import { LEVELS } from "@/core/constants";

// A level as a five-star reading.
//
// Stars carry the category and nothing else. The sub-level lives in the
// label beside them, and that split is the whole point: there are 18 grades
// (six categories times Low/Medium/High) and ten half-star positions, so
// something has to give, and the only question is what gets crushed.
//
// Mapping all 18 proportionally puts Beginner/Low, /Medium and /High on the
// same half star — and eleven of Seacourt's twenty-one players are
// Beginners, so most of the league would show one identical mark. Category
// only spends the compression at the top instead: Advanced, Semi-pro and Pro
// sit at 4, 4.5 and 5, which is uneven, but those tiers are nearly empty and
// the tiers that are full get a clean position each.
//
// Five stars rather than six, which would have spaced all six categories
// evenly and needed no half-star glyph: five is a read-without-thinking
// idiom and worth more than a regularity nobody would notice.
const STARS_BY_CATEGORY: Record<string, number> = {
  Beginner: 1,
  Amateur: 2,
  Intermediate: 3,
  Advanced: 4,
  "Semi-pro": 4.5,
  Pro: 5,
};

/** Bars in the profile's form strip, tallest first. */
export const TIER_HEIGHTS: Record<string, number> = {
  Beginner: 10,
  Amateur: 14,
  Intermediate: 18,
  Advanced: 22,
  "Semi-pro": 26,
  Pro: 30,
};

/**
 * Stars for a level, or null when no level is set.
 *
 * Null is not zero. Somebody who has never picked a level has not declared
 * themselves the weakest player in the league, and an empty row of five
 * outlines says that; a zero would not.
 */
export function starsForLevel(level: { cat?: string } | null | undefined): number | null {
  if (!level || !level.cat) return null;
  const stars = STARS_BY_CATEGORY[level.cat];
  return stars === undefined ? null : stars;
}

/**
 * How tall this opponent's bar is, or null when their level at that date
 * isn't recorded.
 *
 * Null has to survive all the way to the renderer. Two thirds of the league
 * have no level history at all, so falling back to today's level would
 * silently redraw somebody's 2019 form every time an opponent got promoted —
 * which is the one thing form is supposed to be immune to.
 */
export function tierHeight(level: { cat?: string } | null | undefined): number | null {
  if (!level || !level.cat) return null;
  const h = TIER_HEIGHTS[level.cat];
  return h === undefined ? null : h;
}

/** Every category, in order, for legends and pickers. */
export const TIERS = LEVELS.slice();
