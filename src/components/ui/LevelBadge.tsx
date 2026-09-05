"use client";
import React from "react";
import { shortTier } from "@/lib/format";
import { BALL, COURT, pill } from "@/lib/theme";

// `tiny` is for lists where the badge sits beside a name and is a footnote
// to it, not a headline — the Global table runs twenty of these down the
// screen and at full size they were the loudest thing on it.
//
// It shrinks the label as well as the type, because padding and text length
// are most of what a pill takes up and dropping a point of font size barely
// shows. "Adv · High" becomes "Adv·H". That is about as far as it can be
// pushed and still be read: the sub-levels are only ever Low, Medium and
// High, and the header on that screen already spells the categories out in
// full ("4 Beginner, 2 Advanced"), so nothing here is the only place a
// reader could decode it.
export function LevelBadge({ level, small, tiny }: any) {
  if (!level) return null;
  const label = tiny ? level.cat.slice(0, 3) + "·" + (level.sub ? level.sub.charAt(0) : "") : shortTier(level);
  const size = tiny ? 8.5 : small ? 10 : 11;
  const pad = tiny ? "1px 5px" : small ? "2px 8px" : "3px 10px";
  return <span style={{ ...pill(BALL, COURT), fontSize: size, padding: pad, opacity: tiny ? 0.85 : 1 }}>{label}</span>;
}
