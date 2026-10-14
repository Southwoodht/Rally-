import { supabase, withSupabaseTimeout } from "@/lib/supabase";

export interface Trophy {
  id: string;
  kind: "trophy" | "legacy_fact";
  claimed_by: string | null;
  claimant_name: string | null;
  player_id: string | null;
  club_id: string;
  league_id: string | null;
  competition: string | null;
  category: string | null;
  season: string | null;
  result: string | null;
  fact_type: string | null;
  fact_value: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  /** The day it was won, "YYYY-MM-DD" — schema_trophy_won_on.sql. Null for
   *  most honours, and absent entirely on a database without the column. */
  won_on?: string | null;
  /** "singles" | "doubles" | null — schema_trophy_format.sql. */
  format?: string | null;
  clubs?: { name: string } | null;
}

export interface TrophyClaimInput {
  clubId: string;
  claimantName?: string;
  competition: string;
  category?: string;
  season?: string;
  result?: string;
  notes?: string;
  /** "YYYY-MM-DD". */
  wonOn?: string;
  format?: "singles" | "doubles";
}

export interface RecordTrophyInput {
  clubId: string;
  playerId: string;
  playerName?: string;
  competition: string;
  season?: string;
  result?: string;
  notes?: string;
  /** "YYYY-MM-DD". */
  wonOn?: string;
  format?: "singles" | "doubles";
}

export interface LegacyFactClaimInput {
  clubId: string;
  claimantName?: string;
  factType: string;
  factValue: string;
}

// The date goes in the insert only when there is one. On a database that has
// not had schema_trophy_won_on.sql, naming the column at all fails the insert
// — so a trophy given without a date still saves there, and one given WITH a
// date fails loudly rather than silently dropping the day somebody typed.
const wonOnField = (wonOn?: string) => (wonOn && wonOn.trim() ? { won_on: wonOn.trim() } : {});

// Insert a trophy row, carrying its singles/doubles tag when the database has
// the column. A database without schema_trophy_format.sql rejects the unknown
// column; the trophy is then saved without the tag rather than refused,
// because an honour handed out today matters more than which feed it shows in
// — untagged shows on the singles side, where every trophy always has.
async function insertTrophyRow(row: Record<string, any>) {
  const attempt = (r: Record<string, any>) =>
    withSupabaseTimeout(supabase!.from("trophies").insert(r).select().single(), { data: null, error: null } as any);
  let res: any = await attempt(row);
  if (res.error && "format" in row && /format/.test(String(res.error.message || ""))) {
    const { format: _dropped, ...rest } = row;
    res = await attempt(rest);
  }
  return res as { data: any; error: any };
}

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await withSupabaseTimeout(supabase.auth.getUser(), { data: { user: null }, error: null } as any);
  return data.user?.id || null;
}

// Every trophy on Rally is either 100%-Rally-computed (achievements, season
// podium — see core/achievements.ts, never touches this table) or a claim
// that's sat in 'pending' until a club admin approves it. There's no path
// from here to an approved trophy that skips that review.
export async function submitTrophyClaim(input: TrophyClaimInput): Promise<Trophy> {
  if (!supabase) throw new Error("Not connected.");
  const uid = await currentUserId();
  if (!uid) throw new Error("You need to be logged in.");
  const { data, error } = await insertTrophyRow({
    kind: "trophy",
    claimed_by: uid,
    claimant_name: input.claimantName?.trim() || null,
    club_id: input.clubId,
    competition: input.competition.trim(),
    category: input.category?.trim() || null,
    season: input.season?.trim() || null,
    result: input.result?.trim() || null,
    notes: input.notes?.trim() || null,
    ...wonOnField(input.wonOn),
    status: "pending",
    ...(input.format ? { format: input.format } : {}),
  });
  if (error) throw error;
  return data as Trophy;
}

// Same review flow as a trophy claim, just for a career fact instead of a
// competitive honour — e.g. the "when did you start playing?" year from
// onboarding, which is player-reported until a club vouches for it.
export async function submitLegacyFactClaim(input: LegacyFactClaimInput): Promise<Trophy> {
  if (!supabase) throw new Error("Not connected.");
  const uid = await currentUserId();
  if (!uid) throw new Error("You need to be logged in.");
  const { data, error } = await withSupabaseTimeout(
    supabase.from("trophies").insert({
      kind: "legacy_fact",
      claimed_by: uid,
      claimant_name: input.claimantName?.trim() || null,
      club_id: input.clubId,
      fact_type: input.factType,
      fact_value: input.factValue,
      status: "pending",
    }).select().single(),
    { data: null, error: null } as any,
  );
  if (error) throw error;
  return data as Trophy;
}

export async function listMyTrophies(): Promise<Trophy[]> {
  if (!supabase) return [];
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await withSupabaseTimeout(
    supabase.from("trophies").select("*, clubs (name)").eq("claimed_by", uid).order("created_at", { ascending: false }),
    { data: [], error: null } as any,
  );
  if (error) throw error;
  return (data || []) as Trophy[];
}

// Any signed-in user can read approved trophies (RLS-enforced) — used to
// show verified honours on someone else's profile, not just your own.
//
// A trophy can belong to this profile two ways: the person claimed it
// against their own account, or a club admin recorded it against this
// player row back when they had no account. That second case is why the
// transfer needs no rewrite — the trophy stays attached to the row, so
// claiming the row is the whole of it becoming theirs.
export async function listApprovedTrophiesForPlayer(playerId: string, authId?: string | null): Promise<Trophy[]> {
  if (!supabase || !playerId) return [];
  const owners = ["player_id.eq." + playerId];
  if (authId) owners.push("claimed_by.eq." + authId);
  const { data, error } = await withSupabaseTimeout(
    supabase.from("trophies").select("*, clubs (name)").or(owners.join(",")).eq("status", "approved").order("created_at", { ascending: false }),
    { data: [], error: null } as any,
  );
  // player_id is new (schema_trophies_unclaimed.sql). On a database where
  // that hasn't been run the whole query fails on the unknown column, and
  // an empty list here would read as "this player has no trophies" and
  // quietly hide honours somebody really did earn. So fall back to the
  // question the old schema can answer, and only that one goes missing.
  if (error) {
    if (!authId) throw error;
    const { data: legacy, error: legacyError } = await withSupabaseTimeout(
      supabase.from("trophies").select("*, clubs (name)").eq("claimed_by", authId).eq("status", "approved").order("created_at", { ascending: false }),
      { data: [], error: null } as any,
    );
    if (legacyError) throw error;
    return (legacy || []) as Trophy[];
  }
  return (data || []) as Trophy[];
}

// Every dated, approved trophy belonging to anyone in a league — for the
// feed, where a title won is news. Read from the trophies themselves rather
// than written as a post, so taking a trophy down takes its card down with it
// and the two can never disagree.
//
// Each row comes back with the league player it belongs to: the row it was
// recorded against, or the row whose account claimed it.
//
// A database without won_on fails this query on the unknown column; that is
// returned as an empty list on purpose. Unlike the profile, the feed showing
// no trophy cards is exactly what that database would show anyway — there are
// no dates for it to place.
export async function listDatedTrophiesForPlayers(players: Array<{ id: string; auth_id?: string | null }>): Promise<Array<Trophy & { playerId: string }>> {
  if (!supabase || !players.length) return [];
  const ids = players.map((p) => p.id);
  const auths = players.map((p) => p.auth_id).filter(Boolean) as string[];
  const owners = ["player_id.in.(" + ids.map((i) => '"' + i + '"').join(",") + ")"];
  if (auths.length) owners.push("claimed_by.in.(" + auths.join(",") + ")");
  const { data, error } = await withSupabaseTimeout(
    supabase.from("trophies").select("*, clubs (name)").or(owners.join(",")).eq("status", "approved").eq("kind", "trophy").not("won_on", "is", null),
    { data: [], error: null } as any,
  );
  if (error) return [];
  const byAuth: Record<string, string> = {};
  players.forEach((p) => { if (p.auth_id) byAuth[p.auth_id] = p.id; });
  const known = new Set(ids);
  return ((data || []) as Trophy[])
    .map((t) => ({ ...t, playerId: (t.player_id && known.has(t.player_id) ? t.player_id : t.claimed_by ? byAuth[t.claimed_by] : "") || "" }))
    .filter((t) => t.playerId);
}

export async function listPendingClaims(clubId: string): Promise<Trophy[]> {
  if (!supabase) return [];
  const { data, error } = await withSupabaseTimeout(
    supabase.from("trophies").select("*").eq("club_id", clubId).eq("status", "pending").order("created_at", { ascending: true }),
    { data: [], error: null } as any,
  );
  if (error) throw error;
  return (data || []) as Trophy[];
}

export async function approveTrophy(id: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const uid = await currentUserId();
  if (!uid) throw new Error("You need to be logged in.");
  const { error } = await withSupabaseTimeout(
    supabase.from("trophies").update({ status: "approved", verified_by: uid, verified_at: new Date().toISOString() }).eq("id", id),
    { error: null } as any,
  );
  if (error) throw error;
}

export async function rejectTrophy(id: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const uid = await currentUserId();
  if (!uid) throw new Error("You need to be logged in.");
  const { error } = await withSupabaseTimeout(
    supabase.from("trophies").update({ status: "rejected", verified_by: uid, verified_at: new Date().toISOString() }).eq("id", id),
    { error: null } as any,
  );
  if (error) throw error;
}

export async function withdrawTrophyClaim(id: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const { error } = await withSupabaseTimeout(supabase.from("trophies").delete().eq("id", id), { error: null } as any);
  if (error) throw error;
}

// A club admin recording an honour for somebody who has never opened Rally.
// It lands approved with them stamped on it, because they ARE the review —
// see schema_trophies_unclaimed.sql, where RLS insists on exactly that shape
// and on the player row being unclaimed. Nothing here can write onto a live
// account: that still goes through submitTrophyClaim and a second person.
export async function recordTrophyForPlayer(input: RecordTrophyInput): Promise<Trophy> {
  if (!supabase) throw new Error("Not connected.");
  const uid = await currentUserId();
  if (!uid) throw new Error("You need to be logged in.");
  const { data, error } = await insertTrophyRow({
    kind: "trophy",
    claimed_by: null,
    player_id: input.playerId,
    claimant_name: input.playerName?.trim() || null,
    club_id: input.clubId,
    competition: input.competition.trim(),
    season: input.season?.trim() || null,
    result: input.result?.trim() || null,
    notes: input.notes?.trim() || null,
    ...wonOnField(input.wonOn),
    status: "approved",
    verified_by: uid,
    verified_at: new Date().toISOString(),
    ...(input.format ? { format: input.format } : {}),
  });
  if (error) throw error;
  return data as Trophy;
}

// Taking a trophy back down. The same one-line delete serves both cases
// because the interesting part isn't here — RLS decides whether you're the
// claimant taking down your own, or the admin taking down one they
// recorded, and refuses everything else. Doing that check here as well
// would just be a second opinion the database doesn't ask for.
export async function deleteTrophy(id: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const { error } = await withSupabaseTimeout(supabase.from("trophies").delete().eq("id", id), { error: null } as any);
  if (error) throw error;
}
