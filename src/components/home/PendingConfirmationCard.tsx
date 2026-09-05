"use client";
import React from "react";
import { Clock } from "lucide-react";
import { FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, body } from "@/lib/theme";

// A result waiting on the other player.
//
// Not a SurfaceCard: it carries a lime border, which is the one thing on the
// home screen asking to be dealt with rather than read.

export interface PendingConfirmation {
  matchId: string;
  /** "You beat Charlie", "You lost to Zaach", "You drew with George" — the
   *  brief says "You beat", but a pending result can be any of the three and
   *  a card that only knows how to say one of them would lie about the other
   *  two. Built by the caller so the wording lives with the data. */
  headline: string;
  /** Already formatted — "6-2, 6-4". Omitted when nothing was logged. */
  score?: string | null;
  /** Who has to agree to it. */
  waitingOn: string;
  /**
   * Whole hours until it confirms itself, or null when it never will.
   *
   * Null is a real state, not missing data: only results logged after the
   * auto-confirm sweep existed carry a `loggedAt`, and the older ones sit
   * pending forever by design so an old backlog can't mass-confirm itself.
   * The card says nothing about timing rather than inventing a deadline.
   */
  autoConfirmsInHours?: number | null;
}

export interface PendingConfirmationCardProps {
  item: PendingConfirmation;
  onNudge?: (matchId: string) => void;
  onEdit?: (matchId: string) => void;
}

const btn = (fill: string, ink: string): React.CSSProperties => ({
  flex: 1, fontFamily: body, fontWeight: 500, fontSize: 13, padding: "9px 10px",
  borderRadius: 10, border: "none", cursor: "pointer", background: fill, color: ink,
});

export function PendingConfirmationCard({ item, onNudge, onEdit }: PendingConfirmationCardProps) {
  const sub = [
    "Waiting on " + item.waitingOn,
    item.autoConfirmsInHours !== null && item.autoConfirmsInHours !== undefined
      ? "auto-confirms in " + item.autoConfirmsInHours + "h"
      : null,
  ].filter(Boolean).join(" · ");

  return (
    <div style={{ background: FEED_CARD, border: "1.5px solid " + FEED_LIME, borderRadius: 16, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Clock size={16} color={FEED_LIME} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: body, fontSize: 15, color: FEED_TEXT_HI }}>
            <span style={{ fontWeight: 500 }}>{item.headline}</span>
            {item.score && <span style={{ fontWeight: 500 }}> {item.score}</span>}
          </div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 2 }}>{sub}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => onNudge && onNudge(item.matchId)} style={btn(FEED_LIME, FEED_LIME_INK)}>Nudge</button>
        <button onClick={() => onEdit && onEdit(item.matchId)} style={btn(FEED_RAISED, FEED_TEXT_MID)}>Edit</button>
      </div>
    </div>
  );
}

/**
 * Every pending result, capped at three.
 *
 * The cap lives here rather than in the caller because it's a property of
 * the screen: home is a place you glance at, and a column of nine things
 * waiting on other people is a to-do list nobody asked for.
 */
export function PendingStack({ items, onNudge, onEdit, onSeeAll }: {
  items: PendingConfirmation[];
  onNudge?: (matchId: string) => void;
  onEdit?: (matchId: string) => void;
  onSeeAll?: () => void;
}) {
  if (!items || !items.length) return null;   // nothing pending renders nothing
  const shown = items.slice(0, 3);
  const rest = items.length - shown.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {shown.map((it) => (
        <PendingConfirmationCard key={it.matchId} item={it} onNudge={onNudge} onEdit={onEdit} />
      ))}
      {rest > 0 && (
        <button
          onClick={onSeeAll}
          style={{ background: "transparent", border: "none", padding: "2px 0", cursor: onSeeAll ? "pointer" : "default", textAlign: "left", fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID }}
        >
          +{rest} more
        </button>
      )}
    </div>
  );
}
