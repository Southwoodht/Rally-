"use client";
import React, { useEffect, useState } from "react";
import { ClubMark } from "@/components/ui/ClubMark";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { BAD_INVITE, readJoinParam, stashPendingJoin, takePendingJoin } from "@/lib/invite";
import { FRIENDLY_LEAGUE_ID } from "@/lib/leagueData";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { listMyLeagues, createLeague, joinLeague, leagueSizes, leaveLeague, League, setLeaguePlace, clubsNear, type NearbyClub } from "@/lib/leagues";
import { currentSpot, distanceLabel, placeName, type Spot } from "@/lib/place";
import { BALL, CHALK, COURT, FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_PAGE, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, FEED_THEY_LEAD, MUTED, PANEL, PANEL2, body, display, tabular, LINE } from "@/lib/theme";
import { greetingFor, ordinal } from "@/lib/format";
import { myClubSummaries, playedAgo, type ClubSummary } from "@/lib/myLeaguePlaces";
import { ChevronRight, LogIn, MoreHorizontal, Plus, Users } from "lucide-react";
import RallyApp from "@/components/RallyApp";
import { RallyMark } from "@/components/ui/RallyMark";

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
  // A new club's pin, from "Use my location" (schema_club_location.sql).
  const [spot, setSpot] = useState<Spot | null>(null);
  const [locating, setLocating] = useState(false);
  // Clubs near me, on the Join screen.
  const [nearby, setNearby] = useState<NearbyClub[] | null>(null);
  const [nearbyNote, setNearbyNote] = useState("");

  const displayName =
    (session.user.user_metadata as any)?.full_name ||
    session.user.email?.split("@")[0] ||
    "player";

  const [sizes, setSizes] = useState<Record<string, { players: number; matches: number }>>({});
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<ClubSummary[]>([]);
  // Your place, rating and last match in each club, for the landing page.
  // Best-effort: until it arrives (or if it fails) each club shows its counts.
  useEffect(() => {
    if (!leagues.length) return;
    let alive = true;
    myClubSummaries(leagues, session?.user?.id ?? null).then((x) => { if (alive) setSummaries(x); }).catch(() => {});
    return () => { alive = false; };
  }, [leagues]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // The pin goes on after the club exists, through the organiser door. A
      // database without the location file just keeps the typed place.
      if (spot) {
        try { await setLeaguePlace(l.id, location, spot); Object.assign(l, { lat: spot.lat, lng: spot.lng }); }
        catch { /* the club is made; its pin can be set in Club settings */ }
      }
      setName(""); setLocation(""); setSpot(null);
      setLeagues((prev) => [...prev, l]);
      setActive(l); setView("app");
    } catch (e: any) { setError(e.message || "Couldn't create the club."); }
    setBusy(false);
  };

  const useMyLocation = async () => {
    setError(""); setLocating(true);
    try {
      const at = await currentSpot();
      setSpot(at);
      const town = await placeName(at);
      if (town) setLocation(town);
    } catch (e: any) { setError(e.message); }
    setLocating(false);
  };

  const findNearby = async () => {
    setError(""); setNearbyNote(""); setLocating(true);
    try {
      const at = await currentSpot();
      const found = await clubsNear(at, 40);
      setNearby(found);
      if (!found.length) setNearbyNote("No clubs on Southwood within 40 km have set their location yet.");
    } catch (e: any) { setError(e.message); }
    setLocating(false);
  };

  const doJoin = async (withCode?: string) => {
    setError("");
    setBusy(true);
    try {
      const l = await joinLeague(withCode || code);
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
          onLeagueFlags={(patch: any) => {
            setActive((a) => (a ? { ...a, ...patch } : a));
            // The club list too, so the logo shows on the start page and in
            // the club switcher without a reload.
            setLeagues((ls) => ls.map((x) => (x.id === active.id ? { ...x, ...patch } : x)));
          }}
          clubLogo={(active as any).logo_url ?? null}
          clubPlace={{ location: active.location ?? null, lat: (active as any).lat ?? null, lng: (active as any).lng ?? null, open: !!(active as any).open_to_join }}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
          <RallyMark size={34} title="Southwood" />
          <button onClick={() => supabase?.auth.signOut()} style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_MID, background: "none", border: "none", padding: "6px 0", cursor: "pointer" }}>Log out</button>
        </div>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 38, color: FEED_TEXT_HI, lineHeight: 1.05, letterSpacing: -0.6 }}>{greetingFor(displayName || "")}</div>
        {view !== "picker" && (
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_MID, marginTop: 8 }}>
            {view === "create" ? "Start a club for your courts or your mates." : view === "join" ? "Got a code or an invite link? In you come." : "Welcome to Southwood."}
          </div>
        )}
        <div style={{ height: 26 }} />
        {error && <div style={{ fontFamily: body, fontSize: 13.5, color: FEED_THEY_LEAD, background: FEED_CARD, borderRadius: 14, padding: "10px 14px", marginBottom: 12 }}>{error}</div>}
        {children}
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID, marginTop: 34, textAlign: "center" }}>
          <a href="/privacy" style={{ color: FEED_TEXT_MID, textDecoration: "none" }}>Privacy</a>
        </div>
      </div>
    </div>
  );

  if (view === "loading") return <LoadingScreen label="Getting your clubs" />;

  if (view === "create") return shell(
    <div style={{ background: PANEL, border: "none", borderRadius: 14, padding: 20 }}>
      <div style={{ fontFamily: body, fontWeight: 700, fontSize: 16, color: CHALK, marginBottom: 14 }}>Create a club</div>
      <input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Club name, e.g. Seacourt Ladder" />
      <div style={{ display: "flex", gap: 8 }}>
        <input style={{ ...field, flex: 1 }} value={location} onChange={(e) => { setLocation(e.target.value); }} placeholder="Where is it? e.g. Hayling Island" />
        <button onClick={useMyLocation} disabled={locating} style={{ ...primary, width: "auto", flex: "0 0 auto", marginTop: 0, marginBottom: 10, padding: "0 14px", opacity: locating ? 0.6 : 1 }}>
          {locating ? "Finding…" : spot ? "Located" : "Use my location"}
        </button>
      </div>
      <div style={{ fontFamily: body, fontSize: 12, color: MUTED, margin: "-2px 2px 12px", lineHeight: 1.5 }}>
        {spot ? "The club's pin is set to about a kilometre, so players nearby can find it. Your own location isn't kept." : "Optional. With your location, players near the club can find it."}
      </div>
      <button style={{ ...primary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={doCreate}>{busy ? "Creating…" : "Create club"}</button>
      <button style={ghost} onClick={() => { setError(""); setView(leagues.length ? "picker" : "empty"); }}>Back</button>
    </div>
  );

  if (view === "join") return shell(
    <div style={{ background: PANEL, border: "none", borderRadius: 14, padding: 20 }}>
      <div style={{ fontFamily: body, fontWeight: 700, fontSize: 16, color: CHALK, marginBottom: 14 }}>Join a club</div>
      <input style={{ ...field, fontFamily: body, letterSpacing: 1, textTransform: "uppercase" }} value={code} onChange={(e) => { const v = e.target.value; const m = /join=([A-Za-z0-9]+)/i.exec(v); setCode((m ? m[1] : v).toUpperCase().slice(0, 8)); }} placeholder="ABC123" />
      <button style={{ ...primary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => doJoin()}>{busy ? "Joining…" : "Join club"}</button>
      <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 12, lineHeight: 1.5 }}>Type the club code, or paste the invite link. Organisers find both in Run your club.</div>
      <div style={{ height: 1, background: LINE, margin: "18px 0 14px" }} />
      <div style={{ fontFamily: body, fontWeight: 700, fontSize: 15, color: CHALK, marginBottom: 6 }}>No code?</div>
      {nearby === null ? (
        <button style={{ ...ghost, marginTop: 0, opacity: locating ? 0.6 : 1 }} disabled={locating} onClick={findNearby}>{locating ? "Looking…" : "Find clubs near me"}</button>
      ) : (
        <div>
          {nearby.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid " + LINE }}>
              <ClubMark club={c} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: CHALK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED }}>{[distanceLabel(c.km), c.location, `${c.players} ${c.players === 1 ? "player" : "players"}`].filter(Boolean).join(" · ")}</div>
              </div>
              {c.member
                ? <span style={{ fontFamily: body, fontSize: 12.5, color: MUTED }}>You&apos;re in</span>
                : c.open_to_join && c.join_code
                  ? <button disabled={busy} onClick={() => doJoin(c.join_code!)} style={{ ...primary, width: "auto", marginTop: 0, padding: "8px 18px", flex: "0 0 auto" }}>Join</button>
                  : <span style={{ fontFamily: body, fontSize: 12, color: MUTED, textAlign: "right", maxWidth: 90 }}>Invite only, ask a member</span>}
            </div>
          ))}
          {nearbyNote && <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{nearbyNote}</div>}
        </div>
      )}
      <button style={ghost} onClick={() => { setError(""); setView(leagues.length ? "picker" : "empty"); }}>Back</button>
    </div>
  );

  if (view === "picker") {
    // Sam's mockup (2026-10-24): clubs as one card with a line about you in
    // each — your place, your rating, when you last played — Join and Create
    // as two tiles that say what they are for, then Friendlies outside, in a
    // dashed card, because it is the thing that is not a club.
    const label = (t: string) => (
      <div style={{ fontFamily: body, fontWeight: 600, fontSize: 13, letterSpacing: 1.6, textTransform: "uppercase", color: FEED_TEXT_MID, padding: "0 4px", marginBottom: 10 }}>{t}</div>
    );
    const bySummary = new Map(summaries.map((x) => [x.leagueId, x]));
    const tile: React.CSSProperties = { flex: 1, display: "flex", alignItems: "center", gap: 10, background: FEED_CARD, border: "1px solid " + LINE, borderRadius: 20, padding: "14px 12px", cursor: "pointer", textAlign: "left" };
    const tileIcon = (icon: React.ReactNode) => (
      <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: FEED_PAGE }}>{icon}</span>
    );

    return shell(
      <div>
        {label("Your clubs")}
        <div style={{ background: FEED_CARD, border: "1px solid " + LINE, borderRadius: 24, overflow: "hidden", marginBottom: 12 }}>
          {leagues.map((l, i) => {
            const n = sizes[l.id];
            const sm = bySummary.get(l.id);
            const you = sm
              ? sm.clubMatches === 0
                ? <span style={{ fontWeight: 600 }}>No matches yet</span>
                : <>
                    <span style={{ fontWeight: 700 }}>{sm.place ? ordinal(sm.place) : "Not ranked yet"}{sm.place && sm.rating != null ? " · " + sm.rating : ""}</span>
                    <span style={{ fontWeight: 400, color: FEED_TEXT_MID }}>{sm.lastPlayed ? " · " + playedAgo(sm.lastPlayed) : " · not played yet"}</span>
                  </>
              : null;
            const facts = [n && sm?.clubMatches !== 0 ? `${n.players} ${n.players === 1 ? "player" : "players"} · ${n.matches} ${n.matches === 1 ? "match" : "matches"}` : n ? `${n.players} ${n.players === 1 ? "player" : "players"}` : null, l.location || null].filter(Boolean).join(" · ");
            return (
              <div key={l.id}>
                <div role="button" onClick={() => { setActive(l); setView("app"); }} style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 16px", cursor: "pointer" }}>
                  <ClubMark club={l} size={54} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: body, fontWeight: 700, fontSize: 19, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</div>
                    {you && <div style={{ fontFamily: body, fontSize: 15, color: FEED_TEXT_HI, marginTop: 3, ...tabular }}>{you}</div>}
                    {facts && <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14.5, color: FEED_TEXT_MID, marginTop: 3, lineHeight: 1.35, ...tabular }}>{facts}</div>}
                  </div>
                  <button
                    aria-label={"More for " + l.name}
                    onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === l.id ? null : l.id); setConfirmLeave(null); }}
                    style={{ width: 36, height: 36, borderRadius: 18, border: "none", background: menuFor === l.id ? FEED_PAGE : "transparent", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
                  >
                    <MoreHorizontal size={20} color={FEED_TEXT_MID} />
                  </button>
                </div>
                {menuFor === l.id && (
                  <div style={{ padding: "0 16px 16px 86px" }}>
                    <div style={{ fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_MID, marginBottom: 10, ...tabular }}>Join code {l.join_code}</div>
                    {leagues.length > 1 && (confirmLeave === l.id ? (
                      <div>
                        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_HI, lineHeight: 1.45, marginBottom: 10 }}>
                          Leave {l.name}? It stays exactly as it is, and the code gets you back in.
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={async () => { try { await leaveLeague(l.id); setConfirmLeave(null); setMenuFor(null); await load(); } catch (e: any) { setError(e.message || "Couldn't leave."); } }} style={{ flex: 1, fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_LIME_INK, background: FEED_THEY_LEAD, border: "none", borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}>Leave</button>
                          <button onClick={() => setConfirmLeave(null)} style={{ flex: 1, fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_TEXT_HI, background: FEED_PAGE, border: "none", borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}>Stay</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmLeave(l.id)} style={{ fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_THEY_LEAD, background: "none", border: "none", padding: 0, cursor: "pointer" }}>Leave this club</button>
                    ))}
                  </div>
                )}
                {i < leagues.length - 1 && <div style={{ height: 1, background: LINE, marginLeft: 86 }} />}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 30 }}>
          <button onClick={() => { setError(""); setView("join"); }} style={tile}>
            {tileIcon(<LogIn size={19} color={FEED_LIME} />)}
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: body, fontWeight: 700, fontSize: 17, color: FEED_TEXT_HI }}>Join</span>
              <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, marginTop: 1 }}>Got a code?</span>
            </span>
          </button>
          <button onClick={() => { setError(""); setView("create"); }} style={tile}>
            {tileIcon(<Plus size={19} color={FEED_LIME} />)}
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: body, fontWeight: 700, fontSize: 17, color: FEED_TEXT_HI }}>Create</span>
              <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, marginTop: 1, whiteSpace: "nowrap" }}>For your group</span>
            </span>
          </button>
        </div>

        {label("Outside a club")}
        <div role="button" onClick={() => { setActive({ id: FRIENDLY_LEAGUE_ID, name: "Friendlies" } as any); setView("app"); }} style={{ display: "flex", alignItems: "center", gap: 16, border: "1.5px dashed " + FEED_TEXT_MID, borderRadius: 24, padding: "18px 16px", cursor: "pointer", opacity: 0.95 }}>
          <span style={{ width: 54, height: 54, flexShrink: 0, display: "grid", placeItems: "center" }}><Users size={24} color={FEED_TEXT_HI} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: body, fontWeight: 700, fontSize: 19, color: FEED_TEXT_HI }}>Friendlies</div>
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 15, color: FEED_TEXT_MID, marginTop: 3 }}>Log a match against anyone</div>
          </div>
          <ChevronRight size={20} color={FEED_TEXT_MID} />
        </div>
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
          You&apos;re not in a club yet
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
