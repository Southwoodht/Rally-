"use client";
import React, { useState } from "react";
import { LEVELS, SUBS } from "@/core/constants";
import { BALL, CHALK, MUTED, body, miniInput } from "@/lib/theme";

/**
 * "Ask the organisers for a change" — brief item 2. Once a player has a
 * level, only organisers change it; this is how a player says they think it
 * is wrong. One request waits at a time, and it says so while it waits.
 */
export function LevelRequestForm({ current, pending, onAsk }: {
  current: { cat: string; sub: string } | null;
  /** Their request waiting with the organisers, if any. */
  pending: { level: { cat: string; sub: string } } | null;
  onAsk: (level: { cat: string; sub: string }, note: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(current?.cat || LEVELS[0]);
  const [sub, setSub] = useState(current?.sub || "Medium");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const line: React.CSSProperties = { fontFamily: body, fontSize: 12, color: MUTED, lineHeight: 1.5, marginTop: 6 };
  if (pending) {
    return <div style={line}>You asked for {pending.level.cat} · {pending.level.sub}. The organisers will look at it.</div>;
  }
  if (!open) {
    return (
      <div style={line}>
        Only the organisers change levels.{" "}
        <button onClick={() => setOpen(true)} style={{ background: "none", border: "none", padding: 0, color: BALL, fontFamily: body, fontSize: 12, cursor: "pointer" }}>Ask for a change</button>
      </div>
    );
  }
  const same = current && current.cat === cat && current.sub === sub;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ ...miniInput, flex: 2, boxSizing: "border-box" as const }}>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select>
        <select value={sub} onChange={(e) => setSub(e.target.value)} style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }}>{SUBS.map((x) => <option key={x} value={x}>{x}</option>)}</select>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why? (optional) e.g. beat two Advanced players this month" style={{ ...miniInput, width: "100%", marginTop: 6, boxSizing: "border-box" as const }} />
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button
          disabled={busy || !!same}
          onClick={async () => {
            setBusy(true); setErr(null);
            try { await onAsk({ cat, sub }, note); setOpen(false); } catch (e: any) { setErr(e?.message || "Couldn't send that."); }
            setBusy(false);
          }}
          style={{ ...miniInput, flex: 1, cursor: same ? "default" : "pointer", color: same ? MUTED : BALL, textAlign: "center" as const }}
        >
          {busy ? "Sending…" : same ? "That's your level now" : "Send to the organisers"}
        </button>
        <button onClick={() => setOpen(false)} style={{ ...miniInput, cursor: "pointer", color: CHALK, textAlign: "center" as const }}>Cancel</button>
      </div>
      {err && <div style={{ ...line, color: "var(--danger)" }}>{err}</div>}
    </div>
  );
}
