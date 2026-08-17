"use client";
import React from "react";
import { AVATARS, MUTED, avCell, miniInput, mono } from "@/lib/theme";

// A curated quick-pick grid for the common cases, plus a free-text field so
// literally any emoji is choosable — typed or pasted via the device's own
// emoji keyboard (Win+. on Windows, Cmd+Ctrl+Space on Mac, the emoji key on
// mobile) — rather than us trying to embed the entire Unicode emoji set.
export function AvatarPicker({ value, onChange }: any) {
  const isCustom = !!value && !AVATARS.includes(value);
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        <button onClick={() => onChange(null)} style={avCell(!value)}><span style={{ fontFamily: mono, fontSize: 10, color: MUTED }}>A–Z</span></button>
        {AVATARS.map((a) => <button key={a} onClick={() => onChange(a)} style={avCell(value === a)}><span style={{ fontSize: 18 }}>{a}</span></button>)}
      </div>
      <input
        value={isCustom ? value : ""}
        onChange={(e) => { const v = e.target.value; onChange(v || null); }}
        placeholder="Or type/paste any emoji…"
        style={{ ...miniInput, width: "100%", boxSizing: "border-box" as const }}
      />
    </div>
  );
}
