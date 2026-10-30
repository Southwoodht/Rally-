/**
 * The organiser edit log (supabase/schema_match_edits.sql).
 *
 * Sam, 2026-10-30: club owners and editors can correct ANY result in their
 * club — including between two players with accounts, which until now only
 * the two players could change, and only by agreeing — and every such
 * correction is written down: who, when, what it was, what it became. Both
 * players are told, in the bell and by email.
 *
 * The log is written BEFORE the change is saved. If it can't be written, the
 * change doesn't happen: an organiser rewriting somebody's record with no
 * trail is exactly what this exists to prevent.
 */

import { supabase, withSupabaseTimeout } from "@/lib/supabase";

import type { ResultSnapshot } from "@/lib/matchEditText";
export type { ResultSnapshot } from "@/lib/matchEditText";

export const snapshotOf = (m: any): ResultSnapshot => ({
  date: m.date, winner: m.winner, score: m.score || "", status: m.status || "confirmed", p1: m.p1, p2: m.p2,
});

export interface MatchEdit {
  id: string;
  matchId: string;
  p1: string;
  p2: string;
  editedBy: string;
  editedAt: number;
  action: "edit" | "delete";
  before: ResultSnapshot;
  after: ResultSnapshot | null;
}

const fromRow = (r: any): MatchEdit => ({
  id: r.id, matchId: r.match_id, p1: r.p1, p2: r.p2, editedBy: r.edited_by,
  editedAt: new Date(r.edited_at).getTime(), action: r.action, before: r.before, after: r.after ?? null,
});

/** Writes one log row. Returns its id, or throws — and then nothing else happens. */
export async function logMatchEdit(leagueId: string, match: any, action: "edit" | "delete", after: ResultSnapshot | null): Promise<string> {
  if (!supabase) throw new Error("Not connected.");
  const row = {
    league_id: leagueId, match_id: match.id, p1: match.p1, p2: match.p2, action,
    before: snapshotOf(match), after,
  };
  const res: any = await withSupabaseTimeout(supabase.from("match_edits").insert(row).select("id").single() as any, { data: null, error: { message: "timed out" } } as any);
  if (res?.error || !res?.data?.id) {
    const missing = /match_edits/.test(res?.error?.message || "") && /exist|schema cache/i.test(res?.error?.message || "");
    throw new Error(missing ? "Run schema_match_edits.sql first — organiser corrections are logged, and the log isn't there yet." : "Couldn't record the change, so nothing was changed. Try again.");
  }
  return res.data.id;
}

/** Recent corrections touching any of these player rows, newest first. */
export async function listEditsFor(leagueId: string, playerIds: string[], sinceMs: number): Promise<MatchEdit[]> {
  if (!supabase || !playerIds.length) return [];
  const ids = playerIds.map((x) => `"${x.replace(/"/g, "")}"`).join(",");
  const res: any = await withSupabaseTimeout(
    supabase.from("match_edits").select("*").eq("league_id", leagueId)
      .or(`p1.in.(${ids}),p2.in.(${ids})`)
      .gte("edited_at", new Date(sinceMs).toISOString())
      .order("edited_at", { ascending: false }).limit(50) as any,
    { data: [], error: null } as any,
  );
  return (res?.data || []).map(fromRow);
}

/** Email both players about a correction. A courtesy: never an error. */
export async function notifyMatchEdit(editId: string): Promise<void> {
  try {
    if (!supabase) return;
    const s: any = await withSupabaseTimeout(supabase.auth.getSession(), { data: { session: null } } as any);
    const token = s?.data?.session?.access_token;
    if (!token) return;
    await fetch("/api/notify-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ editId }),
    });
  } catch { /* the bell still shows it */ }
}

export { describeResult } from "@/lib/matchEditText";
