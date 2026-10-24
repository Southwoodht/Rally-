"use client";
import React from "react";
import { Check, ChevronRight } from "lucide-react";
import {
  FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_OVERLAY, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID,
  PANEL, body, tabular,
} from "@/lib/theme";

/**
 * The club switcher, opened from the club pill on every tab.
 *
 * It looks and works like the "Your clubs" landing page (Sam, 2026-10-24): a
 * card per club with its players and matches, Friendlies as a card of its
 * own, then Create and Join. Before, it was a list of the app's internal
 * groups with a tick box — a different idea of a "club" from the one on the
 * landing page, which is how the two came to look nothing alike.
 *
 * "Everyone I've played" is gone from here: it lives on the Table as the
 * Global table link.
 *
 * `groups` are the app's sections inside one club (shared storage). Almost
 * every club has exactly one, so they are only listed when there is a choice.
 */
export function GroupSheet({
  clubs, sizes, currentClubId, onSwitchClub, onCreate, onJoin, onManageLeagues, friendly, onFriendly = "/?league=friendly",
  groups, currentId, onSwitch, onClose,
}: {
  clubs?: Array<{ id: string; name: string; location?: string | null; role?: string }>;
  sizes?: Record<string, { players: number; matches: number }>;
  currentClubId?: string;
  onSwitchClub?: (club: any) => void;
  onCreate?: () => void;
  onJoin?: () => void;
  onManageLeagues?: () => void;
  friendly?: boolean;
  onFriendly?: string;
  groups?: Array<{ id: string; name: string }>;
  currentId?: string | null;
  onSwitch?: (id: string) => void;
  onClose: () => void;
}) {
  const card: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 12, width: "100%", background: FEED_CARD, border: "none",
    borderRadius: 16, padding: "14px 16px", marginBottom: 8, cursor: "pointer", textAlign: "left", boxSizing: "border-box",
  };
  const title: React.CSSProperties = { fontFamily: body, fontWeight: 500, fontSize: 17, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  const sub: React.CSSProperties = { fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 3, ...tabular };
  const here = (
    <span style={{ width: 24, height: 24, borderRadius: 12, background: FEED_LIME, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Check size={14} color={FEED_LIME_INK} strokeWidth={3} />
    </span>
  );
  const go = <ChevronRight size={18} color={FEED_TEXT_LOW} style={{ flexShrink: 0 }} />;
  const count = (n?: { players: number; matches: number }) =>
    n ? `${n.players} player${n.players === 1 ? "" : "s"} · ${n.matches} match${n.matches === 1 ? "" : "es"}` : null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: FEED_OVERLAY, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 90 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: PANEL, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: "20px 16px 36px", boxSizing: "border-box", boxShadow: "0 -8px 30px var(--shadow-strong)" }}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 18, color: FEED_TEXT_HI, marginBottom: 12, paddingLeft: 2 }}>Your clubs</div>

        {(clubs || []).map((c) => {
          const on = !friendly && c.id === currentClubId;
          const n = count(sizes?.[c.id]);
          return (
            <button key={c.id} onClick={() => (on ? onClose() : onSwitchClub?.(c))} style={card}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ ...title, display: "block" }}>{c.name}</span>
                <span style={{ ...sub, display: "block" }}>
                  {[n, c.location || null, c.role === "owner" ? "Owner" : null].filter(Boolean).join(" · ") || " "}
                </span>
              </span>
              {on ? here : go}
            </button>
          );
        })}

        {/* Friendlies: a card of its own, as on the landing page. */}
        <button
          onClick={() => { if (friendly) onClose(); else if (typeof window !== "undefined") window.location.href = onFriendly; }}
          style={card}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ ...title, display: "block" }}>Friendlies</span>
            <span style={{ ...sub, display: "block" }}>Matches outside any club</span>
          </span>
          {friendly ? here : go}
        </button>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={onCreate} style={{ flex: 1, background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 16, padding: "14px 10px", fontFamily: body, fontWeight: 500, fontSize: 15, cursor: "pointer" }}>Create</button>
          <button onClick={onJoin} style={{ flex: 1, background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 16, padding: "14px 10px", fontFamily: body, fontWeight: 500, fontSize: 15, cursor: "pointer" }}>Join</button>
        </div>

        {/* Sections inside this club — legacy, and only when there is a
            choice to make. */}
        {groups && groups.length > 1 && !friendly && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_LOW, marginBottom: 8, paddingLeft: 2 }}>Sections in this club</div>
            {groups.map((g) => (
              <button key={g.id} onClick={() => onSwitch?.(g.id)} style={{ ...card, padding: "11px 16px" }}>
                <span style={{ ...title, fontSize: 15, flex: 1 }}>{g.name}</span>
                {g.id === currentId ? here : go}
              </button>
            ))}
          </div>
        )}

        {onManageLeagues && (clubs || []).length > 1 && (
          <button onClick={onManageLeagues} style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", color: FEED_TEXT_MID, fontFamily: body, fontSize: 13.5, cursor: "pointer" }}>
            Leave a club or see join codes
          </button>
        )}
      </div>
    </div>
  );
}
