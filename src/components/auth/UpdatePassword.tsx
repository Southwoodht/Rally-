"use client";
import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { COURT, PANEL, PANEL2, CHALK, BALL, CLAY, MUTED, LINE, display, body, mono } from "@/lib/theme";

export default function UpdatePassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const field: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", background: PANEL2, border: "none",
    borderRadius: 14, padding: "13px 14px", color: CHALK, fontFamily: body, fontSize: 15,
    marginBottom: 10, outline: "none",
  };
  const primary: React.CSSProperties = {
    width: "100%", background: BALL, color: COURT, border: "none", borderRadius: 14,
    padding: "14px 16px", fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: 1,
    textTransform: "uppercase", cursor: "pointer",
  };

  const submit = async () => {
    setError("");
    if (!password || password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true);
    const { error } = await supabase!.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    onDone();
  };

  return (
    <div style={{ minHeight: "100vh", background: COURT, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: display, fontSize: 54, fontWeight: 800, color: BALL, textTransform: "uppercase", letterSpacing: -1, lineHeight: 1 }}>Rally</div>
        </div>
        <div style={{ background: PANEL, border: "none", borderRadius: 16, padding: 20 }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>
            Set a new password
          </div>
          <input style={field} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" type="password" autoComplete="new-password" />
          <input style={field} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" type="password" autoComplete="new-password" />
          {error && <div style={{ fontFamily: body, fontSize: 13, color: CLAY, marginBottom: 10 }}>{error}</div>}
          <button style={{ ...primary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={submit}>
            {busy ? "Saving…" : "Save new password"}
          </button>
        </div>
      </div>
    </div>
  );
}
