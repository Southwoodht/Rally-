"use client";
import React, { useEffect, useMemo, useState } from "react";
import { listMyAdminClubs } from "@/lib/clubs";
import { computeLocalNotifications, Notification } from "@/core/notifications";
import { listMyTrophies, listPendingClaims } from "@/lib/trophies";
import { BALL, CHALK, CLAY, COURT, LINE, MUTED, PANEL2, body, mono } from "@/lib/theme";

const RECENT_WINDOW_MS = 7 * 86400000;

export function NotificationBell({ meId, players, matches, posts, nameOf, onOpenMatch, onGoAdmin }: any) {
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<Notification[]>([]);
  const local = useMemo(() => computeLocalNotifications(meId, players, matches, posts, nameOf), [meId, players, matches, posts, nameOf]);

  const loadRemote = async () => {
    const out: Notification[] = [];
    const now = Date.now();
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
          out.push({ id: "review_" + t.id, icon: "📋", text: `${t.claimant_name || "Someone"} submitted a claim for ${c.name} — needs review`, date: new Date(t.created_at).getTime(), action: "none" });
        });
      }
    } catch {}
    setRemote(out);
  };

  useEffect(() => { if (open) loadRemote(); /* eslint-disable-next-line */ }, [open]);

  const all = useMemo(() => [...local, ...remote].sort((a, b) => b.date - a.date), [local, remote]);
  const badge = local.filter((n) => n.action !== "none").length + remote.filter((n) => n.text.includes("needs review")).length;

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Notifications" style={{ position: "relative", background: PANEL2, border: "1px solid " + LINE, borderRadius: 10, padding: "9px 10px", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 16 }}>🔔</span>
        {badge > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: BALL, color: COURT, fontFamily: mono, fontSize: 9, fontWeight: 800, borderRadius: 999, minWidth: 16, height: 16, display: "grid", placeItems: "center", padding: "0 3px" }}>{badge}</span>}
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 98 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "80vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "1px solid " + LINE, padding: "18px 16px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>Notifications</span>
              <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "1px solid " + LINE, color: MUTED, borderRadius: 6, padding: "4px 10px", fontFamily: mono, fontSize: 12, cursor: "pointer" }}>Close</button>
            </div>
            {all.length === 0 ? (
              <div style={{ fontFamily: body, fontSize: 13, color: MUTED, padding: "10px 0" }}>Nothing new.</div>
            ) : all.map((n) => (
              <button
                key={n.id}
                onClick={() => { if (n.matchId && onOpenMatch) { onOpenMatch(n.matchId); setOpen(false); } }}
                disabled={!n.matchId}
                style={{ display: "flex", gap: 10, width: "100%", background: "transparent", border: "none", borderTop: "1px solid " + LINE, padding: "11px 2px", cursor: n.matchId ? "pointer" : "default", textAlign: "left" }}
              >
                <span style={{ fontSize: 17, flexShrink: 0 }}>{n.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: body, fontSize: 13.5, color: n.action !== "none" ? BALL : CHALK }}>{n.text}</div>
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
