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
import { fullNameOf } from "@/lib/format";

// There's no realtime subscription here on purpose — one poll while the
// screen is open is a few hundred bytes and needs no extra Supabase setup.
// Worth revisiting if conversations ever get busy.
const POLL_MS = 15000;

function MessagesHeader({ onBack }: { onBack?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
      {onBack && (
        <button onClick={onBack} aria-label="Back" style={{ background: "transparent", border: "none", padding: "0 4px 0 0", cursor: "pointer", display: "grid", placeItems: "center" }}>
          <ChevronLeft size={22} color={FEED_LIME} strokeWidth={2} />
        </button>
      )}
      <span style={{ fontFamily: body, fontWeight: 500, fontSize: 28, letterSpacing: "-0.035em", color: FEED_TEXT_HI }}>Messages</span>
    </div>
  );
}

const when = (iso: string) => {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m";
  if (mins < 1440) return Math.round(mins / 60) + "h";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/**
 * Who this conversation is with, named the way the rest of the app names
 * people.
 *
 * `display_name` is whatever the account typed into its profile. The Table
 * and the match cards use the league player record, and a screen that names
 * the same person differently from every other screen is a screen you have
 * to double-check. Friendship is between accounts, so the join is auth_id.
 *
 * A conversation that resolves to a player with no name falls back to the
 * raw string and says so in the console: that is a data problem and it
 * should be findable, not smoothed over.
 */
function playerForThread(t: Thread, players?: any[]): any | null {
  const authId = t.profile?.id;
  return (authId && players ? players.find((p) => p.auth_id === authId) : null) || null;
}

function nameForThread(t: Thread, players?: any[]): string {
  const player = playerForThread(t, players);
  if (player) {
    const full = fullNameOf(player);
    if (full && full !== "Someone") return full;
    console.warn("Messages: player row has no usable name", { authId: t.profile?.id, playerId: player.id });
  }
  return t.profile?.display_name || "Someone";
}

/**
 * Their actual face, the same one the Table and the match cards show.
 *
 * The order is the shared Avatar's order — photo, then the emoji they picked,
 * then an initial — because a person who has set an emoji avatar has one
 * face in this app and it should not disappear the moment you message them.
 * This was showing a grey letter for everybody in Seacourt, where the
 * players all have emoji.
 *
 * The player record wins over the account's avatar_url: that is the picture
 * attached to who they are in this league, which is what every other screen
 * is showing you.
 */
function Face({ t, name, player, size = 44 }: { t: Thread; name: string; player?: any; size?: number }) {
  const common = { width: size, height: size, borderRadius: "50%", flexShrink: 0 } as const;
  const photo = player?.avatarUrl || t.profile?.avatar_url;
  if (photo) return <img src={photo} alt="" style={{ ...common, objectFit: "cover", background: FEED_RAISED }} />;
  if (player?.avatar) {
    return (
      <span style={{ ...common, display: "grid", placeItems: "center", background: FEED_RAISED, fontSize: size * 0.52 }}>
        {player.avatar}
      </span>
    );
  }
  return (
    // Only when there is genuinely no face to show. The initial recedes
    // rather than competing with the name beside it.
    <span style={{ ...common, display: "grid", placeItems: "center", background: FEED_RAISED, fontFamily: body, fontWeight: 500, fontSize: size * 0.38, color: FEED_TEXT_LOW }}>
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

// The press state has to be CSS — :active cannot be expressed inline. No
// scale transform: a row that shrinks under the thumb reads as a button, and
// this is a list.
const ROW_PAD = 16;
const AVATAR = 44;
const ROW_GAP = 12;

const ROW_CSS = `
.rally-thread-row { transition: background 120ms ease-out; }
.rally-thread-row:active { background: ${FEED_RAISED} !important; }
`;

function ThreadRowView({ t, players, onClick, first }: { t: Thread; players?: any[]; onClick: () => void; first?: boolean }) {
  const unread = t.unread > 0;
  const player = playerForThread(t, players);
  const name = nameForThread(t, players);
  return (
    <button
      className="rally-thread-row"
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", cursor: "pointer",
        border: "none", background: "transparent", minHeight: 72, padding: "12px 16px",
      }}
    >
      {/* Inset to where the name starts rather than full-bleed, so the column
          of faces reads as a column and the lines separate the text. A
          border-top would run the full width. */}
      {!first && (
        <span
          aria-hidden="true"
          style={{ position: "absolute", top: 0, left: ROW_PAD + AVATAR + ROW_GAP, right: 0, height: 1, background: FEED_RAISED }}
        />
      )}
      <Face t={t} name={name} player={player} size={AVATAR} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: body, fontWeight: unread ? 600 : 500, fontSize: 17, letterSpacing: "-0.2px", color: FEED_TEXT_HI, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
        <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 15, color: FEED_TEXT_LOW, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t.lastMessage ? (t.lastFromMe ? "You: " : "") + t.lastMessage : "No messages yet"}
        </span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, alignSelf: "flex-start", marginTop: 2 }}>
        {t.last_message_at && (
          <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_LOW }}>{when(t.last_message_at)}</span>
        )}
        {unread && <span style={{ width: 8, height: 8, borderRadius: 4, background: FEED_LIME, flexShrink: 0 }} />}
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

/** Consecutive messages from one person inside this window are one turn. */
const GROUP_WINDOW_MS = 2 * 60 * 1000;

/** The clock only interrupts the conversation once this much has passed. */
const DIVIDER_GAP_MS = 60 * 60 * 1000;

/**
 * The divider between two stretches of conversation.
 *
 * A different day gets the day and the time, because "14:20" on its own is a
 * lie about which afternoon. The same day gets the time alone — the day is
 * already established further up.
 */
const dividerLabel = (iso: string) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? time : dayLabel(iso) + " · " + time;
};

function Conversation({ thread, myId, onBack, onChanged, players }: any) {
  const t: Thread = thread;
  const who = nameForThread(t, players);
  const whoPlayer = playerForThread(t, players);
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
        <Face t={t} name={who} player={whoPlayer} size={40} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: body, fontWeight: 500, fontSize: 18, color: FEED_TEXT_HI, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{who}</span>
          <span style={{ display: "block", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 1 }}>
            {t.status === "accepted" ? (msgs ? msgs.length + " message" + (msgs.length === 1 ? "" : "s") : " ") : t.isRequestToMe ? "Message request" : "Request sent — not accepted yet"}
          </span>
        </span>
      </div>

      {t.isRequestToMe && (
        <div style={{ background: FEED_CARD, borderRadius: 18, padding: 16, marginBottom: 14 }}>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_TEXT_HI, lineHeight: 1.5, marginBottom: 12 }}>
            <span style={{ fontWeight: 500 }}>{who}</span> wants to message you. You&apos;re not friends, so this is a request — they can&apos;t hear back from you until you accept.
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
            <Face t={t} name={who} player={whoPlayer} size={56} />
            <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15.5, color: FEED_TEXT_HI, marginTop: 12 }}>
              {who}
            </div>
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, marginTop: 4 }}>
              No messages yet. Say something.
            </div>
          </div>
        ) : msgs.map((m, i) => {
          const mine = m.sender_id === myId;
          const prev = msgs[i - 1], next = msgs[i + 1];
          const at = (x: any) => new Date(x.created_at).getTime();

          // A burst of messages from one person is one turn in the
          // conversation. Two minutes is the window: long enough to cover
          // somebody typing three thoughts in a row, short enough that
          // picking the thread back up after lunch reads as a new turn.
          const grouped = (a: any, b: any) => !!a && !!b && a.sender_id === b.sender_id && Math.abs(at(b) - at(a)) <= GROUP_WINDOW_MS;
          const withPrev = grouped(prev, m);
          const withNext = grouped(m, next);

          // The clock only interrupts when real time has passed. Anything
          // under an hour and the conversation is still the same
          // conversation, so a divider would just be the clock talking over
          // it. A day boundary always clears the hour, so this covers it.
          const divider = i === 0 || at(m) - at(prev) > DIVIDER_GAP_MS;

          // "Seen" belongs on the last thing you sent and nowhere else — on
          // every bubble it's noise, and on theirs it's meaningless.
          const isMyLast = mine && !msgs.slice(i + 1).some((x) => x.sender_id === myId);

          // Where two bubbles touch, the corner between them tightens on the
          // sender's side only. The outer edge keeps its full radius, so a
          // run reads as one shape rather than a stack of separate ones.
          const tight = 4, round = 18;
          return (
            <React.Fragment key={m.id}>
              {divider && (
                <div style={{ textAlign: "center", margin: i === 0 ? "2px 0 12px" : "20px 0 12px" }}>
                  <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW }}>
                    {dividerLabel(m.created_at)}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, justifyContent: mine ? "flex-end" : "flex-start", marginBottom: withNext ? 4 : 12 }}>
                {/* Their face sits beside the last bubble of their run only.
                    The gutter is held open for the rest so the column of
                    bubbles doesn't step sideways as a run goes on. */}
                {!mine && (withNext
                  ? <span style={{ width: 28, flexShrink: 0 }} />
                  : <Face t={t} name={who} player={whoPlayer} size={28} />)}
                <div style={{ maxWidth: "75%" }}>
                  <div
                    style={{
                      background: mine ? FEED_LIME : FEED_RAISED,
                      color: mine ? FEED_LIME_INK : FEED_TEXT_HI,
                      borderRadius: round,
                      borderTopRightRadius: mine && withPrev ? tight : round,
                      borderBottomRightRadius: mine && withNext ? tight : round,
                      borderTopLeftRadius: !mine && withPrev ? tight : round,
                      borderBottomLeftRadius: !mine && withNext ? tight : round,
                      padding: "8px 12px",
                      fontFamily: body, fontWeight: 400, fontSize: 15, lineHeight: 1.45,
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}
                  >
                    {m.body}
                  </div>
                  {isMyLast && m.read_at && !withNext && (
                    <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, marginTop: 4, textAlign: "right" }}>
                      Seen
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
              flex: 1, minWidth: 0, height: 40, background: FEED_CARD, border: "none", borderRadius: 20,
              padding: "0 16px", fontFamily: body, fontWeight: 400, fontSize: 15,
              color: FEED_TEXT_HI, outline: "none", boxSizing: "border-box" as const,
            }}
          />
          <button
            onClick={send}
            disabled={busy || !text.trim()}
            aria-label="Send"
            style={{
              width: 40, height: 40, borderRadius: 20, border: "none", flexShrink: 0,
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

export function Messages({ startWith, onStarted, players, onBack }: { startWith?: string | null; onStarted?: () => void; players?: any[]; onBack?: () => void }) {
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
      <>
      <MessagesHeader onBack={onBack} />
      <div style={{ background: FEED_CARD, borderRadius: 18, padding: 18 }}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_THEY_LEAD }}>Messages unavailable.</div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, marginTop: 6 }}>{err}</div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_LOW, lineHeight: 1.5, marginTop: 8 }}>
          If this says a table or function is missing, the one-off SQL in supabase/schema_messages.sql hasn&apos;t been run yet.
        </div>
      </div>
      </>
    );
  }

  const open = threads?.find((t) => t.id === openId);
  if (open) return <Conversation thread={open} myId={myId} onBack={() => setOpenId(null)} onChanged={load} players={players} />;

  if (!threads) return <><MessagesHeader onBack={onBack} /><Empty msg="Loading…" /></>;

  const requests = threads.filter((t) => t.isRequestToMe);
  const conversations = threads.filter((t) => !t.isRequestToMe);

  if (!threads.length) {
    return <><MessagesHeader onBack={onBack} /><Empty msg="No messages yet. Open someone's profile and tap Message." /></>;
  }

  return (
    <>
      <style>{ROW_CSS}</style>
      <MessagesHeader onBack={onBack} />
      {requests.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: body, fontWeight: 500, fontSize: 17, color: CHALK }}>Requests</span>
            <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 10.5, color: FEED_LIME_INK, background: BALL, borderRadius: 999, padding: "1px 7px" }}>{requests.length}</span>
          </div>
          <div style={{ background: FEED_CARD, borderRadius: 20, overflow: "hidden", marginBottom: 18 }}>
            {requests.map((t, i) => <ThreadRowView key={t.id} t={t} players={players} first={i === 0} onClick={() => setOpenId(t.id)} />)}
          </div>
          <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, lineHeight: 1.45, margin: "-10px 0 18px" }}>
            People you aren&apos;t friends with land here first. They can&apos;t see whether you&apos;ve read it, and they can&apos;t hear back until you accept.
          </div>
        </>
      )}
      {conversations.length > 0 && (
        <>
          {requests.length > 0 && <div style={{ fontFamily: body, fontWeight: 500, fontSize: 17, color: CHALK, marginBottom: 8 }}>Conversations</div>}
          <div style={{ background: FEED_CARD, borderRadius: 20, overflow: "hidden" }}>
            {conversations.map((t, i) => <ThreadRowView key={t.id} t={t} players={players} first={i === 0} onClick={() => setOpenId(t.id)} />)}
          </div>
        </>
      )}
      {err && <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_THEY_LEAD, marginTop: 10 }}>{err}</div>}
    </>
  );
}
