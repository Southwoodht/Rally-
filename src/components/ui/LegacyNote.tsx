"use client";
import React, { useState } from "react";
import { FEED_TEXT_MID, body } from "@/lib/theme";

/**
 * A laurel wreath, drawn: two sprays of leaves meeting at the foot. For
 * legacy years — the honours before Southwood — and nothing else.
 */
export function Laurel({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  const leaf = (x: number, y: number, r: number) => (
    <ellipse cx={x} cy={y} rx="1.5" ry="3" transform={`rotate(${r} ${x} ${y})`} fill={color} />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, display: "block" }}>
      <path d="M12 21 C6.5 18.5 4 14 4.6 8.5 M12 21 C17.5 18.5 20 14 19.4 8.5" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      {leaf(4.4, 6.5, -10)}{leaf(3.4, 11, -35)}{leaf(4.6, 15.2, -60)}{leaf(7.4, 18.4, -80)}
      {leaf(19.6, 6.5, 10)}{leaf(20.6, 11, 35)}{leaf(19.4, 15.2, 60)}{leaf(16.6, 18.4, 80)}
    </svg>
  );
}

const EXPLAIN = "Legacy: years before Southwood, agreed by both players. Doesn't count towards ratings or records.";

/**
 * "Led 4 legacy years" under a real record, with the laurel. Tapping it
 * explains what legacy means, once, in place — never a tooltip that a phone
 * cannot hover. Stops the tap reaching the row it sits in.
 */
export function LegacyNote({ text, size = 12.5, align = "left" }: { text: string; size?: number; align?: "left" | "center" }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ display: "block", textAlign: align }}>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setOpen((o) => !o); } }}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: body, fontWeight: 500, fontSize: size, color: FEED_TEXT_MID, cursor: "pointer" }}
      >
        <Laurel size={Math.round(size * 1.15)} />
        {text}
      </span>
      {open && <span style={{ display: "block", fontFamily: body, fontWeight: 500, fontSize: size - 0.5, color: FEED_TEXT_MID, lineHeight: 1.45, marginTop: 4 }}>{EXPLAIN}</span>}
    </span>
  );
}
