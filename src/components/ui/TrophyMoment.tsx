"use client";
import React from "react";
import { Trophy } from "lucide-react";
import { FEED_LIME, FEED_TEXT_HI, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

/**
 * A trophy, as a row in a run of matches — match history, Your matches and
 * the league feed all use this one, so a title won looks the same wherever
 * you meet it.
 *
 * It is not a match and must not look like one: no outcome rail, no rating
 * change. The lime trophy and the lime edge are what make it the moment in
 * the list, the same lime that marks the leader on the table.
 */
export function TrophyMoment({ title, who, date, club, onOpen, edge = true, style }: {
  /** "Champion — Men's Singles". */
  title: string;
  /** For the feed: whose it is. Left out on somebody's own history. */
  who?: React.ReactNode;
  /** "4 Jul 2026". */
  date?: string | null;
  club?: string | null;
  onOpen?: () => void;
  /** The 3px lime edge, matching the outcome rail of the rows around it. */
  edge?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        borderLeft: edge ? "3px solid " + FEED_LIME : undefined,
        padding: "12px 16px",
        cursor: onOpen ? "pointer" : "default",
        ...style,
      }}
    >
      <Trophy size={20} color={FEED_LIME} strokeWidth={1.8} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, overflow: "hidden", textOverflow: "ellipsis" }}>
          {who || title}
        </div>
        {/* In the feed the name leads and the honour follows it; on somebody's
            own history the name would be theirs on every row, so it is left
            out and the honour leads. "Zaach won Champion — Men's Singles"
            was the alternative, and nobody talks like that. */}
        {who && (
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_LIME, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}
          </div>
        )}
        <div style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>
          {[date, club].filter(Boolean).join(" · ")}
        </div>
      </div>
    </div>
  );
}
