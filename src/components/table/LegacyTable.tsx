"use client";
import React, { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { Empty } from "@/components/ui/atoms";
import { computeCareerTable } from "@/core/legacy";
import { miniInput, BALL, CHALK, CLAY, LINE, MUTED, PANEL, body, display, mono } from "@/lib/theme";

export function LegacyTable({ players, matches, onOpen }: any) {
  const [q, setQ] = useState("");
  const career = useMemo(() => computeCareerTable(players, matches), [players, matches]);
  const byId: Record<string, any> = {}; players.forEach((p: any) => { byId[p.id] = p; });
  const term = q.trim().toLowerCase();
  const shown = term ? career.filter((r) => { const p = byId[r.playerId]; return ((p?.name || "") + " " + (p?.last || "")).toLowerCase().includes(term); }) : career;

  return (
    <div>
      <div style={{ background: PANEL, border: "1px solid " + LINE, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: BALL, marginBottom: 6 }}>🏛️ Legacy</div>
        <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>Active rankings measure current form. Legacy ranks by <strong style={{ color: CHALK }}>career matches played</strong> — everyone who's ever played, not just who's active now.</div>
      </div>
      {career.length > 8 && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search players…" style={{ ...miniInput, width: "100%", marginBottom: 12, boxSizing: "border-box" as const }} />
      )}
      {!shown.length ? <Empty msg="No career history yet." /> : shown.map((r, i) => {
        const p = byId[r.playerId];
        if (!p) return null;
        return (
          <button key={r.playerId} onClick={() => onOpen(r.playerId)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: "1px solid " + LINE, background: "transparent", border: "none", width: "100%", textAlign: "left", cursor: "pointer" }}>
            <div style={{ fontFamily: mono, fontSize: 13, width: 20, textAlign: "right", color: i === 0 ? BALL : MUTED, fontWeight: 700 }}>{i + 1}</div>
            <Avatar player={p} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, color: CHALK, textTransform: "uppercase", letterSpacing: -0.3, lineHeight: 1, display: "flex", alignItems: "center", gap: 8 }}>
                {p.name}{p.last ? " " + p.last : ""}
                <span style={{ fontFamily: mono, fontSize: 13, color: CLAY, fontWeight: 700 }}>{Math.round(r.winPct! * 100)}%</span>
                <LevelBadge level={p.level} small />
              </div>
              <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                <span>{r.w}W · {r.d}D · {r.l}L</span>
                <span>{r.firstYear === r.lastYear ? r.firstYear : r.firstYear + "–" + r.lastYear}</span>
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: 46 }}>
              <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: i === 0 ? BALL : CHALK, fontVariantNumeric: "tabular-nums" }}>{r.matches}</div>
              <div style={{ fontFamily: mono, fontSize: 9, color: MUTED, letterSpacing: 1, textTransform: "uppercase" }}>matches</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
