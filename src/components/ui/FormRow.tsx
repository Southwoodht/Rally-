"use client";
import React from "react";
import { BALL, CLAY, COURT, MUTED, display, mono } from "@/lib/theme";

export function FormRow({ items, small }: any) {
  const sz = small ? 13 : 15;
  return <span style={{ display: "flex", gap: 3 }}>{items.map((s, i) => <span key={i} style={{ width: sz, height: sz, borderRadius: 3, fontSize: small ? 8 : 9, fontWeight: 800, display: "grid", placeItems: "center", fontFamily: mono, color: COURT, background: s === "W" ? BALL : s === "L" ? CLAY : MUTED }}>{s}</span>)}</span>;
}
