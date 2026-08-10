"use client";
import React from "react";
import { colorFor } from "@/lib/format";
import { COURT, LINE, PANEL2, display } from "@/lib/theme";

export function Avatar({ player, size = 34 }: any) {
  if (!player) return null;
  const em = player.avatar;
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, background: em ? PANEL2 : colorFor(player.id), display: "grid", placeItems: "center", flexShrink: 0, border: "1px solid " + LINE, overflow: "hidden" }}>
      {em ? <span style={{ fontSize: size * 0.52 }}>{em}</span> : <span style={{ fontFamily: display, fontWeight: 800, fontSize: size * 0.46, color: COURT }}>{player.name.slice(0, 1).toUpperCase()}</span>}
    </div>
  );
}
