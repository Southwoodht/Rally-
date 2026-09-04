"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Bell } from "@/components/ui/Bell";
import { listMyAdminClubs } from "@/lib/clubs";
import { computeLocalNotifications, Notification } from "@/core/notifications";
import { listIncomingRequests } from "@/lib/friends";
import { storage } from "@/lib/storage";
import { listMyTrophies, listPendingClaims } from "@/lib/trophies";
import { BALL, CHALK, CLAY, COURT, LINE, MUTED, PANEL2, body, mono } from "@/lib/theme";

const RECENT_WINDOW_MS = 7 * 86400000;
const SEEN_KEY = "notifs_seen";

export function NotificationBell({ meId, players, matches, posts, nameOf, onOpenMatch, onGoAdmin, onGoFriends }: any) {
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<Notification[]>([]);
  // Which notifications have been looked at. Notifications are computed from
  // live data rather than stored, so "read" is the one piece of state that
  // has to be kept — otherwise the count comes back every time the screen
  // recalculates. Kept per account rather than per device, so reading
  // something on your phone clears it on your laptop too.
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [seenLoaded, setSeenLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    storage.get(SEEN_KEY)
      .then((r) => { if (alive && r) setSeen(new Set(JSON.parse(r.value))); })
      .catch(() => {})
      .finally(() => { if (alive) setSeenLoaded(true); });
    return () => { alive = false; };
  }, []);
  const local = useMemo(() => computeLocalNotifications(meId, players, matches, posts, nameOf), [meId, players, matches, posts, nameOf]);

  const loadRemote = async () => {
    const out: Notification[] = [];
    const now = Date.now();
    try {
      // Friend requests notified nowhere at all — no badge, no row, nothing.
      // You only ever found one by opening Friends and happening to look, so
      // a request from somebody you'd just played could sit unanswered for
      // weeks and read as being ignored.
      const requests = await listIncomingRequests();
      requests.forEach((r) => {
        out.push({
          id: "friendreq_" + r.id,
          icon: "👋",
          text: `${r.profile?.display_name || "Someone"} wants to add you as a friend`,
          date: new Date(r.created_at).getTime(),
          action: "friend",
        });
      });
    } catch {}
    try {
      const mine = await listMyTrophies();
      mine.filter((t) => t.status !== "pending" && t.verified_at && now - new Date(t.verified_at).getTime() <= RECENT_WINDOW_MS).forEach((t) => {
        const what = t.kind === "legacy_fact" ? (t.fact_type || "career fact") : (t.competition || "trophy claim");
        out.push({ id: "trophy_" + t.id, icon: t.status === "approved" ? "🏆" : "❌", text: `Your claim for "${what}" was ${t.status}`, date: new Date(t.verified_at!).getTime(), action: "none" });
      });
      const adminClubs = await listMyAdminClubs();
      for (const c of adminClubs) {
        const pending = await listPendingClaims(c.id);
        pending.forEach((t) => {
          out.push({ id: "review_" + t.id, icon: "📋", text: `${t.claimant_name || "Someone"} submitted a claim for ${c.name} — needs review`, date: new Date(t.created_at).getTime(), action: "review" });
        });
      }
    } catch {}
    setRemote(out);
  };

  useEffect(() => { if (open) loadRemote(); /* eslint-disable-next-line */ }, [open]);

  const all = useMemo(() => [...local, ...remote].sort((a, b) => b.date - a.date), [local, remote]);
  // Anything waiting on you that you haven't looked at yet. This used to
  // match remote rows on the words "needs review" in their text, so a friend
  // request or a pending delete could never have reached the badge however
  // it was worded.
  //
  // Seen is deliberately not the same as done: a match still needs
  // confirming after you've read that it's there, and it stays in the list
  // saying so. What stops is the badge and the ringing, which are for "there
  // is something you haven't seen", not "there is something outstanding".
  const badge = all.filter((n) => n.action !== "none" && !seen.has(n.id)).length;

  // Reading the list is what marks it read — same as opening the panel
  // anywhere else. Written back pruned to what's currently live, so the set
  // can't grow forever off the back of notifications that have long gone.
  const markSeen = (ids: string[]) => {
    if (!seenLoaded) return;
    const live = new Set(all.map((n) => n.id));
    const next = new Set([...seen, ...ids].filter((id) => live.has(id)));
    if (next.size === seen.size && [...next].every((id) => seen.has(id))) return;
    setSeen(next);
    storage.set(SEEN_KEY, JSON.stringify([...next])).catch(() => {});
  };

  useEffect(() => {
    if (open && seenLoaded && all.length) markSeen(all.map((n) => n.id));
    // eslint-disable-next-line
  }, [open, seenLoaded, all]);

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Notifications" style={{ position: "relative", background: PANEL2, border: "none", borderRadius: 14, padding: "9px 10px", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Bell size={18} ring={badge > 0} />
        {badge > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: BALL, color: COURT, fontFamily: mono, fontSize: 9, fontWeight: 800, borderRadius: 999, minWidth: 16, height: 16, display: "grid", placeItems: "center", padding: "0 3px" }}>{badge}</span>}
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 98 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "80vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "none", padding: "18px 16px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontFamily: body, fontWeight: 800, fontSize: 17, color: CHALK }}>Notifications</span>
              <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: BALL, borderRadius: 10, padding: "4px 10px", fontFamily: body, fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>Close</button>
            </div>
            {all.length === 0 ? (
              <div style={{ fontFamily: body, fontSize: 13, color: MUTED, padding: "10px 0" }}>Nothing new.</div>
            ) : all.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  if (n.matchId && onOpenMatch) { onOpenMatch(n.matchId); setOpen(false); return; }
                  if (n.action === "friend" && onGoFriends) { onGoFriends(); setOpen(false); return; }
                  if (n.action === "review" && onGoAdmin) { onGoAdmin(); setOpen(false); }
                }}
                disabled={!(n.matchId || (n.action === "friend" && onGoFriends) || (n.action === "review" && onGoAdmin))}
                style={{ display: "flex", gap: 10, width: "100%", background: "transparent", border: "none", borderTop: "none", padding: "11px 2px", cursor: n.matchId || n.action === "friend" || n.action === "review" ? "pointer" : "default", textAlign: "left" }}
              >
                <span style={{ fontSize: 17, flexShrink: 0 }}>{n.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: body, fontSize: 13.5, fontWeight: n.action !== "none" && !seen.has(n.id) ? 600 : 400, color: n.action !== "none" && !seen.has(n.id) ? BALL : CHALK }}>{n.text}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: MUTED, marginTop: 2 }}>{new Date(n.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
