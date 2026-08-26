"use client";
import React from "react";
import { BALL, CHALK, COURT, MUTED, body } from "@/lib/theme";

export function RankingInfo({ onClose }: any) {
  const items = [
    ["Official", "The headline table. Built from the average strength of your wins, your win rate, and how much you play. Beating strong players matters far more than piling up easy ones — but you still need a body of work, so two lucky wins won't put you top."],
    ["ELO", "A pure skill rating, starting at 0. Beating someone stronger than you earns a lot; losing to someone stronger costs almost nothing. It answers 'how good are you', ignoring how often you play."],
    ["Record", "The simple one — your win rate (share of games won, a draw counts as half), nudged by how strong your opponents were and how much you've played."],
    ["Form", "Just your last 5 results — a win scores +1, a loss −1, a draw 0. Shows who's hot right now, regardless of overall record."],
    ["Win %", "The rawest number — just wins divided by games played (draws count as half a win), no adjustment for opponent strength or activity."],
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 95 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "85vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "none", padding: "20px 18px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 14, color: CHALK }}>The rankings</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, borderRadius: 10, padding: "5px 12px", fontFamily: body, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Close</button>
        </div>
        {items.map(([t, d]) => (
          <div key={t} style={{ padding: "12px 0", borderTop: "none" }}>
            <div style={{ fontFamily: body, fontSize: 16, fontWeight: 700, color: BALL }}>{t}</div>
            <div style={{ fontFamily: body, fontSize: 13, color: CHALK, marginTop: 4, lineHeight: 1.5 }}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
