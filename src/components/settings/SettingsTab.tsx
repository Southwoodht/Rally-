"use client";
import React, { useState } from "react";
import { LevelGuide } from "@/components/profile/LevelGuide";
import { TimelineEditor } from "@/components/settings/TimelineEditor";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarPicker } from "@/components/ui/AvatarPicker";
import { BigBtn, Field, Toggle } from "@/components/ui/atoms";
import { LEVELS, SUBS } from "@/core/constants";
import { fmtDate, uid } from "@/lib/format";
import { BALL, CHALK, CLAY, COURT, MUTED, NICKS, PANEL2, body, card, input, miniInput, mono } from "@/lib/theme";

export function SettingsTab({ group, updateGroup, onRemovePlayer, fixtures, onGenerate, onClearFixtures, onAddFixture, onRemoveFixture, onLoadDemo, onClearResults, onImportHistoricalMatches, players, setPlayers, matches, flash, meId }: any) {
  const [name, setName] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [fxP1, setFxP1] = useState("");
  const [fxP2, setFxP2] = useState("");
  const [avOpen, setAvOpen] = useState(null);
  const [tlOpen, setTlOpen] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [seasonName, setSeasonName] = useState("");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");
  const add = () => { const n = name.trim(); if (!n) return; if (players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return flash("Already added"); setPlayers([...players, { id: uid(), name: n, level: null, avatar: null }]); setName(""); };
  const remove = (id) => { onRemovePlayer(id); setConfirmRemove(null); flash("Player removed"); };
  const setLevel = (id, cat, sub) => setPlayers(players.map((p) => p.id === id ? { ...p, level: cat ? { cat, sub: sub || "Medium" } : null } : p));
  const setField = (id, key, val) => setPlayers(players.map((p) => p.id === id ? { ...p, [key]: val } : p));
  const setAvatar = (id, av) => setPlayers(players.map((p) => p.id === id ? { ...p, avatar: av } : p));
  const addPeriod = (id, per) => setPlayers(players.map((p) => p.id === id ? { ...p, levelHistory: [...(p.levelHistory || []), per].sort((a, b) => (a.from || 0) - (b.from || 0)) } : p));
  const removePeriod = (id, i) => setPlayers(players.map((p) => p.id === id ? { ...p, levelHistory: (p.levelHistory || []).filter((_, idx) => idx !== i) } : p));
  return (
    <div style={card}>
      <Field label="League name"><input value={group?.name || ""} onChange={(e) => updateGroup(group.id, { name: e.target.value })} style={{ ...input, boxSizing: "border-box" as const }} /></Field>
      <Field label="Fair play">
        <div style={{ display: "flex", gap: 8 }}>
          <Toggle on={!group?.requireSetup} onClick={() => updateGroup(group.id, { requireSetup: false })} label="Open" />
          <Toggle on={!!group?.requireSetup} onClick={() => updateGroup(group.id, { requireSetup: true })} label="Setup required" />
        </div>
        <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 8 }}>{group?.requireSetup ? "Players stay greyed-out and unranked until they've set their level timeline — fairer for a serious league." : "Anyone can be ranked straight away — relaxed, good for a casual mates' league."}</div>
      </Field>
      <Field label="Season">
        {group?.season ? (
          <div>
            <div style={{ fontFamily: body, fontSize: 13, color: CHALK, marginBottom: 8 }}><strong style={{ color: BALL }}>{group.season.name}</strong> — {fmtDate(group.season.start)}{group.season.end ? " to " + fmtDate(group.season.end) : " · ongoing"}</div>
            <BigBtn onClick={() => updateGroup(group.id, { season: null })} color={CLAY}>End season</BigBtn>
          </div>
        ) : (
          <div>
            <input value={seasonName} onChange={(e) => setSeasonName(e.target.value)} placeholder="Season name, e.g. Summer 2026" style={{ ...input, marginBottom: 10, boxSizing: "border-box" as const }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: MUTED, marginBottom: 4 }}>Starts</div>
                <input type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} style={{ ...miniInput, width: "100%", colorScheme: "dark", boxSizing: "border-box" as const }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: MUTED, marginBottom: 4 }}>Ends (optional)</div>
                <input type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} style={{ ...miniInput, width: "100%", colorScheme: "dark", boxSizing: "border-box" as const }} />
              </div>
            </div>
            <BigBtn onClick={() => { const st = seasonStart ? new Date(seasonStart).getTime() : Date.now(); const en = seasonEnd ? new Date(seasonEnd).getTime() : null; updateGroup(group.id, { season: { name: seasonName.trim() || "Season", start: st, end: en } }); setSeasonName(""); setSeasonStart(""); setSeasonEnd(""); }} color={BALL}>Start season</BigBtn>
            <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 8 }}>Set an end date and the table shows a live countdown. Leave it blank for an ongoing season. Games within the dates count toward it.</div>
          </div>
        )}
      </Field>
      <Field label="Fixtures">
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Toggle on={group?.fixtureMode === "roundrobin"} onClick={() => updateGroup(group.id, { fixtureMode: "roundrobin" })} label="Round-robin" />
          <Toggle on={group?.fixtureMode !== "roundrobin"} onClick={() => updateGroup(group.id, { fixtureMode: "casual" })} label="Casual" />
        </div>
        {group?.fixtureMode === "roundrobin" ? (
          <div>
            <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginBottom: 14 }}>Set up the matches to be played — players log the results in Games → Fixtures. Two ways to add them:</div>
            <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: BALL, marginBottom: 8 }}>1 · Auto — everyone plays everyone</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
              <BigBtn onClick={() => onGenerate(1)} color={BALL}>Once each</BigBtn>
              <BigBtn onClick={() => onGenerate(2)} color={BALL}>Twice</BigBtn>
              <BigBtn onClick={() => onGenerate(3)} color={BALL}>3× each</BigBtn>
            </div>
            <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: BALL, marginBottom: 8 }}>2 · Or add one specific match</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <select value={fxP1} onChange={(e) => setFxP1(e.target.value)} style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }}><option value="">Player…</option>{players.map((p) => <option key={p.id} value={p.id}>{p.name}{p.last ? " " + p.last : ""}</option>)}</select>
              <span style={{ fontFamily: mono, color: MUTED, alignSelf: "center" }}>v</span>
              <select value={fxP2} onChange={(e) => setFxP2(e.target.value)} style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }}><option value="">Player…</option>{players.map((p) => <option key={p.id} value={p.id}>{p.name}{p.last ? " " + p.last : ""}</option>)}</select>
            </div>
            <BigBtn onClick={() => { if (fxP1 && fxP2 && fxP1 !== fxP2) { onAddFixture(fxP1, fxP2); setFxP1(""); setFxP2(""); } else flash("Pick two different players"); }} color={PANEL2}>Add fixture</BigBtn>
            {fixtures && fixtures.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: MUTED, marginBottom: 8 }}>{fixtures.length} fixtures</div>
                {fixtures.map((f) => { const n = (id) => { const p = players.find((x) => x.id === id); return p ? p.name + (p.last ? " " + p.last : "") : id; }; return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "none" }}>
                    <span style={{ flex: 1, fontFamily: body, fontSize: 13, color: f.done ? MUTED : CHALK }}>{n(f.p1)} v {n(f.p2)}{f.done ? " ✓" : ""}</span>
                    <button onClick={() => onRemoveFixture(f.id)} style={{ fontFamily: mono, fontSize: 10, color: CLAY, background: "transparent", border: "none", borderRadius: 5, padding: "3px 7px", cursor: "pointer" }}>✕</button>
                  </div>
                ); })}
                <div style={{ marginTop: 10 }}><BigBtn onClick={onClearFixtures} color={CLAY}>Clear all fixtures</BigBtn></div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontFamily: body, fontSize: 12, color: MUTED }}>Casual — players just log games freely, no schedule. Switch to Round-robin to set up fixtures.</div>
        )}
      </Field>

      <div style={{ borderTop: "none", marginTop: 6, paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 14, color: CHALK }}>Players & pictures</div>
          <button onClick={() => setGuideOpen(true)} style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: BALL, background: "transparent", border: "none", borderRadius: 10, padding: "5px 9px", cursor: "pointer" }}>What's my level?</button>
        </div>
        {guideOpen && <LevelGuide onClose={() => setGuideOpen(false)} />}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a player…" onKeyDown={(e) => e.key === "Enter" && add()} style={{ ...input, marginBottom: 0, boxSizing: "border-box" as const }} />
          <BigBtn onClick={add} color={BALL} grow={false}>Add</BigBtn>
        </div>
        {players.map((p) => {
          const played = matches.filter((m) => m.p1 === p.id || m.p2 === p.id).length;
          // Once a player is claimed by a real account, their profile is
          // theirs — nobody else can edit it, only view it. The shared
          // match/competition data below (in Games) is unaffected.
          const locked = !!p.auth_id && p.id !== meId;
          return (
            <div key={p.id} style={{ padding: "10px 0", borderTop: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <button onClick={() => !locked && setAvOpen(avOpen === p.id ? null : p.id)} style={{ background: "transparent", border: "none", padding: 0, cursor: locked ? "default" : "pointer" }}><Avatar player={p} size={36} /></button>
                {p.auth_id ? (
                  <span style={{ flex: 1, fontFamily: body, color: CHALK, fontSize: 15 }}>{p.name}{p.last ? " " + p.last : ""}<span style={{ color: MUTED, fontSize: 11, marginLeft: 8, fontFamily: body, fontWeight: 600 }}>🔒 account</span></span>
                ) : (
                  <input value={p.name} onChange={(e) => setField(p.id, "name", e.target.value)} placeholder="First name" style={{ ...miniInput, flex: 1, fontFamily: body, fontSize: 15, padding: "7px 8px", boxSizing: "border-box" as const }} />
                )}
                <span style={{ color: MUTED, fontSize: 11, fontFamily: mono, marginRight: 2, whiteSpace: "nowrap" }}>{played} played</span>
                <button onClick={() => setField(p.id, "inactive", !p.inactive)} title={p.inactive ? "Bring back into the league" : "Mark as not currently playing"} style={{ fontFamily: body, fontWeight: 600, fontSize: 11.5, background: "transparent", border: "none", borderRadius: 8, padding: "4px 7px", cursor: "pointer", color: p.inactive ? MUTED : BALL, marginRight: 6 }}>{p.inactive ? "Inactive" : "Active"}</button>
                {locked ? null : confirmRemove === p.id ? (
                  <span style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => remove(p.id)} style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: COURT, background: CLAY, border: "none", borderRadius: 8, padding: "5px 9px", cursor: "pointer" }}>{played > 0 ? "Remove + " + played + " games" : "Confirm"}</button>
                    <button onClick={() => setConfirmRemove(null)} style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: MUTED, background: "transparent", border: "none", borderRadius: 8, padding: "5px 9px", cursor: "pointer" }}>Keep</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmRemove(p.id)} style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: CLAY, background: "transparent", border: "none", borderRadius: 8, padding: "5px 9px", cursor: "pointer" }}>Remove</button>
                )}
              </div>
              {avOpen === p.id && !locked && (
                <div style={{ padding: "4px 0 10px" }}>
                  <AvatarPicker value={p.avatar} onChange={(av) => setAvatar(p.id, av)} />
                </div>
              )}
              {locked ? (
                <div style={{ fontFamily: body, fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
                  {[p.last, p.age ? p.age + " yrs" : null, p.home].filter(Boolean).join(" · ") || "No extra details set"}
                  {p.level && <div>{p.level.cat} · {p.level.sub}</div>}
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={p.last || ""} onChange={(e) => setField(p.id, "last", e.target.value)} placeholder="Surname" style={{ ...miniInput, flex: 2, boxSizing: "border-box" as const }} />
                    <input value={p.age || ""} onChange={(e) => setField(p.id, "age", e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="Age" style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }} />
                    <input value={p.home || ""} onChange={(e) => setField(p.id, "home", e.target.value)} placeholder="Home ground" style={{ ...miniInput, flex: 2, boxSizing: "border-box" as const }} />
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <input value={p.nick || ""} onChange={(e) => setField(p.id, "nick", e.target.value)} placeholder="Nickname (optional)" style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }} />
                    <button onClick={() => setField(p.id, "nick", NICKS[Math.floor(Math.random() * NICKS.length)])} title="Random nickname" style={{ ...miniInput, cursor: "pointer", flex: "0 0 auto", padding: "8px 10px", color: BALL, boxSizing: "border-box" as const }}>&#127922;</button>
                    {p.nick ? <button onClick={() => setField(p.id, "nick", "")} style={{ ...miniInput, cursor: "pointer", flex: "0 0 auto", padding: "8px 10px", color: MUTED, boxSizing: "border-box" as const }}>&#10005;</button> : null}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <select value={p.level?.cat || ""} onChange={(e) => setLevel(p.id, e.target.value, p.level?.sub)} style={{ ...miniInput, flex: 2, boxSizing: "border-box" as const }}><option value="">No level</option>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select>
                    <select value={p.level?.sub || "Medium"} disabled={!p.level} onChange={(e) => setLevel(p.id, p.level?.cat, e.target.value)} style={{ ...miniInput, flex: 1, opacity: p.level ? 1 : 0.4, boxSizing: "border-box" as const }}>{SUBS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                  </div>
                  <button onClick={() => setTlOpen(tlOpen === p.id ? null : p.id)} style={{ marginTop: 8, fontFamily: body, fontWeight: 600, fontSize: 12.5, color: BALL, background: "transparent", border: "none", borderRadius: 10, padding: "5px 9px", cursor: "pointer" }}>Level timeline{p.levelHistory?.length ? " (" + p.levelHistory.length + ")" : ""}</button>
                  {tlOpen === p.id && <TimelineEditor player={p} onAdd={(per) => addPeriod(p.id, per)} onRemove={(i) => removePeriod(p.id, i)} />}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: "none", marginTop: 6, paddingTop: 16 }}>
        <div style={{ fontFamily: body, fontWeight: 700, fontSize: 14, color: CHALK, marginBottom: 10 }}>Data</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><BigBtn onClick={onLoadDemo} color={BALL}>Load example data</BigBtn><BigBtn onClick={onClearResults} color={CLAY}>Clear results</BigBtn><BigBtn onClick={onImportHistoricalMatches} color={PANEL2}>Import historical matches</BigBtn></div>
        <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 8 }}>Applies to this league only. "Clear results" wipes matches but keeps players — use it when you go live. The historical import adds dated singles matches and creates any missing opponent players without duplicating existing entries.</div>
      </div>
    </div>
  );
}
