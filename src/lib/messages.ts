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
  image_url?: string | null;
  /** "chat" or "system". Absent on every row until schema_message_kind.sql
   *  has been run, and absent-or-chat is why isSystemMessage still reads the
   *  text as well — see there. */
  kind?: string | null;
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

export async function sendMessage(
  threadId: string,
  body: string,
  imageUrl?: string | null,
  kind: "chat" | "system" = "chat",
): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const myId = await currentUserId();
  if (!myId) throw new Error("You need to be signed in.");
  const text = body.trim();
  // A picture on its own is a message. Only the pair being empty is nothing
  // to send.
  if (!text && !imageUrl) return;
  const row = { thread_id: threadId, sender_id: myId, body: text.slice(0, 4000), image_url: imageUrl || null };

  // The column may not exist yet — schema_message_kind.sql is Sam's to run,
  // and a nudge must not fail because a migration is pending. So ask for it,
  // and fall back to the row without it only when the database says there is
  // no such column. Anything else is a real failure and is raised as one.
  if (kind === "system") {
    const first: any = await supabase.from("messages").insert({ ...row, kind });
    if (!first?.error) return;
    const msg = String(first.error.message || "");
    if (!/kind|schema cache/i.test(msg)) throw new Error("Couldn't send: " + msg);
  }
  await run(supabase.from("messages").insert(row), "sending");
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

/**
 * Ask somebody to confirm a result you logged.
 *
 * Two halves that must not drift: the message is the delivery and
 * `matches.nudged_at` is the record. A message can be deleted; the record has
 * to survive that, or the 24-hour limit forgets itself.
 *
 * The limit is enforced by `nudge_match()` server-side and not by this
 * function, and certainly not by a disabled button. It throws when it refuses
 * and the reason is worth showing — "Already nudged in the last 24 hours" is
 * something the person can act on.
 *
 * The stamp goes first. If the message send fails afterwards you have a
 * recorded nudge with nothing delivered, which is the harmless way round: the
 * worst case is waiting a day to try again. The other order risks nagging
 * somebody repeatedly, which is the whole thing this limit exists to stop.
 */
export async function nudgeAboutMatch(matchId: string, otherAuthId: string, text: string): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  await run(supabase.rpc("nudge_match", { p_match_id: matchId }), "sending the nudge");
  const threadId = await startThread(otherAuthId);
  await sendMessage(threadId, text, null, "system");
}

// ------------------------------------------------------------------ system
//
// Messages Rally writes, as opposed to messages a person typed.
//
// They travel down the ordinary message pipe — a nudge is delivered as a
// message on purpose, because a second delivery mechanism is a second thing
// that can be out of sync — and until now nothing downstream could tell them
// apart from something the sender had written. So a nudge rendered in the
// sender's own thread as a lime right-aligned bubble: styled as words Sam
// chose, when he had chosen a button.
//
// **The honest fix is a column on `messages`, and this is not it.** A `kind`
// text column, defaulted to 'chat', would make this a fact about the row
// rather than a guess about its contents. That is a migration, Sam runs
// those, and it is worth doing — until then the templates live here, next to
// the matcher that recognises them, so the two cannot drift apart the way
// they would if the strings stayed inline at the call sites.
export const systemMessage = {
  nudge: (name: string): string =>
    `${name} logged your match and it's waiting on you — confirm or dispute it in Rally.`,
  cancelled: (name: string, when: string | null): string =>
    when ? `${name} cancelled your match on ${when}.` : `${name} cancelled your match.`,
};

const SYSTEM_SHAPES: RegExp[] = [
  / logged your match and it's waiting on you — confirm or dispute it in Rally\.$/,
  / cancelled your match(?: on .+)?\.$/,
];

/**
 * True for a message Rally wrote.
 *
 * The column OR the text, deliberately — not the column alone. Rows sent
 * before schema_message_kind.sql runs carry its "chat" default, so the column
 * is present and wrong for exactly those rows, and that migration does no
 * backfill on purpose. The text is the only thing that knows about them, and
 * it stays the answer for them forever.
 *
 * The text shapes are anchored at the end, so somebody quoting one back at
 * you inside a sentence of their own is still their message.
 */
export function isSystemMessage(m: MessageRow | string | null | undefined): boolean {
  if (m && typeof m === "object" && m.kind === "system") return true;
  const s = String((typeof m === "string" ? m : m?.body) ?? "").trim();
  return !!s && SYSTEM_SHAPES.some((re) => re.test(s));
}
