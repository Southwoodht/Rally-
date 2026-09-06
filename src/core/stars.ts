import { LEVELS, SUBS } from "@/core/constants";

// A level as a star rating.
//
// One star per tier, filled in thirds by sub-level. Sam's model, and it is
// the one that works: six tiers times three sub-levels is eighteen grades,
// six stars times three thirds is eighteen positions, so every grade in the
// system gets its own mark and nothing collides.
//
//   Beginner/Low        one third of the first star
//   Beginner/High       one full star — the tier is complete
//   Intermediate/Low    two full stars and a third
//   Pro/High            six full stars
//
// Six rather than five, which is the one place this departs from the brief.
// Five stars is the more familiar idiom and it was the right call for the
// earlier model, but five stars in thirds is fifteen slots for eighteen
// grades and the collisions come straight back. The tiers decide how many
// stars there are; the alternative is inventing a sixth tier or deleting a
// real one.
//
// The formula reads better than it looks: levelVal is 0-17, and adding one
// before dividing is what makes Beginner/Low a third of a star rather than
// nothing at all. Somebody who has picked the lowest level has still picked
// one, and an empty row of stars is what "no level set" means.

/**
 * How many stars, in thirds. A third up to six, or null when no level is set.
 *
 * Null is not zero. Somebody who has never picked a level has not declared
 * themselves the weakest player in the league, and an empty row of outlines
 * says exactly that; a zero would be a claim they never made.
 */
export function starsForLevel(level: { cat?: string; sub?: string } | null | undefined): number | null {
  const v = levelValOf(level);
  return v === null ? null : (v + 1) / 3;
}

/** One star per tier. */
export const STAR_COUNT = LEVELS.length;

function levelValOf(level: { cat?: string; sub?: string } | null | undefined): number | null {
  if (!level || !level.cat || !level.sub) return null;
  const ci = LEVELS.indexOf(level.cat);
  const si = SUBS.indexOf(level.sub);
  if (ci < 0 || si < 0) return null;
  return ci * 3 + si;
}

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
