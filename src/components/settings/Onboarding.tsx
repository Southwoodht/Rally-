"use client";
import React, { useState } from "react";
import { Trophy, Swords, Plus, Clock, User, Settings as Gear, ChevronLeft, ChevronDown, Check } from "lucide-react";
import { LevelGuide } from "@/components/profile/LevelGuide";
import { BigBtn, Field, Toggle } from "@/components/ui/atoms";
import { LEVELS, SUBS, START_ELO } from "@/core/constants";
import { BALL, CHALK, COURT, LINE, MUTED, body, card, display, fontImport, input, miniInput, mono } from "@/lib/theme";

export function Onboarding({ me, onFinish }: any) {
  const yearNow = new Date().getFullYear();
  const [step, setStep] = useState(0);
  const [startYear, setStartYear] = useState("");
  const [gap, setGap] = useState(3);
  const [levels, setLevels] = useState<Record<number, { cat: string; sub: string }>>({});
  const [guide, setGuide] = useState(false);
  const sy = parseInt(startYear) || yearNow;
  const blocks: Array<{ from: number; to: number | null }> = [];
  for (let y = sy; y <= yearNow; y += gap) { const end = Math.min(y + gap - 1, yearNow); blocks.push({ from: y, to: end >= yearNow ? null : end }); }
  const [wins, setWins] = useState(0);
  const [draws, setDraws] = useState(0);
  const [losses, setLosses] = useState(0);
  const [initialElo, setInitialElo] = useState(START_ELO);

  const levelHistory = blocks.map((b, i) => ({ cat: levels[i]?.cat || "Beginner", sub: levels[i]?.sub || "Medium", from: b.from, to: b.to }));
  const finishMapped = () => setStep(3);
  const finishSkip = () => onFinish({ levelHistory: [{ cat: "Beginner", sub: "Low", from: sy, to: null }], initialRecord: { w: 0, d: 0, l: 0 }, initialElo: START_ELO });
  const finishAll = () => onFinish({ levelHistory, initialRecord: { w: Number(wins) || 0, d: Number(draws) || 0, l: Number(losses) || 0 }, initialElo: Number(initialElo) || START_ELO });
  const setBlock = (i, cat, sub) => setLevels((L) => ({ ...L, [i]: { cat: cat ?? L[i]?.cat ?? "Beginner", sub: sub ?? L[i]?.sub ?? "Medium" } }));
  return (
    <div style={{ position: "fixed", inset: 0, background: COURT, zIndex: 100, overflowY: "auto" }}>
      <style>{fontImport}</style>
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "40px 20px 60px" }}>
        <div style={{ fontFamily: mono, letterSpacing: 3, color: BALL, fontSize: 11, textTransform: "uppercase" }}>Welcome{me ? ", " + me.name : ""}</div>
        <h1 style={{ fontFamily: display, fontWeight: 800, color: CHALK, margin: "6px 0 22px", fontSize: 40, lineHeight: 0.95, textTransform: "uppercase", letterSpacing: -0.5 }}>Set up your ladder</h1>

        {step === 0 && (
          <div style={card}>
            <Field label="When did you start playing?"><input value={startYear} onChange={(e) => setStartYear(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="e.g. 2016" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
            <BigBtn onClick={() => setStep(1)} color={BALL}>Continue</BigBtn>
          </div>
        )}

        {step === 1 && (
          <div style={card}>
            <div style={{ fontFamily: body, fontSize: 14, color: CHALK, marginBottom: 6 }}>Map how your level changed over the years?</div>
            <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, marginBottom: 16, lineHeight: 1.5 }}>Recommended — it makes old results fair, so beating a strong player counts more than beating a beginner. Takes a minute. Skip and we'll just assume you started as a Beginner.</div>
            <div style={{ fontFamily: mono, fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>Block size</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[1, 3, 5].map((g) => <Toggle key={g} on={gap === g} onClick={() => setGap(g)} label={"Every " + g + " yr"} />)}
            </div>
            <BigBtn onClick={() => setStep(2)} color={BALL}>Map my levels</BigBtn>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, paddingTop: 14, borderTop: "1px solid " + LINE }}>
              <button onClick={() => setStep(0)} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: MUTED, fontFamily: mono, fontSize: 12, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1 }}><ChevronLeft size={15} /> Back</button>
              <button onClick={finishSkip} style={{ background: "transparent", border: "1px solid " + LINE, borderRadius: 8, padding: "8px 12px", color: MUTED, fontFamily: mono, fontSize: 11, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1 }}>Skip — assume Beginner</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontFamily: body, fontSize: 13, color: MUTED }}>What level were you in each block?</span>
              <button onClick={() => setGuide(true)} style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: BALL, background: "transparent", border: "1px solid " + LINE, borderRadius: 6, padding: "5px 9px", cursor: "pointer" }}>What's my level?</button>
            </div>
            {blocks.map((b, i) => (
              <div key={i} style={{ padding: "10px 0", borderTop: "1px solid " + LINE }}>
                <div style={{ fontFamily: mono, fontSize: 12, color: BALL, marginBottom: 6 }}>{b.from}{b.to ? "–" + b.to : "–now"}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <select value={levels[i]?.cat || "Beginner"} onChange={(e) => setBlock(i, e.target.value, undefined)} style={{ ...miniInput, flex: 2, boxSizing: "border-box" as const }}>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select>
                  <select value={levels[i]?.sub || "Medium"} onChange={(e) => setBlock(i, undefined, e.target.value)} style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }}>{SUBS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                </div>
              </div>
            ))}
            <div style={{ height: 16 }} />
            <BigBtn onClick={finishMapped} color={BALL}>Next — record & rating</BigBtn>
            <button onClick={() => setStep(1)} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: MUTED, fontFamily: mono, fontSize: 12, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1, marginTop: 16 }}><ChevronLeft size={15} /> Back</button>
          </div>
        )}
      </div>
      {step === 3 && (
        <div style={{ position: "fixed", inset: 0, background: COURT, zIndex: 100, overflowY: "auto" }}>
          <div style={{ maxWidth: 620, margin: "0 auto", padding: "40px 20px 60px" }}>
            <div style={card}>
              <div style={{ fontFamily: body, fontSize: 14, color: CHALK, marginBottom: 8 }}>Add your existing record and rating</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={wins} onChange={(e) => setWins(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} placeholder="Wins" inputMode="numeric" style={{ ...miniInput, flex: 1 }} />
                <input value={draws} onChange={(e) => setDraws(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} placeholder="Draws" inputMode="numeric" style={{ ...miniInput, flex: 1 }} />
                <input value={losses} onChange={(e) => setLosses(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} placeholder="Losses" inputMode="numeric" style={{ ...miniInput, flex: 1 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: mono, fontSize: 10, color: MUTED, marginBottom: 6 }}>Starting rating (ELO)</div>
                <input value={initialElo} onChange={(e) => setInitialElo(Number(e.target.value.replace(/[^0-9]/g, "")) || START_ELO)} inputMode="numeric" style={{ ...input, width: 140 }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <BigBtn onClick={finishAll} color={BALL}>Finish</BigBtn>
                <button onClick={() => setStep(2)} style={{ background: "transparent", border: "1px solid " + LINE, borderRadius: 8, padding: "8px 12px", color: MUTED, fontFamily: mono, fontSize: 11 }}>Back</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {guide && <LevelGuide onClose={() => setGuide(false)} />}
    </div>
  );
}
