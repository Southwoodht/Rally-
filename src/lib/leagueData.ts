import { supabase, withSupabaseTimeout } from "@/lib/supabase";

/**
 * Reads/writes the real players/matches/fixtures/posts tables (see
 * supabase/schema_players_matches.sql), replacing the old single-blob
 * shared_storage row per league. RallyApp still works with the same
 * in-memory shape ({ players, matches, fixtures, posts }) it always did —
 * only this file knows the data now lives as real rows.
 *
 * Mirrors the storage.ts fix from the blob-wipe incident: a genuine read
 * failure (timeout/network/RLS-denied-with-error) throws rather than
 * quietly resolving to something that looks like "no data" — callers must
 * never be able to mistake a failed load for an empty league.
 */

const FETCH_FAILED = Symbol("league-data-fetch-failed");

/**
 * Friendlies — matches that belong to no league.
 *
 * A sentinel rather than a real id, so the whole app can go on treating
 * "which league am I in" as one string. Everything downstream — computeStats,
 * the table, a profile, the fixtures list — only ever receives players and
 * matches, so handing it a league-less set makes all of it work unchanged.
 * That is the same trick the dev league uses, and the reason §8's note about
 * computeStats only counting a match when both players are in the list is
 * load-bearing here too.
 *
 * It can never collide with a league id: leagues are uuids.
 */
export const FRIENDLY_LEAGUE_ID = "__friendly";
export const isFriendlyLeague = (id?: string | null) => id === FRIENDLY_LEAGUE_ID;

/** The value that goes in the column. Null is what "no league" is stored as. */
const columnLeagueId = (leagueId: string): string | null => (isFriendlyLeague(leagueId) ? null : leagueId);

async function selectAll(table: string, leagueId: string): Promise<any[]> {
  if (!supabase) return [];
  // RLS does the narrowing for league-less rows: you see a match you played
  // in, and a player row you own or made. Asking for "league_id is null"
  // cannot over-fetch, because the policy has already decided.
  const query = isFriendlyLeague(leagueId)
    ? supabase.from(table).select("*").is("league_id", null)
    : supabase.from(table).select("*").eq("league_id", leagueId);
  const result = await withSupabaseTimeout(
    query,
    FETCH_FAILED as any,
  );
  if (result === (FETCH_FAILED as any)) throw new Error(`Timed out loading "${table}" for league ${leagueId}.`);
  const { data, error } = result;
  if (error) throw error;
  return data || [];
}

const WRITE_FAILED = Symbol("league-data-write-failed");

async function run(promise: PromiseLike<any>, what: string) {
  const result = await withSupabaseTimeout(promise, WRITE_FAILED as any);
  if (result === (WRITE_FAILED as any)) throw new Error(`Timed out ${what}.`);
  if (result.error) throw result.error;
  return result.data;
}

// ---- row <-> app-shape mapping ---------------------------------------

const playerToRow = (leagueId: string, p: any) => ({
  id: p.id,
  league_id: leagueId,
  name: p.name || "",
  last: p.last ?? null,
  nick: p.nick ?? null,
  age: p.age ?? null,
  home: p.home ?? null,
  level: p.level ?? null,
  level_history: p.levelHistory ?? null,
  avatar: p.avatar ?? null,
  avatar_url: p.avatarUrl ?? null,
  auth_id: p.auth_id ?? null,
  // Only ever set on a league-less row, where there is no club to appeal to
  // about a shell somebody got wrong. Null on a league player, which is what
  // every existing row already is.
  created_by: p.created_by ?? null,
  claimed_at: p.claimedAt ? new Date(p.claimedAt).toISOString() : null,
  inactive: !!p.inactive,
  initial_record: p.initialRecord ?? null,
  initial_elo: p.initialElo ?? null,
});

export const rowToPlayer = (r: any) => ({
  id: r.id,
  name: r.name,
  last: r.last ?? undefined,
  nick: r.nick ?? undefined,
  age: r.age ?? undefined,
  home: r.home ?? undefined,
  level: r.level ?? null,
  levelHistory: r.level_history ?? undefined,
  avatar: r.avatar ?? null,
  avatarUrl: r.avatar_url ?? undefined,
  auth_id: r.auth_id ?? null,
  created_by: r.created_by ?? null,
  claimedAt: r.claimed_at ? new Date(r.claimed_at).getTime() : undefined,
  inactive: !!r.inactive,
  initialRecord: r.initial_record ?? undefined,
  initialElo: r.initial_elo ?? undefined,
});

const matchToRow = (leagueId: string, m: any) => (assertWritable(m), {
  id: m.id,
  league_id: leagueId,
  p1: m.p1,
  p2: m.p2,
  date: new Date(m.date).toISOString(),
  winner: m.winner,
  score: m.score ?? null,
  status: m.status || "confirmed",
  reported_by: m.reportedBy ?? null,
  notes: m.notes ?? null,
  venue: m.venue ?? null,
  photo_url: m.photoUrl ?? null,
  category: m.category ?? null,
  pending_edit: m.pendingEdit ?? null,
  delete_requested_by: m.deleteRequestedBy ?? null,
  delete_requested_at: m.deleteRequestedAt ? new Date(m.deleteRequestedAt).toISOString() : null,
});

const NO_RESULT = new Set(["proposed", "scheduled", "awaiting", "cancelled", "declined"]);

/**
 * A match with no winner is only legitimate while it is a booking. Anything
 * else is a bug upstream, and writing it would put a row into the ratings'
 * reach that nothing can score — so it is refused here, loudly, rather than
 * stored and puzzled over later.
 */
const assertWritable = (m: any) => {
  if (!m.winner && !NO_RESULT.has(m.status)) {
    throw new Error(`Refusing to save match ${m.id}: status "${m.status}" needs a winner.`);
  }
};

export const rowToMatch = (r: any) => ({
  nudgedAt: r.nudged_at ? new Date(r.nudged_at).getTime() : null,
  id: r.id,
  date: new Date(r.date).getTime(),
  p1: r.p1,
  p2: r.p2,
  winner: r.winner,
  score: r.score ?? undefined,
  status: r.status,
  reportedBy: r.reported_by ?? null,
  notes: r.notes ?? undefined,
  venue: r.venue ?? undefined,
  photoUrl: r.photo_url ?? undefined,
  category: r.category ?? undefined,
  pendingEdit: r.pending_edit ?? undefined,
  // Drives the 24h auto-confirm sweep in RallyApp.tsx. Sourced from the
  // row's own created_at (set server-side, once, on insert) rather than
  // trusting a client-supplied timestamp — this was silently dropped
  // entirely by this mapping before, which is why auto-confirm stopped
  // working the moment matches moved off the blob and onto this table.
  loggedAt: r.created_at ? new Date(r.created_at).getTime() : undefined,
  deleteRequestedBy: r.delete_requested_by ?? undefined,
  deleteRequestedAt: r.delete_requested_at ? new Date(r.delete_requested_at).getTime() : undefined,
});

/** A date we can store, or nothing. Never a throw. */
const toIsoOrNull = (v: any): string | null => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return isNaN(t) ? null : new Date(t).toISOString();
};

const fixtureToRow = (leagueId: string, f: any) => ({
  id: f.id,
  league_id: leagueId,
  p1: f.p1,
  p2: f.p2,
  done: !!f.done,
  winner: f.winner ?? null,
  match_id: f.matchId ?? null,
  booked: toIsoOrNull(f.booked),
});

const rowToFixture = (r: any) => ({
  id: r.id,
  p1: r.p1,
  p2: r.p2,
  done: !!r.done,
  winner: r.winner ?? undefined,
  matchId: r.match_id ?? undefined,
  booked: r.booked ?? undefined,
});

const postToRow = (leagueId: string, p: any) => ({
  id: p.id,
  league_id: leagueId,
  by_player_id: p.by ?? null,
  text: p.text || "",
  is_announcement: !!p.isAnnouncement,
  date: new Date(p.date || Date.now()).toISOString(),
});

const rowToPost = (r: any) => ({
  id: r.id,
  by: r.by_player_id ?? null,
  text: r.text,
  isAnnouncement: !!r.is_announcement,
  date: new Date(r.date).getTime(),
});

// ---- fetch --------------------------------------------------------------

export async function fetchLeagueData(leagueId: string) {
  const [playerRows, matchRows, fixtureRows, postRows] = await Promise.all([
    selectAll("players", leagueId),
    selectAll("matches", leagueId),
    selectAll("fixtures", leagueId),
    selectAll("posts", leagueId),
  ]);
  return {
    players: playerRows.map(rowToPlayer),
    matches: matchRows.map(rowToMatch),
    fixtures: fixtureRows.map(rowToFixture),
    posts: postRows.map(rowToPost),
  };
}

// ---- single-row writes, used by boot/claim flows -----------------------

export async function insertPlayerRow(leagueId: string, p: any) {
  if (!supabase) return;
  // columnLeagueId, not leagueId. This is the one write path that does not
  // go through syncEntity, so it has to translate the friendly sentinel
  // itself — otherwise it tries to put "__friendly" into a uuid column and
  // the insert fails at exactly the moment somebody is creating their first
  // player.
  await run(supabase.from("players").insert(playerToRow(columnLeagueId(leagueId) as any, p)), `adding player ${p.id}`);
}

export async function updatePlayerRow(id: string, patch: any) {
  if (!supabase) return;
  const row = playerToRow("", patch);
  delete (row as any).id;
  delete (row as any).league_id;
  await run(supabase.from("players").update(row).eq("id", id), `updating player ${id}`);
}

/**
 * Delete one row, and make sure it actually went.
 *
 * A DELETE that RLS refuses is **not an error** in Postgres — it matches no
 * rows and reports success. So a delete the database quietly declined looked
 * exactly like one that worked: the row vanished from the screen, saveData
 * saw no failure, and it was back on the next load. That is not a
 * hypothetical; the delete-agreement migration was written after it happened
 * once, and it happened again.
 *
 * So: ask for the deleted rows back, and if none came, look. A row that is
 * still there was refused, and that has to reach saveData as a failure so it
 * re-reads and shows what the database really holds. A row that is simply
 * gone is a success — deleting something twice is not an error.
 */
async function deleteRow(table: string, id: string) {
  const { error } = await withSupabaseTimeout(
    supabase!.from(table).delete().eq("id", id).select("id"),
    { error: { message: "timed out" } } as any,
  );
  if (error) throw error;
  const check: any = await withSupabaseTimeout(
    supabase!.from(table).select("id").eq("id", id).maybeSingle(),
    { data: null, error: null } as any,
  );
  if (check?.data) {
    // Tagged so saveData can put THIS on screen instead of its generic
    // "couldn't save". A refusal has a cause the person can act on; a
    // network blip does not.
    const e: any = new Error(
      table === "matches"
        ? "That delete was refused. If the other player has an account they need to agree first — otherwise supabase/schema_match_delete_shell_and_pending.sql hasn't been run yet."
        : `Removing from ${table} was refused.`,
    );
    e.userFacing = true;
    throw e;
  }
}

// ---- diff-and-sync, used by RallyApp's saveData for every other mutation

async function syncEntity(
  leagueIdRaw: string,
  table: string,
  prev: any[],
  next: any[],
  toRow: (leagueId: any, x: any) => any,
) {
  if (!supabase || prev === next) return;
  // The sentinel never reaches a row. Translated once here so the four
  // mappers do not each have to remember.
  const leagueId: any = columnLeagueId(leagueIdRaw);
  const prevMap = new Map(prev.map((x) => [x.id, x]));
  const nextIds = new Set(next.map((x) => x.id));
  const ops: Promise<any>[] = [];
  for (const item of next) {
    const old = prevMap.get(item.id);
    if (!old) {
      ops.push(run(supabase.from(table).insert(toRow(leagueId, item)), `adding to ${table}`));
    } else if (JSON.stringify(old) !== JSON.stringify(item)) {
      const row = toRow(leagueId, item);
      delete (row as any).id;
      delete (row as any).league_id;
      ops.push(run(supabase.from(table).update(row).eq("id", item.id), `updating ${table}`));
    }
  }
  for (const item of prev) {
    if (!nextIds.has(item.id)) ops.push(deleteRow(table, item.id));
  }
  await Promise.all(ops);
}

export const syncPlayers = (leagueId: string, prev: any[], next: any[]) => syncEntity(leagueId, "players", prev, next, playerToRow);
export const syncMatches = (leagueId: string, prev: any[], next: any[]) => syncEntity(leagueId, "matches", prev, next, matchToRow);
export const syncFixtures = (leagueId: string, prev: any[], next: any[]) => syncEntity(leagueId, "fixtures", prev, next, fixtureToRow);
export const syncPosts = (leagueId: string, prev: any[], next: any[]) => syncEntity(leagueId, "posts", prev, next, postToRow);
