import { supabase, withSupabaseTimeout } from "@/lib/supabase";

export interface Club {
  id: string;
  name: string;
  location: string | null;
  join_code: string;
  created_by: string;
  role?: string;
}

function makeCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function listMyClubs(): Promise<Club[]> {
  if (!supabase) return [];
  const { data, error } = await withSupabaseTimeout(
    supabase.from("club_members").select("role, clubs (id, name, location, join_code, created_by)").order("joined_at", { ascending: true }),
    { data: [], error: null } as any,
  );
  if (error) throw error;
  return (data || [])
    .filter((r: any) => r.clubs)
    .map((r: any) => ({ ...r.clubs, role: r.role }));
}

export async function listMyAdminClubs(): Promise<Club[]> {
  const mine = await listMyClubs();
  return mine.filter((c) => c.role === "admin");
}

export async function createClub(name: string, location: string): Promise<Club> {
  if (!supabase) throw new Error("Not connected.");
  const { data: userData } = await withSupabaseTimeout(supabase.auth.getUser(), { data: { user: null }, error: null } as any);
  const uid = userData.user?.id;
  if (!uid) throw new Error("You need to be logged in.");

  let club: any = null;
  let lastError: any = null;
  for (let attempt = 0; attempt < 5 && !club; attempt++) {
    const { data, error } = await withSupabaseTimeout(
      supabase.from("clubs").insert({ name: name.trim(), location: location.trim() || null, join_code: makeCode(), created_by: uid }).select().single(),
      { data: null, error: null } as any,
    );
    if (!error) { club = data; break; }
    lastError = error;
    if (error.code !== "23505") break;
  }
  if (!club) throw lastError || new Error("Couldn't create the club.");

  const { error: memberError } = await withSupabaseTimeout(
    supabase.from("club_members").insert({ club_id: club.id, user_id: uid, role: "admin" }),
    { error: null } as any,
  );
  if (memberError) throw memberError;

  return { ...club, role: "admin" };
}

// Joining by code is a plain lookup rather than anything clever: the clubs
// table has a "find a club by its code" policy precisely so somebody who
// isn't a member yet can still resolve one. Membership always goes in as
// 'member' — RLS refuses 'admin' from this path, so a code can never be a
// route to approving your own trophy claims.
export async function findClubByCode(code: string): Promise<Club | null> {
  if (!supabase) return null;
  const { data, error } = await withSupabaseTimeout(
    supabase.from("clubs").select("id, name, location, join_code, created_by").eq("join_code", code.trim().toUpperCase()).maybeSingle(),
    { data: null, error: null } as any,
  );
  if (error) throw error;
  return (data as Club) || null;
}

export async function joinClubByCode(code: string): Promise<Club> {
  if (!supabase) throw new Error("Not connected.");
  const { data: userData } = await withSupabaseTimeout(supabase.auth.getUser(), { data: { user: null }, error: null } as any);
  const uid = userData.user?.id;
  if (!uid) throw new Error("You need to be logged in.");
  const club = await findClubByCode(code);
  if (!club) throw new Error("No club has that code.");
  const { error } = await withSupabaseTimeout(
    supabase.from("club_members").insert({ club_id: club.id, user_id: uid, role: "member" }),
    { error: null } as any,
  );
  // Already a member is not a failure worth showing — you wanted to be in
  // the club and you are.
  if (error && error.code !== "23505") throw error;
  return { ...club, role: "member" };
}
