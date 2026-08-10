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

export async function listMyLeagues(): Promise<League[]> {
  if (!supabase) return [];
  const { data, error } = await withSupabaseTimeout(
    supabase.from("league_members").select("role, leagues (id, name, location, join_code, created_by)").order("joined_at", { ascending: true }),
    { data: [], error: null } as any,
  );
  if (error) throw error;
  return (data || [])
    .filter((r: any) => r.leagues)
    .map((r: any) => ({ ...r.leagues, role: r.role }));
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
  // 23505 = already a member, which is fine
  if (joinError && joinError.code !== "23505") throw joinError;

  return { ...league, role: "member" };
}
