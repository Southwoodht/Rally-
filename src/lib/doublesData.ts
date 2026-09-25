import { supabase, withSupabaseTimeout } from "@/lib/supabase";
import type { DoublesMatch } from "@/core/doubles/elo";

/**
 * Reading and writing doubles matches.
 *
 * A SEPARATE FILE FROM leagueData.ts, for the same reason doubles_matches is a
 * separate table: leagueData's syncEntity diffs prev against next and writes
 * the difference, and every one of its callers passes arrays of singles
 * matches. Adding doubles to that pipeline would put two row shapes through
 * one differ.
 *
 * IT KEEPS leagueData's FAILURE DISCIPLINE, which is the important part. A
 * failed read must never look like an empty result: callers treat empty as
 * licence to seed fresh data over whatever is really there, and CLAUDE.md
 * records what that cost. So a timeout or an error throws; it does not return
 * [].
 */

const FETCH_FAILED = Symbol("doubles-fetch-failed");
const WRITE_FAILED = Symbol("doubles-write-failed");

/** The app shape, plus the fields only the screens care about. */
export interface DoublesRow extends DoublesMatch {
  leagueId: string;
  /** [{ a, b }] in order. Team A's games are always `a`. */
  sets: Array<{ a: number; b: number }>;
  enteredBy: string | null;
  confirmedBy: string | null;
  competitionId: string | null;
  fixtureId: string | null;
}

export const rowToDoubles = (r: any): DoublesRow => ({
  id: r.id,
  leagueId: r.league_id,
  // The engine sorts on a number; the column is a timestamptz.
  playedAt: new Date(r.played_at).getTime(),
  teamA: [r.team_a_p1, r.team_a_p2],
  teamB: [r.team_b_p1, r.team_b_p2],
  winner: r.winner,
  status: r.status,
  sets: Array.isArray(r.sets) ? r.sets : [],
  enteredBy: r.entered_by ?? null,
  confirmedBy: r.confirmed_by ?? null,
  competitionId: r.competition_id ?? null,
  fixtureId: r.fixture_id ?? null,
});

/**
 * `id`, `created_at` and `updated_at` are deliberately absent.
 *
 * The database owns all three — id has a default, created_at has a default,
 * and updated_at is set by the sanity trigger on every write. Writing them
 * from here would be the mistake CLAUDE.md section 6 warns about from the
 * other direction: a column missing from a mapper is evidence about the app,
 * not about the database.
 */
const doublesToRow = (leagueId: string, m: Partial<DoublesRow>) => ({
  league_id: leagueId,
  played_at: new Date(m.playedAt ?? Date.now()).toISOString(),
  team_a_p1: m.teamA?.[0],
  team_a_p2: m.teamA?.[1],
  team_b_p1: m.teamB?.[0],
  team_b_p2: m.teamB?.[1],
  sets: m.sets ?? [],
  winner: m.winner,
  status: m.status ?? "confirmed",
  entered_by: m.enteredBy ?? null,
  confirmed_by: m.confirmedBy ?? null,
  competition_id: m.competitionId ?? null,
  fixture_id: m.fixtureId ?? null,
});

async function run(promise: PromiseLike<any>, what: string) {
  const result: any = await withSupabaseTimeout(promise, WRITE_FAILED as any);
  if (result === (WRITE_FAILED as any)) throw new Error(`Timed out ${what}.`);
  if (result.error) throw result.error;
  return result.data;
}

/**
 * Every doubles match in a league.
 *
 * Returns [] only when the table genuinely holds nothing. If the table does
 * not exist yet — schema_doubles.sql not run — that is an error from
 * PostgREST and it propagates, because "the feature is not installed" and
 * "nobody has played doubles" must not look the same. The caller decides what
 * to show; see loadDoublesSafe below for the one place that difference is
 * deliberately flattened.
 */
export async function loadDoubles(leagueId: string): Promise<DoublesRow[]> {
  if (!supabase) return [];
  const result: any = await withSupabaseTimeout(
    supabase.from("doubles_matches").select("*").eq("league_id", leagueId),
    FETCH_FAILED as any,
  );
  if (result === (FETCH_FAILED as any)) throw new Error("Timed out loading doubles matches.");
  if (result.error) throw result.error;
  return (result.data || []).map(rowToDoubles);
}

/**
 * The same read, for screens that must render whether or not the migration
 * has been run.
 *
 * It returns null rather than [] on failure, so a caller can tell "no doubles
 * yet" from "could not ask" and say so. Never make this return [] — that is
 * exactly the collapse the sentinels in storage.ts exist to prevent.
 */
export async function loadDoublesSafe(leagueId: string): Promise<DoublesRow[] | null> {
  try {
    return await loadDoubles(leagueId);
  } catch {
    return null;
  }
}

export async function insertDoubles(leagueId: string, m: Partial<DoublesRow>): Promise<DoublesRow> {
  if (!supabase) throw new Error("Not connected.");
  const data = await run(
    supabase.from("doubles_matches").insert(doublesToRow(leagueId, m)).select().single(),
    "saving the doubles match",
  );
  return rowToDoubles(data);
}

export async function updateDoubles(id: string, patch: Partial<DoublesRow>, leagueId: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const row: any = doublesToRow(leagueId, patch);
  // Only send what the caller actually set. A partial patch that spelled every
  // other column as undefined would blank them.
  for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];
  await run(supabase.from("doubles_matches").update(row).eq("id", id), "updating the doubles match");
}

/**
 * A DELETE THAT RLS REFUSES IS NOT AN ERROR IN POSTGRES — it matches no rows
 * and reports success. So ask for the deleted rows back and, if none came,
 * look to see whether the row survived. leagueData.ts's deleteRow learned
 * this the hard way; anything writing a delete against Supabase needs it or
 * it will lie.
 */
export async function deleteDoubles(id: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const gone = await run(
    supabase.from("doubles_matches").delete().eq("id", id).select("id"),
    "deleting the doubles match",
  );
  if (gone && gone.length) return;
  const still: any = await withSupabaseTimeout(
    supabase.from("doubles_matches").select("id").eq("id", id).maybeSingle(),
    FETCH_FAILED as any,
  );
  if (still !== (FETCH_FAILED as any) && !still.error && still.data) {
    throw new Error("That delete was refused — only league staff can delete a doubles match.");
  }
}
