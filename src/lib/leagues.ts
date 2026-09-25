import { supabase, withSupabaseTimeout } from "@/lib/supabase";

export interface League {
  id: string;
  name: string;
  location: string | null;
  join_code: string;
  created_by: string;
  role?: string;
  /**
   * Feature flags, from schema_doubles.sql. Both default false in the
   * database, so a league nobody has switched on reads as off without
   * anything here having to know that. Optional in the type because a
   * League object built from anywhere else — the dev-auto stub, a join
   * response — simply will not carry them, and absent must mean off.
   */
  doubles_enabled?: boolean;
  competitions_enabled?: boolean;
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
    supabase.from("league_members").select("role, leagues (id, name, location, join_code, created_by, doubles_enabled, competitions_enabled)").order("joined_at", { ascending: true }),
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

export interface LeagueMember {
  userId: string;
  name: string;
  role: string;
  joinedAt: string | null;
  isMe: boolean;
}

/**
 * Everyone in a league, with their role.
 *
 * Readable by any member — "read members of your leagues" already allows it,
 * so this needs no function. The names come from `profiles`, which is the
 * account row rather than the player row: a role belongs to an account, and
 * the same person may have a player row with a different name on it.
 */
export async function listLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
  if (!supabase) return [];
  const me = (await withSupabaseTimeout(supabase.auth.getUser(), { data: { user: null } } as any) as any)?.data?.user?.id ?? null;
  const { data, error } = await withSupabaseTimeout(
    supabase.from("league_members").select("user_id, role, joined_at, profiles (display_name)").eq("league_id", leagueId),
    { data: [], error: null } as any,
  );
  if (error) throw error;
  const rank: Record<string, number> = { owner: 0, editor: 1, member: 2 };
  return (data || [])
    .map((r: any) => ({
      userId: r.user_id,
      name: r.profiles?.display_name || "Someone",
      role: r.role || "member",
      joinedAt: r.joined_at ?? null,
      isMe: r.user_id === me,
    }))
    .sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9) || a.name.localeCompare(b.name));
}

/**
 * Promote, demote, or hand the league on.
 *
 * Through set_league_role, which is security definer: league_members has no
 * UPDATE policy at all, deliberately. The function checks the caller is an
 * owner and refuses to leave the league without one — a condition RLS cannot
 * express, because it is about the table after the write rather than about a
 * row.
 *
 * Its refusals are written for a person, so they are passed through rather
 * than replaced with a generic failure.
 */
export async function setLeagueRole(leagueId: string, userId: string, role: "owner" | "editor" | "member"): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const res: any = await withSupabaseTimeout(
    supabase.rpc("set_league_role", { p_league_id: leagueId, p_user_id: userId, p_role: role }),
    { error: { message: "timed out" } } as any,
  );
  if (res?.error) {
    const msg = String(res.error.message || "");
    const e: any = new Error(
      /could not find the function|schema cache/i.test(msg)
        ? "Roles aren't switched on yet — supabase/schema_league_roles.sql hasn't been run."
        : msg || "Couldn't change that role.",
    );
    e.userFacing = true;
    throw e;
  }
}
