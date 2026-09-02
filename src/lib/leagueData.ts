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

async function selectAll(table: string, leagueId: string): Promise<any[]> {
  if (!supabase) return [];
  const result = await withSupabaseTimeout(
    supabase.from(table).select("*").eq("league_id", leagueId),
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
  claimed_at: p.claimedAt ? new Date(p.claimedAt).toISOString() : null,
  inactive: !!p.inactive,
  initial_record: p.initialRecord ?? null,
  initial_elo: p.initialElo ?? null,
});

const rowToPlayer = (r: any) => ({
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
  claimedAt: r.claimed_at ? new Date(r.claimed_at).getTime() : undefined,
  inactive: !!r.inactive,
  initialRecord: r.initial_record ?? undefined,
  initialElo: r.initial_elo ?? undefined,
});

const matchToRow = (leagueId: string, m: any) => ({
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
});

const rowToMatch = (r: any) => ({
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
});

const fixtureToRow = (leagueId: string, f: any) => ({
  id: f.id,
  league_id: leagueId,
  p1: f.p1,
  p2: f.p2,
  done: !!f.done,
  winner: f.winner ?? null,
  match_id: f.matchId ?? null,
  booked: f.booked ? new Date(f.booked).toISOString() : null,
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
  await run(supabase.from("players").insert(playerToRow(leagueId, p)), `adding player ${p.id}`);
}

export async function updatePlayerRow(id: string, patch: any) {
  if (!supabase) return;
  const row = playerToRow("", patch);
  delete (row as any).id;
  delete (row as any).league_id;
  await run(supabase.from("players").update(row).eq("id", id), `updating player ${id}`);
}

// ---- diff-and-sync, used by RallyApp's saveData for every other mutation

async function syncEntity(
  leagueId: string,
  table: string,
  prev: any[],
  next: any[],
  toRow: (leagueId: string, x: any) => any,
) {
  if (!supabase || prev === next) return;
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
    if (!nextIds.has(item.id)) ops.push(run(supabase.from(table).delete().eq("id", item.id), `removing from ${table}`));
  }
  await Promise.all(ops);
}

export const syncPlayers = (leagueId: string, prev: any[], next: any[]) => syncEntity(leagueId, "players", prev, next, playerToRow);
export const syncMatches = (leagueId: string, prev: any[], next: any[]) => syncEntity(leagueId, "matches", prev, next, matchToRow);
export const syncFixtures = (leagueId: string, prev: any[], next: any[]) => syncEntity(leagueId, "fixtures", prev, next, fixtureToRow);
export const syncPosts = (leagueId: string, prev: any[], next: any[]) => syncEntity(leagueId, "posts", prev, next, postToRow);
