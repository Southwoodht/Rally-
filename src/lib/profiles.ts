import { supabase, withSupabaseTimeout } from "@/lib/supabase";
import { rowToMatch, rowToPlayer } from "@/lib/leagueData";

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

export interface LeaguePlayerHit {
  /** The player ROW id — the app's own short id, not a uuid, and not an
   *  account. ?profile= takes either. */
  id: string;
  name: string;
  /** Which of your leagues they are in, for the row's second line. */
  leagueName: string | null;
  leagueId: string | null;
  avatarUrl: string | null;
  /** Their account, when they have one — used to drop duplicates against the
   *  account results rather than listing somebody twice. */
  authId: string | null;
}

/**
 * People in YOUR leagues, whether or not they are on Rally.
 *
 * Sam searched "zaach" and got nothing. His row reads name "Zaach " (with a
 * trailing space), last "Rodriguez", nick null, auth_id NULL — he has never
 * made an account. searchProfiles searches accounts, so there was nothing to
 * find, and no change to search_player_accounts() could have found him: it is
 * auth_id-only by design, and correctly so.
 *
 * And he is not the exception. Most of a club has never signed up; they are
 * shell rows somebody added to log a result against. Being unable to search
 * for the people you actually play is close to the opposite of what a player
 * search is for.
 *
 * **This needs no SQL and widens nothing.** RLS on players already limits
 * reads to leagues you are a member of, so this returns exactly the people
 * already on your own table — the same names, reachable by typing instead of
 * scrolling. Somebody else's club stays as invisible as it is now.
 *
 * Three queries rather than one .or(), for the reason searchProfiles gives:
 * PostgREST parses .or() as structured syntax, so a raw query string with a
 * comma in it becomes query syntax rather than a value.
 */
export async function searchLeaguePlayers(query: string): Promise<LeaguePlayerHit[]> {
  if (!supabase) return [];
  const q = query.trim();
  if (q.length < 2) return [];
  const like = "%" + q + "%";
  const cols = "id,name,last,nick,avatar_url,auth_id,league_id";

  // League rows only, and the "not null" is load-bearing rather than tidy.
  //
  // The SELECT policy on players reads: a league row needs is_league_member,
  // and a LEAGUE-LESS row (a Friendly shell) is readable by any signed-in
  // account at all. Leaving those in would widen what can be FOUND without
  // widening what can be read — which is the exact distinction §6 draws when
  // it explains why search_player_accounts returns ids and not rows, and the
  // wrong side of it. Somebody else's Friendly shell is not on your table and
  // you have no record against them.
  //
  // When Friendlies actually ship, the right addition is rows created_by me,
  // not every league-less row in the database.
  const db = supabase;
  const q3 = (col: string) =>
    run(
      db.from("players").select(cols).not("league_id", "is", null).ilike(col, like).limit(20),
      "searching players",
    );
  const [byName, byLast, byNick] = await Promise.all([q3("name"), q3("last"), q3("nick")]);

  const seen = new Map<string, any>();
  for (const r of [...(byName || []), ...(byLast || []), ...(byNick || [])]) seen.set(r.id, r);
  const rows = Array.from(seen.values());
  if (!rows.length) return [];

  // League names in one go, and a failure here costs a subtitle rather than
  // the result — knowing WHICH of your leagues somebody is in is useful and
  // is not what you searched for.
  const leagueIds = Array.from(new Set(rows.map((r) => r.league_id).filter(Boolean)));
  const names = new Map<string, string>();
  if (leagueIds.length) {
    try {
      const ls = await run(supabase.from("leagues").select("id,name").in("id", leagueIds), "naming leagues");
      for (const l of ls || []) names.set(l.id, l.name);
    } catch { /* subtitle only */ }
  }

  return rows.map((r) => ({
    id: r.id,
    // Trimmed, because the stored names are not. Zaach's is "Zaach " and that
    // trailing space is what put two spaces in "Samuel  Henry".
    name: [r.name, r.last].map((x: any) => String(x ?? "").trim()).filter(Boolean).join(" ") || "Player",
    leagueName: r.league_id ? names.get(r.league_id) || null : null,
    leagueId: r.league_id || null,
    avatarUrl: r.avatar_url || null,
    authId: r.auth_id || null,
  }));
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
    age: string | null;
    /** Drives "9 years playing" — the first entry's start year is the start. */
    levelHistory: any[] | null;
    wins: number;
    draws: number;
    losses: number;
    form: string[];
    recent: Array<{
      id: string; date: string; won: boolean | null; score: string | null;
      opponent: string;
      /** So a rivalry can be tapped through to, and drawn with their avatar. */
      opponentId: string | null;
      opponentAvatar: string | null;
    }>;
    /** You against them. Computed server-side, where both halves are visible. */
    h2h: { w: number; d: number; l: number } | null;
  } | null;
  /**
   * Why there are no stats, when there are none.
   *
   * This existed as a console.warn and nothing else, so a profile with no
   * record looked identical whether the function was missing, erroring,
   * timing out, or correctly reporting somebody with no matches. Three
   * separate guesses were spent on that. The screen can now say which.
   */
  statsProblem: string | null;
  /**
   * True when the installed public_player_card() predates opponent_id and
   * opponent_avatar. The rows parse fine and are simply missing both, so
   * opponents are not tappable and their avatars do not appear — with no
   * error to notice. Same failure as statsProblem, one level quieter.
   */
  cardStale: boolean;
}

export async function getPublicPlayerCard(authId: string): Promise<PublicPlayerCard | null> {
  if (!supabase) return null;
  const row = await run(supabase.from("profiles").select("*").eq("id", authId).maybeSingle(), "loading that profile");
  if (!row) return null;
  const base = row as Profile;

  let stats: PublicPlayerCard["stats"] = null;
  let statsProblem: string | null = null;
  try {
    const data: any = await withSupabaseTimeout(supabase.rpc("public_player_card", { p_auth_id: authId }), FAILED as any);
    if (data === (FAILED as any)) {
      statsProblem = "Timed out reading their record.";
    } else if (data.error) {
      statsProblem = data.error.message || "The record query was refused.";
      console.error("public_player_card failed", data.error);
    } else if (!data.data || (Array.isArray(data.data) && !data.data.length)) {
      statsProblem = "No record came back for this account.";
    }
    if (data !== (FAILED as any) && !data.error && data.data) {
      const d = Array.isArray(data.data) ? data.data[0] : data.data;
      if (d) {
        stats = {
          nick: d.nick ?? null,
          level: d.level ?? null,
          home: d.home ?? null,
          age: d.age ?? null,
          levelHistory: d.level_history ?? null,
          wins: d.wins ?? 0,
          draws: d.draws ?? 0,
          losses: d.losses ?? 0,
          form: d.form ?? [],
          recent: (d.recent ?? []).map((m: any) => ({
            id: m.id, date: m.date, won: m.won ?? null, score: m.score ?? null,
            opponent: m.opponent || "",
            opponentId: m.opponent_id ?? null,
            opponentAvatar: m.opponent_avatar ?? null,
          })),
          h2h: (d.h2h_w ?? 0) + (d.h2h_d ?? 0) + (d.h2h_l ?? 0) > 0
            ? { w: d.h2h_w ?? 0, d: d.h2h_d ?? 0, l: d.h2h_l ?? 0 }
            : null,
        };
      }
    }
  } catch (e: any) {
    // A missing function must not take the whole profile down with it — but
    // it must not be silent either.
    statsProblem = e?.message || "Couldn't read their record.";
    console.error("public_player_card unavailable", e);
  }

  /**
   * An older public_player_card() still installed.
   *
   * The function gained opponent_id and opponent_avatar, and a version
   * without them returns rows that parse perfectly and are missing both — so
   * opponents stop being tappable and their avatars stop appearing, with no
   * error anywhere. op.id is players.id and is never null, so every row
   * lacking it means the column is not being returned rather than the data
   * being absent.
   */
  const cardStale = !!stats && stats.recent.length > 0 && stats.recent.every((m) => m.opponentId == null);

  return { id: base.id, display_name: base.display_name, avatar_url: base.avatar_url, friend_code: base.friend_code, stats, statsProblem, cardStale };
}

/**
 * Which account a player row belongs to.
 *
 * /players/<id> accepts an account id or a player row id, and the second has
 * to be resolved. Reading players directly cannot do it from outside the
 * league: "read players in your leagues" hides the row, the read comes back
 * empty with no error, and empty is indistinguishable from "this row has no
 * account". That is how three people with accounts were told they had none.
 *
 * auth_id_for_player() is security definer and returns one uuid or null, so
 * the answer is the same from any account. Null here is the real answer —
 * a shell with nobody behind it.
 *
 * Returns undefined, distinct from null, when the function is not installed:
 * unknown is not the same as nobody, and the screen says different things.
 */
export async function authIdForPlayer(playerId: string): Promise<string | null | undefined> {
  if (!supabase) return undefined;
  try {
    const res: any = await withSupabaseTimeout(
      supabase.rpc("auth_id_for_player", { p_player_id: playerId }),
      FAILED as any,
    );
    if (res === (FAILED as any)) return undefined;
    if (res.error) {
      console.warn("auth_id_for_player: " + res.error.message);
      return undefined;
    }
    return (res.data as string) ?? null;
  } catch {
    return undefined;
  }
}

/**
 * The league behind somebody's profile.
 *
 * This is what makes a stranger's profile identical to the one you see from
 * inside a league rather than a thinner copy of it. The rich profile is not
 * stored anywhere — ProfileContainer computes it in the browser from the
 * whole league, running computeStats over its players and matches. Give a
 * viewer that same input and the same component produces the same screen.
 *
 * Two very different things used to come back as the same null: the person
 * has never played a league match, and the function is not installed. The
 * first is a fact about them and the summary is the right answer. The second
 * is the app quietly showing less than it can, which is how a profile looked
 * "very restricted" from one account and complete from another with nobody
 * able to say why — the difference being that the in-league path never calls
 * this at all.
 *
 * So the reason comes back with the result and the screen can say which.
 */
export type SnapshotReason = "ok" | "no-league-matches" | "not-installed" | "failed";

export interface LeagueSnapshot {
  snapshot: { players: any[]; matches: any[] } | null;
  reason: SnapshotReason;
}

export async function getPublicLeagueSnapshot(authId: string): Promise<LeagueSnapshot> {
  if (!supabase) return { snapshot: null, reason: "failed" };
  try {
    const res: any = await withSupabaseTimeout(supabase.rpc("public_league_snapshot", { p_auth_id: authId }), FAILED as any);
    if (res === (FAILED as any)) return { snapshot: null, reason: "failed" };
    if (res.error) {
      // PostgREST says "Could not find the function" / "schema cache" when
      // the migration has never been run. Anything else is a real failure.
      const msg = String(res.error.message || "");
      const missing = /could not find the function|schema cache|does not exist/i.test(msg);
      console.warn("public_league_snapshot: " + msg);
      return { snapshot: null, reason: missing ? "not-installed" : "failed" };
    }
    if (!res.data) return { snapshot: null, reason: "failed" };
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    const players = (row?.players || []).map(rowToPlayer);
    const matches = (row?.matches || []).map(rowToMatch);
    // The function returns two empty arrays for somebody with no league
    // matches at all, which is a real answer rather than a failure.
    if (!players.length) return { snapshot: null, reason: "no-league-matches" };
    return { snapshot: { players, matches }, reason: "ok" };
  } catch (e: any) {
    console.warn("public_league_snapshot unavailable — showing the summary profile", e);
    return { snapshot: null, reason: "failed" };
  }
}

/**
 * The signed-in account's theme.
 *
 * localStorage is the fast path and the only path when signed out; this is
 * the copy that follows you to another device. On login Supabase wins — see
 * syncThemeFromProfile.
 *
 * Needs schema_profile_theme.sql. Until it runs, the column does not exist,
 * the write fails, and the theme still works from localStorage — the same
 * degrade-quietly shape as the rest of the profile functions. A pending
 * migration should cost the cross-device half of a preference, not the
 * preference.
 */
// Swallows everything on purpose, and matches themeFromProfile below.
// Until schema_profile_theme.sql is run there is no `theme` column, so this
// write fails on every call — and it must stay a preference that did not
// persist rather than an error in front of somebody who just picked a colour.
// The theme is already applied and stored locally before this is reached.
export async function saveMyTheme(theme: string): Promise<void> {
  if (!supabase) return;
  try {
    const me = (await supabase.auth.getUser()).data?.user?.id;
    if (!me) return;
    await supabase.from("profiles").update({ theme }).eq("id", me);
  } catch { /* a preference, not a requirement */ }
}

/**
 * On login, Supabase wins.
 *
 * Returns the stored theme, or null when there is nothing to say — signed
 * out, column not yet added, or the value already matches. Null means "leave
 * what is on screen alone", which matters because the boot script has already
 * painted with localStorage and re-applying the same value would be a wasted
 * transition.
 */
export async function themeFromProfile(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const me = (await supabase.auth.getUser()).data?.user?.id;
    if (!me) return null;
    const res: any = await withSupabaseTimeout(
      supabase.from("profiles").select("theme").eq("id", me).maybeSingle(),
      { data: null, error: { message: "Timed out" } } as any,
    );
    if (!res || res.error) return null;
    return res.data?.theme || null;
  } catch { return null; }
}
