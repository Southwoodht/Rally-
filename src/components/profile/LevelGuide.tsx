"use client";
import React from "react";
import { BALL, CHALK, COURT, MUTED, body } from "@/lib/theme";

export function LevelGuide({ onClose }: any) {
  const items = [
    ["Beginner", "Learning basic forehands and backhands. Can rally 3–10 shots with another beginner. Still developing serves and consistency."],
    ["Intermediate", "Can rally consistently and serve reliably. Understands tactics and positioning. A regular club player."],
    ["Advanced", "Strong club or county level. Can consistently control points. Comfortable against most club players."],
    ["Pro", "National or international standard. Coaching or competing professionally."],
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 95 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "85vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "none", padding: "20px 18px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 14, color: CHALK }}>What's my level?</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, borderRadius: 10, padding: "5px 12px", fontFamily: body, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Close</button>
        </div>
        <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, marginBottom: 8, lineHeight: 1.5 }}>Be honest — rallying with another beginner doesn't make you advanced. Pick where you'd genuinely stand at a club.</div>
        {items.map(([t, d]) => (
          <div key={t} style={{ padding: "12px 0", borderTop: "none" }}>
            <div style={{ fontFamily: body, fontSize: 16, fontWeight: 700, color: BALL }}>{t}</div>
            <div style={{ fontFamily: body, fontSize: 13, color: CHALK, marginTop: 4, lineHeight: 1.5 }}>{d}</div>
          </div>
        ))}
        <div style={{ fontFamily: body, fontSize: 13, color: MUTED, marginTop: 16, lineHeight: 1.5 }}>Not sure? Ask your club coach or the strongest player you know to help you choose — it keeps everyone's ranking fair.</div>
      </div>
    </div>
  );
}
