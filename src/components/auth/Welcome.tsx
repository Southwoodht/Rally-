"use client";
import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { COURT, PANEL, PANEL2, CHALK, BALL, CLAY, MUTED, LINE, display, body, mono } from "@/lib/theme";

type Mode = "welcome" | "signup" | "login" | "reset";

export default function Welcome() {
  const [mode, setMode] = useState<Mode>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
  const secondary: React.CSSProperties = {
    ...primary, background: "transparent", color: CHALK, border: "none", marginTop: 10,
  };

  const reset = () => { setError(""); setNotice(""); };

  const signUp = async () => {
    reset();
    if (!email || !password) { setError("Email and password are required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setBusy(true);
    const { data, error } = await supabase!.auth.signUp({
      email, password, options: { data: { full_name: name || null } },
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    if (data.session) return;             // logged straight in
    setNotice("Check your email to confirm your account, then log in.");
  };

  const logIn = async () => {
    reset();
    if (!email || !password) { setError("Email and password are required."); return; }
    setBusy(true);
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
  };

  const sendReset = async () => {
    reset();
    if (!email) { setError("Enter your email first."); return; }
    setBusy(true);
    const { error } = await supabase!.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setNotice("Check your email for a link to reset your password.");
  };

  return (
    <div style={{ minHeight: "100vh", background: COURT, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: display, fontSize: 54, fontWeight: 800, color: BALL, textTransform: "uppercase", letterSpacing: -1, lineHeight: 1 }}>Rally</div>
          <div style={{ fontFamily: body, fontSize: 14, color: MUTED, marginTop: 8 }}>Head-to-head rankings for racket sports.</div>
        </div>

        <div style={{ background: PANEL, border: "none", borderRadius: 16, padding: 20 }}>
          {mode === "welcome" && (
            <>
              <button style={primary} onClick={() => { reset(); setMode("signup"); }}>Create account</button>
              <button style={secondary} onClick={() => { reset(); setMode("login"); }}>Log in</button>
              <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 16, lineHeight: 1.5, textAlign: "center" }}>
                Your matches, rankings and history stay tied to your account — on any device, forever.
              </div>
            </>
          )}

          {(mode === "signup" || mode === "login") && (
            <>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>
                {mode === "signup" ? "Create your account" : "Welcome back"}
              </div>

              {mode === "signup" && (
                <input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
              )}
              <input style={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" inputMode="email" />
              <input style={field} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} />

              {error && <div style={{ fontFamily: body, fontSize: 13, color: CLAY, marginBottom: 10 }}>{error}</div>}
              {notice && <div style={{ fontFamily: body, fontSize: 13, color: BALL, marginBottom: 10 }}>{notice}</div>}

              <button style={{ ...primary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={mode === "signup" ? signUp : logIn}>
                {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
              </button>

              {mode === "login" && (
                <button
                  style={{ ...secondary, background: "transparent", border: "none", color: MUTED, fontSize: 12, marginTop: 12 }}
                  onClick={() => { reset(); setPassword(""); setMode("reset"); }}
                >
                  Forgot password?
                </button>
              )}

              <button
                style={{ ...secondary, background: "transparent", border: "none", color: MUTED, fontSize: 12 }}
                onClick={() => { reset(); setMode(mode === "signup" ? "login" : "signup"); }}
              >
                {mode === "signup" ? "Already have an account? Log in" : "Need an account? Create one"}
              </button>
              <button
                style={{ ...secondary, background: "transparent", border: "none", color: MUTED, fontSize: 12, marginTop: 0 }}
                onClick={() => { reset(); setMode("welcome"); }}
              >
                Back
              </button>
            </>
          )}

          {mode === "reset" && (
            <>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>
                Reset your password
              </div>
              <div style={{ fontFamily: body, fontSize: 13, color: MUTED, marginBottom: 12, lineHeight: 1.5 }}>
                Enter the email on your account and we&apos;ll send you a link to set a new password.
              </div>
              <input style={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" inputMode="email" />

              {error && <div style={{ fontFamily: body, fontSize: 13, color: CLAY, marginBottom: 10 }}>{error}</div>}
              {notice && <div style={{ fontFamily: body, fontSize: 13, color: BALL, marginBottom: 10 }}>{notice}</div>}

              <button style={{ ...primary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={sendReset}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
              <button
                style={{ ...secondary, background: "transparent", border: "none", color: MUTED, fontSize: 12 }}
                onClick={() => { reset(); setMode("login"); }}
              >
                Back to log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
