"use client";
import React, { useRef } from "react";
import { DeleteAccount } from "@/components/profile/DeleteAccount";
import { OFFENSIVE_NAME_MESSAGE, isOffensiveName } from "@/core/nameFilter";
import { Avatar } from "@/components/ui/Avatar";
import { Empty } from "@/components/ui/atoms";
import { LEVELS, SUBS } from "@/core/constants";
import { readPhotoAsDataUrl } from "@/lib/photo";
import { updateMyPublicProfile } from "@/lib/profiles";
import { LevelRequestForm } from "@/components/profile/LevelRequestForm";
import { StartRecordEditor } from "@/components/settings/StartRecordEditor";
import { EmailsToggle } from "@/components/profile/EmailsToggle";
import { BALL, CHALK, MUTED, NICKS, body, card, miniInput } from "@/lib/theme";

const PHOTO_SIZE = 160;

/** "Rating 1200 · record 4-0-2", or null when nothing was carried in. */
const startSummary = (p: any): string | null => {
  const r = p.initialRecord;
  const rec = r && (r.w || r.d || r.l) ? `record ${r.w || 0}-${r.d || 0}-${r.l || 0}` : null;
  const elo = p.initialElo != null && p.initialElo !== "" && Number(p.initialElo) !== 0 ? `rating ${p.initialElo}` : null;
  const parts = [elo, rec].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ").replace(/^./, (c) => c.toUpperCase()) : null;
};

export function MyProfile({ players, meId, setPlayers, flash, canSetLevels, onSetLevel, onSetStart, pendingRequest, onAskLevel, friendly, played = 0 }: any) {
  const me = players.find((p) => p.id === meId);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!me) return <Empty msg="Pick who you are first." />;
  const setField = (key, val) => {
    // A name that reads as an offensive word is refused where it is typed.
    if ((key === "name" || key === "last") && isOffensiveName([key === "name" ? val : me.name, key === "last" ? val : me.last].filter(Boolean).join(" "))) {
      flash && flash(OFFENSIVE_NAME_MESSAGE);
      return;
    }
    setPlayers(players.map((p) => p.id === meId ? { ...p, [key]: val } : p));
    // A photo on a league row is only visible to that league. The account's
    // own profile row is what everybody else can read, and nothing had ever
    // written to it — which is the whole reason a stranger sees your initial
    // instead of your face. Keep the public copy in step.
    //
    // Deliberately fire-and-forget: failing to update the public copy is not
    // a reason to refuse somebody their own profile picture.
    if (key === "avatarUrl") {
      updateMyPublicProfile({ avatar_url: val }).catch((e) => console.warn("Couldn't update the public photo", e));
    }
    // Same for the name, or search and every profile page keeps showing who
    // you used to be.
    if (key === "name" || key === "last") {
      const me2 = players.find((p) => p.id === meId) || {};
      const first = key === "name" ? val : (me2 as any).name;
      const last = key === "last" ? val : (me2 as any).last;
      const full = [first, last].filter(Boolean).join(" ").trim();
      if (full) updateMyPublicProfile({ display_name: full }).catch((e) => console.warn("Couldn't update the public name", e));
    }
  };
  // Brief item 2: organisers set levels. You pick your own once, while you
  // have none; an organiser's own goes through the organiser door like
  // anybody else's; everyone else asks. Friendlies have no organisers.
  const setLevel = (cat, sub) => {
    const level = cat ? { cat, sub: sub || "Medium" } : null;
    if (canSetLevels && onSetLevel) { onSetLevel(meId, level).catch(() => {}); return; }
    setPlayers(players.map((p) => p.id === meId ? { ...p, level } : p));
  };
  const mayPick = friendly || canSetLevels || !me.level;
  const L = ({ children }: any) => <div style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: MUTED, margin: "14px 0 5px" }}>{children}</div>;
  const onPickPhoto = async (file: File) => {
    try {
      const dataUrl = await readPhotoAsDataUrl(file, PHOTO_SIZE);
      setField("avatarUrl", dataUrl);
    } catch {
      flash && flash("Couldn't read that photo — try a different one (HEIC photos from iPhone sometimes don't work; try a JPEG or screenshot)");
    }
  };
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Avatar player={me} size={44} enlargeable />
        <div>
          <div style={{ fontFamily: body, fontSize: 19, fontWeight: 800, color: CHALK }}>{me.name}{me.nick ? " \u201C" + me.nick + "\u201D" : ""}{me.last ? " " + me.last : ""}</div>
          <div style={{ fontFamily: body, fontSize: 12, color: MUTED }}>This is how you appear to everyone.</div>
        </div>
      </div>
      <L>Profile picture</L>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickPhoto(f); e.target.value = ""; }} />
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => fileRef.current?.click()} style={{ ...miniInput, cursor: "pointer", color: BALL, textAlign: "center" as const }}>{me.avatarUrl ? "Change photo" : "Upload from camera roll"}</button>
        {me.avatarUrl && <button onClick={() => setField("avatarUrl", null)} style={{ ...miniInput, cursor: "pointer", flex: "0 0 auto", padding: "8px 11px", color: MUTED }}>Remove</button>}
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
      {!mayPick ? (
        <>
          <div style={{ fontFamily: body, fontSize: 15, color: CHALK }}>{me.level.cat} · {me.level.sub}</div>
          {onAskLevel && <LevelRequestForm current={me.level} pending={pendingRequest} onAsk={onAskLevel} />}
        </>
      ) : (
      <div style={{ display: "flex", gap: 6 }}>
        <select value={me.level?.cat || ""} onChange={(e) => setLevel(e.target.value, me.level?.sub)} style={{ ...miniInput, flex: 2, boxSizing: "border-box" as const }}><option value="">No level</option>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select>
        <select value={me.level?.sub || "Medium"} disabled={!me.level} onChange={(e) => setLevel(me.level?.cat, e.target.value)} style={{ ...miniInput, flex: 1, opacity: me.level ? 1 : 0.4, boxSizing: "border-box" as const }}>{SUBS.map((x) => <option key={x} value={x}>{x}</option>)}</select>
      </div>
      )}
      {mayPick && !me.level && !canSetLevels && !friendly && (
        <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, lineHeight: 1.5, marginTop: 6 }}>Pick carefully: after this, only the organisers can change it.</div>
      )}
      <L>Starting rating &amp; record</L>
      {friendly || onSetStart ? (
        <StartRecordEditor player={me} fieldStyle={{ ...miniInput, boxSizing: "border-box" as const }}
          onSave={friendly
            ? async (elo, record) => { setPlayers(players.map((p) => p.id === meId ? { ...p, initialElo: elo ?? undefined, initialRecord: record ?? undefined } : p)); }
            : (elo, record) => onSetStart(meId, elo, record)} />
      ) : (
        // Locked like the level (Sam, 2026-10-21): it counts in the ratings,
        // so it is the organisers' to set. Shown, so nobody wonders where it went.
        <div style={{ fontFamily: body, fontSize: 15, color: CHALK, lineHeight: 1.5 }}>
          {startSummary(me) || "None carried in."}
          <div style={{ fontSize: 12.5, color: MUTED }}>Set by the organisers. Ask one if it&apos;s wrong.</div>
        </div>
      )}
      {!friendly && <EmailsToggle flash={flash} />}
      <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, marginTop: 16, lineHeight: 1.4 }}>Changes save straight away. Only club owners can edit other players or club settings.</div>
      <DeleteAccount played={played} />
    </div>
  );
}
