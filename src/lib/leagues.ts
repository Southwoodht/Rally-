import { supabase, withSupabaseTimeout } from "@/lib/supabase";

export interface League {
  id: string;
  name: string;
  location: string | null;
  join_code: string;
  created_by: string;
  role?: string;
}

/** Human-friendly code: no 0/O/1/I so nobody mistypes it. */
function makeCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/** owner beats editor beats member, when duplicate rows disagree. */
const ROLE_RANK: Record<string, number> = { owner: 3, editor: 2, member: 1 };

/**
 * Your leagues, one card each.
 *
 * This reads league_members and returns a row per MEMBERSHIP, so duplicate
 * membership rows for the same (user, league) produce duplicate cards — five
 * identical Seacourts, same join code, same counts. Leaving then removed all
 * of them at once, because leaveLeague deletes by (league_id, user_id) and
 * that is the correct thing for it to do; the list was what was wrong.
 *
 * The dedupe here is a **guard, not the fix**. The fix is the unique
 * constraint in supabase/schema_league_members_unique.sql; until that is run
 * the rows keep accumulating and this only stops them being shown.
 *
 * It keeps the strongest role rather than the first one seen, and that part
 * matters beyond tidiness: leagueRole comes straight off whichever card you
 * tapped, and canManageMatches is gated on it. Pick the card backed by a
 * "member" row when you are really the owner and you silently lose every
 * staff permission — including the one that lets you delete a match.
 */
export async function listMyLeagues(): Promise<League[]> {
  if (!supabase) return [];
  const { data, error } = await withSupabaseTimeout(
    supabase.from("league_members").select("role, leagues (id, name, location, join_code, created_by)").order("joined_at", { ascending: true }),
    { data: [], error: null } as any,
  );
  if (error) throw error;
  const rows = (data || [])
    .filter((r: any) => r.leagues)
    .map((r: any) => ({ ...r.leagues, role: r.role }));

  const byId = new Map<string, League>();
  for (const l of rows) {
    const seen = byId.get(l.id);
    if (!seen) { byId.set(l.id, l); continue; }
    if ((ROLE_RANK[l.role || ""] ?? 0) > (ROLE_RANK[seen.role || ""] ?? 0)) byId.set(l.id, l);
  }
  if (byId.size !== rows.length) {
    console.warn(
      `listMyLeagues: ${rows.length - byId.size} duplicate membership row(s) hidden. ` +
      "Run supabase/schema_league_members_unique.sql to stop them accumulating.",
    );
  }
  return [...byId.values()];
}

/**
 * How much is actually in each league, so a list of five identically named
 * ones can be told apart before anybody leaves the wrong one. Two small
 * queries — only the league_id column comes back, counted here.
 */
export async function leagueSizes(ids: string[]): Promise<Record<string, { players: number; matches: number }>> {
  const out: Record<string, { players: number; matches: number }> = {};
  ids.forEach((id) => (out[id] = { players: 0, matches: 0 }));
  if (!supabase || !ids.length) return out;
  const [pl, mt]: any[] = await Promise.all([
    withSupabaseTimeout(supabase.from("players").select("league_id").in("league_id", ids), { data: [], error: null } as any),
    withSupabaseTimeout(supabase.from("matches").select("league_id").in("league_id", ids), { data: [], error: null } as any),
  ]);
  (pl?.data || []).forEach((r: any) => { if (out[r.league_id]) out[r.league_id].players++; });
  (mt?.data || []).forEach((r: any) => { if (out[r.league_id]) out[r.league_id].matches++; });
  return out;
}

/**
 * Removes your membership only. The league and everything in it stays
 * exactly where it is, and the join code gets you back in — which is why
 * this is offered in the app and deleting a league isn't.
 */
export async function leaveLeague(id: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const { data: userData } = await withSupabaseTimeout(supabase.auth.getUser(), { data: { user: null }, error: null } as any);
  const uid = (userData as any)?.user?.id;
  if (!uid) throw new Error("You need to be logged in.");
  const { error }: any = await withSupabaseTimeout(
    supabase.from("league_members").delete().eq("league_id", id).eq("user_id", uid),
    { error: { message: "Timed out leaving the league." } } as any,
  );
  if (error) throw error;
}

export async function createLeague(name: string, location: string): Promise<League> {
  if (!supabase) throw new Error("Not connected.");
  const { data: userData } = await withSupabaseTimeout(supabase.auth.getUser(), { data: { user: null }, error: null } as any);
  const uid = userData.user?.id;
  if (!uid) throw new Error("You need to be logged in.");

  // Retry in the unlikely event two people generate the same code.
  let league: any = null;
  let lastError: any = null;
  for (let attempt = 0; attempt < 5 && !league; attempt++) {
    const { data, error } = await withSupabaseTimeout(
      supabase.from("leagues").insert({ name: name.trim(), location: location.trim() || null, join_code: makeCode(), created_by: uid }).select().single(),
      { data: null, error: null } as any,
    );
    if (!error) { league = data; break; }
    lastError = error;
    if (error.code !== "23505") break;   // 23505 = duplicate code, worth retrying
  }
  if (!league) throw lastError || new Error("Couldn't create the league.");

  const { error: memberError } = await withSupabaseTimeout(
    supabase.from("league_members").insert({ league_id: league.id, user_id: uid, role: "owner" }),
    { error: null } as any,
  );
  if (memberError) throw memberError;

  return { ...league, role: "owner" };
}

export async function joinLeague(code: string): Promise<League> {
  if (!supabase) throw new Error("Not connected.");
  const clean = code.trim().toUpperCase();
  if (!clean) throw new Error("Enter a code.");

  const { data: userData } = await withSupabaseTimeout(supabase.auth.getUser(), { data: { user: null }, error: null } as any);
  const uid = userData.user?.id;
  if (!uid) throw new Error("You need to be logged in.");

  const { data: league, error } = await withSupabaseTimeout(
    supabase.from("leagues").select("id, name, location, join_code, created_by").eq("join_code", clean).maybeSingle(),
    { data: null, error: null } as any,
  );
  if (error) throw error;
  if (!league) throw new Error("No league found with that code.");

  const { error: joinError } = await withSupabaseTimeout(
    supabase.from("league_members").insert({ league_id: league.id, user_id: uid, role: "member" }),
    { error: null } as any,
  );
  // 23505 = already a member, which is fine — but that only ever fires if a
  // unique constraint on (user_id, league_id) exists to raise it. Without
  // one this insert quietly succeeds every time and stacks up another
  // membership row, which is exactly how the picker ended up showing the
  // same league six times. See schema_league_members_unique.sql.
  if (joinError && joinError.code !== "23505") throw joinError;

  return { ...league, role: "member" };
}
