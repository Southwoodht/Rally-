"use client";
import React, { useEffect, useState } from "react";
import { loadEmailsOn, saveEmailsOn } from "@/lib/emailPrefs";
import { BALL, CHALK, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_MID, MUTED, body } from "@/lib/theme";

/**
 * "Emails" on My profile (winter brief item 6: "players can turn emails off
 * in their profile"). Not drawn at all until the setting has been read, so it
 * never shows a state it doesn't know — and not at all if it can't be read,
 * which is what a database without schema_email.sql looks like.
 */
export function EmailsToggle({ flash }: { flash?: (m: string) => void }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadEmailsOn().then(setOn).catch(() => setOn(null)); }, []);
  if (on === null) return null;
  const flip = async () => {
    const next = !on;
    // Optimistic: the switch moves at once and moves back if the save fails.
    setOn(next); setBusy(true);
    try { await saveEmailsOn(next); flash?.(next ? "Emails on" : "Emails off"); }
    catch (e: any) { setOn(!next); flash?.(e?.message || "Couldn't save that."); }
    setBusy(false);
  };
  return (
    <button onClick={flip} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: FEED_RAISED, border: "none", borderRadius: 14, padding: "12px 14px", cursor: "pointer", marginTop: 14, textAlign: "left" }}>
      <span>
        <span style={{ display: "block", fontFamily: body, fontSize: 15, color: CHALK }}>Emails</span>
        <span style={{ display: "block", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>Challenges, bookings, result reminders and deadlines.</span>
      </span>
      <span style={{ width: 44, height: 26, borderRadius: 13, background: on ? BALL : MUTED, position: "relative", flexShrink: 0, marginLeft: 10, transition: "background-color 150ms ease-out" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, transition: "left 180ms cubic-bezier(0.25, 1.1, 0.4, 1.15)", width: 20, height: 20, borderRadius: 10, background: on ? FEED_LIME_INK : CHALK }} />
      </span>
    </button>
  );
}
