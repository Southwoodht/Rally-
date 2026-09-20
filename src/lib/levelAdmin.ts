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
