"use client";
import React, { useState } from "react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { supabase } from "@/lib/supabase";
import {
  FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, FEED_THEY_LEAD, body,
} from "@/lib/theme";

// Your account, and the way out of it.
//
// Sam, 2026-09-23: "oh big thing we don't have... a log out button."
//
// There WAS one, which is worse than there not being one — it sat on the
// league-picker screen, so the way to log out was to leave the league you
// were in first. From inside the app, which is where you spend every second
// of using Rally, there was no route to it at all. A control you can only
// reach by navigating away from everything is a control nobody will find,
// and Sam did not.
//
// Settings is where people look, so it goes at the foot of Settings. Not on
// Profile, which is the player rather than the account, and not in the header,
// where it would sit one mis-tap from everything else.
//
// ONE TAP. It shipped with a confirm step, on the reasoning that a mis-tap
// costs you a password hunt — and Sam's answer was "must be a simple log out
// button", which is the right call and the one the app already makes
// elsewhere. §3's two-step rule is for things that cannot be undone; logging
// out destroys nothing and the undo is signing back in. A confirm on it is
// ceremony, and ceremony on a safe action teaches people to tap through
// confirms on the unsafe ones.
//
// No navigation afterwards, deliberately. AuthGate subscribes to
// onAuthStateChange, so signing out unmounts the whole app and shows the sign
// -in screen on its own. Anything this component did with the route would be
// a second opinion about where to go, arriving at the same time.

export function AccountCard({ displayName }: { displayName?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const out = async () => {
    setBusy(true); setFailed(null);
    try {
      const { error } = (await supabase?.auth.signOut()) || {};
      if (error) throw error;
      // No setBusy(false): the tree is about to be unmounted by AuthGate, and
      // flicking the button back to its resting state on the way out would be
      // a frame of "nothing happened".
    } catch (e: any) {
      setFailed(e?.message || "Couldn't log out just now.");
      setBusy(false);
    }
  };

  return (
    <SurfaceCard radius={16} pad="14px" style={{ marginTop: 18 }}>
      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
        Account
      </div>

      {displayName && (
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, marginBottom: 12, lineHeight: 1.45 }}>
          Signed in as <span style={{ color: FEED_TEXT_HI }}>{displayName}</span>.
        </div>
      )}

      <button
        onClick={out}
        disabled={busy}
        style={{
          display: "block", width: "100%", fontFamily: body, fontWeight: 500, fontSize: 15,
          padding: "12px 14px", borderRadius: 12, border: "none",
          cursor: busy ? "default" : "pointer",
          background: FEED_RAISED, color: FEED_THEY_LEAD, opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Logging out…" : "Log out"}
      </button>

      {failed && (
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_THEY_LEAD, lineHeight: 1.45, marginTop: 10 }}>
          {failed}
        </div>
      )}
    </SurfaceCard>
  );
}
