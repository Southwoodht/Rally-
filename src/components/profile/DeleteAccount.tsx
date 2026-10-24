"use client";
import React, { useState } from "react";
import { supabase, withSupabaseTimeout } from "@/lib/supabase";
import { DOT_LOSS, FEED_CARD, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, body } from "@/lib/theme";

/**
 * Delete my account (Sam, 2026-10-24), at the foot of My profile.
 *
 * Two steps, and the confirm says what goes and what stays, with the number:
 * the results stay as "Former player" because every one of them is also
 * somebody else's match. The work is done server-side by /api/account/delete,
 * which refuses — changing nothing — if this person created a club nobody
 * else owns.
 */
export function DeleteAccount({ played }: { played: number }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const go = async () => {
    if (!supabase) return;
    setBusy(true); setProblem("");
    try {
      const s: any = await withSupabaseTimeout(supabase.auth.getSession(), { data: { session: null } } as any);
      const token = s?.data?.session?.access_token;
      if (!token) throw new Error("Please sign in again first.");
      const res = await fetch("/api/account/delete", { method: "POST", headers: { authorization: "Bearer " + token } });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.message || "Couldn't delete your account. Nothing was deleted.");
      try { localStorage.clear(); } catch { /* nothing to keep */ }
      await supabase.auth.signOut().catch(() => {});
      window.location.href = "/";
    } catch (e: any) {
      setProblem(e?.message || "Couldn't delete your account. Nothing was deleted.");
      setBusy(false);
    }
  };

  const results = played === 1 ? "1 result" : `${played} results`;
  return (
    <div style={{ marginTop: 26 }}>
      {step === 0 ? (
        <button onClick={() => setStep(1)} style={{ background: "none", border: "none", padding: "8px 0", color: DOT_LOSS, fontFamily: body, fontSize: 14, cursor: "pointer" }}>
          Delete my account
        </button>
      ) : (
        <div style={{ background: FEED_CARD, borderRadius: 14, padding: 14 }}>
          <div style={{ fontFamily: body, fontSize: 14, color: FEED_TEXT_HI, lineHeight: 1.5, marginBottom: 6 }}>
            Delete your account?
          </div>
          <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, marginBottom: 12 }}>
            {played ? `Your ${results} here stay in the club as "Former player", so nobody else's rating changes. ` : ""}
            Your name, email, photo, messages and friends are removed, in every club. This cannot be undone.
          </div>
          {problem && <div style={{ fontFamily: body, fontSize: 13, color: DOT_LOSS, lineHeight: 1.45, marginBottom: 10 }}>{problem}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={go} disabled={busy} style={{ flex: 1, background: DOT_LOSS, color: FEED_LIME_INK, border: "none", borderRadius: 10, padding: "11px 8px", fontFamily: body, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
              {busy ? "Deleting…" : "Delete for good"}
            </button>
            <button onClick={() => { setStep(0); setProblem(""); }} disabled={busy} style={{ flex: 1, background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 10, padding: "11px 8px", fontFamily: body, fontSize: 14, cursor: "pointer" }}>
              Keep it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
