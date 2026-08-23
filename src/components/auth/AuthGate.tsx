"use client";
import React, { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured, withSupabaseTimeout } from "@/lib/supabase";
import { COURT, PANEL, CHALK, BALL, MUTED, LINE, display, body, mono } from "@/lib/theme";
import Welcome from "@/components/auth/Welcome";
import UpdatePassword from "@/components/auth/UpdatePassword";
import Dashboard from "@/components/dashboard/Dashboard";

/**
 * Decides what the app shows:
 *   not configured  -> setup instructions
 *   no session      -> Welcome (create account / log in)
 *   session         -> Dashboard
 */
export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    // support a dev-only override to fake a session for end-to-end checks —
    // never live in production, so this can't become a public login bypass
    // on the deployed URL.
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('__dev_auto') === '1') {
      setSession({ user: { id: 'dev-user', email: 'dev@local', user_metadata: { full_name: 'Dev Tester' } } } as any);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured || !supabase) { setLoading(false); return; }

    const client = supabase;
    if (!client) { setLoading(false); return; }

    const loadSession = async () => {
      try {
        const { data } = await withSupabaseTimeout(client.auth.getSession(), { data: { session: null } } as any);
        setSession(data.session ?? null);
      } catch {
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
    const { data: sub } = client.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) return <SetupNeeded />;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: COURT, display: "grid", placeItems: "center" }}>
        <div style={{ fontFamily: mono, fontSize: 12, color: MUTED, letterSpacing: 2, textTransform: "uppercase" }}>Loading…</div>
      </div>
    );
  }

  if (recovery) return <UpdatePassword onDone={() => setRecovery(false)} />;

  return session ? <Dashboard session={session} /> : <Welcome />;
}

function SetupNeeded() {
  const code: React.CSSProperties = {
    fontFamily: mono, fontSize: 12, color: BALL, background: "rgba(0,0,0,.25)",
    padding: "10px 12px", borderRadius: 8, display: "block", marginTop: 8, whiteSpace: "pre-wrap",
  };
  return (
    <div style={{ minHeight: "100vh", background: COURT, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 460, background: PANEL, border: "1px solid " + LINE, borderRadius: 16, padding: 22 }}>
        <div style={{ fontFamily: display, fontSize: 30, fontWeight: 800, color: BALL, textTransform: "uppercase" }}>Rally</div>
        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: MUTED, margin: "10px 0 12px" }}>Setup needed</div>
        <div style={{ fontFamily: body, fontSize: 14, color: CHALK, lineHeight: 1.6 }}>
          Rally can&apos;t find your Supabase keys. Create a file called <strong>.env.local</strong> in the
          project folder with these two lines, then restart the dev server:
          <span style={code}>NEXT_PUBLIC_SUPABASE_URL=your-project-url{"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key</span>
          <div style={{ color: MUTED, fontSize: 12.5, marginTop: 12 }}>
            Both values are in your Supabase dashboard under Project Settings → API.
            The anon key is safe to use in the browser.
          </div>
        </div>
      </div>
    </div>
  );
}
