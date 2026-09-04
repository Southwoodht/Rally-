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
export function globalScore(r: Omit<GlobalRow, "score" | "gp" | "qgp" | "provisional">): number {
  const lv = levelVal(r.level);
  if (lv == null) return -1;
  const claimed = lv * 100;
  const qgp = r.qw + r.qd + r.ql;

  const trust = 1 / (1 + qgp / 6);
  const unproven = claimed * 0.45 + NEUTRAL * 0.55;
  const proven = claimed + (qualityRate(r) - 0.5) * 2 * 300;
  const career = 45 * Math.log10(1 + Math.max(0, r.w));
  const raw = unproven * trust + proven * (1 - trust) + career;

  const gp = r.w + r.d + r.l;
  const established = Math.min(1, gp / PROVISIONAL_GAMES);
  return raw * established + NEUTRAL * (1 - established);
}

export function rankGlobal(rows: GlobalRow[]): GlobalRow[] {
  return rows.slice().sort((a, b) => {
    const aRated = levelVal(a.level) != null, bRated = levelVal(b.level) != null;
    // Nobody unrated is placed among the rated — we don't know enough about
    // them to say, and guessing would be the dishonest half of the feature.
    if (aRated !== bRated) return aRated ? -1 : 1;
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
  // Ranked against the rated players only, matching what the table shows —
  // unrated players are listed separately there and hold no place number.
  const rated = cache.rows.filter((r) => r.level);
  const i = rated.findIndex((r) => r.key === key);
  return i < 0 ? null : { rank: i + 1, of: rated.length };
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
    };
    const gp = base.w + base.d + base.l;
    return { ...base, gp, qgp: base.qw + base.qd + base.ql, score: globalScore(base), provisional: gp < PROVISIONAL_GAMES };
  });
  return rankGlobal(rows);
}
