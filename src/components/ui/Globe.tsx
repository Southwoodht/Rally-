"use client";
import React from "react";
import { BALL } from "@/lib/theme";

// Drawn rather than 🌍, for the usual reason: an emoji globe renders as
// Apple's glossy blue marble on an iPhone and something else entirely on
// Android, so it never matches the app. See Bell.tsx and MessengerBird.tsx.
//
// The meridians are ellipses rather than a projection — a real one at this
// size is a smudge, and what reads as "globe" is a circle with a waist and
// two curves through it.
export function Globe({ size = 18, color = BALL }: { size?: number; color?: string }) {
  const s = { fill: "none", stroke: color, strokeWidth: 1.4, strokeLinecap: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
      <circle cx="12" cy="12" r="9" {...s} />
      <ellipse cx="12" cy="12" rx="4" ry="9" {...s} />
      <line x1="3" y1="12" x2="21" y2="12" {...s} />
      <path d="M4.6 7.2 A 11 11 0 0 0 19.4 7.2" {...s} />
      <path d="M4.6 16.8 A 11 11 0 0 1 19.4 16.8" {...s} />
    </svg>
  );
}
