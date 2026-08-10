"use client";
import React from "react";
import { BALL, CHALK, LINE, MUTED, PANEL, body, display, mono } from "@/lib/theme";

export function RecapCard({ recap, nameOf, leagueName }: any) {
  const Row = ({ icon, label, value }: any) => value ? (
    <div style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid " + LINE, alignItems: "center" }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: MUTED, width: 96 }}>{label}</span>
      <span style={{ flex: 1, fontFamily: body, fontSize: 13, color: CHALK }}>{value}</span>
    </div>
  ) : null;
  return (
    <div style={{ background: PANEL, border: "1px solid " + LINE, borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: BALL, marginBottom: 6 }}>This week at {leagueName}</div>
      <Row icon="🏆" label="Top winner" value={recap.topGain && recap.topGv > 0 ? nameOf(recap.topGain) + " (+" + recap.topGv.toFixed(0) + " ELO)" : null} />
      <Row icon="🔥" label="On a streak" value={recap.strV >= 2 ? nameOf(recap.strP) + " (" + recap.strV + " wins)" : null} />
      <Row icon="⚡" label="Upset" value={recap.upset ? nameOf(recap.upset.wid) + " beat " + nameOf(recap.upset.m.p1 === recap.upset.wid ? recap.upset.m.p2 : recap.upset.m.p1) : null} />
      <Row icon="🎯" label="Match" value={recap.marquee ? nameOf(recap.marquee.p1) + " v " + nameOf(recap.marquee.p2) + (recap.marquee.score ? " " + recap.marquee.score : "") : null} />
    </div>
  );
}
