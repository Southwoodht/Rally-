import { supabase, withSupabaseTimeout } from "@/lib/supabase";
import { Profile } from "@/lib/profiles";

export interface FriendRow {
  id: string;
  status: "pending" | "accepted";
  requester_id: string;
  addressee_id: string;
  created_at: string;
}

export interface FriendWithProfile extends FriendRow {
  profile: Profile;
}

const FAILED = Symbol("friends-failed");

async function run(promise: PromiseLike<any>, what: string): Promise<any> {
  const result: any = await withSupabaseTimeout(promise, FAILED as any);
  if (result === (FAILED as any)) throw new Error(`Timed out ${what}.`);
  if (result.error) throw result.error;
  return result.data;
}

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await withSupabaseTimeout(supabase.auth.getUser(), { data: { user: null }, error: null } as any);
  return (data as any)?.user?.id || null;
}

async function withOtherProfiles(rows: FriendRow[], myId: string): Promise<FriendWithProfile[]> {
  if (!supabase || !rows.length) return [];
  const otherIds = Array.from(new Set(rows.map((r) => (r.requester_id === myId ? r.addressee_id : r.requester_id))));
  const profiles = await run(supabase.from("profiles").select("*").in("id", otherIds), "loading friend profiles");
  const byId = new Map((profiles as Profile[]).map((p) => [p.id, p]));
  return rows
    .map((r) => ({ ...r, profile: byId.get(r.requester_id === myId ? r.addressee_id : r.requester_id) as Profile }))
    .filter((r) => !!r.profile);
}

export async function listFriends(): Promise<FriendWithProfile[]> {
  if (!supabase) return [];
  const myId = await currentUserId();
  if (!myId) return [];
  const rows = await run(
    supabase.from("friends").select("*").eq("status", "accepted").or(`requester_id.eq.${myId},addressee_id.eq.${myId}`),
    "loading friends",
  );
  return withOtherProfiles((rows as FriendRow[]) || [], myId);
}

export async function listIncomingRequests(): Promise<FriendWithProfile[]> {
  if (!supabase) return [];
  const myId = await currentUserId();
  if (!myId) return [];
  const rows = await run(
    supabase.from("friends").select("*").eq("status", "pending").eq("addressee_id", myId),
    "loading friend requests",
  );
  return withOtherProfiles((rows as FriendRow[]) || [], myId);
}

export async function listOutgoingRequests(): Promise<FriendWithProfile[]> {
  if (!supabase) return [];
  const myId = await currentUserId();
  if (!myId) return [];
  const rows = await run(
    supabase.from("friends").select("*").eq("status", "pending").eq("requester_id", myId),
    "loading sent requests",
  );
  return withOtherProfiles((rows as FriendRow[]) || [], myId);
}

// The single relationship row (in either direction) between the current
// user and one other account, or null if there isn't one yet.
export async function getFriendshipWith(otherId: string): Promise<FriendRow | null> {
  if (!supabase) return null;
  const myId = await currentUserId();
  if (!myId) return null;
  const rows = await run(
    supabase.from("friends").select("*").or(`and(requester_id.eq.${myId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${myId})`),
    "checking friendship status",
  );
  return ((rows as FriendRow[]) || [])[0] || null;
}

export async function sendFriendRequest(addresseeId: string): Promise<void> {
  if (!supabase) return;
  const myId = await currentUserId();
  if (!myId) throw new Error("You need to be logged in.");
  await run(supabase.from("friends").insert({ requester_id: myId, addressee_id: addresseeId, status: "pending" }), "sending a friend request");
}

export async function acceptFriendRequest(id: string): Promise<void> {
  if (!supabase) return;
  await run(supabase.from("friends").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", id), "accepting a friend request");
}

// Cancels a request you sent, declines one you received, or unfriends
// someone — the same delete either way.
export async function removeFriendship(id: string): Promise<void> {
  if (!supabase) return;
  await run(supabase.from("friends").delete().eq("id", id), "removing a friend");
}

/**
 * Who somebody is friends with, and which of them you both know.
 *
 * Needs schema_public_friends.sql. Until that is run this returns an empty
 * list rather than throwing, and the Friends section on a profile simply does
 * not appear — the same degrade-quietly shape as the level estimate and the
 * nudge. A missing migration should cost a feature, never a screen.
 *
 * The friends table's only select policy is "you are in this friendship", so
 * there is no client-side version of this question. It is the function or
 * nothing.
 *
 * Mutuals come back first and flagged, because "you both know Charlie" is the
 * part worth reading and sorting it client-side would mean fetching your own
 * list too, on every profile open.
 */
export interface PublicFriend {
  authId: string;
  name: string;
  avatarUrl: string | null;
  isMutual: boolean;
}

export async function friendsOf(authId: string): Promise<PublicFriend[]> {
  if (!supabase || !authId) return [];
  const res: any = await withSupabaseTimeout(
    supabase.rpc("public_friends_of", { p_auth_id: authId }),
    { data: null, error: { message: "Timed out" } } as any,
  );
  if (!res || res.error || !Array.isArray(res.data)) return [];
  return res.data.map((r: any) => ({
    authId: r.auth_id,
    name: String(r.display_name || "").trim() || "Player",
    avatarUrl: r.avatar_url || null,
    isMutual: !!r.is_mutual,
  }));
}
