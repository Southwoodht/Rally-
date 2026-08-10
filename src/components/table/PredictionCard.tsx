"use client";
import React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BALL, CHALK, LINE, MUTED, PANEL, PANEL2, body, display, mono } from "@/lib/theme";

export function PredictionCard({ prediction }: any) {
  const top = prediction.slice(0, 4);
  return (
    <div style={{ background: PANEL, border: "1px solid " + LINE, borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: BALL, marginBottom: 2 }}>League prediction</div>
      <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, marginBottom: 14, lineHeight: 1.4 }}>Chance to top the season — a model from ELO &amp; form, not a promise. Shifts with every result.</div>
      {top.map((x, i) => (
        <div key={x.p.id} style={{ marginBottom: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
            <span style={{ fontFamily: display, fontSize: 17, fontWeight: 700, color: CHALK, textTransform: "uppercase", letterSpacing: -0.3, display: "flex", alignItems: "center", gap: 8 }}><Avatar player={x.p} size={22} />{x.p.name}</span>
            <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: i === 0 ? BALL : CHALK }}>{x.pct}%</span>
          </div>
          <div style={{ height: 6, background: PANEL2, borderRadius: 3, overflow: "hidden" }}><div style={{ width: x.pct + "%", height: "100%", background: i === 0 ? BALL : MUTED }} /></div>
        </div>
      ))}
    </div>
  );
}
