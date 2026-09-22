import { LEVELS } from "@/core/constants";

// A level as a star rating.
//
// CATEGORY ONLY, on five stars. Sam ruled on 2026-09-22, having seen 2.5
// stars printed beside the label "Intermediate · Low".
//
// This reverses the six-star, thirds-by-sub-level model that used to be
// here, and the argument for the reversal is the one matchGrade.ts has
// carried all along: **a sub-level is a dropdown and half of them are
// wrong.** Ranking Intermediate/High above Intermediate/Medium is arithmetic
// performed on a guess. The 18-point scale stays where it belongs — in the
// ratings, where the error averages out over a hundred matches — and is
// wrong for a badge on one profile.
//
// The old comment's objection was that five stars in thirds is fifteen slots
// for eighteen grades, so the grades collide. They do. They are MEANT to
// now: Intermediate/Low and Intermediate/High are one claim as far as this
// badge is concerned, and the sub-level is still there in the text label
// beside it for anyone who wants it.
//
// Six categories onto five stars is not a clean division, so Semi-pro takes
// the half. That is Sam's table, and it is the right half to give away:
// Semi-pro is the one category most people reach by aspiration rather than
// by result.

/**
 * How many stars, in thirds. A third up to six, or null when no level is set.
 *
 * Null is not zero. Somebody who has never picked a level has not declared
 * themselves the weakest player in the league, and an empty row of outlines
 * says exactly that; a zero would be a claim they never made.
 */
export function starsForLevel(level: { cat?: string; sub?: string } | null | undefined): number | null {
  if (!level || !level.cat) return null;
  const s = STARS_BY_CATEGORY[level.cat];
  return s === undefined ? null : s;
}

/**
 * Sam's table. Deliberately keyed by name rather than by index, so it cannot
 * silently re-map if LEVELS ever gains a category — an unknown name returns
 * null and draws an empty row, which is the same thing "no level set" does
 * and is a gap somebody will report. An index-based version would just shift
 * everybody up a star with no error anywhere.
 */
const STARS_BY_CATEGORY: Record<string, number> = {
  Beginner: 1,
  Amateur: 2,
  Intermediate: 3,
  Advanced: 4,
  "Semi-pro": 4.5,
  Pro: 5,
};

/** Five, the familiar idiom. Not LEVELS.length — see the note above. */
export const STAR_COUNT = 5;

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
