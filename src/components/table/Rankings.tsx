"use client";
import React, { useState } from "react";
import { RankingInfo } from "@/components/table/RankingInfo";
import { Avatar } from "@/components/ui/Avatar";
import { FormRow } from "@/components/ui/FormRow";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { Empty, Toggle } from "@/components/ui/atoms";
import { START_ELO } from "@/core/constants";
import { isSetUp } from "@/core/levels";
import { D, recordStr, winPct } from "@/lib/format";
import { BALL, CHALK, CLAY, LINE, MUTED, PANEL, body, display, input, miniInput, mono } from "@/lib/theme";

export function Rankings({ ranked, elo, wdl, form, official, mode, onMode, onOpen, requireSetup }: any) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [q, setQ] = useState("");
  const base = requireSetup ? ranked.filter(isSetUp) : ranked;
  const term = q.trim().toLowerCase();
  const shown = term ? base.filter((p) => ((p.name || "") + " " + (p.last || "") + " " + (p.nick || "")).toLowerCase().includes(term)) : base;
  const needSetup = requireSetup ? ranked.filter((p) => !isSetUp(p)) : [];
  return (
    <div>
      {base.length > 8 && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search players\u2026" style={{ ...miniInput, width: "100%", marginBottom: 12, boxSizing: "border-box" as const }} />
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "stretch" }}>
        <Toggle on={mode === "overall"} onClick={() => onMode("overall")} label="Official" icon="🏆" emphasize big />
        <Toggle on={mode === "record"} onClick={() => onMode("record")} label="Record" />
        <Toggle on={mode === "winpct"} onClick={() => onMode("winpct")} label="Win %" />
        <Toggle on={mode === "form"} onClick={() => onMode("form")} label="Form" />
        <Toggle on={mode === "elo"} onClick={() => onMode("elo")} label="ELO" />
        <button onClick={() => setInfoOpen(true)} style={{ width: 38, borderRadius: 8, border: "1px solid " + LINE, background: "transparent", color: BALL, fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 15, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>i</button>
      </div>
      {infoOpen && <RankingInfo onClose={() => setInfoOpen(false)} />}
      {term && shown.length === 0 && <Empty msg="No players match that search." />}

      {mode === "overall" && (
        <div style={{ background: PANEL, border: "1px solid " + LINE, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: BALL, marginBottom: 6 }}>Official ranking</div>
          <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>Based on <strong style={{ color: CHALK }}>how strong your wins are on average</strong> (beating higher-level players counts far more), your <strong style={{ color: CHALK }}>win rate</strong>, and <strong style={{ color: CHALK }}>staying active</strong>. Racking up easy wins won't carry you — beating good players will.</div>
        </div>
      )}
      {mode === "elo" && (
        <div style={{ background: PANEL, border: "1px solid " + LINE, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: BALL, marginBottom: 6 }}>How points work</div>
          <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>Everyone starts on <strong style={{ color: CHALK }}>0</strong>. An even match is worth about <strong style={{ color: CHALK }}>±16</strong>. Beat someone above you and you gain more; beat someone below you and you gain less. A draw nudges the gap. Keep losing and you drop below zero.</div>
        </div>
      )}
      {mode === "form" && (
        <div style={{ background: PANEL, border: "1px solid " + LINE, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: BALL, marginBottom: 6 }}>Form</div>
          <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>Just your <strong style={{ color: CHALK }}>last 5 results</strong> — a win scores +1, a loss −1, a draw 0. Shows who's hot right now, regardless of overall record.</div>
        </div>
      )}
      {!shown.length && !needSetup.length ? <Empty msg="No players yet. Add some from Profile → Settings." /> : shown.map((p, i) => {
        const r = wdl[p.id] || { w: 0, d: 0, l: 0, gp: 0 };
        const rating = Math.round(elo[p.id] ?? START_ELO);
        const pct = r.gp ? Math.round(winPct(r) * 100) : null;
        const last = (form[p.id] || []).slice(-5);
        const formScore = last.reduce((s, x) => s + (x === "W" ? 1 : x === "L" ? -1 : 0), 0);
        const leader = i === 0 && r.gp > 0;
        return (
          <button key={p.id} onClick={() => onOpen(p.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: "1px solid " + LINE, background: "transparent", border: "none", width: "100%", textAlign: "left", cursor: "pointer" }}>
            <div style={{ fontFamily: mono, fontSize: 13, width: 20, textAlign: "right", color: leader ? BALL : MUTED, fontWeight: 700 }}>{i + 1}</div>
            <Avatar player={p} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, color: CHALK, textTransform: "uppercase", letterSpacing: -0.3, lineHeight: 1, display: "flex", alignItems: "center", gap: 8 }}>{p.name}{p.last ? " " + p.last : ""}{leader && <span style={{ fontSize: 14 }}>🎾</span>}<LevelBadge level={p.level} small /></div>
              <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 5, display: "flex", gap: 10, alignItems: "center" }}>
                <span>{r.w}W · {r.d}D · {r.l}L</span>
                {pct !== null && <span style={{ color: CLAY, fontWeight: 700 }}>{pct}%</span>}
                {last.length > 0 && <FormRow items={last} small />}
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: 46 }}>
              <div style={{ fontFamily: mono, fontSize: mode === "record" ? 20 : 22, fontWeight: 700, color: mode === "form" ? (formScore > 0 ? BALL : formScore < 0 ? CLAY : MUTED) : (leader ? BALL : CHALK), fontVariantNumeric: "tabular-nums" }}>{mode === "elo" ? rating : mode === "record" ? (r.gp ? recordStr(r) : "0-0") : mode === "winpct" ? (pct === null ? "–" : pct + "%") : mode === "form" ? (r.gp ? (formScore > 0 ? "+" + formScore : String(formScore)) : "–") : (r.gp && official ? Math.round(official[p.id]) : "–")}</div>
              <div style={{ fontFamily: mono, fontSize: 9, color: MUTED, letterSpacing: 1, textTransform: "uppercase" }}>{mode === "elo" ? "elo" : mode === "record" ? "W–L" : mode === "winpct" ? "win %" : mode === "form" ? "form" : "rating"}</div>
            </div>
          </button>
        );
      })}
      {needSetup.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: CLAY, marginBottom: 8 }}>Not set up — unranked</div>
          {needSetup.map((p) => (
            <button key={p.id} onClick={() => onOpen(p.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: "1px solid " + LINE, background: "transparent", border: "none", width: "100%", textAlign: "left", cursor: "pointer", opacity: 0.5 }}>
              <div style={{ width: 20 }} />
              <Avatar player={p} size={38} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, color: CHALK, textTransform: "uppercase", letterSpacing: -0.3 }}>{p.name}{p.last ? " " + p.last : ""}</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: CLAY, marginTop: 3 }}>Needs level timeline</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
