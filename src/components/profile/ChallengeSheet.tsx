"use client";
import React, { useState } from "react";
import { VenuePicker } from "@/components/games/VenuePicker";
import { CrossedRackets } from "@/components/ui/CrossedRackets";
import { DEFAULT_DURATION_MINUTES, DURATION_CHOICES } from "@/core/booking";
import { useColumnReady } from "@/lib/utrReady";
import { venueLabel, type Venue } from "@/lib/venues";
import { formatMatchDateTime } from "@/lib/format";
import { Check } from "lucide-react";
import { FEED_LIME, FEED_LIME_INK, FEED_OVERLAY, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, PANEL, body, miniInput } from "@/lib/theme";

/**
 * Challenge, right where you are (Sam, 2026-10-25: it used to jump to Home,
 * then the profile, then Fixtures, and never quite challenge). Pick when,
 * how long and where, Send — the booking is made, they get "Sam has
 * challenged you for a game — Mon 26 Oct · 5:00pm at Seacourt" by email when
 * they have an account, and you stay on their profile.
 */
export function ChallengeSheet({ name, hasAccount, homeVenue, onSend, onClose }: {
  name: string;
  hasAccount: boolean;
  homeVenue: Venue | null;
  onSend: (whenIso: string, mins: number | undefined, venue: Venue | null) => Promise<boolean | void>;
  onClose: () => void;
}) {
  const [when, setWhen] = useState("");
  const [mins, setMins] = useState(DEFAULT_DURATION_MINUTES);
  const [venue, setVenue] = useState<Venue | null>(homeVenue);
  const [busy, setBusy] = useState(false);
  // Sam: "can it have a Sent, just so I know it went through". The sheet
  // stays open on a confirmation rather than vanishing behind a toast.
  const [sent, setSent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const venueReady = useColumnReady("fixtures", "venue");
  const first = (name || "them").split(" ")[0];

  const fld: React.CSSProperties = { ...miniInput, fontFamily: body, fontSize: 15, background: FEED_RAISED, color: FEED_TEXT_HI, padding: "11px 12px", width: "100%", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontFamily: body, fontWeight: 600, fontSize: 13, color: FEED_TEXT_MID, margin: "14px 0 7px" };

  const send = async () => {
    if (!when || busy) return;
    setBusy(true); setFailed(false);
    const iso = new Date(when).toISOString();
    const v = venueReady ? venue : null;
    const ok = await onSend(iso, mins !== DEFAULT_DURATION_MINUTES ? mins : undefined, v);
    setBusy(false);
    if (ok === false) { setFailed(true); return; }
    setSent([formatMatchDateTime(iso), v ? venueLabel(v) : null].filter(Boolean).join(" at "));
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: FEED_OVERLAY, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 125 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: PANEL, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: "18px 16px 34px", boxSizing: "border-box" }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: "10px 4px 0" }}>
            <div style={{ width: 64, height: 64, borderRadius: 999, background: FEED_LIME, color: FEED_LIME_INK, display: "grid", placeItems: "center", margin: "0 auto" }}>
              <Check size={34} strokeWidth={3} />
            </div>
            <div style={{ fontFamily: body, fontWeight: 700, fontSize: 21, color: FEED_TEXT_HI, marginTop: 14 }}>Challenge sent</div>
            <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, marginTop: 6 }}>{sent}</div>
            <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, marginTop: 8 }}>
              {hasAccount ? `${first} has been emailed. It's in Fixtures for both of you.` : `It's in Fixtures for both of you. ${first} hasn't got an account, so tell them yourself.`}
            </div>
            <button onClick={onClose} style={{ width: "100%", marginTop: 18, border: "none", borderRadius: 12, padding: "13px", cursor: "pointer", fontFamily: body, fontWeight: 700, fontSize: 15.5, background: FEED_RAISED, color: FEED_TEXT_HI }}>Done</button>
          </div>
        ) : (<>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: FEED_TEXT_HI, display: "grid" }}><CrossedRackets size={24} /></span>
          <span style={{ flex: 1, fontFamily: body, fontWeight: 700, fontSize: 19, color: FEED_TEXT_HI }}>Challenge {first}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: FEED_TEXT_MID, fontFamily: body, fontSize: 14, cursor: "pointer" }}>Close</button>
        </div>

        <div style={lbl}>When</div>
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={fld} />

        {when && (
          <>
            <div style={lbl}>How long</div>
            <div style={{ display: "flex", gap: 6 }}>
              {DURATION_CHOICES.map((m) => (
                <button key={m} onClick={() => setMins(m)} style={{ flex: 1, border: "none", borderRadius: 10, padding: "9px 6px", cursor: "pointer", fontFamily: body, fontWeight: 600, fontSize: 13.5, background: mins === m ? FEED_LIME : FEED_RAISED, color: mins === m ? FEED_LIME_INK : FEED_TEXT_MID }}>
                  {m === 60 ? "1 hour" : m === 90 ? "1½ hours" : m / 60 + " hours"}
                </button>
              ))}
            </div>
          </>
        )}

        {venueReady && (
          <>
            <div style={lbl}>Where</div>
            <VenuePicker value={venue} onChange={setVenue} home={homeVenue} />
          </>
        )}

        <button onClick={send} disabled={!when || busy} style={{ width: "100%", marginTop: 18, border: "none", borderRadius: 12, padding: "13px", cursor: when ? "pointer" : "default", fontFamily: body, fontWeight: 700, fontSize: 15.5, background: FEED_LIME, color: FEED_LIME_INK, opacity: !when || busy ? 0.45 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <CrossedRackets size={18} />{busy ? "Sending…" : "Send challenge"}
        </button>
        {failed && (
          <div style={{ fontFamily: body, fontWeight: 600, fontSize: 13.5, color: FEED_TEXT_HI, marginTop: 10, textAlign: "center" }}>
            That didn&apos;t send. Check your signal and try again.
          </div>
        )}
        <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_LOW, lineHeight: 1.5, marginTop: 10, textAlign: "center" }}>
          {hasAccount ? `${first} gets an email with the time${venueReady ? " and place" : ""}.` : `${first} hasn't got an account, so tell them yourself. It's in Fixtures for both of you.`}
        </div>
        </>)}
      </div>
    </div>
  );
}
