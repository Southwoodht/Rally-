"use client";
import React from "react";
import { FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_OVERLAY, FEED_TEXT_HI, FEED_TEXT_MID, PANEL, body } from "@/lib/theme";

/**
 * "Count this as a league game?" — asked after Log a result when the two
 * players still owe each other a competition match (core/leagueGame.ts).
 *
 * There is no tap-outside to dismiss: the result is not saved until one of
 * the buttons is pressed, and a sheet that vanished on a stray tap would lose
 * it. "No, just a friendly" is the old behaviour exactly.
 */
export function LeagueGamePrompt({ who, options, onChoose }: {
  /** "You and Charlie Henry", or both names when staff log for others. */
  who: string;
  options: Array<{ tieId: string; name: string; left: number }>;
  /** The ties it counts for — one per competition — or none for a friendly. */
  onChoose: (tieIds: string[]) => void;
}) {
  const btn: React.CSSProperties = {
    width: "100%", border: "none", borderRadius: 14, padding: "14px 16px", fontFamily: body, fontSize: 16,
    cursor: "pointer", marginTop: 10, textAlign: "center",
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: FEED_OVERLAY, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 98 }}>
      <div style={{ background: PANEL, width: "100%", maxWidth: 620, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: "22px 16px 34px", boxSizing: "border-box" }}>
        <div style={{ fontFamily: body, fontWeight: 600, fontSize: 20, color: FEED_TEXT_HI }}>Count this as a league game?</div>
        <div style={{ fontFamily: body, fontSize: 14.5, color: FEED_TEXT_MID, lineHeight: 1.5, marginTop: 6 }}>
          {who} still {options.length === 1
            ? `have ${options[0].left} ${options[0].left === 1 ? "game" : "games"} to play in ${options[0].name}.`
            : `have games to play in ${options.map((o) => o.name).join(" and ")}.`}{" "}
          If this was one of them, it goes in the table. If not, it&apos;s a friendly and only counts in the ratings.
        </div>
        {/* In two divisions at once (Division 1 and Division Everyone), the
            usual answer is both, so it comes first. */}
        {options.length > 1 && (
          <button onClick={() => onChoose(options.map((o) => o.tieId))} style={{ ...btn, background: FEED_LIME, color: FEED_LIME_INK }}>
            Yes, count it in all {options.length}
          </button>
        )}
        {options.map((o) => (
          <button key={o.tieId} onClick={() => onChoose([o.tieId])} style={{ ...btn, background: options.length > 1 ? FEED_CARD : FEED_LIME, color: options.length > 1 ? FEED_TEXT_HI : FEED_LIME_INK }}>
            {options.length > 1 ? "Only " + o.name : "Yes, a " + o.name + " game"}
          </button>
        ))}
        <button onClick={() => onChoose([])} style={{ ...btn, background: FEED_CARD, color: FEED_TEXT_HI }}>
          No, just a friendly
        </button>
      </div>
    </div>
  );
}
