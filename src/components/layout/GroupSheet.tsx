"use client";
import React, { useState } from "react";
import { ClubMark } from "@/components/ui/ClubMark";
import { Check, ChevronRight, LogIn, MoreHorizontal, Plus, Users } from "lucide-react";
import { ordinal } from "@/lib/format";
import { playedAgo, type ClubSummary } from "@/lib/myLeaguePlaces";
import {
  FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_OVERLAY, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID,
  FEED_PAGE, FEED_THEY_LEAD, LINE, PANEL, body, display, tabular,
} from "@/lib/theme";

/**
 * The club switcher, opened from the club pill on every tab.
 *
 * It looks and works like the "Your clubs" landing page (Sam, 2026-10-24): a
 * card per club with its players and matches, Friendlies as a card of its
 * own, then Create and Join — clubs and "no club" as two sections. Before, it was a list of the app's internal
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
  groups, currentId, onSwitch, onClose, summaries, onLeave,
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
  /** "4th · 1463 · 5 days ago" per club (lib/myLeaguePlaces.ts). */
  summaries?: ClubSummary[];
  /** Leave a club, from its ⋯ menu. */
  onLeave?: (club: any) => Promise<void> | void;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const card: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 12, width: "100%", background: FEED_CARD, border: "none",
    borderRadius: 16, padding: "14px 16px", marginBottom: 8, cursor: "pointer", textAlign: "left", boxSizing: "border-box",
  };
  const title: React.CSSProperties = { fontFamily: body, fontWeight: 700, fontSize: 18, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  const sub: React.CSSProperties = { fontFamily: body, fontWeight: 400, fontSize: 14.5, color: FEED_TEXT_MID, marginTop: 3, ...tabular };
  const here = (
    <span style={{ width: 24, height: 24, borderRadius: 12, background: FEED_LIME, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Check size={14} color={FEED_LIME_INK} strokeWidth={3} />
    </span>
  );
  const letter = (child: React.ReactNode) => (
    <span style={{ width: 40, height: 40, borderRadius: 20, flexShrink: 0, display: "grid", placeItems: "center", background: FEED_PAGE, color: FEED_LIME, fontFamily: body, fontWeight: 700, fontSize: 17 }}>{child}</span>
  );
  const go = <ChevronRight size={18} color={FEED_TEXT_LOW} style={{ flexShrink: 0 }} />;
  const count = (n?: { players: number; matches: number }) =>
    n ? `${n.players} ${n.players === 1 ? "player" : "players"} · ${n.matches} ${n.matches === 1 ? "match" : "matches"}` : null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: FEED_OVERLAY, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 90 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: FEED_PAGE, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: "20px 16px 36px", boxSizing: "border-box", boxShadow: "0 -8px 30px var(--shadow-strong)" }}>
        {/* The landing page's layout (Sam's mockup, 2026-10-24): clubs in one
            card, Join and Create as two tiles, Friendlies outside, dashed. */}
        <div style={{ fontFamily: body, fontWeight: 600, fontSize: 13, letterSpacing: 1.6, textTransform: "uppercase", color: FEED_TEXT_MID, padding: "0 4px", marginBottom: 10 }}>Your clubs</div>
        <div style={{ background: FEED_CARD, border: "1px solid " + LINE, borderRadius: 24, overflow: "hidden", marginBottom: 12 }}>
          {(clubs || []).map((c, i) => {
            const on = !friendly && c.id === currentClubId;
            const n = count(sizes?.[c.id]);
            const sm = summaries?.find((x) => x.leagueId === c.id);
            const you = sm
              ? sm.clubMatches === 0
                ? <span style={{ fontWeight: 600 }}>No matches yet</span>
                : <>
                    <span style={{ fontWeight: 700 }}>{sm.place ? ordinal(sm.place) : "Not ranked yet"}{sm.place && sm.rating != null ? " · " + sm.rating : ""}</span>
                    <span style={{ fontWeight: 400, color: FEED_TEXT_MID }}>{sm.lastPlayed ? " · " + playedAgo(sm.lastPlayed) : " · not played yet"}</span>
                  </>
              : null;
            return (
              <div key={c.id}>
                <div role="button" onClick={() => (on ? onClose() : onSwitchClub?.(c))} style={{ ...card, background: "transparent", borderRadius: 0, marginBottom: 0, gap: 16, padding: "16px 16px" }}>
                  <ClubMark club={c} size={50} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ ...title, display: "block" }}>{c.name}</span>
                    {you && <span style={{ display: "block", fontFamily: body, fontSize: 14.5, color: FEED_TEXT_HI, marginTop: 3, ...tabular }}>{you}</span>}
                    <span style={{ ...sub, display: "block" }}>{[n, c.location || null].filter(Boolean).join(" · ") || "Your club"}</span>
                  </span>
                  {on && here}
                  {onLeave && (
                    <button aria-label={"More for " + c.name} onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === c.id ? null : c.id); setConfirm(false); }} style={{ width: 34, height: 34, borderRadius: 17, border: "none", background: menuFor === c.id ? FEED_PAGE : "transparent", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>
                      <MoreHorizontal size={20} color={FEED_TEXT_MID} />
                    </button>
                  )}
                </div>
                {menuFor === c.id && onLeave && (
                  <div style={{ padding: "0 16px 16px 82px" }}>
                    {(c as any).join_code && <div style={{ fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_MID, marginBottom: 10, ...tabular }}>Join code {(c as any).join_code}</div>}
                    {(clubs || []).length > 1 && (confirm ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => onLeave(c)} style={{ flex: 1, fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_LIME_INK, background: FEED_THEY_LEAD, border: "none", borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}>Leave {c.name}</button>
                        <button onClick={() => setConfirm(false)} style={{ flex: 1, fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_TEXT_HI, background: FEED_PAGE, border: "none", borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}>Stay</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirm(true)} style={{ fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_THEY_LEAD, background: "none", border: "none", padding: 0, cursor: "pointer" }}>Leave this club</button>
                    ))}
                  </div>
                )}
                {i < (clubs || []).length - 1 && <div style={{ height: 1, background: LINE, marginLeft: 82 }} />}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 26 }}>
          {([["Join", "Got a code?", <LogIn key="j" size={19} color={FEED_LIME} />, onJoin], ["Create", "For your group", <Plus key="c" size={19} color={FEED_LIME} />, onCreate]] as const).map(([t, s2, icon, act]) => (
            <button key={t} onClick={act} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: FEED_CARD, border: "1px solid " + LINE, borderRadius: 20, padding: "14px 12px", cursor: "pointer", textAlign: "left" }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: FEED_PAGE }}>{icon}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: body, fontWeight: 700, fontSize: 17, color: FEED_TEXT_HI }}>{t}</span>
                <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, marginTop: 1, whiteSpace: "nowrap" }}>{s2}</span>
              </span>
            </button>
          ))}
        </div>

        <div style={{ fontFamily: body, fontWeight: 600, fontSize: 13, letterSpacing: 1.6, textTransform: "uppercase", color: FEED_TEXT_MID, padding: "0 4px", marginBottom: 10 }}>Outside a club</div>
        <button
          onClick={() => { if (friendly) onClose(); else if (typeof window !== "undefined") window.location.href = onFriendly; }}
          style={{ ...card, background: "transparent", border: "1.5px dashed " + FEED_TEXT_MID, borderRadius: 24, gap: 16, padding: "16px 16px" }}
        >
          <span style={{ width: 50, height: 50, flexShrink: 0, display: "grid", placeItems: "center" }}><Users size={24} color={FEED_TEXT_HI} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ ...title, display: "block" }}>Friendlies</span>
            <span style={{ ...sub, display: "block" }}>Log a match against anyone</span>
          </span>
          {friendly ? here : go}
        </button>

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
          <button onClick={onManageLeagues} style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", color: FEED_TEXT_MID, fontFamily: body, fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>
            Leave a club or see join codes
          </button>
        )}
      </div>
    </div>
  );
}
