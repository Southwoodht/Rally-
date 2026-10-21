import { supabase, withSupabaseTimeout } from "@/lib/supabase";

/**
 * A league owner or editor filling in a level for somebody who never has.
 *
 * Not a normal save, and deliberately not reachable through saveData. Every
 * other write in the app goes players -> syncPlayers -> update, and that
 * update is refused by RLS the moment the row has an auth_id — correctly, and
 * that refusal is the protection, not a bug to route around. This writes four
 * separate columns through a security-definer function that checks the caller
 * is staff of that player's league and can write nothing else.
 *
 * The estimate never becomes their claim. `level` and `level_history` are
 * untouched; the app reads their own values first and falls back to these only
 * when they have said nothing. See supabase/schema_level_estimate.sql.
 */
export async function setLevelEstimate(
  playerId: string,
  level: { cat: string; sub: string } | null,
  history: any[] | null,
): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const result: any = await withSupabaseTimeout(
    supabase.rpc("set_player_level_estimate", {
      p_player_id: playerId,
      p_level: level,
      p_history: history && history.length ? history : null,
    }),
    { error: { message: "timed out" } } as any,
  );
  if (result?.error) {
    // The function raises with a sentence meant for a person — "Only a league
    // owner or editor can set a level estimate." — so pass it through rather
    // than replacing it with a generic failure. The one exception is a missing
    // function, which means the migration has not been run and says nothing
    // useful on its own.
    const msg = String(result.error.message || "");
    const e: any = new Error(
      /does not exist|schema cache|function/i.test(msg) && /set_player_level_estimate/i.test(msg)
        ? "Level estimates aren't switched on yet — supabase/schema_level_estimate.sql hasn't been run."
        : msg || "Couldn't save that estimate.",
    );
    e.userFacing = true;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Organisers set levels (schema_levels_organisers.sql, brief item 2)
// ---------------------------------------------------------------------------

const missingFn = (e: any, name: string) =>
  /does not exist|schema cache|could not find/i.test(String(e?.message || "")) && String(e?.message || "").includes(name);

/**
 * An organiser setting a player's real level and its dated timeline — anyone
 * in their club, signed up or not. The caller builds `history` with
 * withLevelChange (core/levels.ts), so the level and the period that dates
 * it always travel together.
 */
export async function setPlayerLevel(playerId: string, level: { cat: string; sub: string } | null, history: any[]): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const result: any = await withSupabaseTimeout(
    supabase.rpc("set_player_level", { p_player_id: playerId, p_level: level, p_history: history }),
    { error: { message: "timed out" } } as any,
  );
  if (result?.error) {
    throw new Error(missingFn(result.error, "set_player_level")
      ? "Organiser levels aren't switched on yet — supabase/schema_levels_organisers.sql hasn't been run."
      : String(result.error.message || "Couldn't set that level."));
  }
}

export interface LevelRequest {
  id: string;
  leagueId: string;
  playerId: string;
  level: { cat: string; sub: string };
  note: string | null;
  status: "pending" | "approved" | "declined";
  createdAt: number;
}

const rowToRequest = (r: any): LevelRequest => ({
  id: r.id, leagueId: r.league_id, playerId: r.player_id, level: r.level, note: r.note ?? null,
  status: r.status, createdAt: new Date(r.created_at).getTime(),
});

/** A player asking the organisers for a different level. One pending at a time. */
export async function requestLevelChange(leagueId: string, playerId: string, level: { cat: string; sub: string }, note: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const { error }: any = await withSupabaseTimeout(
    supabase.from("level_requests").insert({ league_id: leagueId, player_id: playerId, level, note: note.trim() || null }),
    { error: { message: "timed out" } } as any,
  );
  if (error) {
    if (error.code === "23505") throw new Error("You already have a request waiting. The organisers will look at it.");
    if (/level_requests/.test(String(error.message || "")) && /does not exist|schema cache|could not find/i.test(String(error.message || ""))) {
      throw new Error("Level requests aren't switched on yet — supabase/schema_levels_organisers.sql hasn't been run.");
    }
    throw error;
  }
}

/**
 * Requests for a club: pending ones for organisers, your own for a player
 * (RLS decides which). Null when the table is not there yet, so a screen can
 * say nothing rather than "no requests" (§2: a failed read is not empty).
 */
export async function loadLevelRequests(leagueId: string): Promise<LevelRequest[] | null> {
  if (!supabase) return null;
  const { data, error }: any = await withSupabaseTimeout(
    supabase.from("level_requests").select("*").eq("league_id", leagueId).order("created_at", { ascending: true }),
    { data: null, error: { message: "timed out" } } as any,
  );
  if (error) return null;
  return (data || []).map(rowToRequest);
}

/** Approve or decline. Approving does NOT set the level by itself — the caller does that first, through setPlayerLevel. */
export async function decideLevelRequest(id: string, status: "approved" | "declined"): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
  const { data, error }: any = await withSupabaseTimeout(
    supabase.from("level_requests").update({ status, decided_by: uid, decided_at: new Date().toISOString() }).eq("id", id).select("id"),
    { data: null, error: { message: "timed out" } } as any,
  );
  if (error) throw error;
  if (!data || !data.length) throw new Error("Only an organiser can decide a level request.");
}
