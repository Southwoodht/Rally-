"use client";
import React from "react";
import { FEED_LIME, FEED_LOST, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, body } from "@/lib/theme";

// The last five results, and who they were against.
//
// Profile only. The Table and Home keep plain FormDots — a dot answers "how
// is he doing", and this answers "against whom", which is a question you
// only ask once you are already looking at one person.
//
// Until 2026-10-22 it was five bars whose height was the opponent's level at
// the date; Sam found them unreadable, so it is letters now. `height` is
// still supplied by callers and no longer drawn.

export interface FormBarItem {
  outcome: "W" | "D" | "L";
  /**
   * Bar height in px for the opponent's tier at that date, or null when no
   * level was recorded for them then.
   *
   * Null renders a 3px stub rather than a short bar. Beginner is already
   * 10px, so anything with a plausible height collides with a real value and
   * becomes a guess wearing a different hat — a stub has visibly no height
   * and reads as "not participating" rather than "weak opponent".
   */
  height: number | null;
  opponentName: string;
  /** "Intermediate · Medium", or undefined when unknown. */
  levelLabel?: string;
}

/**
 * The last five as letters — W W L W L — oldest on the left, each with who it
 * was against underneath (Sam, 2026-10-22: the bars whose height was the
 * opponent's level "look nice but I don't get it"). The opponent's level is
 * still there for anyone who holds a finger on a result.
 */
function Chip({ item }: { item: FormBarItem }) {
  const verb = item.outcome === "W" ? "Beat" : item.outcome === "L" ? "Lost to" : "Drew with";
  const label = `${verb} ${item.opponentName}${item.levelLabel ? ", " + item.levelLabel : ""}`;
  const colour = item.outcome === "W" ? FEED_LIME : item.outcome === "L" ? FEED_LOST : FEED_TEXT_HI;
  // "Charlie H", not "Charlie": Seacourt has two, and the bare first name
  // would put both on the same chip.
  const parts = (item.opponentName || "").trim().split(/\s+/);
  const first = parts[0] + (parts[1] ? " " + parts[1][0] : "");
  return (
    <div title={label} aria-label={label} role="img" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 48, minWidth: 0 }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: FEED_RAISED, color: colour, display: "grid", placeItems: "center", fontFamily: body, fontWeight: 500, fontSize: 15 }}>{item.outcome}</span>
      <span style={{ fontFamily: body, fontSize: 10.5, color: FEED_TEXT_MID, maxWidth: 48, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{first}</span>
    </div>
  );
}

export function FormBars({ items }: { items: FormBarItem[] }) {
  if (!items || !items.length) return null;
  const shown = items.slice(-5);
  return (
    <div>
      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID, marginBottom: 8, textAlign: "center" }}>
        {shown.length === 5 ? "Last 5" : "Last " + shown.length} · latest on the right
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
        {shown.map((item, i) => <Chip key={i} item={item} />)}
      </div>
    </div>
  );
}
