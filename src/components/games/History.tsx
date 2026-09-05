"use client";
import React, { useState, useMemo } from "react";
import { FixturesPanel } from "@/components/games/FixturesPanel";
import { buildEvents } from "@/components/games/events";
import { BigBtn, Empty, Toggle } from "@/components/ui/atoms";
import { predictProb } from "@/core/predict";
import { autoConfirmNote, deleteTimeoutNote, fmtDate, winnerLabel } from "@/lib/format";
import { PlayerLink } from "@/components/ui/PlayerLink";
import { BALL, CHALK, CLAY, COURT, LINE, MUTED, PANEL, PANEL2, body, input, listCard, miniInput, mono, wrap } from "@/lib/theme";

export function History({ posts, onPost, onRemovePost, matches, players, elo, nameOf, meId, groupName, fixtures, onGenerate, onClearFixtures, onResolveFixture, onBookFixture, onConfirm, onDispute, onDelete, canEditMatches, onEditMatch, onApproveEdit, onRejectEdit, onAgreeDelete, onCancelDelete, onOpenMatch, onOpenProfile }: any) {
  const [scope, setScope] = useState("feed");
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<any>(null);
  const [feedFilter, setFeedFilter] = useState("league");
  const [customSel, setCustomSel] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [asAnnouncement, setAsAnnouncement] = useState(false);
  const announcements = useMemo(() => (posts || []).filter((p) => p.isAnnouncement).sort((a, b) => b.date - a.date), [posts]);
  const pending = useMemo(() => matches.filter((m) => m.status === "pending").sort((a, b) => b.date - a.date), [matches]);
  const pendingEdits = useMemo(() => matches.filter((m) => m.pendingEdit).sort((a, b) => (b.pendingEdit?.proposedAt || 0) - (a.pendingEdit?.proposedAt || 0)), [matches]);
  const pendingDeletes = useMemo(() => matches.filter((m) => m.deleteRequestedBy).sort((a, b) => (b.deleteRequestedAt || 0) - (a.deleteRequestedAt || 0)), [matches]);
  const confirmed = useMemo(() => matches.filter((m) => m.status !== "pending").sort((a, b) => b.date - a.date), [matches]);
  const events = useMemo(() => buildEvents(players, matches, null), [players, matches]);
  const feedList = useMemo(() => {
    if (feedFilter === "mine") return confirmed.filter((m) => m.p1 === meId || m.p2 === meId);
    if (feedFilter === "custom") { const s = new Set(customSel); return s.size >= 2 ? confirmed.filter((m) => s.has(m.p1) && s.has(m.p2)) : []; }
    return confirmed;
  }, [confirmed, feedFilter, customSel, meId]);
  const toggleCustom = (id) => setCustomSel(customSel.includes(id) ? customSel.filter((x) => x !== id) : [...customSel, id]);
  const nm = (id) => { const p = players.find((x) => x.id === id); return p ? p.name + (p.last ? " " + p.last : "") : nameOf(id); };
  // One place to turn an id into a person, so every name on this screen
  // resolves the same way and every one of them is a tap to them.
  const who = (id: string) => players.find((x: any) => x.id === id) || null;
  const Who = ({ id, ...rest }: any) => <PlayerLink player={who(id)} name={nameOf(id)} onOpen={onOpenProfile} {...rest} />;
  const beginEdit = (m: any) => {
    setEditingMatchId(m.id);
    setEditDraft({ date: m.date ? new Date(m.date).toISOString().slice(0, 10) : "", p1: m.p1, p2: m.p2, winner: m.winner || "draw", score: m.score || "" });
  };
  const saveEdit = (m: any) => {
    if (!editDraft || !onEditMatch) return;
    onEditMatch(m.id, { date: editDraft.date ? new Date(editDraft.date).getTime() : m.date, p1: editDraft.p1, p2: editDraft.p2, winner: editDraft.winner, score: editDraft.score.trim() });
    setEditingMatchId(null);
    setEditDraft(null);
  };
  return (
    <div>
      {(pending.length > 0 || pendingEdits.length > 0 || pendingDeletes.length > 0) && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: BALL, marginBottom: 10 }}>Awaiting confirmation</div>
          {pending.map((m) => {
            const iAmIn = m.p1 === meId || m.p2 === meId;
            const canRespond = iAmIn && m.reportedBy !== meId;
            const iReported = m.reportedBy === meId;
            const other = nameOf(m.p1 === meId ? m.p2 : m.p1);
            const note = autoConfirmNote(m.loggedAt);
            return (
              <div key={m.id} style={{ background: PANEL, border: "1px solid " + BALL, borderRadius: 14, padding: 12, marginBottom: 8 }}>
                <div style={{ fontFamily: body, fontSize: 14, color: CHALK }}><Who id={m.reportedBy} size={18} /> logged: <strong>{winnerLabel(m, nameOf)}</strong></div>
                <div style={{ fontFamily: mono, fontSize: 11, color: MUTED, margin: "2px 0 10px" }}>{fmtDate(m.date)}{m.score ? " · " + m.score : ""}</div>
                {canRespond ? (
                  <>
                    <div style={{ display: "flex", gap: 8 }}><BigBtn onClick={() => onConfirm(m.id)} color={BALL}>Agree</BigBtn><BigBtn onClick={() => onDispute(m.id)} color={CLAY}>Dispute</BigBtn></div>
                    {note && <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, marginTop: 8 }}>If you don't respond, this {note}.</div>}
                  </>
                ) : iReported ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontFamily: body, fontSize: 12, color: MUTED }}>Waiting for {other} to agree{note ? ` — ${note}` : "…"}</span><button onClick={() => onDispute(m.id)} style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: MUTED, background: "transparent", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}>Cancel</button></div>
                ) : (
                  <span style={{ fontFamily: body, fontSize: 12, color: MUTED }}>Waiting on the players to agree{note ? ` — ${note}` : "."}</span>
                )}
              </div>
            );
          })}
          {pendingEdits.map((m) => {
            const edit = m.pendingEdit;
            const iAmIn = m.p1 === meId || m.p2 === meId;
            const proposedByMe = edit.proposedBy === meId;
            const canRespond = iAmIn && !proposedByMe;
            const other = nameOf(m.p1 === meId ? m.p2 : m.p1);
            const before = { winner: m.winner, score: m.score, date: m.date };
            const after = { winner: edit.winner, score: edit.score, date: edit.date };
            return (
              <div key={m.id + "-edit"} style={{ background: PANEL, border: "1px solid " + BALL, borderRadius: 14, padding: 12, marginBottom: 8 }}>
                <div style={{ fontFamily: body, fontSize: 14, color: CHALK }}><Who id={edit.proposedBy} size={18} /> wants to change a result:</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: MUTED, margin: "4px 0" }}>Was: {winnerLabel({ ...m, ...before }, nameOf)}{before.score ? " · " + before.score : ""} · {fmtDate(before.date)}</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: BALL, marginBottom: 10 }}>Now: {winnerLabel({ ...m, ...after }, nameOf)}{after.score ? " · " + after.score : ""} · {fmtDate(after.date)}</div>
                {canRespond ? (
                  <div style={{ display: "flex", gap: 8 }}><BigBtn onClick={() => onApproveEdit(m.id)} color={BALL}>Agree</BigBtn><BigBtn onClick={() => onRejectEdit(m.id)} color={CLAY}>Reject</BigBtn></div>
                ) : proposedByMe ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontFamily: body, fontSize: 12, color: MUTED }}>Waiting for {other} to agree…</span><button onClick={() => onRejectEdit(m.id)} style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: MUTED, background: "transparent", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}>Cancel</button></div>
                ) : (
                  <span style={{ fontFamily: body, fontSize: 12, color: MUTED }}>Waiting on the players to agree.</span>
                )}
              </div>
            );
          })}
          {pendingDeletes.map((m) => {
            const iAmIn = m.p1 === meId || m.p2 === meId;
            const requestedByMe = m.deleteRequestedBy === meId;
            const canRespond = iAmIn && !requestedByMe;
            const other = nameOf(m.p1 === meId ? m.p2 : m.p1);
            const note = deleteTimeoutNote(m.deleteRequestedAt);
            return (
              <div key={m.id + "-delete"} style={{ background: PANEL, border: "1px solid " + CLAY, borderRadius: 14, padding: 12, marginBottom: 8 }}>
                <div style={{ fontFamily: body, fontSize: 14, color: CHALK }}><Who id={m.deleteRequestedBy} size={18} /> wants to delete a result:</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: MUTED, margin: "2px 0 10px" }}>{winnerLabel(m, nameOf)}{m.score ? " · " + m.score : ""} · {fmtDate(m.date)}</div>
                {canRespond ? (
                  <>
                    <div style={{ display: "flex", gap: 8 }}><BigBtn onClick={() => onAgreeDelete(m.id)} color={CLAY}>Agree & delete</BigBtn><BigBtn onClick={() => onCancelDelete(m.id)} color={BALL}>Keep it</BigBtn></div>
                    {note && <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, marginTop: 8 }}>If you don't respond, this {note}.</div>}
                  </>
                ) : requestedByMe ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontFamily: body, fontSize: 12, color: MUTED }}>Waiting for {other} to agree{note ? ` — ${note}` : "…"}</span><button onClick={() => onCancelDelete(m.id)} style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: MUTED, background: "transparent", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}>Cancel</button></div>
                ) : (
                  <span style={{ fontFamily: body, fontSize: 12, color: MUTED }}>Waiting on the players to agree{note ? ` — ${note}` : "."}</span>
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
              <div style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: MUTED, marginBottom: 8 }}>Pick players (e.g. just the brothers)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {players.map((p) => { const on = customSel.includes(p.id); return (
                  <button key={p.id} onClick={() => toggleCustom(p.id)} style={{ fontFamily: body, fontSize: 12, padding: "6px 10px", borderRadius: 20, cursor: "pointer", border: "1px solid " + (on ? BALL : LINE), background: on ? BALL : "transparent", color: on ? COURT : CHALK }}>{p.name}{p.last ? " " + p.last[0] : ""}</button>
                ); })}
              </div>
            </div>
          )}
          {announcements.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: BALL, marginBottom: 8 }}>📌 Announcements</div>
              {announcements.map((p) => (
                <div key={p.id} style={{ display: "flex", gap: 10, background: PANEL, border: "1px solid " + BALL, borderRadius: 14, padding: 12, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: body, fontSize: 14, color: CHALK }}>{p.text}</div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: MUTED, marginTop: 2 }}>{nm(p.by)} · {fmtDate(p.date)}</div>
                  </div>
                  {(p.by === meId || canEditMatches) && <button onClick={() => onRemovePost(p.id)} style={{ fontFamily: mono, fontSize: 10, color: MUTED, background: "transparent", border: "none", borderRadius: 5, padding: "4px 7px", cursor: "pointer", flexShrink: 0, alignSelf: "flex-start" }}>&#10005;</button>}
                </div>
              ))}
            </div>
          )}
          {(() => {
            const s = new Set(customSel);
            const up = (fixtures || []).filter((f) => !f.done && f.booked).filter((f) => feedFilter === "mine" ? (f.p1 === meId || f.p2 === meId) : feedFilter === "custom" ? (s.has(f.p1) && s.has(f.p2)) : true);
            if (!up.length) return null;
            return (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: BALL, marginBottom: 8 }}>📅 Coming up</div>
                {up.map((f) => { const p1 = Math.round(predictProb(f.p1, f.p2, matches, elo, players) * 100); return (
                  <div key={f.id} style={{ background: PANEL, border: "none", borderRadius: 14, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontFamily: body, fontSize: 15, fontWeight: 700, color: CHALK }}>{nm(f.p1)} v {nm(f.p2)}</span>
                      <span style={{ fontFamily: mono, fontSize: 10, color: COURT, background: BALL, borderRadius: 4, padding: "2px 6px" }}>{f.booked}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 10, color: MUTED, marginBottom: 3 }}><span>{nm(f.p1)} {p1}%</span><span>{100 - p1}% {nm(f.p2)}</span></div>
                    <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", background: PANEL2 }}><div style={{ width: p1 + "%", background: BALL }} /><div style={{ width: (100 - p1) + "%", background: MUTED }} /></div>
                  </div>
                ); })}
              </div>
            );
          })()}
          <div style={{ display: "flex", gap: 6, marginBottom: canEditMatches ? 8 : 14 }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What's on your mind?" style={{ ...miniInput, flex: 1, fontFamily: body, fontSize: 14, padding: "10px 11px", boxSizing: "border-box" as const }} />
            <BigBtn onClick={() => { const t = draft.trim(); if (t) { onPost(t, asAnnouncement); setDraft(""); setAsAnnouncement(false); } }} color={BALL} grow={false}>Post</BigBtn>
          </div>
          {canEditMatches && (
            <button onClick={() => setAsAnnouncement(!asAnnouncement)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", padding: 0, marginBottom: 14, cursor: "pointer" }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, border: "1px solid " + (asAnnouncement ? BALL : LINE), background: asAnnouncement ? BALL : "transparent" }} />
              <span style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: asAnnouncement ? BALL : MUTED }}>📌 Post as announcement</span>
            </button>
          )}
          {(() => {
            const s2 = new Set(customSel);
            const inScope = (ids) => feedFilter === "mine" ? ids.includes(meId) : feedFilter === "custom" ? (s2.size >= 2 && ids.every((i) => s2.has(i))) : true;
            const items = [
              ...feedList.map((m) => ({ kind: "result", date: m.date, key: m.id, m })),
              ...events.filter((e) => true).map((e) => ({ kind: "event", date: e.date, key: e.id, e })),
              ...(posts || []).filter((p) => !p.isAnnouncement).map((p) => ({ kind: "post", date: p.date, key: p.id, p })),
            ].sort((a, b) => b.date - a.date);
            if (!items.length) return null;
            return <div style={listCard}>{items.map((it) => {
              if (it.kind === "event") return (
                <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: "none" }}>
                  <span style={{ fontSize: 17 }}>{it.e.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: body, fontSize: 14, color: BALL }}>{it.e.text}</div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: MUTED, marginTop: 1 }}>{fmtDate(it.e.date)}</div>
                  </div>
                </div>
              );
              if (it.kind === "post") return (
                <div key={it.key} style={{ display: "flex", gap: 12, padding: "12px 4px", borderBottom: "none" }}>
                  <span style={{ fontSize: 17 }}>&#128172;</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: body, fontSize: 14, color: CHALK }}>{it.p.text}</div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: MUTED, marginTop: 2 }}><Who id={it.p.by} size={16} strong={false} /> \u00b7 {fmtDate(it.p.date)}</div>
                  </div>
                  {it.p.by === meId && <button onClick={() => onRemovePost(it.p.id)} style={{ fontFamily: mono, fontSize: 10, color: MUTED, background: "transparent", border: "none", borderRadius: 5, padding: "4px 7px", cursor: "pointer" }}>&#10005;</button>}
                </div>
              );
              const m = it.m;
              return (
                <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: "none" }}>
                  <span style={{ fontSize: 17 }}>{m.winner === "draw" ? "\uD83E\uDD1D" : "\uD83C\uDFBE"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontFamily: body, fontSize: 14, color: CHALK }}>
                      <Who id={m.winner === "p2" ? m.p2 : m.p1} />
                      <span style={{ color: MUTED, fontWeight: 500 }}>{m.winner === "draw" ? "drew with" : "beat"}</span>
                      <Who id={m.winner === "p2" ? m.p1 : m.p2} />
                      {(m.notes || m.photoUrl) && <span>{m.notes ? "💬" : ""}{m.photoUrl ? "📷" : ""}</span>}
                    </div>
                    <button onClick={() => onOpenMatch && onOpenMatch(m.id)} disabled={!onOpenMatch} style={{ display: "block", width: "100%", background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: onOpenMatch ? "pointer" : "default", marginTop: 2 }}>
                      <div style={{ fontFamily: mono, fontSize: 11, color: MUTED }}>{fmtDate(m.date)}{m.score ? " · " + m.score : ""}{onOpenMatch ? <span style={{ color: BALL }}> ›</span> : null}</div>
                    </button>
                    {canEditMatches && (
                      <div style={{ marginTop: 8 }}>
                        {editingMatchId === m.id ? (
                          <div style={{ display: "grid", gap: 6 }}>
                            <input type="date" value={editDraft?.date || ""} onChange={(e) => setEditDraft({ ...editDraft, date: e.target.value })} style={{ ...miniInput, boxSizing: "border-box" as const }} />
                            <select value={editDraft?.p1 || ""} onChange={(e) => setEditDraft({ ...editDraft, p1: e.target.value })} style={{ ...miniInput, boxSizing: "border-box" as const }}>
                              {players.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.last ? " " + p.last : ""}</option>)}
                            </select>
                            <select value={editDraft?.p2 || ""} onChange={(e) => setEditDraft({ ...editDraft, p2: e.target.value })} style={{ ...miniInput, boxSizing: "border-box" as const }}>
                              {players.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.last ? " " + p.last : ""}</option>)}
                            </select>
                            <select value={editDraft?.winner || "draw"} onChange={(e) => setEditDraft({ ...editDraft, winner: e.target.value })} style={{ ...miniInput, boxSizing: "border-box" as const }}>
                              <option value="p1">Player 1 wins</option>
                              <option value="p2">Player 2 wins</option>
                              <option value="draw">Draw</option>
                            </select>
                            <input value={editDraft?.score || ""} onChange={(e) => setEditDraft({ ...editDraft, score: e.target.value })} placeholder="Score (optional), e.g. 6–4" style={{ ...miniInput, boxSizing: "border-box" as const }} />
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={() => saveEdit(m)} style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: COURT, background: BALL, border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}>Save</button>
                              <button onClick={() => { setEditingMatchId(null); setEditDraft(null); }} style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: MUTED, background: "transparent", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => beginEdit(m)} style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: BALL, background: "transparent", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}>Edit</button>
                        )}
                      </div>
                    )}                  </div>
                  <button onClick={() => onDelete(m.id)} style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: MUTED, background: "transparent", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}>Undo</button>
                </div>
              );
            })}</div>;
          })()}

          {feedList.length === 0 && (posts || []).length === 0 && <Empty msg={feedFilter === "mine" ? "None of your games yet. Tap + to log one." : feedFilter === "custom" ? (customSel.length < 2 ? "Pick at least two players above." : "No games between them yet.") : "Nothing here yet \u2014 log a game or post something."} />}
        </div>
      )}
    </div>
  );
}
