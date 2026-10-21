import { supabase, withSupabaseTimeout } from "@/lib/supabase";
import type { Season } from "@/core/seasons";

/**
 * Seasons, from the `seasons` table (supabase/schema_seasons.sql).
 *
 * The failure discipline is leagueData's: a failed read is never an empty
 * list. `loadSeasons` returns null only for "the table does not exist yet",
 * which is the one case the caller should answer by falling back to the old
 * season in the club's settings blob — any other failure throws, because
 * "this club has no seasons" is exactly the wrong thing to show when the
 * truth is "we could not ask".
 */

const TIMED_OUT = Symbol("timed out");

async function run(promise: PromiseLike<any>, what: string) {
  const result: any = await withSupabaseTimeout(promise, TIMED_OUT as any);
  if (result === (TIMED_OUT as any)) throw new Error(`Timed out ${what}.`);
  if (result.error) throw result.error;
  return result.data;
}

const missingTable = (e: any) =>
  /relation .*seasons.* does not exist|could not find the table|schema cache/i.test(String(e?.message || "")) || e?.code === "42P01" || e?.code === "PGRST205";

export const rowToSeason = (r: any): Season => ({
  id: r.id,
  leagueId: r.league_id,
  name: r.name,
  startsOn: r.starts_on,
  endsOn: r.ends_on ?? null,
  status: r.status === "ended" ? "ended" : "active",
  endedAt: r.ended_at ? new Date(r.ended_at).getTime() : null,
});

/** Every season of a club, newest first; null when the table is not installed. */
export async function loadSeasons(leagueId: string): Promise<Season[] | null> {
  if (!supabase) return null;
  try {
    const rows = await run(
      supabase.from("seasons").select("*").eq("league_id", leagueId).order("starts_on", { ascending: false }),
      "loading seasons",
    );
    return (rows || []).map(rowToSeason);
  } catch (e) {
    if (missingTable(e)) return null;
    throw e;
  }
}

export async function createSeason(leagueId: string, s: { name: string; startsOn: string; endsOn: string | null }): Promise<Season> {
  if (!supabase) throw new Error("Not connected.");
  try {
    const row = await run(
      supabase.from("seasons").insert({ league_id: leagueId, name: s.name.trim(), starts_on: s.startsOn, ends_on: s.endsOn }).select().single(),
      "starting the season",
    );
    return rowToSeason(row);
  } catch (e: any) {
    // The unique index: one active season per club. Say it in words.
    if (e?.code === "23505") throw new Error("A season is already running. End it before starting another.");
    if (missingTable(e)) throw new Error("Seasons aren't switched on yet — supabase/schema_seasons.sql hasn't been run.");
    throw e;
  }
}

export async function updateSeason(id: string, patch: { name?: string; startsOn?: string; endsOn?: string | null }): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const row: any = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.startsOn !== undefined) row.starts_on = patch.startsOn;
  if (patch.endsOn !== undefined) row.ends_on = patch.endsOn;
  const data = await run(supabase.from("seasons").update(row).eq("id", id).select("id"), "saving the season");
  // An update RLS refuses matches no rows and reports success (§6). Ask for
  // the row back and treat none as the refusal it is.
  if (!data || !data.length) throw new Error("Only an organiser can change the season.");
}

/** Ends it now, by hand. Keeps the row; its standings freeze at this moment. */
export async function endSeason(id: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const data = await run(
    supabase.from("seasons").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", id).eq("status", "active").select("id"),
    "ending the season",
  );
  if (!data || !data.length) throw new Error("Only an organiser can end the season.");
}

/**
 * Close the season if its last day has passed. True only for the one caller
 * who actually closed it — that caller posts the winners, nobody else.
 * Quietly false on any failure: a missed close is retried on the next open.
 */
export async function closeSeasonIfDue(id: string): Promise<boolean> {
  if (!supabase || id === "legacy") return false;
  try {
    const data = await run(supabase.rpc("close_season_if_due", { p_season: id }), "closing the season");
    return data === true;
  } catch {
    return false;
  }
}
