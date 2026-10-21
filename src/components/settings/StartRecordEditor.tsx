"use client";
import React, { useState } from "react";
import { BALL, FEED_LIME_INK, MUTED, body } from "@/lib/theme";

/**
 * A starting rating and a carried-in W-D-L, saved with one button.
 *
 * Organisers only (schema_starting_record_organisers.sql), so the save goes
 * through set_player_start — one request when they are done typing, not one
 * per keystroke, which is what the old My profile fields did.
 */
export function StartRecordEditor({ player, fieldStyle, onSave }: {
  player: any;
  fieldStyle: React.CSSProperties;
  onSave: (elo: number | null, record: { w: number; d: number; l: number } | null) => Promise<void>;
}) {
  const num = (v: any) => (v == null || v === "" ? "" : String(v));
  const [elo, setElo] = useState(num(player.initialElo));
  const [w, setW] = useState(num(player.initialRecord?.w || ""));
  const [d, setD] = useState(num(player.initialRecord?.d || ""));
  const [l, setL] = useState(num(player.initialRecord?.l || ""));
  const [busy, setBusy] = useState(false);
  const digits = (s: string) => s.replace(/[^0-9]/g, "");
  const dirty = elo !== num(player.initialElo) || w !== num(player.initialRecord?.w || "") || d !== num(player.initialRecord?.d || "") || l !== num(player.initialRecord?.l || "");
  const save = async () => {
    setBusy(true);
    try {
      const anyRecord = w !== "" || d !== "" || l !== "";
      await onSave(elo === "" ? null : Number(elo), anyRecord ? { w: Number(w) || 0, d: Number(d) || 0, l: Number(l) || 0 } : null);
    } catch { /* the caller has said why */ } finally { setBusy(false); }
  };
  const f = { ...fieldStyle, flex: 1, minWidth: 0 };
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <input value={elo} onChange={(e) => setElo(digits(e.target.value))} inputMode="numeric" placeholder="Starting rating" style={f} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={w} onChange={(e) => setW(digits(e.target.value))} inputMode="numeric" placeholder="Wins" style={f} />
        <input value={d} onChange={(e) => setD(digits(e.target.value))} inputMode="numeric" placeholder="Draws" style={f} />
        <input value={l} onChange={(e) => setL(digits(e.target.value))} inputMode="numeric" placeholder="Losses" style={f} />
      </div>
      {dirty && (
        <button onClick={save} disabled={busy} style={{ marginTop: 8, background: BALL, color: FEED_LIME_INK, border: "none", borderRadius: 10, padding: "9px 14px", fontFamily: body, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Saving…" : "Save starting record"}
        </button>
      )}
      <div style={{ fontFamily: body, fontSize: 12, color: MUTED, lineHeight: 1.45, marginTop: 6 }}>
        Results from before the club used Southwood. They count in the ratings, so only organisers set them.
      </div>
    </div>
  );
}
