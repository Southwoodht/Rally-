"use client";
import React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Empty } from "@/components/ui/atoms";
import { LEVELS, SUBS } from "@/core/constants";
import { AVATARS, BALL, CHALK, LINE, MUTED, NICKS, PANEL2, body, card, display, input, miniInput, mono, wrap } from "@/lib/theme";

export function MyProfile({ players, meId, setPlayers, flash }: any) {
  const me = players.find((p) => p.id === meId);
  if (!me) return <Empty msg="Pick who you are first." />;
  const setField = (key, val) => setPlayers(players.map((p) => p.id === meId ? { ...p, [key]: val } : p));
  const setLevel = (cat, sub) => setPlayers(players.map((p) => p.id === meId ? { ...p, level: cat ? { cat, sub: sub || "Medium" } : null } : p));
  const L = ({ children }: any) => <div style={{ fontFamily: mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, margin: "14px 0 5px" }}>{children}</div>;
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Avatar player={me} size={44} />
        <div>
          <div style={{ fontFamily: display, fontSize: 22, fontWeight: 800, color: CHALK, textTransform: "uppercase", letterSpacing: -0.4 }}>{me.name}{me.nick ? " \u201C" + me.nick + "\u201D" : ""}{me.last ? " " + me.last : ""}</div>
          <div style={{ fontFamily: body, fontSize: 12, color: MUTED }}>This is how you appear to everyone.</div>
        </div>
      </div>
      <L>Name</L>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={me.name || ""} onChange={(e) => setField("name", e.target.value)} placeholder="First name" style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }} />
        <input value={me.last || ""} onChange={(e) => setField("last", e.target.value)} placeholder="Surname" style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }} />
      </div>
      <L>Nickname</L>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={me.nick || ""} onChange={(e) => setField("nick", e.target.value)} placeholder="e.g. The Destroyer" style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }} />
        <button onClick={() => setField("nick", NICKS[Math.floor(Math.random() * NICKS.length)])} style={{ ...miniInput, cursor: "pointer", flex: "0 0 auto", padding: "8px 11px", color: BALL, boxSizing: "border-box" as const }}>&#127922;</button>
        {me.nick ? <button onClick={() => setField("nick", "")} style={{ ...miniInput, cursor: "pointer", flex: "0 0 auto", padding: "8px 11px", color: MUTED, boxSizing: "border-box" as const }}>&#10005;</button> : null}
      </div>
      <L>Age &amp; home ground</L>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={me.age || ""} onChange={(e) => setField("age", e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="Age" style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }} />
        <input value={me.home || ""} onChange={(e) => setField("home", e.target.value)} placeholder="Home ground" style={{ ...miniInput, flex: 2, boxSizing: "border-box" as const }} />
      </div>
      <L>Your level</L>
      <div style={{ display: "flex", gap: 6 }}>
        <select value={me.level?.cat || ""} onChange={(e) => setLevel(e.target.value, me.level?.sub)} style={{ ...miniInput, flex: 2, boxSizing: "border-box" as const }}><option value="">No level</option>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select>
        <select value={me.level?.sub || "Medium"} disabled={!me.level} onChange={(e) => setLevel(me.level?.cat, e.target.value)} style={{ ...miniInput, flex: 1, opacity: me.level ? 1 : 0.4, boxSizing: "border-box" as const }}>{SUBS.map((x) => <option key={x} value={x}>{x}</option>)}</select>
      </div>
      <L>Avatar colour</L>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {AVATARS.map((av) => <button key={av} onClick={() => setField("avatar", av)} style={{ fontSize: 20, padding: "5px 7px", borderRadius: 8, cursor: "pointer", background: me.avatar === av ? PANEL2 : "transparent", border: "1px solid " + (me.avatar === av ? BALL : LINE) }}>{av}</button>)}
      </div>
      <L>Rating</L>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={me.initialElo ?? ""} onChange={(e) => setField("initialElo", e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="ELO" style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }} />
      </div>
      <L>Existing record</L>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={(me.initialRecord?.w ?? "") || ""} onChange={(e) => setField("initialRecord", { ...(me.initialRecord || {}), w: Number(e.target.value.replace(/[^0-9]/g, "")) })} inputMode="numeric" placeholder="Wins" style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }} />
        <input value={(me.initialRecord?.d ?? "") || ""} onChange={(e) => setField("initialRecord", { ...(me.initialRecord || {}), d: Number(e.target.value.replace(/[^0-9]/g, "")) })} inputMode="numeric" placeholder="Draws" style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }} />
        <input value={(me.initialRecord?.l ?? "") || ""} onChange={(e) => setField("initialRecord", { ...(me.initialRecord || {}), l: Number(e.target.value.replace(/[^0-9]/g, "")) })} inputMode="numeric" placeholder="Losses" style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }} />
      </div>
      <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, marginTop: 16, lineHeight: 1.4 }}>Changes save straight away. Only league owners can edit other players or league settings.</div>
    </div>
  );
}
