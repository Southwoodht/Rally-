import { Profile } from "@/lib/profiles";
import { supabase, withSupabaseTimeout } from "@/lib/supabase";

// Private messages. See supabase/schema_messages.sql for the rules — the
// short version is that a first message to someone you aren't friends with
// arrives as a request, and only the sender can add to it until the
// recipient accepts. That's enforced in RLS, so nothing here is load-bearing
// for safety; this file is just the client's side of it.

export interface ThreadRow {
  id: string;
  user_a: string;
  user_b: string;
  started_by: string;
  status: "pending" | "accepted";
  created_at: string;
  last_message_at: string | null;
}

export interface MessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface Thread extends ThreadRow {
  profile: Profile;
  lastMessage: string | null;
  lastFromMe: boolean;
  unread: number;
  /** A request someone sent you, still waiting on your answer. */
  isRequestToMe: boolean;
}

const FAILED = Symbol("messages-failed");

async function run(promise: PromiseLike<any>, what: string): Promise<any> {
  const result: any = await withSupabaseTimeout(promise, FAILED as any);
  if (result === (FAILED as any)) throw new Error(`Timed out ${what}.`);
  if (result.error) throw result.error;
  return result.data;
}

export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await withSupabaseTimeout(supabase.auth.getUser(), { data: { user: null }, error: null } as any);
  return (data as any)?.user?.id || null;
}

/** Find or create the thread with someone. Returns its id. */
export async function startThread(otherId: string): Promise<string> {
  if (!supabase) throw new Error("Not connected.");
  const data = await run(supabase.rpc("start_thread", { other_id: otherId }), "opening the conversation");
  return data as string;
}

export async function listThreads(): Promise<Thread[]> {
  if (!supabase) return [];
  const myId = await currentUserId();
  if (!myId) return [];

  const rows: ThreadRow[] = await run(
    supabase.from("message_threads").select("*").order("last_message_at", { ascending: false, nullsFirst: false }),
    "loading conversations",
  ) || [];
  if (!rows.length) return [];

  const otherIds = Array.from(new Set(rows.map((t) => (t.user_a === myId ? t.user_b : t.user_a))));
  const [profiles, messages] = await Promise.all([
    run(supabase.from("profiles").select("*").in("id", otherIds), "loading profiles"),
    // Every message in your threads at once. At this scale that is one small
    // query; paging per thread would be four round trips to render a list.
    run(supabase.from("messages").select("*").in("thread_id", rows.map((t) => t.id)).order("created_at", { ascending: true }), "loading messages"),
  ]);

  const byId = new Map((profiles as Profile[] || []).map((p) => [p.id, p]));
  const byThread = new Map<string, MessageRow[]>();
  ((messages as MessageRow[]) || []).forEach((m) => {
    const arr = byThread.get(m.thread_id) || [];
    arr.push(m);
    byThread.set(m.thread_id, arr);
  });

  return rows
    .map((t) => {
      const otherId = t.user_a === myId ? t.user_b : t.user_a;
      const ms = byThread.get(t.id) || [];
      return {
        ...t,
        profile: byId.get(otherId) as Profile,
        lastMessage: ms.length ? ms[ms.length - 1].body : null,
        lastFromMe: ms.length ? ms[ms.length - 1].sender_id === myId : false,
        unread: ms.filter((m) => m.sender_id !== myId && !m.read_at).length,
        isRequestToMe: t.status === "pending" && t.started_by !== myId,
      };
    })
    // A thread whose other person no longer has a profile can't be rendered
    // or replied to, so it isn't shown.
    .filter((t) => !!t.profile);
}

export async function listMessages(threadId: string): Promise<MessageRow[]> {
  if (!supabase) return [];
  return (await run(
    supabase.from("messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true }),
    "loading the conversation",
  )) || [];
}

export async function sendMessage(threadId: string, body: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const myId = await currentUserId();
  if (!myId) throw new Error("You need to be signed in.");
  const text = body.trim();
  if (!text) return;
  await run(supabase.from("messages").insert({ thread_id: threadId, sender_id: myId, body: text.slice(0, 4000) }), "sending");
}

export async function acceptThread(threadId: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  await run(
    supabase.from("message_threads").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", threadId),
    "accepting the request",
  );
}

/** Deletes the thread and, by cascade, everything in it. */
export async function deleteThread(threadId: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  await run(supabase.from("message_threads").delete().eq("id", threadId), "deleting the conversation");
}

export async function markThreadRead(threadId: string): Promise<void> {
  if (!supabase) return;
  const myId = await currentUserId();
  if (!myId) return;
  await run(
    supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("thread_id", threadId).neq("sender_id", myId).is("read_at", null),
    "marking as read",
  );
}

export async function unreadMessageCount(): Promise<number> {
  if (!supabase) return 0;
  try {
    const data = await run(supabase.rpc("unread_message_count"), "counting unread messages");
    return Number(data) || 0;
  } catch {
    // A badge is never worth an error screen.
    return 0;
  }
}
