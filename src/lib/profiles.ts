import { supabase, withSupabaseTimeout } from "@/lib/supabase";

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  friend_code: string;
}

const FAILED = Symbol("profiles-failed");

async function run(promise: PromiseLike<any>, what: string): Promise<any> {
  const result: any = await withSupabaseTimeout(promise, FAILED as any);
  if (result === (FAILED as any)) throw new Error(`Timed out ${what}.`);
  if (result.error) throw result.error;
  return result.data;
}

export async function getMyProfile(): Promise<Profile | null> {
  if (!supabase) return null;
  const { data: userData } = await withSupabaseTimeout(supabase.auth.getUser(), { data: { user: null }, error: null } as any);
  const uid = (userData as any)?.user?.id;
  if (!uid) return null;
  const data = await run(supabase.from("profiles").select("*").eq("id", uid).maybeSingle(), "loading your profile");
  return data as Profile | null;
}

// Search by display name (contains) or an exact friend code — friend codes
// are short and typo-prone, so an exact match only avoids false positives.
// Two separate filtered queries rather than building a combined filter
// string from raw user input, which PostgREST's .or() syntax would parse
// as structured (comma-separated) query syntax, not a literal value.
export async function searchProfiles(query: string, excludeId?: string): Promise<Profile[]> {
  if (!supabase) return [];
  const q = query.trim();
  if (!q) return [];
  const [byName, byCode] = await Promise.all([
    run(supabase.from("profiles").select("*").ilike("display_name", `%${q}%`).limit(20), "searching players"),
    run(supabase.from("profiles").select("*").eq("friend_code", q.toUpperCase()).limit(1), "searching players"),
  ]);
  const seen = new Map<string, Profile>();
  for (const row of [...((byCode as Profile[]) || []), ...((byName as Profile[]) || [])]) seen.set(row.id, row);

  // Nicknames live on league rows, which a stranger cannot read, so matching
  // them needs a function. Without it, searching "Cheese" finds nobody unless
  // you are already in their league — the same word giving different answers
  // to different people. Absent until the SQL is run, and its absence just
  // means names-only, which is what happened before.
  try {
    const res: any = await withSupabaseTimeout(supabase.rpc("search_player_accounts", { p_query: q }), FAILED as any);
    const ids: string[] = res !== (FAILED as any) && !res.error ? (res.data || []).map((r: any) => r.auth_id).filter(Boolean) : [];
    const missing = ids.filter((id) => !seen.has(id));
    if (missing.length) {
      const extra = await run(supabase.from("profiles").select("*").in("id", missing), "searching players");
      for (const row of (extra as Profile[]) || []) seen.set(row.id, row);
    }
  } catch (e) {
    console.warn("Nickname search unavailable", e);
  }

  const rows = Array.from(seen.values());
  return excludeId ? rows.filter((r) => r.id !== excludeId) : rows;
}

/**
 * Keep the account's public copy of a name and photo in step.
 *
 * `players.avatar_url` is where a photo has always been written, and it is on
 * a league row, so only league-mates can read it. `profiles.avatar_url` is
 * readable by any signed-in account and has never been written by anything —
 * which is why somebody outside your league sees your initial and not your
 * face. It is not a load failure; it is an empty column rendering correctly.
 *
 * So the photo now goes to both. The player row stays the one the league
 * reads, and the profile row is the copy the rest of the app can see.
 *
 * Failures are the caller's to swallow: not being able to update the public
 * copy is not a reason to refuse somebody their own profile picture.
 */
export async function updateMyPublicProfile(patch: { display_name?: string; avatar_url?: string | null }): Promise<void> {
  if (!supabase) return;
  const { data: userData } = await withSupabaseTimeout(supabase.auth.getUser(), { data: { user: null }, error: null } as any);
  const uid = (userData as any)?.user?.id;
  if (!uid) return;
  await run(supabase.from("profiles").update(patch).eq("id", uid), "updating your profile");
}

/**
 * One person, as anybody signed in is allowed to see them.
 *
 * Two tiers, because they have different reach:
 *
 * - the `profiles` row — name, photo, friend code — is readable by every
 *   signed-in account already, so this always works;
 * - the record, form and recent matches need `public_player_card()`, a
 *   security-definer function that does not exist until the SQL in
 *   RALLY_FIX_REPORT.md has been run.
 *
 * When the function is missing this returns the first tier and `stats: null`
 * rather than throwing. That is deliberate: the complaint being fixed is
 * "I can't open his profile or see his photo or challenge him", and none of
 * those need the second tier. The page works today and gets richer later.
 */
export interface PublicPlayerCard {
  id: string;
  display_name: string;
  avatar_url: string | null;
  friend_code: string;
  stats: {
    nick: string | null;
    level: { cat: string; sub: string } | null;
    home: string | null;
    wins: number;
    draws: number;
    losses: number;
    form: string[];
    recent: Array<{ id: string; date: string; won: boolean | null; score: string | null; opponent: string }>;
    /** You against them. Computed server-side, where both halves are visible. */
    h2h: { w: number; d: number; l: number } | null;
  } | null;
}

export async function getPublicPlayerCard(authId: string): Promise<PublicPlayerCard | null> {
  if (!supabase) return null;
  const row = await run(supabase.from("profiles").select("*").eq("id", authId).maybeSingle(), "loading that profile");
  if (!row) return null;
  const base = row as Profile;

  let stats: PublicPlayerCard["stats"] = null;
  try {
    const data: any = await withSupabaseTimeout(supabase.rpc("public_player_card", { p_auth_id: authId }), FAILED as any);
    if (data !== (FAILED as any) && !data.error && data.data) {
      const d = Array.isArray(data.data) ? data.data[0] : data.data;
      if (d) {
        stats = {
          nick: d.nick ?? null,
          level: d.level ?? null,
          home: d.home ?? null,
          wins: d.wins ?? 0,
          draws: d.draws ?? 0,
          losses: d.losses ?? 0,
          form: d.form ?? [],
          recent: d.recent ?? [],
          h2h: (d.h2h_w ?? 0) + (d.h2h_d ?? 0) + (d.h2h_l ?? 0) > 0
            ? { w: d.h2h_w ?? 0, d: d.h2h_d ?? 0, l: d.h2h_l ?? 0 }
            : null,
        };
      }
    }
  } catch (e) {
    // The function not being installed is the expected case until the SQL is
    // run, and it must not take the whole profile down with it.
    console.warn("public_player_card unavailable — showing the profile without a record", e);
  }

  return { id: base.id, display_name: base.display_name, avatar_url: base.avatar_url, friend_code: base.friend_code, stats };
}
