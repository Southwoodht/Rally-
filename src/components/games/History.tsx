"use client";
import React, { useState, useMemo } from "react";
import { FixturesPanel } from "@/components/games/FixturesPanel";
import { buildEvents } from "@/components/games/events";
import { BigBtn, Empty, Toggle } from "@/components/ui/atoms";
import { predictProb } from "@/core/predict";
import { fmtDate, winnerLabel } from "@/lib/format";
import { BALL, CHALK, CLAY, COURT, LINE, MUTED, PANEL, PANEL2, body, display, input, miniInput, mono, wrap } from "@/lib/theme";

export function History({ posts, onPost, onRemovePost, matches, players, elo, nameOf, meId, groupName, fixtures, onGenerate, onClearFixtures, onResolveFixture, onBookFixture, onConfirm, onDispute, onDelete, canEditMatches, onEditMatch }: any) {
  const [scope, setScope] = useState("feed");
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<any>(null);
  const [feedFilter, setFeedFilter] = useState("league");
  const [customSel, setCustomSel] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const pending = useMemo(() => matches.filter((m) => m.status === "pending").sort((a, b) => b.date - a.date), [matches]);
  const confirmed = useMemo(() => matches.filter((m) => m.status !== "pending").sort((a, b) => b.date - a.date), [matches]);
  const events = useMemo(() => buildEvents(players, matches, null), [players, matches]);
  const feedList = useMemo(() => {
    if (feedFilter === "mine") return confirmed.filter((m) => m.p1 === meId || m.p2 === meId);
    if (feedFilter === "custom") { const s = new Set(customSel); return s.size >= 2 ? confirmed.filter((m) => s.has(m.p1) && s.has(m.p2)) : []; }
    return confirmed;
  }, [confirmed, feedFilter, customSel, meId]);
  const toggleCustom = (id) => setCustomSel(customSel.includes(id) ? customSel.filter((x) => x !== id) : [...customSel, id]);
  const nm = (id) => { const p = players.find((x) => x.id === id); return p ? p.name + (p.last ? " " + p.last : "") : nameOf(id); };
  const beginEdit = (m: any) => {
    setEditingMatchId(m.id);
    setEditDraft({ date: m.date ? new Date(m.date).toISOString().slice(0, 10) : "", p1: m.p1, p2: m.p2, winner: m.winner || "draw" });
  };
  const saveEdit = (m: any) => {
    if (!editDraft || !onEditMatch) return;
    onEditMatch(m.id, { date: editDraft.date ? new Date(editDraft.date).getTime() : m.date, p1: editDraft.p1, p2: editDraft.p2, winner: editDraft.winner });
    setEditingMatchId(null);
    setEditDraft(null);
  };
  return (
    <div>
      {pending.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: BALL, marginBottom: 10 }}>Awaiting confirmation</div>
          {pending.map((m) => {
            const iAmIn = m.p1 === meId || m.p2 === meId;
            const canRespond = iAmIn && m.reportedBy !== meId;
            const iReported = m.reportedBy === meId;
            const other = nameOf(m.p1 === meId ? m.p2 : m.p1);
            return (
              <div key={m.id} style={{ background: PANEL, border: "1px solid " + BALL, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <div style={{ fontFamily: body, fontSize: 14, color: CHALK }}>{nameOf(m.reportedBy) || "Someone"} logged: <strong>{winnerLabel(m, nameOf)}</strong></div>
                <div style={{ fontFamily: mono, fontSize: 11, color: MUTED, margin: "2px 0 10px" }}>{fmtDate(m.date)}{m.score ? " · " + m.score : ""}</div>
                {canRespond ? (
                  <div style={{ display: "flex", gap: 8 }}><BigBtn onClick={() => onConfirm(m.id)} color={BALL}>Agree</BigBtn><BigBtn onClick={() => onDispute(m.id)} color={CLAY}>Dispute</BigBtn></div>
                ) : iReported ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontFamily: body, fontSize: 12, color: MUTED }}>Waiting for {other} to agree…</span><button onClick={() => onDispute(m.id)} style={{ fontFamily: mono, fontSize: 10, color: MUTED, background: "transparent", border: "1px solid " + LINE, borderRadius: 5, padding: "5px 8px", cursor: "pointer", textTransform: "uppercase" }}>Cancel</button></div>
                ) : (
                  <span style={{ fontFamily: body, fontSize: 12, color: MUTED }}>Waiting on the players to agree.</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Toggle on={scope === "feed"} onClick={() => setScope("feed")} label="Newsfeed" />
        <Toggle on={scope === "fixtures"} onClick={() => setScope("fixtures")} label="Fixtures" />
      </div>
      {scope === "fixtures" ? (
        <FixturesPanel fixtures={fixtures || []} players={players} elo={elo} matches={matches} nameOf={nameOf} onResolve={onResolveFixture} onBook={onBookFixture} />
      ) : (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <Toggle on={feedFilter === "league"} onClick={() => setFeedFilter("league")} label="League" />
            <Toggle on={feedFilter === "mine"} onClick={() => setFeedFilter("mine")} label="Mine" />
            <Toggle on={feedFilter === "custom"} onClick={() => setFeedFilter("custom")} label="Custom" />
          </div>
          {feedFilter === "custom" && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: MUTED, marginBottom: 8 }}>Pick players (e.g. just the brothers)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {players.map((p) => { const on = customSel.includes(p.id); return (
                  <button key={p.id} onClick={() => toggleCustom(p.id)} style={{ fontFamily: body, fontSize: 12, padding: "6px 10px", borderRadius: 20, cursor: "pointer", border: "1px solid " + (on ? BALL : LINE), background: on ? BALL : "transparent", color: on ? COURT : CHALK }}>{p.name}{p.last ? " " + p.last[0] : ""}</button>
                ); })}
              </div>
            </div>
          )}
          {(() => {
            const s = new Set(customSel);
            const up = (fixtures || []).filter((f) => !f.done && f.booked).filter((f) => feedFilter === "mine" ? (f.p1 === meId || f.p2 === meId) : feedFilter === "custom" ? (s.has(f.p1) && s.has(f.p2)) : true);
            if (!up.length) return null;
            return (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: BALL, marginBottom: 8 }}>📅 Coming up</div>
                {up.map((f) => { const p1 = Math.round(predictProb(f.p1, f.p2, matches, elo, players) * 100); return (
                  <div key={f.id} style={{ background: PANEL, border: "1px solid " + LINE, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontFamily: display, fontSize: 16, fontWeight: 700, color: CHALK, textTransform: "uppercase", letterSpacing: -0.2 }}>{nm(f.p1)} v {nm(f.p2)}</span>
                      <span style={{ fontFamily: mono, fontSize: 10, color: COURT, background: BALL, borderRadius: 4, padding: "2px 6px" }}>{f.booked}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 10, color: MUTED, marginBottom: 3 }}><span>{nm(f.p1)} {p1}%</span><span>{100 - p1}% {nm(f.p2)}</span></div>
                    <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", background: PANEL2 }}><div style={{ width: p1 + "%", background: BALL }} /><div style={{ width: (100 - p1) + "%", background: MUTED }} /></div>
                  </div>
                ); })}
              </div>
            );
          })()}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What's on your mind?" style={{ ...miniInput, flex: 1, fontFamily: body, fontSize: 14, padding: "10px 11px", boxSizing: "border-box" as const }} />
            <BigBtn onClick={() => { const t = draft.trim(); if (t) { onPost(t); setDraft(""); } }} color={BALL} grow={false}>Post</BigBtn>
          </div>
          {(() => {
            const s2 = new Set(customSel);
            const inScope = (ids) => feedFilter === "mine" ? ids.includes(meId) : feedFilter === "custom" ? (s2.size >= 2 && ids.every((i) => s2.has(i))) : true;
            const items = [
              ...feedList.map((m) => ({ kind: "result", date: m.date, key: m.id, m })),
              ...events.filter((e) => true).map((e) => ({ kind: "event", date: e.date, key: e.id, e })),
              ...(posts || []).map((p) => ({ kind: "post", date: p.date, key: p.id, p })),
            ].sort((a, b) => b.date - a.date);
            if (!items.length) return null;
            return items.map((it) => {
              if (it.kind === "event") return (
                <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: "1px solid " + LINE }}>
                  <span style={{ fontSize: 17 }}>{it.e.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: body, fontSize: 14, color: BALL }}>{it.e.text}</div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: MUTED, marginTop: 1 }}>{fmtDate(it.e.date)}</div>
                  </div>
                </div>
              );
              if (it.kind === "post") return (
                <div key={it.key} style={{ display: "flex", gap: 12, padding: "12px 4px", borderBottom: "1px solid " + LINE }}>
                  <span style={{ fontSize: 17 }}>&#128172;</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: body, fontSize: 14, color: CHALK }}>{it.p.text}</div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: MUTED, marginTop: 2 }}>{nm(it.p.by)} \u00b7 {fmtDate(it.p.date)}</div>
                  </div>
                  {it.p.by === meId && <button onClick={() => onRemovePost(it.p.id)} style={{ fontFamily: mono, fontSize: 10, color: MUTED, background: "transparent", border: "1px solid " + LINE, borderRadius: 5, padding: "4px 7px", cursor: "pointer" }}>&#10005;</button>}
                </div>
              );
              const m = it.m;
              return (
                <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: "1px solid " + LINE }}>
                  <span style={{ fontSize: 17 }}>{m.winner === "draw" ? "\uD83E\uDD1D" : "\uD83C\uDFBE"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: body, fontSize: 14, color: CHALK }}><strong>{winnerLabel(m, nameOf)}</strong></div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: MUTED, marginTop: 1 }}>{fmtDate(m.date)}{m.score ? " \u00b7 " + m.score : ""}</div>                    {canEditMatches && (
                      <div style={{ marginTop: 8 }}>
                        {editingMatchId === m.id ? (
                          <div style={{ display: "grid", gap: 6 }}>
                            <input type="date" value={editDraft?.date || ""} onChange={(e) => setEditDraft({ ...editDraft, date: e.target.value })} style={{ ...miniInput, boxSizing: "border-box" as const }} />
                            <select value={editDraft?.p1 || ""} onChange={(e) => setEditDraft({ ...editDraft, p1: e.target.value })} style={{ ...miniInput, boxSizing: "border-box" as const }}>
                              {players.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <select value={editDraft?.p2 || ""} onChange={(e) => setEditDraft({ ...editDraft, p2: e.target.value })} style={{ ...miniInput, boxSizing: "border-box" as const }}>
                              {players.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <select value={editDraft?.winner || "draw"} onChange={(e) => setEditDraft({ ...editDraft, winner: e.target.value })} style={{ ...miniInput, boxSizing: "border-box" as const }}>
                              <option value="p1">Player 1 wins</option>
                              <option value="p2">Player 2 wins</option>
                              <option value="draw">Draw</option>
                            </select>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={() => saveEdit(m)} style={{ fontFamily: mono, fontSize: 10, color: COURT, background: BALL, border: "none", borderRadius: 5, padding: "5px 8px", cursor: "pointer", textTransform: "uppercase" }}>Save</button>
                              <button onClick={() => { setEditingMatchId(null); setEditDraft(null); }} style={{ fontFamily: mono, fontSize: 10, color: MUTED, background: "transparent", border: "1px solid " + LINE, borderRadius: 5, padding: "5px 8px", cursor: "pointer", textTransform: "uppercase" }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => beginEdit(m)} style={{ fontFamily: mono, fontSize: 10, color: BALL, background: "transparent", border: "1px solid " + LINE, borderRadius: 5, padding: "5px 8px", cursor: "pointer", textTransform: "uppercase" }}>Edit</button>
                        )}
                      </div>
                    )}                  </div>
                  <button onClick={() => onDelete(m.id)} style={{ fontFamily: mono, fontSize: 10, color: MUTED, background: "transparent", border: "1px solid " + LINE, borderRadius: 5, padding: "5px 8px", cursor: "pointer", textTransform: "uppercase", letterSpacing: 1 }}>Undo</button>
                </div>
              );
            });
          })()}

          {feedList.length === 0 && (posts || []).length === 0 && <Empty msg={feedFilter === "mine" ? "None of your games yet. Tap + to log one." : feedFilter === "custom" ? (customSel.length < 2 ? "Pick at least two players above." : "No games between them yet.") : "Nothing here yet \u2014 log a game or post something."} />}
        </div>
      )}
    </div>
  );
}
