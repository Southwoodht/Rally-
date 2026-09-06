"use client";
import React from "react";
import { FEED_LIME, FEED_TEXT_MID, body } from "@/lib/theme";

// The last five results, with height carrying who they were against.
//
// Profile only. The Table and Home keep plain FormDots — a dot answers "how
// is he doing", and this answers "against whom", which is a question you
// only ask once you are already looking at one person.
//
// Height is the opponent's level AT THE DATE OF THE MATCH, never today's.
// Form that redraws itself when an old opponent gets promoted is not form,
// it is a rolling reinterpretation of the past.

const EMPTY = "#2F5B47";
const ROW_HEIGHT = 30;
const STUB = 3;

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

const fillFor = (outcome: FormBarItem["outcome"]) =>
  outcome === "W" ? FEED_LIME : outcome === "L" ? EMPTY : "transparent";

function Bar({ item }: { item: FormBarItem }) {
  const known = item.height !== null && item.height !== undefined;
  const h = known ? item.height! : STUB;
  const verb = item.outcome === "W" ? "Beat" : item.outcome === "L" ? "Lost to" : "Drew with";
  const label = known
    ? `${verb} ${item.opponentName}, ${item.levelLabel || "level unknown"}`
    : `${verb} ${item.opponentName}, level not recorded`;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{
        width: 9, height: h, borderRadius: 3, display: "block", flexShrink: 0,
        background: fillFor(item.outcome),
        border: item.outcome === "D" ? "1.5px solid " + FEED_LIME : undefined,
        boxSizing: "border-box",
      }}
    />
  );
}

export function FormBars({ items }: { items: FormBarItem[] }) {
  if (!items || !items.length) return null;
  const shown = items.slice(-5);
  const unknown = shown.filter((i) => i.height === null || i.height === undefined).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID }}>
          {shown.length === 5 ? "Last 5" : "Last " + shown.length}
        </span>
        <span style={{ fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID }}>height = opponent level</span>
      </div>
      {/* Bottom-aligned so the heights are read against a shared baseline —
          centred bars would make a tall one and a short one look like two
          different kinds of thing rather than two amounts. */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 10, height: ROW_HEIGHT }}>
        {shown.map((item, i) => <Bar key={i} item={item} />)}
      </div>
      {/* Said out loud rather than left to be inferred from a short mark.
          Two thirds of this league have no level history, so this line will
          be common until the re-pick prompt lands — and a gap somebody can
          see is a gap somebody can fill. */}
      {unknown > 0 && (
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID, textAlign: "center", marginTop: 8 }}>
          {unknown} of {shown.length} {unknown === 1 ? "has" : "have"} no level recorded
        </div>
      )}
    </div>
  );
}
