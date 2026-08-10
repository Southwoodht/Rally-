"use client";
import React from "react";
import { BALL, CHALK, COURT, LINE, MUTED, body, display, mono } from "@/lib/theme";

export function RankingInfo({ onClose }: any) {
  const items = [
    ["Official", "The headline table. Built from the average strength of your wins, your win rate, and how much you play. Beating strong players matters far more than piling up easy ones — but you still need a body of work, so two lucky wins won't put you top."],
    ["ELO", "A pure skill rating, starting at 0. Beating someone stronger than you earns a lot; losing to someone stronger costs almost nothing. It answers 'how good are you', ignoring how often you play."],
    ["Record", "The simple one — your win rate (share of games won, a draw counts as half), nudged by how strong your opponents were and how much you've played."],
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 95 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "85vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "1px solid " + LINE, padding: "20px 18px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>The three rankings</div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid " + LINE, color: MUTED, borderRadius: 6, padding: "4px 10px", fontFamily: mono, fontSize: 12, cursor: "pointer" }}>Close</button>
        </div>
        {items.map(([t, d]) => (
          <div key={t} style={{ padding: "12px 0", borderTop: "1px solid " + LINE }}>
            <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, color: BALL, textTransform: "uppercase", letterSpacing: -0.3 }}>{t}</div>
            <div style={{ fontFamily: body, fontSize: 13, color: CHALK, marginTop: 4, lineHeight: 1.5 }}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
