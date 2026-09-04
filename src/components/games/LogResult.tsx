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
  // Set-by-set rather than one free-text box. Stored back into the same
  // `score` string as "6-2, 6-3, 6-2" (see core/sets.ts), so nothing else
  // has to change to display it and no migration is needed. Three sets to
  // start because that's the common case; more on request.
  const [sets, setSets] = useState<Array<{ a: string; b: string }>>([{ a: "", b: "" }, { a: "", b: "" }, { a: "", b: "" }]);
  const [err, setErr] = useState("");
  const setCell = (i: number, side: "a" | "b", v: string) =>
    setSets(sets.map((s, j) => (j === i ? { ...s, [side]: v.replace(/[^0-9]/g, "").slice(0, 3) } : s)));
  // Only sets where both sides were filled in count — a half-entered set is
  // someone still typing, not a 6-0.
  const filledSets = sets.filter((s) => s.a !== "" && s.b !== "");
  const scoreStr = filledSets.map((s) => `${parseInt(s.a, 10)}-${parseInt(s.b, 10)}`).join(", ");
  const [showMore, setShowMore] = useState(false);
  const [notes, setNotes] = useState(""); const [venue, setVenue] = useState(""); const [category, setCategory] = useState("");
  const [w1, setW1] = useState(""); const [dr, setDr] = useState(""); const [w2, setW2] = useState("");
  const [fromDate, setFromDate] = useState(""); const [toDate, setToDate] = useState(todayStr());
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearYear, setClearYear] = useState<"all" | number>("all");
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
    onSave({ id: uid(), date: when, p1, p2, score: scoreStr, winner, status: needsConfirm ? "pending" : "confirmed", reportedBy: meId, loggedAt: Date.now(), notes: notes.trim() || undefined, venue: venue.trim() || undefined, category: category.trim() || undefined, prediction });
  };
  const submitBulk = () => {
    if (!p1 || !p2) return setErr("Pick both players.");
    if (p1 === p2) return setErr("Pick two different players.");
    const W = parseInt(w1) || 0, Dn = parseInt(dr) || 0, L = parseInt(w2) || 0;
    if (W + Dn + L === 0) return setErr("Enter at least one result.");
    setErr(""); onSaveMany(buildBulk(p1, p2, W, Dn, L, fromDate, toDate));
  };
  const existingBetween = (matches || []).filter((m) => (m.p1 === p1 && m.p2 === p2) || (m.p1 === p2 && m.p2 === p1));
  const existingYears: number[] = (Array.from(new Set(existingBetween.map((m) => new Date(m.date).getFullYear()))) as number[]).sort((a, b) => b - a);
  const toClear = clearYear === "all" ? existingBetween : existingBetween.filter((m) => new Date(m.date).getFullYear() === clearYear);
  const clearExisting = () => {
    if (!onDeleteBetween) return;
    onDeleteBetween(p1, p2, clearYear === "all" ? undefined : clearYear);
    setConfirmClear(false);
    setClearYear("all");
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
          <Field label="Score (optional)">
            <div style={{ display: "grid", gridTemplateColumns: `minmax(0,1fr) repeat(${sets.length}, 46px)`, gap: 6, alignItems: "center" }}>
              <span />
              {sets.map((_, i) => (
                <span key={"h" + i} style={{ fontFamily: body, fontSize: 10.5, fontWeight: 600, color: MUTED, textAlign: "center" }}>Set {i + 1}</span>
              ))}
              {([["a", n1], ["b", n2]] as const).map(([side, label]) => (
                <React.Fragment key={side}>
                  <span style={{ fontFamily: body, fontSize: 13, fontWeight: 600, color: CHALK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                  {sets.map((s, i) => (
                    <input
                      key={side + i}
                      value={s[side]}
                      onChange={(e) => setCell(i, side, e.target.value)}
                      inputMode="numeric"
                      aria-label={`${label}, set ${i + 1}`}
                      style={{ ...input, fontFamily: mono, fontSize: 15, textAlign: "center", padding: "10px 4px", marginBottom: 0 }}
                    />
                  ))}
                </React.Fragment>
              ))}
            </div>
            {sets.length < 5 && (
              <button onClick={() => setSets([...sets, { a: "", b: "" }])} style={{ background: "transparent", border: "none", color: BALL, fontFamily: mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, cursor: "pointer", padding: "8px 0 0" }}>+ Add a set</button>
            )}
            <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, marginTop: 6, lineHeight: 1.4 }}>
              Leave blank if you&apos;d rather not. Filling it in tells the global table how close the match actually was — it doesn&apos;t affect this league&apos;s table.
            </div>
          </Field>
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
            <div style={{ background: "rgba(203,109,71,.12)", border: "1px solid " + CLAY, borderRadius: 12, padding: "10px 12px", marginBottom: 14 }}>
              <div style={{ fontFamily: body, fontSize: 13, color: MUTED, marginBottom: confirmClear ? 8 : 0 }}>
                You already have <strong style={{ color: CLAY }}>{existingBetween.length}</strong> match{existingBetween.length === 1 ? "" : "es"} logged between {n1} and {n2}. Adding more stacks on top of these — to redo part or all of this record, clear it first.
              </div>
              {existingYears.length > 1 && (
                <select value={String(clearYear)} onChange={(e) => setClearYear(e.target.value === "all" ? "all" : Number(e.target.value))} style={{ ...input, fontFamily: mono, fontSize: 11, padding: "7px 8px", marginBottom: 8, boxSizing: "border-box" as const }}>
                  <option value="all">All years ({existingBetween.length})</option>
                  {existingYears.map((y) => <option key={y} value={String(y)}>{y} only ({existingBetween.filter((m) => new Date(m.date).getFullYear() === y).length})</option>)}
                </select>
              )}
              {confirmClear ? (
                <div style={{ background: COURT, border: "1px solid " + CLAY, borderRadius: 12, padding: "12px 12px" }}>
                  <div style={{ fontFamily: body, fontSize: 16, fontWeight: 700, color: CHALK, marginBottom: 6 }}>
                    Delete {clearYear === "all" ? "entire" : clearYear} record vs {n2}?
                  </div>
                  <div style={{ fontFamily: body, fontSize: 13, color: CLAY, lineHeight: 1.4, marginBottom: 12 }}>
                    {toClear.length} match{toClear.length === 1 ? "" : "es"} will be permanently deleted. This cannot be undone.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setConfirmClear(false)} style={{ flex: 1, fontFamily: mono, fontSize: 11, color: CHALK, background: "transparent", border: "none", borderRadius: 10, padding: "9px 10px", cursor: "pointer", textTransform: "uppercase", fontWeight: 700 }}>Cancel</button>
                    <button onClick={clearExisting} disabled={!toClear.length} style={{ flex: 1, fontFamily: mono, fontSize: 11, color: COURT, background: CLAY, border: "none", borderRadius: 10, padding: "9px 10px", cursor: "pointer", textTransform: "uppercase", fontWeight: 700, opacity: toClear.length ? 1 : 0.5 }}>Delete</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmClear(true)} style={{ marginTop: existingYears.length > 1 ? 0 : 8, fontFamily: mono, fontSize: 10, color: CLAY, background: "transparent", border: "none", borderRadius: 5, padding: "6px 10px", cursor: "pointer", textTransform: "uppercase" }}>Clear {clearYear === "all" ? "existing record" : clearYear + " record"} vs {n2}</button>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><Field label={n1 + " wins"}>{numIn(w1, setW1, "0")}</Field></div>
            <div style={{ flex: 1 }}><Field label="Draws">{numIn(dr, setDr, "0")}</Field></div>
            <div style={{ flex: 1 }}><Field label={n2 + " wins"}>{numIn(w2, setW2, "0")}</Field></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><Field label="From date"><input type="date" value={fromDate} max={toDate || todayStr()} onChange={(e) => setFromDate(e.target.value)} style={{ ...input, colorScheme: "dark", boxSizing: "border-box" as const }} /></Field></div>
            <div style={{ flex: 1 }}><Field label="To date"><input type="date" value={toDate} min={fromDate || undefined} max={todayStr()} onChange={(e) => setToDate(e.target.value)} style={{ ...input, colorScheme: "dark", boxSizing: "border-box" as const }} /></Field></div>
          </div>
          {err && <div style={{ color: CLAY, fontFamily: body, fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <BigBtn onClick={submitBulk} color={BALL}>Add whole record</BigBtn>
          <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 10 }}>Enter a full past record in one go — e.g. you vs Cheese, 101–10 between two dates. These go straight in as confirmed history, spread evenly across that range — pick the exact months it happened in, not the whole year.</div>
        </>
      )}
    </div>
  );
}
