"use client";
import React, { useState } from "react";
import { buildBulk } from "@/components/games/bulk";
import { BigBtn, Empty, Field, Toggle } from "@/components/ui/atoms";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { predictProb } from "@/core/predict";
import { uid } from "@/lib/format";
import { BALL, CHALK, CLAY, COURT, LINE, MUTED, body, card, display, input, mono } from "@/lib/theme";

const todayStr = () => new Date().toISOString().slice(0, 10);

export function LogResult({ players, matches, elo, meId, onSave, onSaveMany, onCreatePlayer, onDeleteBetween }: any) {
  const [mode, setMode] = useState("single");
  const [p1, setP1] = useState(""); const [p2, setP2] = useState("");
  const [dateStr, setDateStr] = useState(todayStr());
  const [score, setScore] = useState(""); const [err, setErr] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [notes, setNotes] = useState(""); const [venue, setVenue] = useState(""); const [category, setCategory] = useState("");
  const [w1, setW1] = useState(""); const [dr, setDr] = useState(""); const [w2, setW2] = useState("");
  const [fromY, setFromY] = useState(""); const [toY, setToY] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const fullName = (p: any) => p ? p.name + (p.last ? " " + p.last : "") : null;
  const n1 = fullName(players.find((p) => p.id === p1)) || "Player 1";
  const n2 = fullName(players.find((p) => p.id === p2)) || "Player 2";
  const opponent = players.find((p) => p.id === (p1 === meId ? p2 : p2 === meId ? p1 : null));
  const needsConfirm = !!(opponent && opponent.auth_id);
  const submit = (winner) => {
    if (!p1 || !p2) return setErr("Pick both players.");
    if (p1 === p2) return setErr("Pick two different players.");
    setErr("");
    const when = dateStr ? new Date(dateStr).getTime() : Date.now();
    // Snapshot Rally's prediction using the state as it stood right before
    // this result — so later we can honestly say whether it called it right.
    let prediction: any = undefined;
    if (elo) {
      try { const pctP1 = Math.round(predictProb(p1, p2, matches, elo, players) * 100); prediction = { p1Pct: pctP1 }; } catch {}
    }
    onSave({ id: uid(), date: when, p1, p2, score: score.trim(), winner, status: needsConfirm ? "pending" : "confirmed", reportedBy: meId, loggedAt: Date.now(), notes: notes.trim() || undefined, venue: venue.trim() || undefined, category: category.trim() || undefined, prediction });
  };
  const submitBulk = () => {
    if (!p1 || !p2) return setErr("Pick both players.");
    if (p1 === p2) return setErr("Pick two different players.");
    const W = parseInt(w1) || 0, Dn = parseInt(dr) || 0, L = parseInt(w2) || 0;
    if (W + Dn + L === 0) return setErr("Enter at least one result.");
    setErr(""); onSaveMany(buildBulk(p1, p2, W, Dn, L, fromY, toY));
  };
  const existingBetween = (matches || []).filter((m) => (m.p1 === p1 && m.p2 === p2) || (m.p1 === p2 && m.p2 === p1));
  const clearExisting = () => {
    if (!onDeleteBetween) return;
    onDeleteBetween(p1, p2);
    setConfirmClear(false);
  };
  if (players.length < 2) return <div style={card}><Empty msg="Add at least two players in Settings before logging a game." /></div>;
  const numIn = (v, set, ph) => <input value={v} onChange={(e) => set(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder={ph} style={{ ...input, boxSizing: "border-box" as const }} />;
  return (
    <div style={card}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Toggle on={mode === "single"} onClick={() => setMode("single")} label="One game" />
        <Toggle on={mode === "bulk"} onClick={() => setMode("bulk")} label="Bulk / history" />
      </div>
      <Field label="Player 1"><PlayerPicker value={p1} onChange={setP1} players={players} exclude={p2} placeholder="Player 1" onCreatePlayer={onCreatePlayer} /></Field>
      <Field label="Player 2"><PlayerPicker value={p2} onChange={setP2} players={players} exclude={p1} placeholder="Player 2" onCreatePlayer={onCreatePlayer} /></Field>
      {mode === "single" ? (
        <>
          <Field label="Date played"><input type="date" value={dateStr} max={todayStr()} onChange={(e) => setDateStr(e.target.value)} style={{ ...input, colorScheme: "dark", boxSizing: "border-box" as const }} /></Field>
          <Field label="Score (optional)"><input value={score} onChange={(e) => setScore(e.target.value)} placeholder="e.g. 6–4" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
          {showMore ? (
            <>
              <Field label="Note (optional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Came back from 4–1 down" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
              <Field label="Venue (optional)"><input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Seacourt, Court 2" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
              <Field label="Category (optional)"><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Men's Singles, Friendly" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
            </>
          ) : (
            <button onClick={() => setShowMore(true)} style={{ background: "transparent", border: "none", color: BALL, fontFamily: mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, cursor: "pointer", padding: 0, marginBottom: 14 }}>+ Add a note or venue</button>
          )}
          {err && <div style={{ color: CLAY, fontFamily: body, fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <div style={{ fontFamily: mono, fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1.5, margin: "6px 0 8px" }}>Who won?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <BigBtn onClick={() => submit("p1")} disabled={!p1} color={BALL}>{n1}</BigBtn>
            <BigBtn onClick={() => submit("draw")} color={MUTED}>Draw</BigBtn>
            <BigBtn onClick={() => submit("p2")} disabled={!p2} color={BALL}>{n2}</BigBtn>
          </div>
          <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 10 }}>
            {needsConfirm ? "Your opponent has 24 hours to agree or dispute it — after that it's confirmed automatically. They'll see it under Games." : opponent ? "They don't have a Rally account, so this counts straight away — nobody else can confirm it for them." : "Pick both players to see how this gets confirmed."}
          </div>
        </>
      ) : (
        <>
          {p1 && p2 && existingBetween.length > 0 && onDeleteBetween && (
            <div style={{ background: "rgba(203,109,71,.12)", border: "1px solid " + CLAY, borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
              <div style={{ fontFamily: body, fontSize: 13, color: MUTED, marginBottom: confirmClear ? 8 : 0 }}>
                You already have <strong style={{ color: CLAY }}>{existingBetween.length}</strong> match{existingBetween.length === 1 ? "" : "es"} logged between {n1} and {n2}. Adding more stacks on top of these — to redo this record from scratch, clear it first.
              </div>
              {confirmClear ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontFamily: body, fontSize: 12.5, color: CHALK, flex: 1 }}>Delete all {existingBetween.length}? This can't be undone.</span>
                  <button onClick={clearExisting} style={{ fontFamily: mono, fontSize: 10, color: COURT, background: CLAY, border: "none", borderRadius: 5, padding: "6px 10px", cursor: "pointer", textTransform: "uppercase", fontWeight: 700 }}>Yes, clear</button>
                  <button onClick={() => setConfirmClear(false)} style={{ fontFamily: mono, fontSize: 10, color: MUTED, background: "transparent", border: "1px solid " + LINE, borderRadius: 5, padding: "6px 10px", cursor: "pointer", textTransform: "uppercase" }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmClear(true)} style={{ marginTop: 8, fontFamily: mono, fontSize: 10, color: CLAY, background: "transparent", border: "1px solid " + LINE, borderRadius: 5, padding: "6px 10px", cursor: "pointer", textTransform: "uppercase" }}>Clear existing record vs {n2}</button>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><Field label={n1 + " wins"}>{numIn(w1, setW1, "0")}</Field></div>
            <div style={{ flex: 1 }}><Field label="Draws">{numIn(dr, setDr, "0")}</Field></div>
            <div style={{ flex: 1 }}><Field label={n2 + " wins"}>{numIn(w2, setW2, "0")}</Field></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><Field label="From year">{numIn(fromY, setFromY, "2016")}</Field></div>
            <div style={{ flex: 1 }}><Field label="To year">{numIn(toY, setToY, "2020")}</Field></div>
          </div>
          {err && <div style={{ color: CLAY, fontFamily: body, fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <BigBtn onClick={submitBulk} color={BALL}>Add whole record</BigBtn>
          <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 10 }}>Enter a full past record in one go — e.g. you vs Cheese, 101–10 from 2016 to 2020. These go straight in as confirmed history, spread across the dates.</div>
        </>
      )}
    </div>
  );
}
