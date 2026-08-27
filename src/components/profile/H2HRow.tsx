"use client";
import React from "react";
import { shortTier } from "@/lib/format";
import { CHALK, MUTED, body, mono } from "@/lib/theme";

// `level` is the opponent's level right now — just background on who they
// are today, deliberately small and quiet. It says nothing about how hard
// the wins in `rec` actually were, since that record can span matches from
// years apart at very different levels — see the per-match rating instead
// (core/difficulty.ts) for that, which uses their level at the time.
export function H2HRow({ name, rec, yr, c, level, onClick }: any) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", padding: "7px 0", width: "100%", background: "transparent", border: "none", borderBottom: "none", cursor: "pointer", textAlign: "left" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: body, fontSize: 14, color: CHALK }}>{name}</div>
        {level && <div style={{ fontFamily: body, fontSize: 11, color: MUTED, marginTop: 1 }}>currently {shortTier(level)}</div>}
      </div>
      <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: c }}>{rec}</span>
      <span style={{ fontFamily: mono, fontSize: 11, color: MUTED, width: 78, textAlign: "right" }}>{yr}</span>
      <span style={{ fontFamily: mono, fontSize: 12, color: MUTED }}>›</span>
    </button>
  );
}
