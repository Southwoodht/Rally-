"use client";
import React from "react";
import { BALL, CLAY, COURT, MUTED, body } from "@/lib/theme";

// `colors` is optional and, when given, draws a thin opponent-difficulty bar
// under each result. Five wins in a row read as five wins in a row; the bars
// are what tell you whether they were against anyone. Callers that don't pass
// it get exactly the old row.
export function FormRow({ items, small, colors }: any) {
  const sz = small ? 13 : 15;
  const cell = (s: string) => ({ width: sz, height: sz, borderRadius: 3, fontSize: small ? 8 : 9, fontWeight: 800, display: "grid", placeItems: "center", fontFamily: body, color: COURT, background: s === "W" ? BALL : s === "L" ? CLAY : MUTED } as const);
  return (
    <span style={{ display: "flex", gap: 3 }}>
      {items.map((s: string, i: number) => (
        <span key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={cell(s)}>{s}</span>
          {colors && colors[i] && <span style={{ width: sz, height: 3, borderRadius: 2, background: colors[i] }} />}
        </span>
      ))}
    </span>
  );
}
