import { supabase, withSupabaseTimeout } from "@/lib/supabase";

export interface Trophy {
  id: string;
  kind: "trophy" | "legacy_fact";
  claimed_by: string;
  claimant_name: string | null;
  club_id: string;
  league_id: string | null;
  competition: string | null;
  category: string | null;
  season: string | null;
  result: string | null;
  fact_type: string | null;
  fact_value: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  clubs?: { name: string } | null;
}

export interface TrophyClaimInput {
  clubId: string;
  claimantName?: string;
  competition: string;
  category?: string;
  season?: string;
  result?: string;
  notes?: string;
}

export interface LegacyFactClaimInput {
  clubId: string;
  claimantName?: string;
  factType: string;
  factValue: string;
}

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await withSupabaseTimeout(supabase.auth.getUser(), { data: { user: null }, error: null } as any);
  return data.user?.id || null;
}

// Every trophy on Rally is either 100%-Rally-computed (achievements, season
// podium — see core/achievements.ts, never touches this table) or a claim
// that's sat in 'pending' until a club admin approves it. There's no path
// from here to an approved trophy that skips that review.
export async function submitTrophyClaim(input: TrophyClaimInput): Promise<Trophy> {
  if (!supabase) throw new Error("Not connected.");
  const uid = await currentUserId();
  if (!uid) throw new Error("You need to be logged in.");
  const { data, error } = await withSupabaseTimeout(
    supabase.from("trophies").insert({
      kind: "trophy",
      claimed_by: uid,
      claimant_name: input.claimantName?.trim() || null,
      club_id: input.clubId,
      competition: input.competition.trim(),
      category: input.category?.trim() || null,
      season: input.season?.trim() || null,
      result: input.result?.trim() || null,
      notes: input.notes?.trim() || null,
      status: "pending",
    }).select().single(),
    { data: null, error: null } as any,
  );
  if (error) throw error;
  return data as Trophy;
}

// Same review flow as a trophy claim, just for a career fact instead of a
// competitive honour — e.g. the "when did you start playing?" year from
// onboarding, which is player-reported until a club vouches for it.
export async function submitLegacyFactClaim(input: LegacyFactClaimInput): Promise<Trophy> {
  if (!supabase) throw new Error("Not connected.");
  const uid = await currentUserId();
  if (!uid) throw new Error("You need to be logged in.");
  const { data, error } = await withSupabaseTimeout(
    supabase.from("trophies").insert({
      kind: "legacy_fact",
      claimed_by: uid,
      claimant_name: input.claimantName?.trim() || null,
      club_id: input.clubId,
      fact_type: input.factType,
      fact_value: input.factValue,
      status: "pending",
    }).select().single(),
    { data: null, error: null } as any,
  );
  if (error) throw error;
  return data as Trophy;
}

export async function listMyTrophies(): Promise<Trophy[]> {
  if (!supabase) return [];
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await withSupabaseTimeout(
    supabase.from("trophies").select("*, clubs (name)").eq("claimed_by", uid).order("created_at", { ascending: false }),
    { data: [], error: null } as any,
  );
  if (error) throw error;
  return (data || []) as Trophy[];
}

// Any signed-in user can read approved trophies (RLS-enforced) — used to
// show verified honours on someone else's profile, not just your own.
export async function listApprovedTrophiesFor(userId: string): Promise<Trophy[]> {
  if (!supabase || !userId) return [];
  const { data, error } = await withSupabaseTimeout(
    supabase.from("trophies").select("*, clubs (name)").eq("claimed_by", userId).eq("status", "approved").order("created_at", { ascending: false }),
    { data: [], error: null } as any,
  );
  if (error) throw error;
  return (data || []) as Trophy[];
}

export async function listPendingClaims(clubId: string): Promise<Trophy[]> {
  if (!supabase) return [];
  const { data, error } = await withSupabaseTimeout(
    supabase.from("trophies").select("*").eq("club_id", clubId).eq("status", "pending").order("created_at", { ascending: true }),
    { data: [], error: null } as any,
  );
  if (error) throw error;
  return (data || []) as Trophy[];
}

export async function approveTrophy(id: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const uid = await currentUserId();
  if (!uid) throw new Error("You need to be logged in.");
  const { error } = await withSupabaseTimeout(
    supabase.from("trophies").update({ status: "approved", verified_by: uid, verified_at: new Date().toISOString() }).eq("id", id),
    { error: null } as any,
  );
  if (error) throw error;
}

export async function rejectTrophy(id: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const uid = await currentUserId();
  if (!uid) throw new Error("You need to be logged in.");
  const { error } = await withSupabaseTimeout(
    supabase.from("trophies").update({ status: "rejected", verified_by: uid, verified_at: new Date().toISOString() }).eq("id", id),
    { error: null } as any,
  );
  if (error) throw error;
}

export async function withdrawTrophyClaim(id: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const { error } = await withSupabaseTimeout(supabase.from("trophies").delete().eq("id", id), { error: null } as any);
  if (error) throw error;
}
