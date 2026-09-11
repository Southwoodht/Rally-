"use client";
import React from "react";
import { CalendarPlus } from "lucide-react";
import { StatNumeral } from "@/components/ui/Surfaces";
import { formatMatchDateTime } from "@/lib/format";
import { FEED_CARD, FEED_LIME, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

// Two tiles, side by side, never three. At phone width a third column turns
// readable numbers into cramped ones — and there is no arrangement of three
// that doesn't force the middle one to be the shortest.

export interface NextUp {
  /** Their full name. A first name alone is ambiguous in a club with two
   *  Charlies, and this is the one line telling you who to turn up against. */
  opponent: string;
  /** The stored booking time. Formatted here, not by the caller, so every
   *  screen showing a booking says it the same way. */
  when: any;
  /** What the app reckons, in words. */
  line?: string | null;
  /** Your chance, rounded. Null when there is nothing to go on. */
  winChance?: number | null;
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
          <div style={{ ...line(FEED_TEXT_MID), ...tabular }}>{formatMatchDateTime(nextUp.when)}</div>
          {/* What the app reckons, said the way somebody would say it. The
              number is the app's; the sentence is for the person reading it
              ten minutes before they leave the house. */}
          {nextUp.line && (
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, marginTop: 6, lineHeight: 1.4 }}>
              {nextUp.line}
              {nextUp.winChance != null && (
                <span style={{ ...tabular, color: FEED_LIME, marginLeft: 6 }}>{nextUp.winChance}%</span>
              )}
            </div>
          )}
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
