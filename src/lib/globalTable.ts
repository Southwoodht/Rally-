import { levelVal } from "@/core/levels";
import { supabase, withSupabaseTimeout } from "@/lib/supabase";

// The Global table — everyone you can see, ranked on their own record
// wherever they play, not on the handful of matches they happened to play
// against us.
//
// The problem this solves: when Zaach plays Bob, Bob gets a player row in
// our league holding exactly one result — the one he lost. A flat table puts
// him bottom on 0-1. But Bob is 100-0 in his own league against semi-pros.
// Ranking him on the sliver we saw is an artefact of where he entered.
//
// So the numbers here come from public.global_standings() (see
// supabase/schema_global_standings.sql), which aggregates every league a
// person plays in. Cross-league merging is by auth_id only — never by name,
// which is the bug behind the Charlie incident — so an unclaimed player
// still shows only what our leagues know. That is the honest answer, and it
// gives people a reason to claim their profile.

export interface GlobalRow {
  key: string;
  name: string;
  last: string | null;
  nick: string | null;
  avatar: string | null;
  avatarUrl: string | null;
  level: { cat: string; sub: string } | null;
  claimed: boolean;
  leagues: number;
  w: number;
  d: number;
  l: number;
  // Against opponents at or above their own level — the evidence that they
  // belong where they say they do.
  qw: number;
  qd: number;
  ql: number;
  gp: number;
  qgp: number;
  /**
   * Margin, over the scored quality matches only. `qShareSum` is the sum of
   * how much of each match they took (6-0,6-0,6-0 is 1.0, a 6-7,5-7 loss is
   * 0.44); `qResSum` is the sum of the plain 1/0.5/0 results for those same
   * matches. Both come from global_standings(); both are 0 when the
   * migration hasn't been run, which is exactly the no-op case.
   */
  qShareSum: number;
  qResSum: number;
  /**
   * Losses and draws against people *below* their level, summed as level
   * points of gap. Losing one category down adds 3, three categories down
   * adds 9. Both 0 when the migration hasn't been run.
   */
  badLossSum: number;
  badDrawSum: number;
  /**
   * Every match against an opponent who has a level — and note this does not
   * require *them* to have one. `ratedN` matches, `oppLvSum` those opponents'
   * levels summed, `ratedResSum` the 1/0.5/0 results, and the share pair for
   * the ones with a score. All 0 before the migration, which is the fall-back
   * case.
   */
  ratedN: number;
  oppLvSum: number;
  ratedResSum: number;
  ratedShareSum: number;
  ratedShareN: number;
  ratedScoredResSum: number;
  score: number;
  /** Too few games to place them honestly — see globalScore. */
  provisional: boolean;
}

/**
 * How far margin is allowed to move a quality result, 0 to 1.
 *
 * At 0 this is the old binary: a win is a win however close. At 1 the result
 * stops mattering and only games count, so a 7-6 7-6 win and a 6-7 6-7 loss
 * land within a whisker of each other, which is plainly wrong — winning is
 * the main thing that happened.
 *
 * 0.35 keeps a win clearly a win (a 7-6 7-6 win scores 0.83 against a
 * perfect 1.0) while giving a close loss to a good opponent something rather
 * than nothing (6-7 5-7 scores 0.15 against a bagelling's 0.0). Losing 6-5
 * to someone at your own level should cost less than losing 0-6 0-6 0-6, and
 * this is the number that decides how much less.
 *
 * It lives here rather than in the SQL on purpose: the function reports
 * facts, the app decides what they are worth, and tuning this needs no
 * migration.
 */
export const MARGIN_WEIGHT = 0.35;

/**
 * What a bad loss costs, in the same currency as everything else — points,
 * where 100 is one rung and 300 a full category.
 *
 * Beating people at or above you can lift you 300 above your claim. Losing to
 * people below you should be able to pull you down comparably, because it is
 * the same kind of evidence pointing the other way: it says the claimed level
 * is too high. Before this, it said nothing at all — the quality bucket only
 * looked upwards, so a loss to a beginner was invisible while a loss to
 * somebody stronger counted against you.
 *
 * It's a rate, not a tally: severity is averaged over games played, so this
 * is "how often do you lose to people below you", not "how many times". One
 * category-below loss in ten games costs about 30 points; losing half your
 * games a category down costs about 150, which is the point at which the
 * level itself is the thing that's wrong.
 */
export const BAD_LOSS_WEIGHT = 300;

/**
 * The most a bad-loss record can take off, so a thin record can't produce a
 * wild number. Someone 0-0-1 to a beginner would otherwise carry the full
 * severity of that single match into a table position.
 */
export const BAD_LOSS_CAP = 300;

// Below this many games we don't claim to know where someone belongs.
export const PROVISIONAL_GAMES = 10;


// The middle of the scale — where "we don't actually know how good you are"
// sits. Both an unbacked "Pro" and an unbacked "Beginner" get pulled towards
// it, from opposite directions.
//
// 6 is Intermediate/Low on the 18-point scale, which is what 3 meant on the
// 12-point one — the same rung, renumbered, not a new opinion about where
// the middle is. Checked against the production snapshot: at 6 the global
// order is identical to today's. Left at 3 it moves two people; set to the
// arithmetic midpoint of the new scale instead it moves nine.
const NEUTRAL = 6 * 100;

/**
 * The quality record as a rate, with margin folded in where a score exists.
 *
 * With no scores anywhere this is exactly the old win rate,
 * (qw + qd/2) / qgp. Where a scored quality match exists, its plain result is
 * swapped for a blend of the result and the share of games taken:
 *
 *     value = (1 - W) * result + W * share
 *     total = resultSumAll + W * (shareSumScored - resultSumScored)
 *
 * which is the same thing rearranged so it needs only the two sums the SQL
 * hands back rather than a row per match. Unscored matches keep contributing
 * their plain result untouched, so leaving the score box empty costs nothing.
 */
export function qualityRate(r: { qw: number; qd: number; ql: number; qShareSum: number; qResSum: number }): number {
  const qgp = r.qw + r.qd + r.ql;
  if (!qgp) return 0.5;
  const resultSumAll = r.qw + r.qd * 0.5;
  const total = resultSumAll + MARGIN_WEIGHT * (r.qShareSum - r.qResSum);
  return total / qgp;
}

/**
 * Where someone sits globally.
 *
 * Level is a *claim*, not a measurement. Anyone can pick Pro from a dropdown,
 * and nothing in the app stops them. So level cannot be the anchor: it's a
 * starting assumption whose weight falls away as real evidence arrives.
 *
 *   unproven  what we assume before they've shown us anything — their claim,
 *             dragged more than half the way back to the middle of the scale.
 *             An unevidenced Pro does not get to sit at the top.
 *   proven    what their record says their level is: how they do against
 *             opponents at or above their own level, worth up to three level
 *             points either side of the claim. Dominating your equals and
 *             betters is the one result that means the same thing in every
 *             league, which is why it carries the weight here.
 *   trust     how much we still have to take their word for it. Six matches
 *             against their own level or better halves it, eighteen cuts it
 *             to a quarter. Evidence replaces the claim rather than adding
 *             to it.
 *   career    all-time wins, with heavy diminishing returns — a hundred wins
 *             is worth about half a level point, not five. Volume against
 *             weak opposition must never outrank evidence against strong.
 *
 * The awkward case, and it is genuinely awkward: a 70-year-old ex-pro with
 * three matches on record against an active player with thirty wins and a
 * hard schedule. This lands them close together, which is the honest answer —
 * the ex-pro's claim is discounted for thin evidence, the active player's
 * volume and quality lift them, and neither runs away with it. A career peak
 * that happened before Rally existed isn't something this table can see, and
 * it shouldn't pretend to: that's what the Legacy table and trophies are for.
 *
 * Finally the whole thing is damped by how much they've played at all. A
 * player who is 0-1 may well be excellent — but one match is not a position
 * in a table, and letting a claimed level alone lift them over somebody with
 * forty results makes the table describe ambition rather than evidence. Under
 * ten games they're pulled towards the middle and shown as provisional; they
 * climb out of it by playing, which is the right incentive.
 *
 * Unrated players get no starting assumption at all and are listed after the
 * ranked ones — see rankGlobal — rather than being assumed to be beginners.
 */
/**
 * What losing to weaker players takes off, in points.
 *
 * Severity is level points of gap, converted to categories, averaged over
 * every game played and capped. A draw counts half a loss — it's the same
 * signal, weaker. Zero for anyone who has never lost to somebody below them,
 * and zero before the migration adds the columns.
 */
export function badLossPenalty(r: { badLossSum: number; badDrawSum: number; w: number; d: number; l: number }): number {
  const gp = r.w + r.d + r.l;
  if (!gp) return 0;
  const categories = (r.badLossSum + r.badDrawSum * 0.5) / 3;
  return Math.min(BAD_LOSS_CAP, BAD_LOSS_WEIGHT * (categories / gp));
}

/**
 * How far a perfect record lifts you above the level you played, in level
 * points. 6 is two categories: beat everyone you face and you're rated two
 * categories above them; lose to everyone and you're two below. Conservative
 * on purpose — a 100% record against three people is thin evidence, and the
 * trust blend below is what stops it running away.
 */
export const PERF_SPREAD = 6;

/**
 * The level somebody has actually played like, in level points, or null when
 * they've never faced a levelled opponent.
 *
 * The average level they faced, moved by how they did against it. Beating
 * Intermediates makes you Intermediate-ish whatever you claim; losing to
 * Beginners makes you a Beginner however good you say you are.
 *
 * This is the piece that makes the table automatic. It replaces the old
 * "results against opponents at or above your level" bucket, which ignored
 * every match against somebody weaker — so a 2-0-1 whose wins were against
 * weaker players counted only the loss, and an unrated player counted for
 * nothing in either direction because there was no level of their own to
 * compare against. Nothing here needs the person to have a level; only the
 * opponent does.
 *
 * Where scores exist the win rate is softened by the share of games taken,
 * on the same MARGIN_WEIGHT as before, so a 6-5 loss reads as closer than a
 * bagelling without a win stopping being a win.
 */
export function performanceLevel(r: {
  ratedN: number; oppLvSum: number; ratedResSum: number;
  ratedShareSum: number; ratedScoredResSum: number;
}): number | null {
  if (!r.ratedN) return null;
  const avgOpp = r.oppLvSum / r.ratedN;
  // Same rearrangement as qualityRate: the plain result is swapped for a
  // blend of result and share, and only over the matches that actually have
  // a score — hence ratedScoredResSum, the results of exactly those, so the
  // swap is like for like. Matches with no score keep their plain result.
  const total = r.ratedResSum + MARGIN_WEIGHT * (r.ratedShareSum - r.ratedScoredResSum);
  const rate = Math.max(0, Math.min(1, total / r.ratedN));
  return avgOpp + PERF_SPREAD * (rate - 0.5);
}

export function globalScore(r: Omit<GlobalRow, "score" | "gp" | "qgp" | "provisional">): number {
  const lv = levelVal(r.level);
  // No level set is not a result. It used to send someone to the bottom of
  // the table below everybody, which put a 6-3-10 record under a player who
  // was 0-0-1 — and "worse than everyone" is a far stronger claim about
  // somebody than the beginner assumption this was written to avoid. So an
  // unrated player simply makes no claim: they start at the middle of the
  // scale, exactly where a rated player's unevidenced claim gets dragged to,
  // and their record moves them from there like anybody else's.
  const claimed = lv == null ? NEUTRAL : lv * 100;
  const qgp = r.qw + r.qd + r.ql;

  // What their results say, when there is anything to go on. This replaces
  // the old quality bucket and the bad-loss patch bolted beside it: a
  // performance rating already counts every match in both directions, so
  // losing to weaker players drags it down without needing a separate
  // penalty, and beating them holds it up instead of counting for nothing.
  const perf = performanceLevel(r);
  const evidenceN = r.ratedN || qgp;
  const trust = 1 / (1 + evidenceN / 6);
  // An unevidenced claim is worth nothing at all now, not 45% of something.
  // It used to be worth enough that a Pro claim with three matches outranked
  // fifty-seven matches of evidence, and an Advanced claim with a single
  // loss sat fifth. Everyone starts in the middle and their results move
  // them; the level they picked decides who they're measured against, not
  // where they land. That also retires the old wrinkle where setting no
  // level scored better than honestly setting Beginner.
  const unproven = NEUTRAL;
  // Falls back to the old shape, penalty included, when the migration hasn't
  // run and there is no performance rating to be had.
  const proven = perf != null ? perf * 100 : claimed + (qualityRate(r) - 0.5) * 2 * 300;
  const career = 45 * Math.log10(1 + Math.max(0, r.w));
  const raw = unproven * trust + proven * (1 - trust) + career - (perf != null ? 0 : badLossPenalty(r));

  // No second damping toward neutral. There used to be one, pulling anybody
  // under ten games toward the middle, and it inverted the table: the less
  // you had played, the harder you were pulled up towards 600, so a 2-0-1
  // scored below an 0-0-2 purely for having played one more match. Playing
  // more and doing better must never make you rank lower.
  //
  // Thin evidence is already handled once, and in the right place — `trust`
  // leans on the claim until results arrive. Doing it twice was the bug.
  // Under PROVISIONAL_GAMES people are still flagged provisional, which is
  // the honest thing to say about them; it just isn't done by moving them.
  return raw;
}

// Everyone is ranked together, unrated included. Segregating them was meant
// to avoid guessing at someone we know nothing about, but it guessed anyway
// and guessed the worst: an unrated player with a real record sat under
// every rated player, however few games they had. Someone with no level and
// nineteen matches is not less placeable than someone with a level and one.
// The row still says "unrated", so nobody is presented as having claimed a
// level they haven't.
export function rankGlobal(rows: GlobalRow[]): GlobalRow[] {
  return rows.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.gp !== a.gp) return b.gp - a.gp;
    return a.name.localeCompare(b.name);
  });
}

// A profile asks for one person's global place, and several profiles get
// opened in a row, so the whole table is cached briefly rather than re-fetched
// per profile. A minute is short enough that a result logged elsewhere shows
// up quickly and long enough that flicking between profiles costs nothing.
let cache: { at: number; rows: GlobalRow[] } | null = null;
const CACHE_MS = 60_000;

export const globalKeyFor = (p: any): string => (p?.auth_id ? String(p.auth_id) : "p:" + p?.id);

export interface GlobalPlace { rank: number; of: number }

export async function globalRankFor(key: string, now = Date.now()): Promise<GlobalPlace | null> {
  if (!cache || now - cache.at > CACHE_MS) {
    try { cache = { at: now, rows: await loadGlobalStandings() }; } catch { return null; }
  }
  // Ranked against everybody, matching what the table shows now that unrated
  // players are placed on their record rather than dumped underneath it.
  const i = cache.rows.findIndex((r) => r.key === key);
  return i < 0 ? null : { rank: i + 1, of: cache.rows.length };
}

// #6 means nothing without knowing whether that's six of eight or six of six
// hundred. The word carries what the number can't at a glance.
//
// The word on its own turned out not to be enough either — "Decent" and
// "Strong" don't say what they are measuring, and the row they sit on is
// labelled "Global", which doesn't say it spans every league rather than
// this one. So each carries a note that spells out both, in the same shape
// the play-style chip uses.
export function standingWord(place: GlobalPlace): { label: string; tier: "gold" | "blue" | "green" | "orange" | "muted"; note: string } {
  const p = place.rank / Math.max(1, place.of);
  const of = `of the ${place.of} players ranked across every league Rally can see for you`;
  if (p <= 0.1) return { label: "Elite", tier: "gold", note: `Top 10% ${of}.` };
  if (p <= 0.25) return { label: "Strong", tier: "blue", note: `Top quarter ${of}.` };
  if (p <= 0.5) return { label: "Decent", tier: "green", note: `Top half ${of}.` };
  if (p <= 0.75) return { label: "Climbing", tier: "orange", note: `Bottom half ${of}.` };
  return { label: "Early days", tier: "muted", note: `Bottom quarter ${of}.` };
}

export async function loadGlobalStandings(): Promise<GlobalRow[]> {
  if (!supabase) return [];
  const { data, error } = await withSupabaseTimeout(
    supabase.rpc("global_standings"),
    { data: null, error: { message: "Timed out" } } as any,
  );
  if (error) throw new Error(error.message || "Could not load the global table.");
  const rows: GlobalRow[] = (data || []).map((r: any) => {
    const base = {
      key: r.key,
      name: r.name,
      last: r.last,
      nick: r.nick,
      avatar: r.avatar,
      avatarUrl: r.avatar_url,
      level: r.level,
      claimed: !!r.claimed,
      leagues: r.leagues || 0,
      w: r.w || 0,
      d: r.d || 0,
      l: r.l || 0,
      qw: r.qw || 0,
      qd: r.qd || 0,
      ql: r.ql || 0,
      // Absent until schema_global_standings_margin.sql has been run. Both
      // at 0 makes qualityRate() collapse back to the plain win rate, so an
      // app deployed ahead of the migration behaves exactly as it did
      // before rather than mis-scoring anybody.
      qShareSum: Number(r.qshare_sum ?? 0),
      qResSum: Number(r.qres_sum ?? 0),
      // Absent until schema_global_standings_badloss.sql has been run; at 0
      // the penalty is 0, so the table behaves exactly as it did before.
      badLossSum: Number(r.badloss_sum ?? 0),
      badDrawSum: Number(r.baddraw_sum ?? 0),
      // Absent until schema_global_standings_perf.sql has been run. ratedN
      // at 0 means performanceLevel returns null and the score falls back to
      // exactly the previous behaviour.
      ratedN: Number(r.rated_n ?? 0),
      oppLvSum: Number(r.opp_lv_sum ?? 0),
      ratedResSum: Number(r.rated_res_sum ?? 0),
      ratedShareSum: Number(r.rated_share_sum ?? 0),
      ratedShareN: Number(r.rated_share_n ?? 0),
      ratedScoredResSum: Number(r.rated_scored_res_sum ?? 0),
    };
    const gp = base.w + base.d + base.l;
    return { ...base, gp, qgp: base.qw + base.qd + base.ql, score: globalScore(base), provisional: gp < PROVISIONAL_GAMES };
  });
  // Somebody who has never played has no record to be ranked on, and this
  // table ranks people on their record. They were being given a position
  // anyway — landing mid-table on the neutral score, above people with real
  // results — which is a placeholder holding a place.
  return rankGlobal(rows.filter((r) => r.gp > 0));
}
