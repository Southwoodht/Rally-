"use client";
import React from "react";
import { shortTier } from "@/lib/format";
import { BALL, COURT, pill } from "@/lib/theme";

// `tiny` is for lists where the badge sits beside a name and is a footnote
// to it, not a headline — the Global table runs twenty of these down the
// screen and at the normal size they read as the loudest thing on it.
export function LevelBadge({ level, small, tiny }: any) {
  if (!level) return null;
  const size = tiny ? 9 : small ? 10 : 11;
  const pad = tiny ? "1px 6px" : small ? "2px 8px" : "3px 10px";
  return <span style={{ ...pill(BALL, COURT), fontSize: size, padding: pad, opacity: tiny ? 0.85 : 1 }}>{shortTier(level)}</span>;
}
