"use client";
import React, { useState } from "react";
import { BigBtn, Empty } from "@/components/ui/atoms";
import { predictProb } from "@/core/predict";
import { BALL, CHALK, COURT, LINE, MUTED, PANEL2, body, display, fxBtn, input, miniInput, mono } from "@/lib/theme";

export function FixturesPanel({ fixtures, players, elo, matches, nameOf, onResolve, onBook }: any) {
  const nm = (id) => { const p = players.find((x) => x.id === id); return p ? p.name + (p.last ? " " + p.last : "") : nameOf(id); };
  const prob = (a, b) => Math.round(predictProb(a, b, matches, elo, players) * 100);
  const [open, setOpen] = useState(null);
  const [whenText, setWhenText] = useState("");
  const [scoreText, setScoreText] = useState("");
  const [search, setSearch] = useState("");
  const done = fixtures.filter((f) => f.done).length;
  const total = fixtures.length;
  if (!total) {
    return (
      <div style={{ textAlign: "center", padding: "24px 12px" }}>
        <div style={{ fontFamily: body, fontSize: 14, color: CHALK, marginBottom: 6 }}>No fixtures set up.</div>
        <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>A league owner can set these up in <strong style={{ color: CHALK }}>Profile → Manage players &amp; league → Fixtures</strong> — either an automatic round-robin or hand-picked matchups.</div>
      </div>
    );
  }
  const openRow = (f) => { setOpen(open === f.id ? null : f.id); setWhenText(f.booked || ""); setScoreText(""); };
  const q = search.trim().toLowerCase();
  const shown = q ? fixtures.filter((f) => (nm(f.p1) + " " + nm(f.p2)).toLowerCase().includes(q)) : fixtures;
  return (
    <div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a player or matchup…" style={{ ...miniInput, width: "100%", marginBottom: 12, boxSizing: "border-box" as const }} />
      <div style={{ fontFamily: mono, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{done}/{total} played{q ? " · " + shown.length + " found" : ""}</div>
      <div style={{ height: 6, background: PANEL2, borderRadius: 3, overflow: "hidden", marginBottom: 16 }}><div style={{ width: (total ? (done / total) * 100 : 0) + "%", height: "100%", background: BALL }} /></div>
      {shown.length === 0 && <Empty msg="No fixtures match that search." />}
      {shown.map((f) => (
        <div key={f.id} style={{ padding: "10px 0", borderBottom: "none" }}>
          {f.done ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>✓</span>
              <span style={{ flex: 1, fontFamily: body, fontSize: 13, color: CHALK, opacity: 0.7 }}>{f.winner === "draw" ? nm(f.p1) + " drew " + nm(f.p2) : nm(f.winner === "p1" ? f.p1 : f.p2) + " beat " + nm(f.winner === "p1" ? f.p2 : f.p1)}{f.score ? " " + f.score : ""}</span>
              <button onClick={() => onResolve(f, null)} style={{ fontFamily: mono, fontSize: 10, color: MUTED, background: "transparent", border: "none", borderRadius: 5, padding: "4px 8px", cursor: "pointer", textTransform: "uppercase", letterSpacing: 1 }}>Undo</button>
            </div>
          ) : (
            <div>
              <button onClick={() => openRow(f)} style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontFamily: body, fontSize: 14, color: CHALK }}>{nm(f.p1)} <span style={{ color: MUTED }}>v</span> {nm(f.p2)}</span>
                  {f.booked ? <span style={{ fontFamily: mono, fontSize: 10, color: COURT, background: BALL, borderRadius: 4, padding: "2px 6px" }}>📅 {f.booked}</span> : null}
                </div>
                {(() => { const p1 = prob(f.p1, f.p2); return (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 10, color: MUTED, marginBottom: 3 }}><span>{p1}%</span><span style={{ textTransform: "uppercase", letterSpacing: 1 }}>win chance</span><span>{100 - p1}%</span></div>
                    <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", background: PANEL2 }}><div style={{ width: p1 + "%", background: BALL }} /><div style={{ width: (100 - p1) + "%", background: MUTED }} /></div>
                  </div>
                ); })()}
                <div style={{ fontFamily: mono, fontSize: 10, color: BALL, marginTop: 5, textTransform: "uppercase", letterSpacing: 1 }}>{open === f.id ? "▾ close" : "tap to set a game or enter result"}</div>
              </button>
              {open === f.id && (
                <div style={{ marginTop: 12, background: PANEL2, borderRadius: 12, padding: 12 }}>
                  <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: BALL, marginBottom: 6 }}>Set a game</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: f.booked ? 6 : 16 }}>
                    <input value={whenText} onChange={(e) => setWhenText(e.target.value)} placeholder="When? e.g. Saturday 2pm" style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }} />
                    <BigBtn onClick={() => onBook(f.id, whenText.trim())} color={BALL} grow={false}>Book</BigBtn>
                  </div>
                  {f.booked && <button onClick={() => onBook(f.id, "")} style={{ fontFamily: mono, fontSize: 10, color: MUTED, background: "transparent", border: "none", borderRadius: 5, padding: "4px 8px", cursor: "pointer", textTransform: "uppercase", marginBottom: 16 }}>Clear booking</button>}
                  <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: BALL, marginBottom: 6 }}>Enter result</div>
                  <input value={scoreText} onChange={(e) => setScoreText(e.target.value)} placeholder="Score, e.g. 6-3 (optional)" style={{ ...miniInput, width: "100%", marginBottom: 8, boxSizing: "border-box" as const }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { onResolve(f, "p1", scoreText.trim()); setOpen(null); }} style={fxBtn}>{nm(f.p1)} won</button>
                    <button onClick={() => { onResolve(f, "draw", scoreText.trim()); setOpen(null); }} style={{ ...fxBtn, flex: "0 0 auto", padding: "8px 12px" }}>Draw</button>
                    <button onClick={() => { onResolve(f, "p2", scoreText.trim()); setOpen(null); }} style={fxBtn}>{nm(f.p2)} won</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
