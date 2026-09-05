"use client";
import React from "react";
import { CalendarPlus } from "lucide-react";
import { StatNumeral } from "@/components/ui/Surfaces";
import { FEED_CARD, FEED_LIME, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body } from "@/lib/theme";

// Two tiles, side by side, never three. At phone width a third column turns
// readable numbers into cramped ones — and there is no arrangement of three
// that doesn't force the middle one to be the shortest.

export interface NextUp {
  /** Their first name, already resolved. */
  opponent: string;
  /** Already formatted — "Sat 13 Sep · 10:00". Only booked fixtures have a
   *  time at all, so an unbooked one can't fill this tile. */
  when: string;
}

export interface ThisMonth {
  w: number;
  l: number;
  /** 0-100, already rounded. */
  winRate: number;
}

const tile: React.CSSProperties = { background: FEED_CARD, borderRadius: 16, padding: 14, minWidth: 0 };
const label: React.CSSProperties = { fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW };
const line = (color: string): React.CSSProperties => ({ fontFamily: body, fontWeight: 400, fontSize: 12.5, color, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });

export function HomeTiles({ nextUp, thisMonth, onBook }: {
  nextUp?: NextUp | null;
  thisMonth?: ThisMonth | null;
  onBook?: () => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {/* Nothing booked isn't an empty tile — an empty tile is a dead end.
          It becomes the way to fix the thing it's reporting. */}
      {nextUp ? (
        <div style={tile}>
          <div style={label}>Next up</div>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 16, color: FEED_TEXT_HI, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {nextUp.opponent}
          </div>
          <div style={line(FEED_TEXT_MID)}>{nextUp.when}</div>
        </div>
      ) : (
        <button onClick={onBook} style={{ ...tile, textAlign: "left", border: "none", cursor: onBook ? "pointer" : "default", display: "block", width: "100%" }}>
          <div style={label}>Next up</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <CalendarPlus size={16} color={FEED_LIME} strokeWidth={2} />
            <span style={{ fontFamily: body, fontWeight: 500, fontSize: 16, color: FEED_LIME }}>Book a match</span>
          </div>
          <div style={line(FEED_TEXT_MID)}>Nothing in the diary</div>
        </button>
      )}

      <div style={tile}>
        <div style={label}>This month</div>
        <div style={{ marginTop: 4 }}>
          {thisMonth
            ? <StatNumeral size={22} tone="hi">{thisMonth.w}–{thisMonth.l}</StatNumeral>
            : <span style={{ fontFamily: body, fontWeight: 500, fontSize: 16, color: FEED_TEXT_MID }}>No matches yet</span>}
        </div>
        <div style={line(FEED_TEXT_MID)}>
          {thisMonth ? thisMonth.winRate + "% win rate" : "Log one and this fills in"}
        </div>
      </div>
    </div>
  );
}
