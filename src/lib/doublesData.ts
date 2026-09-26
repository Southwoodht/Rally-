import { supabase, withSupabaseTimeout } from "@/lib/supabase";
import type { DoublesMatch } from "@/core/doubles/elo";
import type { Competition, CompetitionPair, Tie } from "@/core/doubles/competition";

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
  /** The competition entries on each side, when this was a competition tie. */
  teamAPairId: string | null;
  teamBPairId: string | null;
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
  teamAPairId: r.team_a_pair_id ?? null,
  teamBPairId: r.team_b_pair_id ?? null,
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
  team_a_pair_id: m.teamAPairId ?? null,
  team_b_pair_id: m.teamBPairId ?? null,
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

// ---------------------------------------------------------------------------
// Doubles fixtures — a booked match that has not been played yet
// ---------------------------------------------------------------------------
//
// Its own table (schema_doubles_fixtures.sql), for the reason written at the
// top of that file: public.fixtures is (p1, p2) and every reader of it would
// show a doubles booking as a singles one between the first two players.

export interface DoublesFixture {
  id: string;
  leagueId: string;
  teamA: [string, string];
  teamB: [string, string];
  /** ms, or null for "agreed but not scheduled" — as fixtures.booked. */
  booked: number | null;
  done: boolean;
  matchId: string | null;
  createdBy: string | null;
  /** Set on a competition tie (schema_doubles_competitions.sql); null otherwise. */
  competitionId: string | null;
  round: number | null;
  pairA: string | null;
  pairB: string | null;
}

export const rowToDoublesFixture = (r: any): DoublesFixture => ({
  id: r.id,
  leagueId: r.league_id,
  teamA: [r.team_a_p1, r.team_a_p2],
  teamB: [r.team_b_p1, r.team_b_p2],
  booked: r.booked ? new Date(r.booked).getTime() : null,
  done: !!r.done,
  matchId: r.match_id ?? null,
  createdBy: r.created_by ?? null,
  competitionId: r.competition_id ?? null,
  round: r.round ?? null,
  pairA: r.pair_a ?? null,
  pairB: r.pair_b ?? null,
});

/**
 * Null on failure, never [] — see loadDoublesSafe. This one matters more than
 * that one: doubles_fixtures is a SEPARATE migration from doubles_matches, so
 * a league can have doubles switched on and working while this table does
 * not exist yet. "Nothing booked" would be a lie told on exactly that day.
 */
export async function loadDoublesFixturesSafe(leagueId: string): Promise<DoublesFixture[] | null> {
  if (!supabase) return [];
  try {
    const result: any = await withSupabaseTimeout(
      supabase.from("doubles_fixtures").select("*").eq("league_id", leagueId),
      FETCH_FAILED as any,
    );
    if (result === (FETCH_FAILED as any) || result.error) return null;
    return (result.data || []).map(rowToDoublesFixture);
  } catch {
    return null;
  }
}

export async function insertDoublesFixture(
  leagueId: string,
  f: { teamA: [string, string]; teamB: [string, string]; booked: number | null; createdBy: string | null },
): Promise<DoublesFixture> {
  if (!supabase) throw new Error("Not connected.");
  // id, done, match_id and created_at are the database's defaults.
  const data = await run(
    supabase.from("doubles_fixtures").insert({
      league_id: leagueId,
      team_a_p1: f.teamA[0], team_a_p2: f.teamA[1],
      team_b_p1: f.teamB[0], team_b_p2: f.teamB[1],
      booked: f.booked ? new Date(f.booked).toISOString() : null,
      created_by: f.createdBy,
    }).select().single(),
    "booking the doubles match",
  );
  return rowToDoublesFixture(data);
}

export async function updateDoublesFixture(
  id: string,
  patch: { booked?: number | null; done?: boolean; matchId?: string | null },
): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const row: any = {};
  if (patch.booked !== undefined) row.booked = patch.booked ? new Date(patch.booked).toISOString() : null;
  if (patch.done !== undefined) row.done = patch.done;
  if (patch.matchId !== undefined) row.match_id = patch.matchId;
  await run(supabase.from("doubles_fixtures").update(row).eq("id", id), "updating the doubles booking");
}

/** Same refused-delete check as deleteDoubles, for the same reason. */
export async function deleteDoublesFixture(id: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const gone = await run(
    supabase.from("doubles_fixtures").delete().eq("id", id).select("id"),
    "cancelling the doubles match",
  );
  if (gone && gone.length) return;
  const still: any = await withSupabaseTimeout(
    supabase.from("doubles_fixtures").select("id").eq("id", id).maybeSingle(),
    FETCH_FAILED as any,
  );
  if (still !== (FETCH_FAILED as any) && !still.error && still.data) {
    throw new Error("That cancel was refused — only the four players or league staff can cancel it.");
  }
}

// ---------------------------------------------------------------------------
// Competitions — schema_doubles_competitions.sql
// ---------------------------------------------------------------------------


const rowToCompetition = (r: any): Competition => ({
  id: r.id,
  leagueId: r.league_id,
  name: r.name,
  format: r.format,
  legs: r.legs ?? 1,
  pointsWin: r.points_win ?? 3,
  pointsDraw: r.points_draw ?? 1,
  status: r.status,
  createdBy: r.created_by ?? null,
  createdAt: new Date(r.created_at).getTime(),
});

const rowToPair = (r: any): CompetitionPair => ({
  id: r.id, competitionId: r.competition_id, p1: r.p1, p2: r.p2, seed: r.seed,
});

/**
 * Every competition in the league, with its pairs. Null on failure, never
 * empty — same rule as the other Safe reads, and it matters more here: the
 * tables are a separate migration, so "no competitions" and "cannot ask" will
 * genuinely differ on the day between the code shipping and the SQL running.
 */
export async function loadCompetitionsSafe(leagueId: string): Promise<{ competitions: Competition[]; pairs: CompetitionPair[] } | null> {
  if (!supabase) return { competitions: [], pairs: [] };
  try {
    const comps: any = await withSupabaseTimeout(
      supabase.from("doubles_competitions").select("*").eq("league_id", leagueId),
      FETCH_FAILED as any,
    );
    if (comps === (FETCH_FAILED as any) || comps.error) return null;
    const competitions = (comps.data || []).map(rowToCompetition);
    if (!competitions.length) return { competitions, pairs: [] };
    const pr: any = await withSupabaseTimeout(
      supabase.from("doubles_competition_pairs").select("*").in("competition_id", competitions.map((c: Competition) => c.id)),
      FETCH_FAILED as any,
    );
    if (pr === (FETCH_FAILED as any) || pr.error) return null;
    return { competitions, pairs: (pr.data || []).map(rowToPair) };
  } catch {
    return null;
  }
}

/** The four players of a tie, looked up from its two pairs. */
const tieRow = (leagueId: string, competitionId: string, t: Tie, byId: Map<string, CompetitionPair>, createdBy: string | null) => {
  const a = byId.get(t.pairA)!, b = byId.get(t.pairB)!;
  return {
    league_id: leagueId, competition_id: competitionId, round: t.round,
    pair_a: a.id, pair_b: b.id,
    team_a_p1: a.p1, team_a_p2: a.p2, team_b_p1: b.p1, team_b_p2: b.p2,
    created_by: createdBy,
  };
};

/**
 * Create a competition, its pairs, and the ties that can be drawn now.
 *
 * THREE WRITES, NO TRANSACTION (§7). Ordered so a failure part-way leaves
 * something a person can see and delete, never something invisible: the
 * competition row first, so a failed pairs insert leaves an empty competition
 * on screen with a Delete button rather than orphaned pairs nobody can reach.
 */
export async function createCompetition(
  leagueId: string,
  c: { name: string; format: Competition["format"]; legs: number; pointsWin: number; pointsDraw: number; createdBy: string | null },
  pairs: Array<{ p1: string; p2: string }>,
  schedule: (pairs: CompetitionPair[]) => Tie[],
): Promise<{ competition: Competition; pairs: CompetitionPair[]; fixtures: DoublesFixture[] }> {
  if (!supabase) throw new Error("Not connected.");
  const comp = rowToCompetition(await run(
    supabase.from("doubles_competitions").insert({
      league_id: leagueId, name: c.name.trim(), format: c.format, legs: c.legs,
      points_win: c.pointsWin, points_draw: c.pointsDraw, created_by: c.createdBy,
    }).select().single(),
    "creating the competition",
  ));
  const saved: CompetitionPair[] = (await run(
    supabase.from("doubles_competition_pairs").insert(
      pairs.map((p, i) => ({ competition_id: comp.id, p1: p.p1, p2: p.p2, seed: i + 1 })),
    ).select(),
    "entering the pairs",
  ) || []).map(rowToPair);
  const fixtures = await drawTies(leagueId, comp.id, schedule(saved), saved, c.createdBy);
  return { competition: comp, pairs: saved, fixtures };
}

/** Insert ties as doubles fixtures. The unique index makes a double draw harmless. */
export async function drawTies(
  leagueId: string, competitionId: string, ties: Tie[], pairs: CompetitionPair[], createdBy: string | null,
): Promise<DoublesFixture[]> {
  if (!supabase) throw new Error("Not connected.");
  if (!ties.length) return [];
  const byId = new Map(pairs.map((p) => [p.id, p]));
  const data = await run(
    supabase.from("doubles_fixtures").insert(ties.map((t) => tieRow(leagueId, competitionId, t, byId, createdBy))).select(),
    "drawing the fixtures",
  );
  return (data || []).map(rowToDoublesFixture);
}

export async function finishCompetition(id: string, finished: boolean): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  await run(supabase.from("doubles_competitions").update({ status: finished ? "finished" : "running" }).eq("id", id), "updating the competition");
}

/**
 * Delete a competition. Its unplayed fixtures and its pairs go with it
 * (cascade); results already played are doubles matches and are kept.
 * Same refused-delete check as every other delete here.
 */
export async function deleteCompetition(id: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const gone = await run(
    supabase.from("doubles_competitions").delete().eq("id", id).select("id"),
    "deleting the competition",
  );
  if (gone && gone.length) return;
  throw new Error("That delete was refused — only league staff can delete a competition.");
}
