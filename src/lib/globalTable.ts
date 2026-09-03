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
  score: number;
}

const pts = (w: number, d: number, l: number) => (w + l + d ? (w + d * 0.5) / (w + d + l) : 0.5);

// Confidence ramp: a 1-0 record shouldn't move someone as far as a 40-0 one.
// Full weight arrives at ten games, which is roughly where a record in this
// app stops being noise.
const confidence = (n: number) => Math.min(1, n / 10);

/**
 * Where someone sits globally.
 *
 * Level is the anchor, worth 100 a point, because that is the one claim that
 * spans leagues — an Advanced player's league and an Intermediate's are not
 * the same competition and their win rates are not comparable. Records then
 * move people *within* reach of their neighbours without ever leapfrogging a
 * whole level on volume alone:
 *
 *   ±60  how they do against opponents at or above their own level. This is
 *        the load-bearing one. Beating your equals and betters is the only
 *        record that survives the move across leagues.
 *   ±25  overall win rate, as a tiebreak. Deliberately small: 100-0 against
 *        people well below you says little, and shouldn't outrank someone
 *        with a harder draw.
 *
 * Unrated players get no anchor and are listed after rated ones — see
 * rankGlobal — rather than being silently assumed to be beginners.
 */
export function globalScore(r: Omit<GlobalRow, "score" | "gp" | "qgp">): number {
  const lv = levelVal(r.level);
  if (lv == null) return -1;
  const qgp = r.qw + r.qd + r.ql;
  const gp = r.w + r.d + r.l;
  const quality = (pts(r.qw, r.qd, r.ql) - 0.5) * 2 * 60 * confidence(qgp);
  const overall = (pts(r.w, r.d, r.l) - 0.5) * 2 * 25 * confidence(gp);
  return lv * 100 + quality + overall;
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
export function standingWord(place: GlobalPlace): { label: string; tier: "gold" | "blue" | "green" | "orange" | "muted" } {
  const p = place.rank / Math.max(1, place.of);
  if (p <= 0.1) return { label: "Elite", tier: "gold" };
  if (p <= 0.25) return { label: "Strong", tier: "blue" };
  if (p <= 0.5) return { label: "Decent", tier: "green" };
  if (p <= 0.75) return { label: "Climbing", tier: "orange" };
  return { label: "Early days", tier: "muted" };
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
    };
    return { ...base, gp: base.w + base.d + base.l, qgp: base.qw + base.qd + base.ql, score: globalScore(base) };
  });
  return rankGlobal(rows);
}
