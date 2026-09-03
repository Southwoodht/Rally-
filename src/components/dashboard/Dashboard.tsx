"use client";
import React, { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { listMyLeagues, createLeague, joinLeague, leagueSizes, leaveLeague, League } from "@/lib/leagues";
import { COURT, PANEL, PANEL2, CHALK, BALL, CLAY, MUTED, LINE, display, body, mono } from "@/lib/theme";
import RallyApp from "@/components/RallyApp";

type View = "loading" | "empty" | "create" | "join" | "picker" | "app";

export default function Dashboard({ session }: { session: Session }) {
  const [view, setView] = useState<View>("loading");
  const [leagues, setLeagues] = useState<League[]>([]);
  const [active, setActive] = useState<League | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [code, setCode] = useState("");

  const displayName =
    (session.user.user_metadata as any)?.full_name ||
    session.user.email?.split("@")[0] ||
    "player";

  const [sizes, setSizes] = useState<Record<string, { players: number; matches: number }>>({});
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null);

  const load = async () => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('__dev_auto') === '1') {
      // dev auto mode — skip Supabase league listing so the debug league remains active
      return;
    }
    try {
      const mine = await listMyLeagues();
      setLeagues(mine);
      // Only worth asking when there's a choice to make.
      if (mine.length > 1) leagueSizes(mine.map((l) => l.id)).then(setSizes).catch(() => {});
      if (mine.length === 1) { setActive(mine[0]); setView("app"); }
      else if (mine.length > 1) setView("picker");
      else setView("empty");
    } catch (e: any) {
      setError(e.message || "Couldn't load your leagues.");
      setView("empty");
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  // If running in dev with ?__dev_auto=1, mount a debug league immediately
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('__dev_auto') === '1') {
      setActive({ id: 'g_debug', name: 'Dev League', join_code: 'DBG', created_by: 'dev-user', role: 'owner' } as any);
      setView('app');
    }
  }, []);

  const doCreate = async () => {
    setError("");
    if (!name.trim()) { setError("Give the league a name."); return; }
    setBusy(true);
    try {
      const l = await createLeague(name, location);
      setName(""); setLocation("");
      setLeagues((prev) => [...prev, l]);
      setActive(l); setView("app");
    } catch (e: any) { setError(e.message || "Couldn't create the league."); }
    setBusy(false);
  };

  const doJoin = async () => {
    setError("");
    setBusy(true);
    try {
      const l = await joinLeague(code);
      setCode("");
      setLeagues((prev) => prev.some((x) => x.id === l.id) ? prev : [...prev, l]);
      setActive(l); setView("app");
    } catch (e: any) { setError(e.message || "Couldn't join that league."); }
    setBusy(false);
  };

  const field: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", background: PANEL2, border: "none",
    borderRadius: 14, padding: "13px 14px", color: CHALK, fontFamily: body, fontSize: 15,
    marginBottom: 10, outline: "none",
  };
  const primary: React.CSSProperties = {
    width: "100%", background: BALL, color: COURT, border: "none", borderRadius: 14,
    padding: "14px 16px", fontFamily: body, fontSize: 15, fontWeight: 600,
    cursor: "pointer",
  };
  const ghost: React.CSSProperties = {
    ...primary, background: "transparent", color: MUTED, border: "none", fontSize: 13, marginTop: 8,
  };
  const tile: React.CSSProperties = {
    flex: 1, background: PANEL, border: "none", borderRadius: 14,
    padding: "22px 16px", cursor: "pointer", textAlign: "left",
  };

  if (view === "app" && active) {
    return (
      <div>
        <div style={{ background: PANEL, borderBottom: "none", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: body, fontSize: 16, fontWeight: 700, color: CHALK }}>{active.name}</div>
            <div style={{ fontFamily: body, fontSize: 12, color: MUTED }}>Code <span style={{ fontFamily: mono }}>{active.join_code}</span></div>
          </div>
          <button onClick={() => setView(leagues.length > 1 ? "picker" : "empty")} style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: MUTED, background: "transparent", border: "none", borderRadius: 12, padding: "7px 10px", cursor: "pointer" }}>Leagues</button>
        </div>
        <RallyApp leagueId={active.id} leagueName={active.name} leagueRole={active.role} leagueJoinCode={active.join_code} displayName={displayName} />
      </div>
    );
  }

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: COURT, padding: "22px 18px 40px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: display, fontSize: 34, fontWeight: 800, color: BALL, textTransform: "uppercase", letterSpacing: -0.5, lineHeight: 1 }}>Rally</div>
            <div style={{ fontFamily: body, fontSize: 13.5, color: MUTED, marginTop: 6 }}>Welcome, {displayName}.</div>
          </div>
          <button onClick={() => supabase?.auth.signOut()} style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: MUTED, background: "transparent", border: "none", borderRadius: 12, padding: "7px 10px", cursor: "pointer" }}>Log out</button>
        </div>
        {error && <div style={{ fontFamily: body, fontSize: 13, color: CLAY, marginBottom: 12 }}>{error}</div>}
        {children}
        <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 30, textAlign: "center" }}>Rally v1.0 Foundation</div>
      </div>
    </div>
  );

  if (view === "loading") return shell(
    <div style={{ fontFamily: body, fontSize: 14, color: MUTED, textAlign: "center", padding: 30 }}>Loading…</div>
  );

  if (view === "create") return shell(
    <div style={{ background: PANEL, border: "none", borderRadius: 14, padding: 20 }}>
      <div style={{ fontFamily: body, fontWeight: 700, fontSize: 16, color: CHALK, marginBottom: 14 }}>Create a league</div>
      <input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="League name, e.g. Seacourt Ladder" />
      <input style={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" />
      <button style={{ ...primary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={doCreate}>{busy ? "Creating…" : "Create league"}</button>
      <button style={ghost} onClick={() => { setError(""); setView(leagues.length ? "picker" : "empty"); }}>Back</button>
    </div>
  );

  if (view === "join") return shell(
    <div style={{ background: PANEL, border: "none", borderRadius: 14, padding: 20 }}>
      <div style={{ fontFamily: body, fontWeight: 700, fontSize: 16, color: CHALK, marginBottom: 14 }}>Join a league</div>
      <input style={{ ...field, fontFamily: mono, letterSpacing: 3, textTransform: "uppercase" }} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={8} />
      <button style={{ ...primary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={doJoin}>{busy ? "Joining…" : "Join league"}</button>
      <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 12, lineHeight: 1.5 }}>Ask whoever set the league up for the code — it&apos;s shown at the top of their screen.</div>
      <button style={ghost} onClick={() => { setError(""); setView(leagues.length ? "picker" : "empty"); }}>Back</button>
    </div>
  );

  if (view === "picker") return shell(
    <div>
      <div style={{ fontFamily: body, fontWeight: 700, fontSize: 16, color: CHALK, marginBottom: 10 }}>Your leagues</div>
      {/* Several leagues can end up with the same name — created once each
          time somebody tapped Create while setting things up. The counts are
          what tell them apart, so they're shown before there's any chance to
          leave the wrong one. */}
      {leagues.map((l) => {
        const n = sizes[l.id];
        const empty = n && !n.players && !n.matches;
        return (
          <div key={l.id} style={{ ...tile, width: "100%", marginBottom: 8, display: "block", boxSizing: "border-box" as const }}>
            <button onClick={() => { setActive(l); setView("app"); }} style={{ display: "block", width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
              <div style={{ fontFamily: body, fontSize: 17, fontWeight: 700, color: CHALK }}>{l.name}</div>
              <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 3 }}>{l.location ? l.location + " · " : ""}Code <span style={{ fontFamily: mono }}>{l.join_code}</span>{l.role === "owner" ? " · Owner" : ""}</div>
              {n && (
                <div style={{ fontFamily: body, fontSize: 12.5, fontWeight: 600, color: empty ? CLAY : MUTED, marginTop: 4 }}>
                  {empty ? "Empty — nothing in it" : n.players + " player" + (n.players === 1 ? "" : "s") + " · " + n.matches + " match" + (n.matches === 1 ? "" : "es")}
                </div>
              )}
            </button>
            {leagues.length > 1 && (
              confirmLeave === l.id ? (
                <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
                  <div style={{ fontFamily: body, fontSize: 12.5, color: CHALK, lineHeight: 1.45, marginBottom: 8 }}>
                    Leave <strong>{l.name}</strong>? It stays exactly as it is — this only takes it off your list, and code <span style={{ fontFamily: mono }}>{l.join_code}</span> gets you back in.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={async () => { try { await leaveLeague(l.id); setConfirmLeave(null); await load(); } catch (e: any) { setError(e.message || "Couldn't leave."); } }} style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: COURT, background: CLAY, border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>Leave</button>
                    <button onClick={() => setConfirmLeave(null)} style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: MUTED, background: "transparent", border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmLeave(l.id)} style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: MUTED, background: "transparent", border: "none", padding: "8px 0 0", cursor: "pointer" }}>Leave this league</button>
              )
            )}
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button style={tile} onClick={() => { setError(""); setView("create"); }}><div style={{ fontFamily: body, fontSize: 15, fontWeight: 600, color: CHALK }}>➕ Create</div></button>
        <button style={tile} onClick={() => { setError(""); setView("join"); }}><div style={{ fontFamily: body, fontSize: 15, fontWeight: 600, color: CHALK }}>🔑 Join</div></button>
      </div>
    </div>
  );

  return shell(
    <>
      <div style={{ background: PANEL2, border: "none", borderRadius: 14, padding: 20, marginBottom: 18, textAlign: "center" }}>
        <div style={{ fontSize: 30 }}>🎾</div>
        <div style={{ fontFamily: body, fontSize: 19, fontWeight: 700, color: CHALK, marginTop: 8 }}>No leagues yet</div>
        <div style={{ fontFamily: body, fontSize: 13.5, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>Start one for your club or mates, or join an existing league with a code.</div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button style={tile} onClick={() => { setError(""); setView("create"); }}>
          <div style={{ fontSize: 20 }}>➕</div>
          <div style={{ fontFamily: body, fontSize: 16, fontWeight: 700, color: CHALK, marginTop: 8 }}>Create league</div>
          <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, marginTop: 4, lineHeight: 1.4 }}>Set up a ladder and invite players.</div>
        </button>
        <button style={tile} onClick={() => { setError(""); setView("join"); }}>
          <div style={{ fontSize: 20 }}>🔑</div>
          <div style={{ fontFamily: body, fontSize: 16, fontWeight: 700, color: CHALK, marginTop: 8 }}>Join league</div>
          <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, marginTop: 4, lineHeight: 1.4 }}>Enter a code from the organiser.</div>
        </button>
      </div>
    </>
  );
}
