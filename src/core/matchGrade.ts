import { LEVELS } from "./constants";
import { levelAt } from "./levels";

/**
 * How good a result was, given who it was against.
 *
 * One function, because Quality and History are two presentations of the
 * same question and a second copy of this would drift within a week.
 *
 * **Categories only, never sub-levels.** Level is a dropdown anybody can
 * pick, and half of them are wrong; ranking Intermediate/High above
 * Intermediate/Medium is arithmetic performed on a guess. The engine's
 * 18-point scale still exists and is still right for the ratings, where the
 * error averages out over a hundred matches — it is wrong for a label on a
 * single row, which is read as a judgement about that one match.
 *
 * Everything here is derived. Nothing is stored, so filling in a level
 * history regrades the past on the next render, which is the intent.
 */

export type Outcome = "W" | "D" | "L";

export type Grade =
  | "statement"
  | "noShame"
  | "trueTest"
  | "expected"
  | "routine"
  | "oneToForget";

export const GRADE_LABEL: Record<Grade, string> = {
  statement: "Statement win",
  noShame: "No shame in it",
  trueTest: "True test",
  expected: "Expected",
  routine: "Routine",
  oneToForget: "One to forget",
};

/** What "not graded" reads as. Null is the value; this is the words. */
export const UNGRADED_LABEL = "Not graded";

/**
 * Grades that mean the opponent was worth playing, for the places that want
 * to say "this was a real test" without re-deriving the gap.
 */
export const TESTING_GRADES: Grade[] = ["statement", "noShame", "trueTest"];

/** A level's category index on the 0-5 scale, or null if it isn't one. */
export function catVal(level: any): number | null {
  if (!level || !level.cat) return null;
  const i = LEVELS.indexOf(level.cat);
  return i < 0 ? null : i;
}

/**
 * Categories between the two, opponent minus viewer. Positive means the
 * opponent was above. Null when either side has no level.
 */
export function categoryGap(viewerLevel: any, opponentLevel: any): number | null {
  const mine = catVal(viewerLevel);
  const theirs = catVal(opponentLevel);
  return mine == null || theirs == null ? null : theirs - mine;
}

/**
 * Was the opponent at the viewer's level or above? Null when unknown.
 *
 * The single definition of the split the Quality screen is built on — the
 * tiles, the bar and the verdict all ask this one question, so they cannot
 * disagree about the answer.
 */
export function atOrAbove(viewerLevel: any, opponentLevel: any): boolean | null {
  const gap = categoryGap(viewerLevel, opponentLevel);
  return gap == null ? null : gap >= 0;
}

/**
 * The grade for one result.
 *
 * A draw against somebody below counts as "One to forget" alongside a loss.
 * The brief covers "lost vs below" and not "drew vs below"; grouping them
 * mirrors the other end, where a loss and a draw against somebody above are
 * both "No shame in it". Dropping a point to a player a category down is a
 * poor day whichever way the scoreline finished, and the alternative —
 * calling it "Expected" — would put a draw and a win under one word.
 */
export function gradeMatch(outcome: Outcome, viewerLevel: any, opponentLevel: any): Grade | null {
  const gap = categoryGap(viewerLevel, opponentLevel);
  if (gap == null) return null;
  if (gap >= 1) return outcome === "W" ? "statement" : "noShame";
  if (gap === 0) return "trueTest";           // win, loss or draw: it was a test
  if (outcome !== "W") return "oneToForget";  // dropped a result to somebody below
  return gap === -1 ? "expected" : "routine"; // -2 or further down is routine
}

/**
 * The grade for a match as it stood on the day, and as the same fixture
 * would read today.
 *
 * `then` is the honest grade and the one every count uses. `now` exists only
 * so History can say "aged well" — and it is null whenever it would be the
 * same as `then`, so a screen cannot show a pair of identical chips and turn
 * the ageing into decoration.
 */
export interface GradedMatch {
  outcome: Outcome;
  /** Grade using both levels as recorded on the match date. Null if either is missing. */
  then: Grade | null;
  /** Only set when today's levels give a different grade from `then`. */
  now: Grade | null;
  /** Categories between them on the day. Null when ungraded. */
  gap: number | null;
  /** The opponent's category on the day, for "Advanced · one above you". */
  opponentCategory: string | null;
  /** Their category now, when it differs from the day's. */
  opponentCategoryNow: string | null;
}

export function gradeAgainstHistory(
  outcome: Outcome,
  viewer: any,
  opponent: any,
  date: number,
): GradedMatch {
  const myThen = levelAt(viewer, date);
  const theirThen = levelAt(opponent, date);
  const then = gradeMatch(outcome, myThen, theirThen);

  // Today's claim, which is what "and now" means. Not levelAt(now): a
  // player with no history has no level on any date, but the dropdown they
  // picked is a real statement about the present.
  const myNow = viewer?.level || null;
  const theirNow = opponent?.level || null;
  const nowGrade = gradeMatch(outcome, myNow, theirNow);

  return {
    outcome,
    then,
    now: nowGrade !== null && nowGrade !== then ? nowGrade : null,
    gap: categoryGap(myThen, theirThen),
    opponentCategory: theirThen?.cat ?? null,
    opponentCategoryNow: theirNow?.cat && theirNow.cat !== theirThen?.cat ? theirNow.cat : null,
  };
}

/** "one above you" / "your level" / "two below you". Null when ungraded. */
export function gapPhrase(gap: number | null): string | null {
  if (gap == null) return null;
  if (gap === 0) return "your level";
  const n = Math.abs(gap);
  const word = n === 1 ? "one" : n === 2 ? "two" : n === 3 ? "three" : n === 4 ? "four" : String(n);
  return word + (gap > 0 ? " above you" : " below you");
}

/**
 * The verdict word for a schedule, from the share of graded matches against
 * somebody at your category or above.
 *
 * Thresholds rather than a curve because this is a headline: it has to mean
 * the same thing on two different profiles, and it has to not flicker
 * between two words when one match lands.
 *
 * The scale is set by what a round-robin actually produces. In a league of
 * six categories where everybody plays everybody, a player in the middle
 * meets somebody at or above them roughly half the time; the top of the
 * table cannot exceed a low number however hard they try, and the bottom
 * cannot avoid a high one. So the middle band is centred on 50 and is wide,
 * and the words describe the schedule rather than praising the player.
 */
export type Verdict = "Testing schedule" | "Balanced schedule" | "Comfortable schedule" | "Untested";

export const VERDICT_THRESHOLDS: Array<{ min: number; verdict: Verdict }> = [
  { min: 0.65, verdict: "Testing schedule" },
  { min: 0.40, verdict: "Balanced schedule" },
  { min: 0.20, verdict: "Comfortable schedule" },
  { min: 0, verdict: "Untested" },
];

/**
 * `share` is at-or-above over **graded** matches, 0 to 1. Null when nothing
 * is graded — with no evidence there is no verdict, and "Untested" would be
 * a judgement drawn from missing data rather than from easy opponents.
 */
export function verdictFor(share: number | null): Verdict | null {
  if (share == null || !Number.isFinite(share)) return null;
  return (VERDICT_THRESHOLDS.find((t) => share >= t.min) as { verdict: Verdict }).verdict;
}
