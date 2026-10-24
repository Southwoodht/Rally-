"use client";
import React, { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { BAD_INVITE, readJoinParam, stashPendingJoin, takePendingJoin } from "@/lib/invite";
import { FRIENDLY_LEAGUE_ID } from "@/lib/leagueData";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { listMyLeagues, createLeague, joinLeague, leagueSizes, leaveLeague, League } from "@/lib/leagues";
import { BALL, CHALK, CLAY, COURT, FEED_CARD, FEED_HERO, FEED_LIME, FEED_LIME_DIVIDER, FEED_LIME_INK, FEED_LIME_INK_2, FEED_ON_HERO, FEED_PAGE, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, FEED_THEY_LEAD, LINE, MUTED, PANEL, PANEL2, body, display, tabular } from "@/lib/theme";
import { greetingFor } from "@/lib/format";
import { ChevronRight, LogIn, Plus, Users } from "lucide-react";
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
  const [leaving, setLeaving] = useState(false);

  const load = async () => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('__dev_auto') === '1') {
      // dev auto mode — skip Supabase league listing so the debug league remains active
      return;
    }
    try {
      // "?league=friendly" — arriving from the switcher inside the app.
      // Checked before the league list, because somebody with exactly one
      // league is otherwise sent straight into it and never gets a choice.
      if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("league") === "friendly") {
        setActive({ id: FRIENDLY_LEAGUE_ID, name: "Friendlies" } as any);
        setView("app");
        return;
      }

      // A held invite is redeemed once, before the league list decides what
      // to show — otherwise somebody arriving on a link gets dropped on the
      // create-or-join screen with the thing they were invited to nowhere in
      // sight.
      const pending = takePendingJoin();
      if (pending) {
        try {
          const joined = await joinLeague(pending);
          const mineNow = await listMyLeagues();
          setLeagues(mineNow);
          setActive(joined); setView("app");
          return;
        } catch {
          setError(BAD_INVITE);
        }
      }
      const mine = await listMyLeagues();
      setLeagues(mine);
      // Only worth asking when there's a choice to make.
      if (mine.length) leagueSizes(mine.map((l) => l.id)).then(setSizes).catch(() => {});
      if (mine.length === 1) { setActive(mine[0]); setView("app"); }
      else if (mine.length > 1) setView("picker");
      else setView("empty");
    } catch (e: any) {
      setError(e.message || "Couldn't load your clubs.");
      setView("empty");
    }
  };

  // An invite link is ?join=CODE. Read it before anything else, because a
  // signed-out visitor is about to be sent through sign-up and the query
  // string will not survive the round trip — without stashing it the link
  // works for people who already have an account and quietly does nothing
  // for the people it was written for.
  useEffect(() => {
    const code = readJoinParam();
    if (code) stashPendingJoin(code);
  }, []);

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
    if (!name.trim()) { setError("Give the club a name."); return; }
    setBusy(true);
    try {
      const l = await createLeague(name, location);
      setName(""); setLocation("");
      setLeagues((prev) => [...prev, l]);
      setActive(l); setView("app");
    } catch (e: any) { setError(e.message || "Couldn't create the club."); }
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
    } catch (e: any) { setError(e.message || "Couldn't join that club."); }
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
      // The safe area lives HERE, on the shell, and nowhere below it.
      //
      // It used to be on RallyApp's inner container instead, which is below
      // this bar — so the bar itself slid under the iOS status bar on every
      // screen while the content underneath was pushed down by an inset it
      // did not need. Wrong in both directions at once, from one line in the
      // wrong place. Everything inside now inherits it; nothing inside
      // applies it again.
      //
      // THE BAR THAT USED TO BE HERE IS GONE, and the page colour comes with
      // it. It was a white strip carrying the league name and a "Leagues"
      // link, sitting directly above a header that already shows the league
      // name — so the club was printed twice, a centimetre apart, on every
      // screen in the app. Sam circled it and asked what it was for.
      //
      // The name was pure duplication. The link was not: joining by code,
      // reading your join codes and leaving a league live on the Dashboard's
      // own views and are reachable from nowhere else. So it moved into
      // GroupSheet — which the league pill already opens — rather than being
      // deleted with the bar.
      //
      // The wrapper stays, because the safe-area inset belongs HERE on the
      // shell and nowhere below it: putting it on RallyApp's inner container
      // once pushed the content down while leaving the bar under the status
      // bar. It is the page colour now rather than PANEL, since there is no
      // longer a bar for the strip to be an extension of.
      <div style={{ background: COURT, paddingTop: "env(safe-area-inset-top)" }}>
        <RallyApp
          // A fresh app per club: switching from the club sheet changes the
          // league under it, and everything inside reads its league on mount.
          key={active.id}
          leagueId={active.id}
          leagueName={active.name}
          leagueRole={active.role}
          leagueJoinCode={active.join_code}
          leagueCreatedBy={(active as any).created_by || null}
          // The switches in "Run your league" change the league row; the flags
          // above are read from it, so the app has to be told or the switch
          // would flip back on the next render.
          onLeagueFlags={(patch: any) => setActive((a) => (a ? { ...a, ...patch } : a))}
          displayName={displayName}
          onManageLeagues={() => setView(leagues.length > 1 ? "picker" : "empty")}
          // The club sheet (Sam, 2026-10-24): the same cards as Your clubs.
          clubs={leagues}
          clubSizes={sizes}
          onSwitchClub={(l: any) => { if (l.id !== active.id) setActive(l); }}
          onClubAction={(v: "create" | "join") => { setError(""); setView(v); }}
          // Absent means off. A League built anywhere but listMyLeagues — the
          // dev stub, a fresh join response — carries no flags at all, and
          // that has to read as "not switched on" rather than as undefined
          // behaviour.
          doublesEnabled={!!(active as any).doubles_enabled}
          competitionsEnabled={!!(active as any).competitions_enabled}
        />
      </div>
    );
  }

  // The landing page (Sam, 2026-10-24: "nice but ugly — sexy it up"). The
  // scoreboard system: a greeting set large, the busiest club as the hero
  // card with its numbers loud, the rest as quieter cards, Friendlies with its
  // own mark, and Join/Create as the two real buttons. Leaving a club moved
  // behind "Leave a club" — it was a link on every card, the loudest thing on
  // a page whose job is to open one.
  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: FEED_PAGE, padding: "18px 16px 40px", paddingTop: "calc(18px + env(safe-area-inset-top))", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 26 }}>
          <div style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: FEED_LIME, textTransform: "uppercase", letterSpacing: 0.5, lineHeight: 1 }}>Southwood</div>
          <button onClick={() => supabase?.auth.signOut()} style={{ fontFamily: body, fontWeight: 500, fontSize: 13.5, color: FEED_TEXT_MID, background: FEED_RAISED, border: "none", borderRadius: 999, padding: "8px 14px", cursor: "pointer" }}>Log out</button>
        </div>
        <div style={{ fontFamily: display, fontWeight: 600, fontSize: 34, color: FEED_TEXT_HI, lineHeight: 1.08, letterSpacing: -0.5 }}>{greetingFor(displayName || "")}</div>
        <div style={{ fontFamily: body, fontSize: 15, color: FEED_TEXT_MID, marginTop: 6, marginBottom: 22 }}>
          {view === "picker" ? "Where are we playing today?" : view === "create" ? "Start a club for your courts or your mates." : view === "join" ? "Got a code or an invite link? In you come." : "Welcome to Southwood."}
        </div>
        {error && <div style={{ fontFamily: body, fontSize: 13.5, color: FEED_THEY_LEAD, background: FEED_CARD, borderRadius: 14, padding: "10px 14px", marginBottom: 12 }}>{error}</div>}
        {children}
        <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 34, textAlign: "center" }}>
          Southwood · <a href="/privacy" style={{ color: FEED_TEXT_MID }}>Privacy</a>
        </div>
      </div>
    </div>
  );

  if (view === "loading") return <LoadingScreen label="Getting your clubs" />;

  if (view === "create") return shell(
    <div style={{ background: PANEL, border: "none", borderRadius: 14, padding: 20 }}>
      <div style={{ fontFamily: body, fontWeight: 700, fontSize: 16, color: CHALK, marginBottom: 14 }}>Create a club</div>
      <input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Club name, e.g. Seacourt Ladder" />
      <input style={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" />
      <button style={{ ...primary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={doCreate}>{busy ? "Creating…" : "Create club"}</button>
      <button style={ghost} onClick={() => { setError(""); setView(leagues.length ? "picker" : "empty"); }}>Back</button>
    </div>
  );

  if (view === "join") return shell(
    <div style={{ background: PANEL, border: "none", borderRadius: 14, padding: 20 }}>
      <div style={{ fontFamily: body, fontWeight: 700, fontSize: 16, color: CHALK, marginBottom: 14 }}>Join a club</div>
      <input style={{ ...field, fontFamily: body, letterSpacing: 1, textTransform: "uppercase" }} value={code} onChange={(e) => { const v = e.target.value; const m = /join=([A-Za-z0-9]+)/i.exec(v); setCode((m ? m[1] : v).toUpperCase().slice(0, 8)); }} placeholder="ABC123" />
      <button style={{ ...primary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={doJoin}>{busy ? "Joining…" : "Join club"}</button>
      <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 12, lineHeight: 1.5 }}>Type the club code, or paste the invite link. Organisers find both in Run your club.</div>
      <button style={ghost} onClick={() => { setError(""); setView(leagues.length ? "picker" : "empty"); }}>Back</button>
    </div>
  );

  if (view === "picker") {
    // The club with the most matches is the hero: it is almost always the
    // one somebody opens, and its numbers are worth showing large.
    const sized = (l: League) => sizes[l.id]?.matches ?? -1;
    const hero = leagues.reduce<League | null>((best, l) => (!best || sized(l) > sized(best) ? l : best), null);
    const rest = leagues.filter((l) => l !== hero);
    const open = (l: League) => { if (leaving) return; setActive(l); setView("app"); };
    const monogram = (name: string, onHero: boolean) => (
      <span style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, display: "grid", placeItems: "center", background: onHero ? FEED_LIME_DIVIDER : FEED_PAGE, color: onHero ? FEED_ON_HERO : FEED_LIME, fontFamily: display, fontWeight: 700, fontSize: 22 }}>
        {(name || "?").trim().charAt(0).toUpperCase()}
      </span>
    );
    const leaveBlock = (l: League) => leaving && leagues.length > 1 ? (
      confirmLeave === l.id ? (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12, background: FEED_PAGE, borderRadius: 12, padding: 12 }}>
          <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_HI, lineHeight: 1.45, marginBottom: 8 }}>
            Leave {l.name}? It stays exactly as it is. Code {l.join_code} gets you back in.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={async () => { try { await leaveLeague(l.id); setConfirmLeave(null); await load(); } catch (e: any) { setError(e.message || "Couldn't leave."); } }} style={{ flex: 1, fontFamily: body, fontWeight: 500, fontSize: 13.5, color: FEED_LIME_INK, background: FEED_THEY_LEAD, border: "none", borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}>Leave</button>
            <button onClick={() => setConfirmLeave(null)} style={{ flex: 1, fontFamily: body, fontWeight: 500, fontSize: 13.5, color: FEED_TEXT_HI, background: FEED_RAISED, border: "none", borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}>Stay</button>
          </div>
        </div>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); setConfirmLeave(l.id); }} style={{ marginTop: 10, fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_THEY_LEAD, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>Leave this club</button>
      )
    ) : null;
    const stat = (n: number | undefined, word: string, color: string, sub: string) => (
      <div>
        <div style={{ fontFamily: display, fontWeight: 600, fontSize: 30, lineHeight: 1, color, ...tabular }}>{n ?? "–"}</div>
        <div style={{ fontFamily: body, fontSize: 12.5, color: sub, marginTop: 4 }}>{n === 1 ? word : word === "match" ? "matches" : word + "s"}</div>
      </div>
    );

    return shell(
      <div>
        {hero && (
          <div role="button" onClick={() => open(hero)} style={{ background: FEED_HERO, color: FEED_ON_HERO, borderRadius: 24, padding: "18px 18px 16px", marginBottom: 10, cursor: leaving ? "default" : "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {monogram(hero.name, true)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: body, fontWeight: 500, fontSize: 21, color: FEED_ON_HERO, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hero.name}</div>
                <div style={{ fontFamily: body, fontSize: 13, color: FEED_LIME_INK_2, marginTop: 2 }}>{[hero.location, hero.role === "owner" ? "Owner" : null].filter(Boolean).join(" · ") || "Your club"}</div>
              </div>
              {!leaving && <ChevronRight size={20} color={FEED_ON_HERO} />}
            </div>
            <div style={{ height: 1, background: FEED_LIME_DIVIDER, margin: "16px 0 14px" }} />
            <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
              {stat(sizes[hero.id]?.players, "player", FEED_ON_HERO, FEED_LIME_INK_2)}
              {stat(sizes[hero.id]?.matches, "match", FEED_ON_HERO, FEED_LIME_INK_2)}
              <div style={{ flex: 1, textAlign: "right", fontFamily: body, fontSize: 12.5, color: FEED_LIME_INK_2, ...tabular }}>Code {hero.join_code}</div>
            </div>
            {leaveBlock(hero)}
          </div>
        )}

        {rest.map((l) => {
          const n = sizes[l.id];
          return (
            <div key={l.id} role="button" onClick={() => open(l)} style={{ background: FEED_CARD, borderRadius: 20, padding: "14px 16px", marginBottom: 10, cursor: leaving ? "default" : "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {monogram(l.name, false)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: body, fontWeight: 500, fontSize: 17, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</div>
                  <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 2, ...tabular }}>
                    {[n ? `${n.players} player${n.players === 1 ? "" : "s"} · ${n.matches} match${n.matches === 1 ? "" : "es"}` : null, l.role === "owner" ? "Owner" : null].filter(Boolean).join(" · ") || "Code " + l.join_code}
                  </div>
                </div>
                {!leaving && <ChevronRight size={18} color={FEED_TEXT_MID} />}
              </div>
              {leaveBlock(l)}
            </div>
          );
        })}

        <div role="button" onClick={() => { if (!leaving) { setActive({ id: FRIENDLY_LEAGUE_ID, name: "Friendlies" } as any); setView("app"); } }} style={{ display: "flex", alignItems: "center", gap: 12, background: FEED_CARD, borderRadius: 20, padding: "14px 16px", marginBottom: 18, cursor: "pointer" }}>
          <span style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, display: "grid", placeItems: "center", background: FEED_PAGE }}><Users size={20} color={FEED_LIME} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: body, fontWeight: 500, fontSize: 17, color: FEED_TEXT_HI }}>Friendlies</div>
            <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 2 }}>You and your mates, no club needed</div>
          </div>
          <ChevronRight size={18} color={FEED_TEXT_MID} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setError(""); setView("join"); }} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 999, padding: "14px 12px", fontFamily: body, fontWeight: 500, fontSize: 15.5, cursor: "pointer" }}>
            <LogIn size={17} /> Join a club
          </button>
          <button onClick={() => { setError(""); setView("create"); }} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 999, padding: "14px 12px", fontFamily: body, fontWeight: 500, fontSize: 15.5, cursor: "pointer" }}>
            <Plus size={17} /> Create one
          </button>
        </div>

        {leagues.length > 1 && (
          <button onClick={() => { setLeaving(!leaving); setConfirmLeave(null); }} style={{ display: "block", margin: "18px auto 0", background: "none", border: "none", color: FEED_TEXT_MID, fontFamily: body, fontSize: 13.5, cursor: "pointer" }}>
            {leaving ? "Done" : "Leave a club"}
          </button>
        )}
      </div>
    );
  }

  return shell(
    <>
      {/* Not a dead end and not an error — most people arrive here with no
          league because they have not made one yet, and the screen should
          read as the next step rather than as something missing. Join comes
          first because somebody sent you a code far more often than you set
          out to run a club. */}
      <div style={{ background: FEED_CARD, borderRadius: 20, padding: 22, marginBottom: 16 }}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 22, letterSpacing: "-0.02em", color: FEED_TEXT_HI }}>
          You&apos;re not in a league yet
        </div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, marginTop: 8, lineHeight: 1.5 }}>
          Join one with a code or an invite link, or start your own for your club or your mates.
        </div>
      </div>

      <button
        onClick={() => { setError(""); setView("join"); }}
        style={{ width: "100%", background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 20, padding: "15px 18px", cursor: "pointer", fontFamily: body, fontWeight: 500, fontSize: 16, marginBottom: 10 }}
      >
        Join a club
      </button>
      <button
        onClick={() => { setError(""); setView("create"); }}
        style={{ width: "100%", background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 20, padding: "15px 18px", cursor: "pointer", fontFamily: body, fontWeight: 500, fontSize: 16, marginBottom: 18 }}
      >
        Create a club
      </button>

      {/* The third answer, and for some people the only one they want. A
          league is a commitment — a name, a code, people to invite. Two mates
          who play on a Tuesday need none of it, and making them set one up
          first is asking them to run a club before they can record a game. */}
      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, lineHeight: 1.5, marginBottom: 10 }}>
        Or skip the club entirely — just log matches against your mates.
      </div>
      <button
        onClick={() => { setActive({ id: FRIENDLY_LEAGUE_ID, name: "Friendlies" } as any); setView("app"); }}
        style={{ width: "100%", background: FEED_CARD, color: FEED_TEXT_HI, border: "none", borderRadius: 20, padding: "15px 18px", cursor: "pointer", fontFamily: body, fontWeight: 500, fontSize: 16 }}
      >
        Just me and my mates
      </button>
    </>
  );
}
