"use client";
import React, { useState } from "react";
import { buildBulk } from "@/components/games/bulk";
import { BigBtn, Empty, Field, Select, Toggle } from "@/components/ui/atoms";
import { uid } from "@/lib/format";
import { BALL, CLAY, MUTED, body, card, display, input, mono } from "@/lib/theme";

export function LogResult({ players, meId, onSave, onSaveMany }: any) {
  const [mode, setMode] = useState("single");
  const [p1, setP1] = useState(""); const [p2, setP2] = useState("");
  const [score, setScore] = useState(""); const [err, setErr] = useState("");
  const [w1, setW1] = useState(""); const [dr, setDr] = useState(""); const [w2, setW2] = useState("");
  const [fromY, setFromY] = useState(""); const [toY, setToY] = useState("");
  const n1 = players.find((p) => p.id === p1)?.name || "Player 1";
  const n2 = players.find((p) => p.id === p2)?.name || "Player 2";
  const submit = (winner) => {
    if (!p1 || !p2) return setErr("Pick both players.");
    if (p1 === p2) return setErr("Pick two different players.");
    setErr(""); onSave({ id: uid(), date: Date.now(), p1, p2, score: score.trim(), winner, status: "pending", reportedBy: meId });
  };
  const submitBulk = () => {
    if (!p1 || !p2) return setErr("Pick both players.");
    if (p1 === p2) return setErr("Pick two different players.");
    const W = parseInt(w1) || 0, Dn = parseInt(dr) || 0, L = parseInt(w2) || 0;
    if (W + Dn + L === 0) return setErr("Enter at least one result.");
    setErr(""); onSaveMany(buildBulk(p1, p2, W, Dn, L, fromY, toY));
  };
  if (players.length < 2) return <div style={card}><Empty msg="Add at least two players in Settings before logging a game." /></div>;
  const numIn = (v, set, ph) => <input value={v} onChange={(e) => set(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder={ph} style={{ ...input, boxSizing: "border-box" as const }} />;
  return (
    <div style={card}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Toggle on={mode === "single"} onClick={() => setMode("single")} label="One game" />
        <Toggle on={mode === "bulk"} onClick={() => setMode("bulk")} label="Bulk / history" />
      </div>
      <Field label="Player 1"><Select value={p1} onChange={setP1} players={players} exclude={p2} /></Field>
      <Field label="Player 2"><Select value={p2} onChange={setP2} players={players} exclude={p1} /></Field>
      {mode === "single" ? (
        <>
          <Field label="Score (optional)"><input value={score} onChange={(e) => setScore(e.target.value)} placeholder="e.g. 6–4" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
          {err && <div style={{ color: CLAY, fontFamily: body, fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <div style={{ fontFamily: mono, fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1.5, margin: "6px 0 8px" }}>Who won?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <BigBtn onClick={() => submit("p1")} disabled={!p1} color={BALL}>{n1}</BigBtn>
            <BigBtn onClick={() => submit("draw")} color={MUTED}>Draw</BigBtn>
            <BigBtn onClick={() => submit("p2")} disabled={!p2} color={BALL}>{n2}</BigBtn>
          </div>
          <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 10 }}>The result won't count until your opponent agrees it. They'll see it under Games to confirm or dispute.</div>
        </>
      ) : (
        <>
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
