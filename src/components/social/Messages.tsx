"use client";
import React, { useEffect, useRef, useState } from "react";
import { BigBtn, Empty } from "@/components/ui/atoms";
import {
  acceptThread, currentUserId, deleteThread, listMessages, listThreads, markThreadRead,
  sendMessage, startThread, type MessageRow, type Thread,
} from "@/lib/messages";
import { BALL, CHALK, CLAY, COURT, LINE, MUTED, PANEL, PANEL2, RADIUS, RADIUS_SM, SOFT_SHADOW, body, input, mono } from "@/lib/theme";
import { ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, FEED_THEY_LEAD, tabular } from "@/lib/theme";

// There's no realtime subscription here on purpose — one poll while the
// screen is open is a few hundred bytes and needs no extra Supabase setup.
// Worth revisiting if conversations ever get busy.
const POLL_MS = 15000;

const when = (iso: string) => {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m";
  if (mins < 1440) return Math.round(mins / 60) + "h";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

function Face({ t, size = 38 }: { t: Thread; size?: number }) {
  const common = { width: size, height: size, borderRadius: "50%", flexShrink: 0 } as const;
  if (t.profile?.avatar_url) return <img src={t.profile.avatar_url} alt="" style={{ ...common, objectFit: "cover" }} />;
  return (
    <span style={{ ...common, display: "grid", placeItems: "center", background: FEED_RAISED, fontFamily: body, fontWeight: 500, fontSize: size * 0.4, color: FEED_TEXT_HI }}>
      {(t.profile?.display_name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

function ThreadRowView({ t, onClick }: { t: Thread; onClick: () => void }) {
  const unread = t.unread > 0;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", cursor: "pointer",
        border: "none", padding: "13px 14px 13px 11px",
        // An unread conversation should be findable without reading anything:
        // a bar down the edge and a brighter row, not just a small number.
        background: unread ? FEED_RAISED : "transparent",
        borderLeft: "3px solid " + (unread ? BALL : "transparent"),
      }}
    >
      <Face t={t} size={42} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontFamily: body, fontWeight: 500, fontSize: 15.5, color: FEED_TEXT_HI, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t.profile?.display_name}
          </span>
          {unread && <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 10.5, color: FEED_LIME_INK, background: BALL, borderRadius: 999, padding: "1px 7px", flexShrink: 0 }}>{t.unread}</span>}
        </span>
        <span style={{ display: "block", fontFamily: body, fontWeight: unread ? 600 : 400, fontSize: 13, color: unread ? FEED_TEXT_HI : FEED_TEXT_MID, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t.lastMessage ? (t.lastFromMe ? "You: " : "") + t.lastMessage : "No messages yet"}
        </span>
      </span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
        {t.last_message_at && <span style={{ fontFamily: body, fontWeight: 600, fontSize: 11.5, color: unread ? BALL : FEED_TEXT_MID }}>{when(t.last_message_at)}</span>}
        <ChevronRight size={16} color={BALL} strokeWidth={2} style={{ flexShrink: 0 }} />
      </span>
    </button>
  );
}

// Days, not timestamps. A thread is read top to bottom, and "Tuesday" tells
// you more about a gap in a conversation than a clock time does.
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.floor((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long" });
};

function Conversation({ thread, myId, onBack, onChanged }: any) {
  const t: Thread = thread;
  const [msgs, setMsgs] = useState<MessageRow[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      setMsgs(await listMessages(t.id));
      setErr(null);
      if (!t.isRequestToMe) await markThreadRead(t.id);
    } catch (e: any) { setErr(e?.message || "Couldn't load this conversation."); }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs?.length]);

  // Mirrors the RLS rule rather than reimplementing it: while a request is
  // pending only whoever started it can write. If this UI got it wrong the
  // database would still say no.
  const canWrite = t.status === "accepted" || t.started_by === myId;

  const send = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    try { await sendMessage(t.id, v); setText(""); await load(); onChanged?.(); }
    catch (e: any) { setErr(e?.message || "Couldn't send that."); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "0 0 14px", borderBottom: "0.5px solid " + FEED_HAIRLINE, marginBottom: 14 }}>
        <button onClick={onBack} aria-label="Back" style={{ background: "transparent", border: "none", padding: "0 4px 0 0", cursor: "pointer", display: "grid", placeItems: "center" }}><ChevronLeft size={22} color={BALL} strokeWidth={2} /></button>
        <Face t={t} size={40} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: body, fontWeight: 500, fontSize: 18, color: FEED_TEXT_HI, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.profile?.display_name}</span>
          <span style={{ display: "block", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 1 }}>
            {t.status === "accepted" ? (msgs ? msgs.length + " message" + (msgs.length === 1 ? "" : "s") : " ") : t.isRequestToMe ? "Message request" : "Request sent — not accepted yet"}
          </span>
        </span>
      </div>

      {t.isRequestToMe && (
        <div style={{ background: FEED_CARD, borderRadius: 18, padding: 16, marginBottom: 14 }}>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_TEXT_HI, lineHeight: 1.5, marginBottom: 12 }}>
            <span style={{ fontWeight: 500 }}>{t.profile?.display_name}</span> wants to message you. You&apos;re not friends, so this is a request — they can&apos;t hear back from you until you accept.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={async () => { await acceptThread(t.id); onChanged?.(); }} style={{ flex: 1, background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 12, padding: "11px 14px", cursor: "pointer", fontFamily: body, fontWeight: 500, fontSize: 14 }}>Accept</button>
            <button onClick={async () => { await deleteThread(t.id); onChanged?.(); onBack(); }} style={{ flex: 1, background: FEED_RAISED, color: FEED_TEXT_MID, border: "none", borderRadius: 12, padding: "11px 14px", cursor: "pointer", fontFamily: body, fontWeight: 500, fontSize: 14 }}>Delete</button>
          </div>
        </div>
      )}

      <div style={{ minHeight: 200 }}>
        {!msgs ? (
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, padding: "24px 0" }}>Loading…</div>
        ) : !msgs.length ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <Face t={t} size={56} />
            <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15.5, color: FEED_TEXT_HI, marginTop: 12 }}>
              {t.profile?.display_name}
            </div>
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, marginTop: 4 }}>
              No messages yet. Say something.
            </div>
          </div>
        ) : msgs.map((m, i) => {
          const mine = m.sender_id === myId;
          const newDay = i === 0 || dayLabel(msgs[i - 1].created_at) !== dayLabel(m.created_at);
          const next = msgs[i + 1];
          // Consecutive messages from one person are one turn in the
          // conversation, so they sit tight together and only the last of a
          // run carries the time. A timestamp under every bubble is the
          // clock shouting over the conversation.
          const runEnds = !next || next.sender_id !== m.sender_id || dayLabel(next.created_at) !== dayLabel(m.created_at);
          // "Seen" belongs on the last thing you sent and nowhere else — on
          // every bubble it's noise, and on theirs it's meaningless.
          const isMyLast = mine && !msgs.slice(i + 1).some((x) => x.sender_id === myId);
          return (
            <React.Fragment key={m.id}>
              {newDay && (
                <div style={{ textAlign: "center", margin: i === 0 ? "2px 0 14px" : "18px 0 14px" }}>
                  <span style={{ fontFamily: body, fontWeight: 400, fontSize: 11.5, color: FEED_TEXT_MID, background: FEED_RAISED, borderRadius: 999, padding: "4px 12px" }}>{dayLabel(m.created_at)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: runEnds ? 10 : 2 }}>
                <div style={{ maxWidth: "80%" }}>
                  <div
                    style={{
                      background: mine ? FEED_LIME : FEED_CARD,
                      color: mine ? FEED_LIME_INK : FEED_TEXT_HI,
                      borderRadius: 18,
                      borderBottomRightRadius: mine && runEnds ? 6 : 18,
                      borderBottomLeftRadius: !mine && runEnds ? 6 : 18,
                      padding: "9px 14px",
                      fontFamily: body, fontWeight: 400, fontSize: 15, lineHeight: 1.45,
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}
                  >
                    {m.body}
                  </div>
                  {runEnds && (
                    <div style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_LOW, marginTop: 4, textAlign: mine ? "right" : "left" }}>
                      {when(m.created_at)}{isMyLast && m.read_at ? " · Seen" : ""}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={endRef} />
      </div>

      {err && <div style={{ fontFamily: body, fontSize: 12.5, color: CLAY, marginTop: 8 }}>{err}</div>}

      {canWrite ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, position: "sticky", bottom: 0, paddingBottom: 4 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={t.status === "pending" ? "Send a request…" : "Message…"}
            style={{
              flex: 1, minWidth: 0, background: FEED_CARD, border: "none", borderRadius: 999,
              padding: "12px 16px", fontFamily: body, fontWeight: 400, fontSize: 15,
              color: FEED_TEXT_HI, outline: "none", boxSizing: "border-box" as const,
            }}
          />
          <button
            onClick={send}
            disabled={busy || !text.trim()}
            aria-label="Send"
            style={{
              width: 42, height: 42, borderRadius: 999, border: "none", flexShrink: 0,
              background: text.trim() ? FEED_LIME : FEED_RAISED,
              color: text.trim() ? FEED_LIME_INK : FEED_TEXT_LOW,
              display: "grid", placeItems: "center",
              cursor: text.trim() && !busy ? "pointer" : "default",
            }}
          >
            <ArrowUp size={19} strokeWidth={2.4} />
          </button>
        </div>
      ) : (
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 12, lineHeight: 1.5 }}>
          Accept the request above to reply.
        </div>
      )}

      {t.status === "accepted" && (
        <button onClick={async () => { await deleteThread(t.id); onChanged?.(); onBack(); }} style={{ background: "transparent", border: "none", padding: "18px 0 0", cursor: "pointer", fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_LOW }}>
          Delete this conversation
        </button>
      )}
    </div>
  );
}

export function Messages({ startWith, onStarted }: { startWith?: string | null; onStarted?: () => void }) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try { setThreads(await listThreads()); setErr(null); }
    catch (e: any) { setErr(e?.message || "Couldn't load your messages."); }
  };

  useEffect(() => { currentUserId().then(setMyId); }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Arriving from a profile's Message button: open (or create) that
      // conversation straight away rather than making them find it.
      if (startWith) {
        try { const id = await startThread(startWith); if (alive) setOpenId(id); }
        catch (e: any) { if (alive) setErr(e?.message || "Couldn't open that conversation."); }
        onStarted?.();
      }
      if (alive) await load();
    })();
    const timer = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startWith]);

  if (err && !threads) {
    return (
      <div style={{ background: FEED_CARD, borderRadius: 18, padding: 18 }}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_THEY_LEAD }}>Messages unavailable.</div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, marginTop: 6 }}>{err}</div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_LOW, lineHeight: 1.5, marginTop: 8 }}>
          If this says a table or function is missing, the one-off SQL in supabase/schema_messages.sql hasn&apos;t been run yet.
        </div>
      </div>
    );
  }

  const open = threads?.find((t) => t.id === openId);
  if (open) return <Conversation thread={open} myId={myId} onBack={() => setOpenId(null)} onChanged={load} />;

  if (!threads) return <Empty msg="Loading…" />;

  const requests = threads.filter((t) => t.isRequestToMe);
  const conversations = threads.filter((t) => !t.isRequestToMe);

  if (!threads.length) {
    return <Empty msg="No messages yet. Open someone's profile and tap Message." />;
  }

  return (
    <>
      {requests.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: body, fontWeight: 500, fontSize: 17, color: CHALK }}>Requests</span>
            <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 10.5, color: FEED_LIME_INK, background: BALL, borderRadius: 999, padding: "1px 7px" }}>{requests.length}</span>
          </div>
          <div style={{ background: PANEL, borderRadius: RADIUS, boxShadow: SOFT_SHADOW, overflow: "hidden", marginBottom: 18 }}>
            {requests.map((t) => <ThreadRowView key={t.id} t={t} onClick={() => setOpenId(t.id)} />)}
          </div>
          <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, lineHeight: 1.45, margin: "-10px 0 18px" }}>
            People you aren&apos;t friends with land here first. They can&apos;t see whether you&apos;ve read it, and they can&apos;t hear back until you accept.
          </div>
        </>
      )}
      {conversations.length > 0 && (
        <>
          {requests.length > 0 && <div style={{ fontFamily: body, fontWeight: 500, fontSize: 17, color: CHALK, marginBottom: 8 }}>Conversations</div>}
          <div style={{ background: PANEL, borderRadius: RADIUS, boxShadow: SOFT_SHADOW, overflow: "hidden" }}>
            {conversations.map((t) => <ThreadRowView key={t.id} t={t} onClick={() => setOpenId(t.id)} />)}
          </div>
        </>
      )}
      {err && <div style={{ fontFamily: body, fontSize: 12.5, color: CLAY, marginTop: 10 }}>{err}</div>}
      <div style={{ height: 1, background: LINE, margin: "18px 0 0" }} />
    </>
  );
}
