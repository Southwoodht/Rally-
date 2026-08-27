"use client";
import React from "react";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { CHALK, MUTED, body, mono } from "@/lib/theme";

// `level` is the opponent's level right now, not at the time of those
// matches — the point is judging the record against who they are today
// (a winning record against someone now Advanced reads differently than
// against someone still Beginner), same idea Compare already shows.
export function H2HRow({ name, rec, yr, c, level, onClick }: any) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", width: "100%", background: "transparent", border: "none", borderBottom: "none", cursor: "pointer", textAlign: "left" }}>
      <span style={{ fontFamily: body, fontSize: 14, color: CHALK }}>{name}</span>
      {level && <LevelBadge level={level} small />}
      <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 13, fontWeight: 700, color: c }}>{rec}</span>
      <span style={{ fontFamily: mono, fontSize: 11, color: MUTED, width: 78, textAlign: "right" }}>{yr}</span>
      <span style={{ fontFamily: mono, fontSize: 12, color: MUTED }}>›</span>
    </button>
  );
}
