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
  const rows = Array.from(seen.values());
  return excludeId ? rows.filter((r) => r.id !== excludeId) : rows;
}
