"use client";
import React, { useState } from "react";
import { gameTo11Problem, scoreProblem } from "@/core/sets";
import { legacyNeedsAgreement } from "@/core/matchStatus";
import { buildBulk } from "@/components/games/bulk";
import { BigBtn, Empty, Field, Toggle } from "@/components/ui/atoms";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { predictProb } from "@/core/predict";
import { uid } from "@/lib/format";
import { useColumnReady } from "@/lib/utrReady";
import { BALL, CHALK, CLAY, COURT, LINE, MUTED, body, card, display, input } from "@/lib/theme";
import { FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, tabular } from "@/lib/theme";

// Small actions that add a field: lime, sentence case, body font. They were
// uppercase mono, and in this app the numbers font means a number — a word
// set in it reads as a code rather than something you can tap.
const addLink: React.CSSProperties = {
  background: "transparent", border: "none", color: FEED_LIME, fontFamily: body,
  fontWeight: 500, fontSize: 13, cursor: "pointer", textAlign: "left",
};

const sectionLabel: React.CSSProperties = {
  fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID,
  letterSpacing: 0,
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export function LogResult({ players, matches, elo, meId, onSave, onSaveMany, onCreatePlayer, onDeleteBetween, canLegacy, organiser }: any) {
  const [mode, setMode] = useState("single");
  // Legacy results (Sam, 2026-10-25): old matches nobody logged at the time,
  // known to the year. Organisers only — a legacy result needs nobody's
  // agreement, so it is the club's record to keep, not anyone's to add about
  // somebody else — and only once schema_match_legacy.sql has added
  // date_precision, because a save naming a missing column fails outright.
  const legacyReady = useColumnReady("matches", "date_precision") === true;
  const [legacyYear, setLegacyYear] = useState(() => new Date().getFullYear() - 1);
  /**
   * Player 1 starts as you.
   *
   * You are in the match nearly every time — this is the screen somebody
   * uses standing on court having just finished one — and it was starting
   * empty for no reason anybody could point at. Still editable, because
   * league staff do log results for two other people.
   *
   * It also fixes a thing that read as a separate bug: the score grid labels
   * its rows with the chosen names and falls back to "Player 1 / Player 2"
   * only while a slot is empty. With one slot filled from the start, half
   * the grid is named before you touch anything.
   *
   * meId is empty for somebody with no player row in this league, and the
   * initialiser handles that by leaving it blank rather than seeding "".
   */
  const [p1, setP1] = useState(() => meId || ""); const [p2, setP2] = useState("");
  const [dateStr, setDateStr] = useState(todayStr());
  // Set-by-set rather than one free-text box. Stored back into the same
  // `score` string as "6-2, 6-3, 6-2" (see core/sets.ts), so nothing else
  // has to change to display it and no migration is needed. Three sets to
  // start because that's the common case; more on request.
  const [sets, setSets] = useState<Array<{ a: string; b: string }>>([{ a: "", b: "" }, { a: "", b: "" }, { a: "", b: "" }]);
  const [err, setErr] = useState("");
  // Sets (tennis, padel) or games to 11 (squash, racketball). Only the
  // grid's labels and the finished-game check differ; the score is the same
  // "11-7, 9-11" string either way. Remembered per person on this device.
  const [to11, setTo11State] = useState<boolean>(() => { try { return localStorage.getItem("rally.scoreFormat") === "to11"; } catch { return false; } });
  const setTo11 = (v: boolean) => {
    setTo11State(v);
    try { localStorage.setItem("rally.scoreFormat", v ? "to11" : "sets"); } catch {}
    if (v && sets.length < 5) setSets([...sets, ...Array.from({ length: 5 - sets.length }, () => ({ a: "", b: "" }))]);
  };
  // A quick 3-0 that wasn't a full set (winter brief item 9). Logged as
  // status "short": shown and labelled, counted in nothing (core/matchStatus).
  const [short, setShort] = useState(false);
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
    // The grid is written Player 1 first, so the check knows direction.
    const problem = scoreProblem(scoreStr, winner, true);
    if (problem) return setErr(problem);
    if (to11) {
      for (const g of filledSets) {
        const bad = gameTo11Problem(parseInt(g.a, 10), parseInt(g.b, 10));
        if (bad) return setErr(bad);
      }
    }
    setErr("");
    const when = dateStr ? new Date(dateStr).getTime() : Date.now();
    // Snapshot Rally's prediction using the state as it stood right before
    // this result — so later we can honestly say whether it called it right.
    let prediction: any = undefined;
    if (elo) {
      try { const pctP1 = Math.round(predictProb(p1, p2, matches, elo, players) * 100); prediction = { p1Pct: pctP1 }; } catch {}
    }
    onSave({ id: uid(), date: when, p1, p2, score: scoreStr, winner, status: short ? "short" : needsConfirm ? "pending" : "confirmed", reportedBy: meId, loggedAt: Date.now(), notes: notes.trim() || undefined, venue: venue.trim() || undefined, category: category.trim() || undefined, prediction });
  };
  const submitLegacy = (winner: string) => {
    if (!p1 || !p2) return setErr("Pick both players.");
    if (p1 === p2) return setErr("Pick two different players.");
    // Members log their OWN legacy years (Sam, 2026-10-30); organisers may
    // record anybody's.
    if (!organiser && p1 !== meId && p2 !== meId) return setErr("You can only add legacy years you played in.");
    setErr("");
    // Mid-year, so it sorts inside its year; the date is never printed —
    // datePrecision "year" makes every screen show just the year.
    const when = Date.UTC(legacyYear, 6, 1, 12);
    // A claim until the other side agrees it (Sam, 2026-10-30) — anyone in it
    // with an account who didn't log it. Against a shell it is simply recorded.
    // A member's claim always waits for agreement — against somebody with no
    // account, an organiser agrees it for them. An organiser's own entry
    // against a shell is simply recorded, as any organiser result is.
    const claim = !organiser || legacyNeedsAgreement(players.find((p) => p.id === p1), players.find((p) => p.id === p2), meId);
    onSave({ id: uid(), date: when, p1, p2, score: "", winner, status: claim ? "legacy_claimed" : "legacy", datePrecision: "year", reportedBy: meId, loggedAt: Date.now() });
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
  const numIn = (v, set, ph) => <input value={v} onChange={(e) => set(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder={ph} style={{ ...input, boxSizing: "border-box" as const }} />;
  return (
    <div style={{ background: FEED_CARD, borderRadius: 18, padding: 18 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Toggle on={mode === "single"} onClick={() => setMode("single")} label="One game" />
        <Toggle on={mode === "bulk"} onClick={() => setMode("bulk")} label="Bulk / history" />
        {canLegacy && legacyReady && <Toggle on={mode === "legacy"} onClick={() => setMode("legacy")} label="Legacy" />}
      </div>
      <Field label="Player 1"><PlayerPicker value={p1} onChange={setP1} players={players} exclude={p2} placeholder="Player 1" onCreatePlayer={onCreatePlayer} /></Field>
      <Field label="Player 2"><PlayerPicker value={p2} onChange={setP2} players={players} exclude={p1} placeholder="Player 2" onCreatePlayer={onCreatePlayer} /></Field>
      {mode === "legacy" ? (
        <>
          <Field label="Year">
            <select value={String(legacyYear)} onChange={(e) => setLegacyYear(Number(e.target.value))} style={{ ...input, fontFamily: body, boxSizing: "border-box" as const }}>
              {Array.from({ length: 40 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          </Field>
          {err && <div style={{ color: CLAY, fontFamily: body, fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <div style={{ ...sectionLabel, margin: "8px 0 9px" }}>Who won?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <BigBtn onClick={() => submitLegacy("p1")} disabled={!p1} color={BALL}>{n1}</BigBtn>
            <BigBtn onClick={() => submitLegacy("draw")} color={MUTED}>Draw</BigBtn>
            <BigBtn onClick={() => submitLegacy("p2")} disabled={!p2} color={BALL}>{n2}</BigBtn>
          </div>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_MID, marginTop: 12, lineHeight: 1.45 }}>
            One per year, before Southwood. Shown under the head-to-head, never in the record or any rating. It shows as claimed until the other player confirms it.
          </div>
        </>
      ) : mode === "single" ? (
        <>
          <Field label="Date played"><input type="date" value={dateStr} max={todayStr()} onChange={(e) => setDateStr(e.target.value)} style={{ ...input, colorScheme: "dark", boxSizing: "border-box" as const }} /></Field>
          <Field label="Score (optional)">
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {([[false, "Sets"], [true, "Games to 11"]] as const).map(([v, l]) => (
                <button key={l} onClick={() => setTo11(v)} style={{ fontFamily: body, fontWeight: 600, fontSize: 13, padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer", background: to11 === v ? FEED_LIME : FEED_RAISED, color: to11 === v ? FEED_LIME_INK : FEED_TEXT_MID }}>{l}</button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `minmax(0,1fr) repeat(${sets.length}, 46px)`, gap: 6, alignItems: "center" }}>
              <span />
              {sets.map((_, i) => (
                <span key={"h" + i} style={{ fontFamily: body, fontSize: 12, fontWeight: 500, color: FEED_TEXT_MID, textAlign: "center" }}>{to11 ? "Game" : "Set"} {i + 1}</span>
              ))}
              {([["a", n1], ["b", n2]] as const).map(([side, label]) => (
                <React.Fragment key={side}>
                  <span style={{ fontFamily: body, fontSize: 14, fontWeight: 600, color: FEED_TEXT_HI, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                  {sets.map((s, i) => (
                    <input
                      key={side + i}
                      value={s[side]}
                      onChange={(e) => setCell(i, side, e.target.value)}
                      inputMode="numeric"
                      aria-label={`${label}, ${to11 ? "game" : "set"} ${i + 1}`}
                      style={{ ...input, ...tabular, fontFamily: body, fontWeight: 600, fontSize: 16, background: FEED_RAISED, color: FEED_TEXT_HI, textAlign: "center", padding: "10px 4px", marginBottom: 0 }}
                    />
                  ))}
                </React.Fragment>
              ))}
            </div>
            {sets.length < 5 && (
              <button onClick={() => setSets([...sets, { a: "", b: "" }])} style={{ ...addLink, padding: "10px 0 0" }}>{to11 ? "Add a game" : "Add a set"}</button>
            )}
            {/* One line, not three. This was the largest block of text on the
                screen and it is optional guidance on an optional field — on a
                phone it pushed "Who won?", the only thing you MUST answer,
                below the fold. */}
            <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 6, lineHeight: 1.4 }}>
              Optional — but it makes the predictions sharper.
            </div>
          </Field>
          {showMore ? (
            <>
              <Field label="Note (optional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Came back from 4–1 down" autoComplete="off" autoCorrect="off" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
              <Field label="Venue (optional)"><input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Seacourt, Court 2" autoComplete="off" autoCorrect="off" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
              <Field label="Category (optional)"><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Men's Singles, Friendly" autoComplete="off" autoCorrect="off" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
            </>
          ) : (
            <button onClick={() => setShowMore(true)} style={{ ...addLink, padding: 0, marginBottom: 16 }}>Add a note or venue</button>
          )}
          <button
            onClick={() => setShort(!short)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: FEED_RAISED, border: "none", borderRadius: 14, padding: "12px 14px", cursor: "pointer", marginBottom: 14, textAlign: "left" }}
          >
            <span>
              <span style={{ display: "block", fontFamily: body, fontSize: 15, color: FEED_TEXT_HI }}>Short or unfinished match</span>
              <span style={{ display: "block", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>A game that stopped early. Shown in the feed, never counted.</span>
            </span>
            <span style={{ width: 44, height: 26, borderRadius: 13, background: short ? BALL : FEED_CARD, position: "relative", flexShrink: 0, marginLeft: 10 }}>
              <span style={{ position: "absolute", top: 3, left: short ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: short ? FEED_LIME_INK : FEED_TEXT_MID }} />
            </span>
          </button>
          {err && <div style={{ color: CLAY, fontFamily: body, fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <div style={{ ...sectionLabel, margin: "8px 0 9px" }}>Who won?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <BigBtn onClick={() => submit("p1")} disabled={!p1} color={BALL}>{n1}</BigBtn>
            <BigBtn onClick={() => submit("draw")} color={MUTED}>Draw</BigBtn>
            <BigBtn onClick={() => submit("p2")} disabled={!p2} color={BALL}>{n2}</BigBtn>
          </div>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_MID, marginTop: 12, lineHeight: 1.45 }}>
            {short ? "Short matches show in the feed and head-to-head, labelled, and count towards nothing — no rating, no table." : needsConfirm ? "Your opponent has 48 hours to agree or dispute it — after that it's confirmed automatically. They'll see it under Games." : opponent ? "They don't have a Southwood account, so this counts straight away — nobody else can confirm it for them." : "Pick both players to see how this gets confirmed."}
          </div>
        </>
      ) : (
        <>
          {p1 && p2 && existingBetween.length > 0 && onDeleteBetween && (
            <div style={{ background: "var(--bg-raised)", border: "1px solid " + CLAY, borderRadius: 12, padding: "10px 12px", marginBottom: 14 }}>
              <div style={{ fontFamily: body, fontSize: 13, color: MUTED, marginBottom: confirmClear ? 8 : 0 }}>
                You already have <strong style={{ color: CLAY }}>{existingBetween.length}</strong> match{existingBetween.length === 1 ? "" : "es"} logged between {n1} and {n2}. Adding more stacks on top of these — to redo part or all of this record, clear it first.
              </div>
              {existingYears.length > 1 && (
                <select value={String(clearYear)} onChange={(e) => setClearYear(e.target.value === "all" ? "all" : Number(e.target.value))} style={{ ...input, fontFamily: body, fontSize: 12, padding: "7px 8px", marginBottom: 8, boxSizing: "border-box" as const }}>
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
                    <button onClick={() => setConfirmClear(false)} style={{ flex: 1, fontFamily: body, fontSize: 13, color: CHALK, background: "transparent", border: "none", borderRadius: 10, padding: "9px 10px", cursor: "pointer", fontWeight: 700 }}>Cancel</button>
                    <button onClick={clearExisting} disabled={!toClear.length} style={{ flex: 1, fontFamily: body, fontSize: 13, color: COURT, background: CLAY, border: "none", borderRadius: 10, padding: "9px 10px", cursor: "pointer", fontWeight: 700, opacity: toClear.length ? 1 : 0.5 }}>Delete</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmClear(true)} style={{ marginTop: existingYears.length > 1 ? 0 : 8, fontFamily: body, fontSize: 13, fontWeight: 600, color: CLAY, background: "transparent", border: "none", borderRadius: 5, padding: "6px 10px", cursor: "pointer" }}>Clear {clearYear === "all" ? "existing record" : clearYear + " record"} vs {n2}</button>
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
