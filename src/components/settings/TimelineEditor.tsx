"use client";
import React, { useState } from "react";
import { BigBtn } from "@/components/ui/atoms";
import { LEVELS, SUBS } from "@/core/constants";
import { BALL, CHALK, CLAY, MUTED, body, miniInput, mono } from "@/lib/theme";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A boundary is either a plain year (older entries) or a "YYYY-MM" string
// from the month picker below — format either one for display.
const fmtBoundary = (v: any) => {
  if (v == null) return null;
  if (typeof v === "number") return String(v);
  const [y, m] = String(v).split("-").map(Number);
  return m ? `${MONTH_NAMES[m - 1]} ${y}` : String(y);
};

export function TimelineEditor({ player, onAdd, onRemove }: any) {
  const [cat, setCat] = useState("Beginner"); const [sub, setSub] = useState("Medium");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const hist = player.levelHistory || [];
  return (
    <div style={{ padding: "8px 0 4px" }}>
      {hist.length ? hist.map((h, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
          <span style={{ fontFamily: body, fontSize: 12, color: CHALK }}>{h.cat} · {h.sub} <span style={{ color: MUTED, fontFamily: mono }}>{fmtBoundary(h.from) || "…"}–{fmtBoundary(h.to) || "now"}</span></span>
          <button onClick={() => onRemove(i)} style={{ fontFamily: mono, fontSize: 12, color: CLAY, background: "transparent", border: "none", borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}>×</button>
        </div>
      )) : <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginBottom: 6 }}>No timeline yet — add periods so old games judge this player at their level back then.</div>}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ ...miniInput, flex: 2, boxSizing: "border-box" as const }}>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select>
        <select value={sub} onChange={(e) => setSub(e.target.value)} style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }}>{SUBS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
        <input type="month" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...miniInput, flex: 1, colorScheme: "dark", boxSizing: "border-box" as const }} />
        <span style={{ color: MUTED, fontFamily: body, fontSize: 12 }}>to</span>
        <input type="month" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Now" style={{ ...miniInput, flex: 1, colorScheme: "dark", boxSizing: "border-box" as const }} />
      </div>
      <div style={{ fontFamily: body, fontSize: 11, color: MUTED, marginTop: 4, marginBottom: 6 }}>Leave "to" blank if this is their level now.</div>
      <BigBtn onClick={() => { onAdd({ cat, sub, from: from || null, to: to || null }); setFrom(""); setTo(""); }} color={BALL}>Add period</BigBtn>
    </div>
  );
}
