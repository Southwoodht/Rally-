"use client";
import React from "react";
import { ChevronRight } from "lucide-react";
import { FEED_CARD, FEED_PAGE, FEED_TEXT_HI, FEED_TEXT_MID, LINE, body, tabular } from "@/lib/theme";

/**
 * The inset-grouped style (Sam, 2026-10-24, from the landing page he drew):
 * a small uppercase label, then one rounded card holding rows split by
 * hairlines. At most three text levels — label, row title, one muted line —
 * one accent colour, and no explanatory paragraphs.
 *
 * Shared so every screen restyled to it draws the same label, card and
 * divider rather than each growing its own copy.
 */

export function GroupLabel({ children, right, style }: { children: React.ReactNode; right?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px", marginBottom: 8, ...style }}>
      <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontWeight: 600, fontSize: 12.5, letterSpacing: 1.4, textTransform: "uppercase", color: FEED_TEXT_MID, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {children}
      </span>
      {right}
    </div>
  );
}

export function GroupCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: FEED_CARD, border: "1px solid " + LINE, borderRadius: 20, overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

/** One row. `first` leaves off the hairline above it. */
export function GroupRow({ title, sub, right, onClick, first, chevron, style }: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  first?: boolean;
  chevron?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: first ? "none" : "1px solid " + LINE, cursor: onClick ? "pointer" : "default", ...style }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15.5, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        {sub != null && sub !== "" && (
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...tabular }}>{sub}</div>
        )}
      </div>
      {right}
      {chevron && <ChevronRight size={18} color={FEED_TEXT_MID} style={{ flexShrink: 0 }} />}
    </div>
  );
}

/** A small record pill, "3–1", that never wraps. */
export function RecordPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ flexShrink: 0, whiteSpace: "nowrap", fontFamily: body, fontWeight: 600, fontSize: 13, color: FEED_TEXT_HI, background: FEED_PAGE, borderRadius: 999, padding: "4px 10px", ...tabular }}>
      {children}
    </span>
  );
}
