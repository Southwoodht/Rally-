"use client";
import React from "react";
import { CHALK, LINE, MUTED, body, display, mono } from "@/lib/theme";

export function H2HRow({ name, rec, yr, c, onClick }: any) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", width: "100%", background: "transparent", border: "none", borderBottom: "1px solid " + LINE, cursor: "pointer", textAlign: "left" }}>
      <span style={{ fontFamily: body, fontSize: 14, color: CHALK }}>{name}</span>
      <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 13, fontWeight: 700, color: c }}>{rec}</span>
      <span style={{ fontFamily: mono, fontSize: 11, color: MUTED, width: 78, textAlign: "right" }}>{yr}</span>
      <span style={{ fontFamily: mono, fontSize: 12, color: MUTED }}>›</span>
    </button>
  );
}
