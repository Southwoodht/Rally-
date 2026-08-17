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
