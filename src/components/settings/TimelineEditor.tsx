"use client";
import React, { useState } from "react";
import { BigBtn } from "@/components/ui/atoms";
import { LEVELS, SUBS } from "@/core/constants";
import { BALL, CHALK, CLAY, LINE, MUTED, body, display, input, miniInput, mono } from "@/lib/theme";

export function TimelineEditor({ player, onAdd, onRemove }: any) {
  const [cat, setCat] = useState("Beginner"); const [sub, setSub] = useState("Medium");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const hist = player.levelHistory || [];
  return (
    <div style={{ padding: "8px 0 4px" }}>
      {hist.length ? hist.map((h, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
          <span style={{ fontFamily: body, fontSize: 12, color: CHALK }}>{h.cat} · {h.sub} <span style={{ color: MUTED, fontFamily: mono }}>{h.from || "…"}–{h.to || "now"}</span></span>
          <button onClick={() => onRemove(i)} style={{ fontFamily: mono, fontSize: 12, color: CLAY, background: "transparent", border: "none", borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}>×</button>
        </div>
      )) : <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginBottom: 6 }}>No timeline yet — add periods so old games judge this player at their level back then.</div>}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ ...miniInput, flex: 2, boxSizing: "border-box" as const }}>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select>
        <select value={sub} onChange={(e) => setSub(e.target.value)} style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }}>{SUBS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input value={from} onChange={(e) => setFrom(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="From yr" style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }} />
        <input value={to} onChange={(e) => setTo(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="To yr (blank = now)" style={{ ...miniInput, flex: 1.4, boxSizing: "border-box" as const }} />
        <BigBtn onClick={() => { onAdd({ cat, sub, from: from ? parseInt(from) : null, to: to ? parseInt(to) : null }); setFrom(""); setTo(""); }} color={BALL} grow={false}>Add</BigBtn>
      </div>
    </div>
  );
}
