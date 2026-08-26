"use client";
import React, { useState } from "react";
import { RankingInfo } from "@/components/table/RankingInfo";
import { Avatar } from "@/components/ui/Avatar";
import { FormRow } from "@/components/ui/FormRow";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { Empty } from "@/components/ui/atoms";
import { START_ELO } from "@/core/constants";
import { isSetUp } from "@/core/levels";
import { D, recordStr, winPct } from "@/lib/format";
import { BALL, CHALK, CLAY, MUTED, PANEL, RADIUS, body, input, listCard, listRow, miniInput, mono, segmentOption, segmentTrack } from "@/lib/theme";

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
        <div style={{ ...segmentTrack, flex: 1 }}>
          <button onClick={() => onMode("overall")} style={segmentOption(mode === "overall")}>Official</button>
          <button onClick={() => onMode("record")} style={segmentOption(mode === "record")}>Record</button>
          <button onClick={() => onMode("winpct")} style={segmentOption(mode === "winpct")}>Win %</button>
          <button onClick={() => onMode("form")} style={segmentOption(mode === "form")}>Form</button>
          <button onClick={() => onMode("elo")} style={segmentOption(mode === "elo")}>ELO</button>
        </div>
        <button onClick={() => setInfoOpen(true)} style={{ width: 38, borderRadius: 12, border: "none", background: "rgba(0,0,0,0.22)", color: BALL, fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 15, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>i</button>
      </div>
      {infoOpen && <RankingInfo onClose={() => setInfoOpen(false)} />}
      {term && shown.length === 0 && <Empty msg="No players match that search." />}

      {mode === "overall" && (
        <div style={{ background: PANEL, borderRadius: RADIUS, padding: "14px 16px", marginBottom: 14, boxShadow: "0 4px 14px rgba(0,0,0,0.16)" }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: BALL, marginBottom: 6 }}>Official ranking</div>
          <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>Based on <strong style={{ color: CHALK }}>how strong your wins are on average</strong> (beating higher-level players counts far more), your <strong style={{ color: CHALK }}>win rate</strong>, and <strong style={{ color: CHALK }}>staying active</strong>. Racking up easy wins won't carry you — beating good players will.</div>
        </div>
      )}
      {mode === "elo" && (
        <div style={{ background: PANEL, borderRadius: RADIUS, padding: "14px 16px", marginBottom: 14, boxShadow: "0 4px 14px rgba(0,0,0,0.16)" }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: BALL, marginBottom: 6 }}>How points work</div>
          <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>Everyone starts on <strong style={{ color: CHALK }}>0</strong>. An even match is worth about <strong style={{ color: CHALK }}>±16</strong>. Beat someone above you and you gain more; beat someone below you and you gain less. A draw nudges the gap. Keep losing and you drop below zero.</div>
        </div>
      )}
      {mode === "form" && (
        <div style={{ background: PANEL, borderRadius: RADIUS, padding: "14px 16px", marginBottom: 14, boxShadow: "0 4px 14px rgba(0,0,0,0.16)" }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: BALL, marginBottom: 6 }}>Form</div>
          <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>Just your <strong style={{ color: CHALK }}>last 5 results</strong> — a win scores +1, a loss −1, a draw 0. Shows who's hot right now, regardless of overall record.</div>
        </div>
      )}
      {!shown.length && !needSetup.length ? <Empty msg="No players yet. Add some from Profile → Settings." /> : (
        <div style={listCard}>
          {shown.map((p, i) => {
            const r = wdl[p.id] || { w: 0, d: 0, l: 0, gp: 0 };
            const rating = Math.round(elo[p.id] ?? START_ELO);
            const pct = r.gp ? Math.round(winPct(r) * 100) : null;
            const last = (form[p.id] || []).slice(-5);
            const formScore = last.reduce((s, x) => s + (x === "W" ? 1 : x === "L" ? -1 : 0), 0);
            const leader = i === 0 && r.gp > 0;
            const record = `${r.w}–${r.d}–${r.l}`;
            return (
              <button key={p.id} onClick={() => onOpen(p.id)} style={listRow}>
                <div style={{ fontFamily: mono, fontSize: 13, width: 20, textAlign: "right", color: leader ? BALL : MUTED, fontWeight: 700 }}>{i + 1}</div>
                <Avatar player={p} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: body, fontSize: 16, fontWeight: 700, color: CHALK, lineHeight: 1.2, display: "flex", alignItems: "center", gap: 8 }}>{p.name}{p.last ? " " + p.last : ""}{leader && <span style={{ fontSize: 14 }}>🎾</span>}<LevelBadge level={p.level} small /></div>
                  <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, marginTop: 4, display: "flex", gap: 10, alignItems: "center" }}>
                    <span>{record}{pct !== null ? ` · ${pct}% win rate` : ""}</span>
                    {last.length > 0 && <FormRow items={last} small />}
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: 46 }}>
                  <div style={{ fontFamily: mono, fontSize: mode === "record" ? 20 : 22, fontWeight: 700, color: mode === "form" ? (formScore > 0 ? BALL : formScore < 0 ? CLAY : MUTED) : (leader ? BALL : CHALK), fontVariantNumeric: "tabular-nums" }}>{mode === "elo" ? rating : mode === "record" ? (r.gp ? recordStr(r) : "0-0") : mode === "winpct" ? (pct === null ? "–" : pct + "%") : mode === "form" ? (r.gp ? (formScore > 0 ? "+" + formScore : String(formScore)) : "–") : (r.gp && official ? Math.round(official[p.id]) : "–")}</div>
                  <div style={{ fontFamily: body, fontWeight: 600, fontSize: 10.5, color: MUTED }}>{mode === "elo" ? "Elo" : mode === "record" ? "W–L" : mode === "winpct" ? "Win %" : mode === "form" ? "Form" : "Rating"}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {needSetup.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: CLAY, marginBottom: 8 }}>Not set up — unranked</div>
          <div style={listCard}>
            {needSetup.map((p) => (
              <button key={p.id} onClick={() => onOpen(p.id)} style={{ ...listRow, opacity: 0.5 }}>
                <div style={{ width: 20 }} />
                <Avatar player={p} size={38} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: body, fontSize: 16, fontWeight: 700, color: CHALK }}>{p.name}{p.last ? " " + p.last : ""}</div>
                  <div style={{ fontFamily: body, fontSize: 12.5, color: CLAY, marginTop: 3 }}>Needs level timeline</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
