import { countsAsPlayed, isUnconfirmedResult } from "./matchStatus";
import { LEVELS } from "./constants";
import { gapPhrase, gradeAgainstHistory, verdictFor, type GradedMatch, type Outcome, type Verdict } from "./matchGrade";

/**
 * Everything "Your matches" shows, from one pass over the viewer's results.
 *
 * Both modes read this. Quality is the aggregates, History is the rows, and
 * they are the same walk over the same list — computing it twice is how a
 * screen ends up with a headline that disagrees with the list beneath it.
 *
 * Pure. No React, no fetching, no dates formatted. The caller supplies the
 * players and matches it already has.
 */

/**
 * Whose schedule this is, and therefore how to say it.
 *
 * The screen was written entirely in the second person, which is fine while
 * it only ever showed you your own matches. Reading somebody else's, every
 * one of those sentences becomes a lie about who is being described — so the
 * words come from here rather than being hardcoded.
 *
 * Third person uses their name and then "they", never he or she: the app
 * does not ask anybody their pronouns and guessing from a name gets it wrong
 * for real people.
 */
export interface Voice {
  /** True when the reader is the subject. */
  self: boolean;
  /** Their first name. Ignored when self. */
  name: string;
}

export const YOU: Voice = { self: true, name: "" };

/** "your" / "Charlie's" */
export const poss = (v: Voice) => (v.self ? "your" : v.name + "'s");
/** "Your" / "Charlie's" */
export const Poss = (v: Voice) => (v.self ? "Your" : v.name + "'s");
/** "you" / "Charlie" */
export const subj = (v: Voice) => (v.self ? "you" : v.name);
/** "You are" / "Charlie is" */
export const isVerb = (v: Voice) => (v.self ? "You are" : v.name + " is");
/** "your" / "their" — the possessive after the subject is already named. */
export const theirs = (v: Voice) => (v.self ? "your" : "their");
/** "you" / "them" — object form. */
export const obj = (v: Voice) => (v.self ? "you" : "them");

export interface Record3 { w: number; d: number; l: number }

const rec = (): Record3 => ({ w: 0, d: 0, l: 0 });
const add = (r: Record3, o: Outcome) => { if (o === "W") r.w++; else if (o === "D") r.d++; else r.l++; };
const played = (r: Record3) => r.w + r.d + r.l;

/**
 * Win rate as a percentage, or null when there is too little to say.
 *
 * Draws count as half, matching winPct everywhere else. The floor is a
 * property of the answer rather than of the caller: "100% won" off one match
 * is not a win rate, it is a single result wearing a statistic's clothes.
 */
export const MIN_FOR_RATE = 3;
export function rateOf(r: Record3): number | null {
  const n = played(r);
  return n < MIN_FOR_RATE ? null : Math.round(((r.w + r.d * 0.5) / n) * 100);
}

export interface QualityRow {
  /** A category name from LEVELS. */
  cat: string;
  record: Record3;
  matches: number;
  /** Null under MIN_FOR_RATE — the row says "not enough to judge" instead. */
  winRate: number | null;
  /** Categories from the viewer: +1 is one above. */
  gap: number;
  isMine: boolean;
}

export interface OpponentQuality {
  player: any;
  record: Record3;
  /** Their category, as recorded on the day of your most recent meeting. */
  cat: string | null;
  /** "one above you" / "your level". Null when ungraded. */
  phrase: string | null;
  gap: number | null;
  /** The grade of your most recent meeting, for the label under the record. */
  lastGrade: GradedMatch["then"];
}

export interface YearShare {
  year: number;
  /** At-or-above over graded, 0-100. Null when nothing that year was graded. */
  share: number | null;
  graded: number;
  matches: number;
}

export interface GradedRow {
  matchId: string;
  date: number;
  outcome: Outcome;
  opponent: any;
  score?: string | null;
  pending?: boolean;
  grade: GradedMatch;
}

export interface MatchQuality {
  /** Every counted match, newest first, graded. */
  rows: GradedRow[];
  /** Counted matches. Pending ones are not in here — see the note below. */
  total: number;
  graded: number;
  ungraded: number;
  atOrAbove: Record3;
  below: Record3;
  /**
   * Matches nobody can grade, because a level was missing at the time.
   *
   * A real bucket rather than a silent drop. These used to be counted
   * nowhere, so the two tiles summed to `graded` while the screen around
   * them said `total` — on a roster where almost nobody has a level history
   * that is not a rounding difference, it is most of the matches.
   * **atOrAbove + below + unknown === total, for every player, always.**
   */
  unknown: Record3;
  /** At-or-above as a share of GRADED matches, 0-1. Null when none are. */
  share: number | null;
  verdict: Verdict | null;
  byLevel: QualityRow[];
  /** Where the wins came from. Ungraded wins are in neither. */
  winsFrom: { above: number; at: number; below: number };
  opponents: OpponentQuality[];
  overTime: YearShare[];
}

/**
 * `viewerId`'s matches, graded.
 *
 * Pending results are excluded, like every other number in the engine: a
 * match nobody has agreed to is not a match yet, and a list presented as the
 * contents of a number must contain that number's contents.
 */
export function buildMatchQuality(
  viewerId: string,
  players: any[],
  matches: any[],
  voice: Voice = YOU,
): MatchQuality {
  const byId: Record<string, any> = {};
  (players || []).forEach((p) => (byId[p.id] = p));
  const me = byId[viewerId];

  const mine = (matches || [])
    .filter((m) => countsAsPlayed(m) && (m.p1 === viewerId || m.p2 === viewerId))
    .sort((a, b) => b.date - a.date);

  const rows: GradedRow[] = mine.map((m) => {
    const oid = m.p1 === viewerId ? m.p2 : m.p1;
    const outcome: Outcome = m.winner === "draw" ? "D" : m.winner === (m.p1 === viewerId ? "p1" : "p2") ? "W" : "L";
    return {
      matchId: m.id,
      date: m.date,
      outcome,
      opponent: byId[oid],
      score: m.score ?? null,
      pending: isUnconfirmedResult(m),
      grade: gradeAgainstHistory(outcome, me, byId[oid], m.date),
    };
  });

  const atOrAbove = rec(), below = rec(), unknown = rec();
  const winsFrom = { above: 0, at: 0, below: 0 };
  let graded = 0;

  // By level: keyed on the opponent's category ON THE DAY, which is the
  // whole premise. A row for a category the viewer has never faced is not
  // rendered — an empty row is a promise, not a fact.
  const levelRows: Record<string, Record3> = {};

  rows.forEach((r) => {
    const g = r.grade;
    // Ungraded — a level was missing on one side or the other, so there is
    // no gap to judge. It still happened, so it is still counted: dropping
    // it here is what made the tiles disagree with the total.
    if (g.gap == null || !g.opponentCategory) { add(unknown, r.outcome); return; }
    graded++;
    if (g.gap >= 0) { add(atOrAbove, r.outcome); if (r.outcome === "W") { if (g.gap > 0) winsFrom.above++; else winsFrom.at++; } }
    else { add(below, r.outcome); if (r.outcome === "W") winsFrom.below++; }
    if (!levelRows[g.opponentCategory]) levelRows[g.opponentCategory] = rec();
    add(levelRows[g.opponentCategory], r.outcome);
  });

  const myCat = me?.level?.cat ?? null;
  const myCatIdx = myCat ? LEVELS.indexOf(myCat) : -1;
  const byLevel: QualityRow[] = LEVELS
    .map((cat: string, i: number) => ({ cat, i }))
    .filter(({ cat }: any) => !!levelRows[cat])
    .map(({ cat, i }: any) => ({
      cat,
      record: levelRows[cat],
      matches: played(levelRows[cat]),
      winRate: rateOf(levelRows[cat]),
      gap: myCatIdx < 0 ? 0 : i - myCatIdx,
      isMine: cat === myCat,
    }))
    // Hardest first, so the top of the card is the part worth reading.
    .sort((a: QualityRow, b: QualityRow) => b.gap - a.gap);

  // Opponents, aggregated. The category and grade come from the most recent
  // meeting — rows are newest first, so the first one seen wins.
  const oppMap = new Map<string, OpponentQuality>();
  rows.forEach((r) => {
    if (!r.opponent) return;
    let o = oppMap.get(r.opponent.id);
    if (!o) {
      o = {
        player: r.opponent,
        record: rec(),
        cat: r.grade.opponentCategory,
        phrase: gapPhrase(r.grade.gap, voice.self),
        gap: r.grade.gap,
        lastGrade: r.grade.then,
      };
      oppMap.set(r.opponent.id, o);
    }
    add(o.record, r.outcome);
  });
  const opponents = [...oppMap.values()].sort((a, b) =>
    // Hardest first. Ungraded opponents sink to the bottom rather than being
    // treated as beginners — no level is not a low level.
    (b.gap ?? -99) - (a.gap ?? -99) || played(b.record) - played(a.record));

  // Over time. Every year the viewer played, oldest first, so a chart reads
  // left to right.
  const years = new Map<number, { graded: number; above: number; matches: number }>();
  rows.forEach((r) => {
    const y = new Date(r.date).getFullYear();
    const e = years.get(y) || { graded: 0, above: 0, matches: 0 };
    e.matches++;
    if (r.grade.gap != null) { e.graded++; if (r.grade.gap >= 0) e.above++; }
    years.set(y, e);
  });
  const overTime: YearShare[] = [...years.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, e]) => ({
      year,
      share: e.graded ? Math.round((e.above / e.graded) * 100) : null,
      graded: e.graded,
      matches: e.matches,
    }));

  const share = graded ? played(atOrAbove) / graded : null;

  return {
    rows,
    total: rows.length,
    graded,
    ungraded: rows.length - graded,
    atOrAbove,
    below,
    unknown,
    share,
    verdict: verdictFor(share),
    byLevel,
    winsFrom,
    opponents,
    overTime,
  };
}

/**
 * The sentence under the verdict.
 *
 * States the denominator out loud, because a percentage of graded matches is
 * not a percentage of matches and the difference is currently most of them.
 */
export function shareSentence(q: MatchQuality, v: Voice = YOU): string {
  if (q.share == null) return "None of " + poss(v) + " matches can be graded yet.";
  const pct = Math.round(q.share * 100);
  const n = played(q.atOrAbove);
  return pct + "% of " + poss(v) + " graded matches were against somebody at " +
    theirs(v) + " level or above — " + n + " of " + q.graded + ".";
}

/** The one-line conclusion under "Where your wins come from". */
export function winsFromSentence(q: MatchQuality, v: Voice = YOU): string | null {
  const { above, at, below } = q.winsFrom;
  const totalWins = above + at + below;
  if (!totalWins) return null;
  const hard = above + at;
  if (hard === 0) return "Every graded win has come against somebody below " + obj(v) + ".";
  if (below === 0) return "Every graded win has come at " + theirs(v) + " level or above.";
  // An exact split gets said as an exact split. Rounding a tie to one side
  // and printing "50% came at your level or above" is true and reads as a
  // claim, when the fact is that it went both ways equally.
  if (hard === below) return "Half of " + poss(v) + " graded wins came at " + theirs(v) + " level or above, half against somebody below.";
  const pct = Math.round((hard / totalWins) * 100);
  return hard > below
    ? pct + "% of " + poss(v) + " wins came at " + theirs(v) + " level or above."
    : Math.round((below / totalWins) * 100) + "% of " + poss(v) + " wins came against somebody below " + obj(v) + ".";
}

/**
 * The one-line summary under the yearly chart. Null when it cannot say.
 *
 * Endpoints need MIN_FOR_RATE graded matches behind them. A year with one
 * graded match is a 0% or a 100%, and "you are playing easier opposition
 * than you used to — 100% in 2019" off the back of a single result is the
 * chart inventing a career arc out of one afternoon.
 */
export function overTimeSentence(overTime: YearShare[], v: Voice = YOU): string | null {
  const known = overTime.filter((y) => y.share != null && y.graded >= MIN_FOR_RATE);
  if (known.length < 2) return null;
  const first = known[0], last = known[known.length - 1];
  const delta = (last.share as number) - (first.share as number);
  const span = " — " + first.share + "% in " + first.year + ", " + last.share + "% in " + last.year + ".";
  if (Math.abs(delta) < 10) return Poss(v) + " schedule has been about as testing as it ever was.";
  const used = v.self ? " than you used to" : " than they used to";
  return isVerb(v) + (delta > 0 ? " playing tougher opposition" : " playing easier opposition") + used + span;
}

/** Fewer than this many years and the chart says nothing worth a card. */
export const MIN_YEARS_FOR_CHART = 3;
