"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Calendar, Check, ChevronLeft, ChevronRight, Database, Link2, Settings2, Shield, Trophy, Users } from "lucide-react";
import { AccountCard } from "@/components/settings/AccountCard";
import { LeagueMembers } from "@/components/settings/LeagueMembers";
import { PlayerEditSheet } from "@/components/settings/PlayerEditSheet";
import { Avatar } from "@/components/ui/Avatar";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { levelNow } from "@/core/levels";
import { inviteUrl } from "@/lib/invite";
import { isFriendlyLeague } from "@/lib/leagueData";
import { fmtDate, fullNameOf, uid } from "@/lib/format";
import {
  DOT_LOSS, FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_OVERLAY, FEED_RAISED,
  FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, miniInput, tabular,
} from "@/lib/theme";

/**
 * "Run your league" — the admin, rebuilt around what an admin comes to do.
 *
 * Sam, 26 Sep 2026: "how simple is the admin. I know it confuses me ... think
 * about a tennis club admin or even the leader of a friends group."
 *
 * The old Settings screen was one scroll: roles, name, "Fair play", season, a
 * fixtures generator, EVERY player's full edit form one after another, a data
 * section with a button that did nothing in the live app, and your account at
 * the foot — shown to every member alike. It was all correct and none of it
 * was findable.
 *
 * Now: three things up front (invite, start a competition, players), a
 * first-time checklist until the league is off the ground, and everything
 * else as one line each that opens its own page. Every control that existed
 * still exists; what changed is where it lives and who is shown it.
 *
 * MEMBERS SEE A DIFFERENT, SHORT SCREEN. They can invite people — a member
 * bringing a friend is the most common way a club grows — and manage their
 * account. Nothing on it is a control the database would then refuse them.
 */

type Page = "home" | "players" | "singles" | "seasons" | "roles" | "settings" | "data";

const lbl: React.CSSProperties = {
  fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID,
  textTransform: "uppercase", letterSpacing: 0.8,
};
const fld: React.CSSProperties = {
  ...miniInput, fontFamily: body, fontSize: 15, background: FEED_RAISED, color: FEED_TEXT_HI,
  padding: "10px 12px", width: "100%", boxSizing: "border-box",
};
const btn = (fill: string, ink: string): React.CSSProperties => ({
  flex: 1, fontFamily: body, fontWeight: 500, fontSize: 14, padding: "11px 10px",
  borderRadius: 10, border: "none", cursor: "pointer", background: fill, color: ink,
});
const note: React.CSSProperties = { fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.5 };

/** An on/off switch drawn in the app's own colours. */
const Switch = ({ on }: { on: boolean }) => (
  <span style={{ width: 44, height: 26, borderRadius: 13, background: on ? FEED_LIME : FEED_RAISED, position: "relative", flexShrink: 0 }}>
    <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: on ? FEED_LIME_INK : FEED_TEXT_LOW, transition: "left 0.15s" }} />
  </span>
);

const CHECKLIST_KEY = (leagueId: string) => "rally.hubChecklistHidden." + leagueId;

export function LeagueHub(props: any) {
  const {
    group, updateGroup, players, setPlayers, matches, fixtures, flash, meId, leagueId, displayName,
    leagueJoinCode, canManage, isCreator, doublesEnabled, competitionsEnabled, hasCompetition,
    onSetFlags, onStartDoublesCompetition, onStartSinglesCompetition, onLogResult,
  } = props;
  const friendly = isFriendlyLeague(leagueId);
  const [page, setPage] = useState<Page>("home");
  const [choosing, setChoosing] = useState(false);

  // --- invite -------------------------------------------------------------
  // The share sheet where there is one (it is how a link reaches WhatsApp in
  // one tap on a phone), the clipboard where there is not, and the bare code
  // if both refuse — the code still works typed in.
  const invite = async () => {
    const link = inviteUrl(leagueJoinCode || "");
    if (!link) { flash("This league has no invite code."); return; }
    const text = `Join ${group?.name || "our league"} on Rally`;
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title: text, text, url: link });
        return;
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return; // they closed the sheet
    }
    try { await navigator.clipboard.writeText(link); flash("Invite link copied — paste it into your group chat"); }
    catch { flash("League code: " + leagueJoinCode); }
  };

  // --- first-time checklist ----------------------------------------------
  const active = players.filter((p: any) => !p.inactive).length;
  const steps = [
    { done: active >= 4, title: "Get four players in", sub: `${Math.min(active, 4)} of 4`, action: invite, cta: "Invite" },
    { done: (matches || []).length > 0, title: "Log a first result", sub: "Anyone can, from the + button", action: onLogResult, cta: "Add" },
    { done: (fixtures || []).length > 0 || !!hasCompetition, title: "Start a competition", sub: "A league or a knockout", action: () => setChoosing(true), cta: "Start" },
  ];
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try { setHidden(window.localStorage.getItem(CHECKLIST_KEY(leagueId)) === "1"); } catch { /* a private window: show it */ }
  }, [leagueId]);
  const hideChecklist = () => { setHidden(true); try { window.localStorage.setItem(CHECKLIST_KEY(leagueId), "1"); } catch { /* fine */ } };
  const showChecklist = canManage && !friendly && !hidden && steps.some((s) => !s.done);

  // --- sub-pages ------------------------------------------------------------
  const back = (title: string) => (
    <button onClick={() => setPage("home")} style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 14, cursor: "pointer", padding: "0 0 12px" }}>
      <ChevronLeft size={16} strokeWidth={2.2} />{title}
    </button>
  );

  if (page === "players") return <><>{back("Run your league")}</><PlayersPage {...props} /></>;
  // Competition ties are managed from their competition, not from here.
  if (page === "singles") return <><>{back("Run your league")}</><SinglesFixturesPage {...props} fixtures={(fixtures || []).filter((f: any) => !f.competitionId)} /></>;
  if (page === "seasons") return <><>{back("Run your league")}</><SeasonsPage group={group} updateGroup={updateGroup} /></>;
  if (page === "roles") return <><>{back("Run your league")}</><LeagueMembers leagueId={leagueId} leagueName={group?.name} /></>;
  if (page === "settings") return <><>{back("Run your league")}</><SettingsPage {...props} /></>;
  if (page === "data") return <><>{back("Run your league")}</><DataPage {...props} /></>;

  // --- members' screen ------------------------------------------------------
  if (!canManage && !friendly) {
    return (
      <div>
        <SurfaceCard radius={18} pad="18px 16px" style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 18, color: FEED_TEXT_HI }}>{group?.name || "Your league"}</div>
          <div style={{ ...note, marginTop: 4 }}>{active} players{doublesEnabled ? " · singles and doubles" : ""}</div>
          {leagueJoinCode && (
            <button onClick={invite} style={{ ...btn(FEED_LIME, FEED_LIME_INK), width: "100%", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Link2 size={17} strokeWidth={2.2} />Invite someone
            </button>
          )}
          <div style={{ ...note, marginTop: 12 }}>The league&apos;s organisers look after players, competitions and settings.</div>
        </SurfaceCard>
        <AccountCard displayName={displayName} />
      </div>
    );
  }

  // --- the hub --------------------------------------------------------------
  const tile = (icon: React.ReactNode, title: string, onClick: () => void, primary = false) => (
    <button onClick={onClick} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, background: primary ? FEED_LIME : FEED_CARD, color: primary ? FEED_LIME_INK : FEED_TEXT_HI, border: "none", borderRadius: 16, padding: "14px 12px", cursor: "pointer", textAlign: "left" }}>
      {icon}
      <span style={{ fontFamily: body, fontWeight: 500, fontSize: 14, lineHeight: 1.2 }}>{title}</span>
    </button>
  );

  const row = (icon: React.ReactNode, title: string, sub: string, to: Page) => (
    <button onClick={() => setPage(to)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: "none", borderTop: "0.5px solid " + FEED_HAIRLINE, padding: "13px 2px", cursor: "pointer", textAlign: "left" }}>
      <span style={{ width: 22, display: "flex", justifyContent: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: body, fontSize: 15, color: FEED_TEXT_HI }}>{title}</span>
        <span style={{ display: "block", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</span>
      </span>
      <ChevronRight size={16} color={FEED_TEXT_LOW} strokeWidth={2} style={{ flexShrink: 0 }} />
    </button>
  );

  const toPlay = (fixtures || []).filter((f: any) => !f.done && !f.competitionId).length;
  const ic = (C: any) => <C size={18} color={FEED_LIME} strokeWidth={2} />;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {!friendly && leagueJoinCode && tile(<Link2 size={20} strokeWidth={2.2} />, "Invite players", invite, true)}
        {!friendly && tile(<Trophy size={20} color={FEED_LIME} strokeWidth={2} />, "Start a competition", () => setChoosing(true))}
        {tile(<Users size={20} color={FEED_LIME} strokeWidth={2} />, `Players · ${active}`, () => setPage("players"))}
      </div>

      {showChecklist && (
        <SurfaceCard radius={18} pad="16px 14px 8px" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI }}>Getting started</span>
            <button onClick={hideChecklist} style={{ background: "none", border: "none", color: FEED_TEXT_MID, fontFamily: body, fontSize: 12.5, cursor: "pointer", padding: 0 }}>Hide</button>
          </div>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
              <span style={{ width: 24, height: 24, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: s.done ? FEED_LIME : FEED_RAISED, color: FEED_LIME_INK, fontFamily: body, fontSize: 12, ...tabular }}>
                {s.done ? <Check size={14} strokeWidth={3} /> : <span style={{ color: FEED_TEXT_MID }}>{i + 1}</span>}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: body, fontSize: 14.5, color: s.done ? FEED_TEXT_MID : FEED_TEXT_HI, textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span>
                {!s.done && <span style={{ display: "block", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 1 }}>{s.sub}</span>}
              </span>
              {!s.done && s.action && (
                <button onClick={s.action} style={{ background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 16, padding: "7px 13px", fontFamily: body, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>{s.cta}</button>
              )}
            </div>
          ))}
        </SurfaceCard>
      )}

      <SurfaceCard radius={18} pad="4px 14px" style={{ marginBottom: 14 }}>
        <div style={{ marginTop: -1 }}>
          {!friendly && row(ic(Calendar), "Seasons", group?.season ? `${group.season.name} · running` : "None running", "seasons")}
          {!friendly && row(ic(Trophy), "Arranged matches", toPlay ? `${toPlay} to play` : "Hand-picked singles matches, outside any competition", "singles")}
          {!friendly && row(ic(Shield), "Who helps run it", "Organisers and helpers", "roles")}
          {!friendly && row(ic(Settings2), "League settings", `${group?.name || "Name"} · doubles ${doublesEnabled ? "on" : "off"}`, "settings")}
          {row(ic(Database), "Data", "Import old results · clear results", "data")}
        </div>
      </SurfaceCard>

      <AccountCard displayName={displayName} />

      {choosing && (
        <StartSheet
          competitions={!!competitionsEnabled}
          doubles={!!doublesEnabled}
          isCreator={isCreator}
          onClose={() => setChoosing(false)}
          onDoubles={() => { setChoosing(false); onStartDoublesCompetition(); }}
          onSingles={() => { setChoosing(false); onStartSinglesCompetition(); }}
          onTurnOn={async (patch: Record<string, boolean>) => {
            try { await onSetFlags(patch); flash("Switched on"); }
            catch (e: any) { flash(e?.message || "Couldn't switch that on."); }
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Start a competition: one question, two answers
// ---------------------------------------------------------------------------

function StartSheet({ competitions, doubles, isCreator, onClose, onDoubles, onSingles, onTurnOn }: any) {
  const option = (title: string, sub: string, onClick: () => void, disabled = false) => (
    <button disabled={disabled} onClick={onClick} style={{ display: "block", width: "100%", textAlign: "left", background: FEED_CARD, border: "none", borderRadius: 14, padding: "14px 14px", marginBottom: 10, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1 }}>
      <span style={{ display: "block", fontFamily: body, fontWeight: 500, fontSize: 15.5, color: FEED_TEXT_HI }}>{title}</span>
      <span style={{ display: "block", ...note, marginTop: 3 }}>{sub}</span>
    </button>
  );
  // What is off, and one tap to turn it on for whoever is allowed to.
  const off = (what: string, patch: Record<string, boolean>) => (
    <div style={{ ...note, margin: "-4px 2px 12px" }}>
      {what} switched off for this league.{" "}
      {isCreator
        ? <button onClick={() => onTurnOn(patch)} style={{ background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 12.5, cursor: "pointer", padding: 0 }}>Switch on</button>
        : "The person who created the league can switch it on."}
    </div>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: FEED_OVERLAY, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 97 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: FEED_RAISED, width: "100%", maxWidth: 620, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: "18px 16px 34px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontFamily: body, fontWeight: 500, fontSize: 17, color: FEED_TEXT_HI }}>Start a competition</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: FEED_TEXT_MID, fontFamily: body, fontSize: 14, cursor: "pointer" }}>Close</button>
        </div>
        <div style={{ ...note, marginBottom: 14 }}>A league (everyone plays everyone, with a table) or a knockout (winners go through). You choose next.</div>
        {option("Singles", "Pick the players — or add everyone in one tap. Rally draws the matches, keeps the table and moves winners through.", onSingles, !competitions)}
        {option("Doubles", "Fixed pairs, the same way.", onDoubles, !competitions || !doubles)}
        {!competitions ? off("Competitions are", { competitions_enabled: true }) : !doubles ? off("Doubles is", { doubles_enabled: true }) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

function PlayersPage({ players, setPlayers, matches, onRemovePlayer, meId, flash }: any) {
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const playedBy = useMemo(() => {
    const n: Record<string, number> = {};
    for (const m of matches || []) { n[m.p1] = (n[m.p1] || 0) + 1; n[m.p2] = (n[m.p2] || 0) + 1; }
    return n;
  }, [matches]);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    // A suggestion, never a decision (§3): an exact first-name match only
    // stops a double-tap creating the same person twice.
    if (players.some((p: any) => (p.name || "").toLowerCase() === n.toLowerCase() && !p.last)) return flash("There's already a " + n + " with no surname — add the surname to tell them apart.");
    const parts = n.split(/\s+/);
    const created = { id: uid(), name: parts[0], last: parts.slice(1).join(" ") || undefined, level: null, avatar: null };
    setPlayers([...players, created]);
    setName("");
    setEditing(created.id);
  };

  const term = q.trim().toLowerCase();
  const sorted = players.slice().sort((a: any, b: any) => (+!!a.inactive - +!!b.inactive) || fullNameOf(a).localeCompare(fullNameOf(b)));
  const shown = term ? sorted.filter((p: any) => (fullNameOf(p) + " " + (p.nick || "")).toLowerCase().includes(term)) : sorted;
  const editingPlayer = players.find((p: any) => p.id === editing);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a player — first name and surname" style={{ ...fld, flex: 1 }} />
        <button onClick={add} disabled={!name.trim()} style={{ ...btn(name.trim() ? FEED_LIME : FEED_RAISED, name.trim() ? FEED_LIME_INK : FEED_TEXT_LOW), flex: "0 0 auto", padding: "10px 16px" }}>Add</button>
      </div>
      {players.length > 10 && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${players.length} players`} style={{ ...fld, marginBottom: 12 }} />
      )}
      <SurfaceCard radius={18} pad="2px 14px">
        {shown.map((p: any, i: number) => {
          const lv = levelNow(p);
          return (
            <button key={p.id} onClick={() => setEditing(p.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: "none", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : "none", padding: "10px 0", cursor: "pointer", textAlign: "left", opacity: p.inactive ? 0.6 : 1 }}>
              <Avatar player={p} size={36} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: body, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullNameOf(p)}</span>
                <span style={{ display: "block", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 1, ...tabular }}>
                  {[`${playedBy[p.id] || 0} played`, lv ? `${lv.cat} · ${lv.sub}` : "No level", p.auth_id ? "Account" : null, p.inactive ? "Not playing" : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ChevronRight size={16} color={FEED_TEXT_LOW} strokeWidth={2} style={{ flexShrink: 0 }} />
            </button>
          );
        })}
        {!shown.length && <div style={{ ...note, padding: "14px 0" }}>{term ? "Nobody matches that." : "No players yet — add the first above."}</div>}
      </SurfaceCard>

      {editingPlayer && (
        <PlayerEditSheet
          player={editingPlayer}
          played={playedBy[editingPlayer.id] || 0}
          locked={!!editingPlayer.auth_id && editingPlayer.id !== meId}
          onChange={(patch) => setPlayers(players.map((x: any) => (x.id === editingPlayer.id ? { ...x, ...patch } : x)))}
          onRemove={() => { onRemovePlayer(editingPlayer.id); setEditing(null); flash("Player removed"); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Singles fixtures — the old round-robin generator, in plain words
// ---------------------------------------------------------------------------

function SinglesFixturesPage({ players, fixtures, onGenerate, onClearFixtures, onAddFixture, onRemoveFixture, flash }: any) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const active = players.filter((p: any) => !p.inactive);
  const pairs = (active.length * (active.length - 1)) / 2;
  const n = (id: string) => { const p = players.find((x: any) => x.id === id); return p ? fullNameOf(p) : "?"; };
  const open = (fixtures || []).filter((f: any) => !f.done);
  const opts = players.slice().sort((x: any, y: any) => fullNameOf(x).localeCompare(fullNameOf(y)));

  return (
    <div>
      <SurfaceCard radius={18} pad="16px 14px" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15.5, color: FEED_TEXT_HI }}>Everyone plays everyone</div>
        <div style={{ ...note, margin: "4px 0 12px" }}>
          Creates a match for every pair of the {active.length} active players. They show in Fixtures, and results go in as normal.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[1, 2].map((r) => (
            <button key={r} onClick={() => { onGenerate(r); }} style={btn(r === 1 ? FEED_LIME : FEED_RAISED, r === 1 ? FEED_LIME_INK : FEED_TEXT_HI)}>
              {r === 1 ? "Once" : "Twice"} · {pairs * r} matches
            </button>
          ))}
        </div>
        {!!(fixtures || []).length && <div style={{ ...note, marginTop: 10, color: DOT_LOSS }}>This replaces the {fixtures.length} fixtures already there.</div>}
      </SurfaceCard>

      <SurfaceCard radius={18} pad="16px 14px" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15.5, color: FEED_TEXT_HI, marginBottom: 10 }}>Add one match</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <select value={a} onChange={(e) => setA(e.target.value)} style={{ ...fld, flex: 1 }}><option value="">Player…</option>{opts.map((p: any) => <option key={p.id} value={p.id}>{fullNameOf(p)}</option>)}</select>
          <span style={{ ...note }}>v</span>
          <select value={b} onChange={(e) => setB(e.target.value)} style={{ ...fld, flex: 1 }}><option value="">Player…</option>{opts.map((p: any) => <option key={p.id} value={p.id}>{fullNameOf(p)}</option>)}</select>
        </div>
        <button onClick={() => { if (a && b && a !== b) { onAddFixture(a, b); setA(""); setB(""); flash("Match added"); } else flash("Pick two different players"); }} style={{ ...btn(FEED_RAISED, FEED_TEXT_HI), width: "100%" }}>Add match</button>
      </SurfaceCard>

      {!!(fixtures || []).length && (
        <SurfaceCard radius={18} pad="12px 14px">
          <div style={{ ...lbl, marginBottom: 6 }}>{open.length} to play · {fixtures.length - open.length} played</div>
          {fixtures.map((f: any, i: number) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
              <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 14, color: f.done ? FEED_TEXT_MID : FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n(f.p1)} v {n(f.p2)}{f.done ? " · played" : ""}</span>
              {!f.done && <button onClick={() => onRemoveFixture(f.id)} style={{ background: "none", border: "none", color: FEED_TEXT_MID, fontFamily: body, fontSize: 13, cursor: "pointer" }}>Remove</button>}
            </div>
          ))}
          <div style={{ marginTop: 10 }}>
            {confirmClear ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { onClearFixtures(); setConfirmClear(false); }} style={btn(DOT_LOSS, FEED_LIME_INK)}>Clear all {fixtures.length}</button>
                <button onClick={() => setConfirmClear(false)} style={btn(FEED_RAISED, FEED_TEXT_HI)}>Keep</button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)} style={{ background: "none", border: "none", color: DOT_LOSS, fontFamily: body, fontSize: 13.5, cursor: "pointer", padding: "4px 0" }}>Clear all fixtures…</button>
            )}
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

function SeasonsPage({ group, updateGroup }: any) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const s = group?.season;
  return (
    <SurfaceCard radius={18} pad="16px 14px">
      {s ? (
        <>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 17, color: FEED_TEXT_HI }}>{s.name}</div>
          <div style={{ ...note, marginTop: 4 }}>{fmtDate(s.start)}{s.end ? " to " + fmtDate(s.end) : " · no end date"}</div>
          <div style={{ ...note, marginTop: 10 }}>The table can show this season or all time. Matches between the dates count towards the season.</div>
          <div style={{ marginTop: 14 }}>
            {confirmEnd ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { updateGroup(group.id, { season: null }); setConfirmEnd(false); }} style={btn(DOT_LOSS, FEED_LIME_INK)}>End {s.name}</button>
                <button onClick={() => setConfirmEnd(false)} style={btn(FEED_RAISED, FEED_TEXT_HI)}>Keep it</button>
              </div>
            ) : (
              <button onClick={() => setConfirmEnd(true)} style={{ ...btn(FEED_RAISED, FEED_TEXT_HI), width: "100%" }}>End this season</button>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15.5, color: FEED_TEXT_HI, marginBottom: 4 }}>Start a season</div>
          <div style={{ ...note, marginBottom: 12 }}>Gives the table a “this season” view alongside all time. Give it an end date and the table counts down to it. No results are touched.</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Summer 2026" style={{ ...fld, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <label style={{ flex: 1 }}><div style={{ ...lbl, marginBottom: 6 }}>Starts</div><input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...fld, colorScheme: "dark" }} /></label>
            <label style={{ flex: 1 }}><div style={{ ...lbl, marginBottom: 6 }}>Ends (optional)</div><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ ...fld, colorScheme: "dark" }} /></label>
          </div>
          <button
            onClick={() => updateGroup(group.id, { season: { name: name.trim() || "Season", start: start ? new Date(start).getTime() : Date.now(), end: end ? new Date(end).getTime() : null } })}
            style={{ ...btn(FEED_LIME, FEED_LIME_INK), width: "100%" }}
          >
            Start season
          </button>
        </>
      )}
    </SurfaceCard>
  );
}

// ---------------------------------------------------------------------------
// League settings
// ---------------------------------------------------------------------------

function SettingsPage({ group, updateGroup, isCreator, doublesEnabled, competitionsEnabled, onSetFlags, flash }: any) {
  const [busy, setBusy] = useState(false);
  const flip = async (patch: Record<string, boolean>, said: string) => {
    if (busy) return;
    setBusy(true);
    try { await onSetFlags(patch); flash(said); }
    catch (e: any) { flash(e?.message || "Couldn't change that."); }
    setBusy(false);
  };
  const toggle = (title: string, sub: string, on: boolean, onClick: () => void, enabled = true) => (
    <button disabled={!enabled} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: "none", borderTop: "0.5px solid " + FEED_HAIRLINE, padding: "13px 0", cursor: enabled ? "pointer" : "default", textAlign: "left", opacity: enabled ? 1 : 0.55 }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: body, fontSize: 15, color: FEED_TEXT_HI }}>{title}</span>
        <span style={{ display: "block", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2, lineHeight: 1.45 }}>{sub}</span>
      </span>
      <Switch on={on} />
    </button>
  );
  return (
    <>
      <SurfaceCard radius={18} pad="16px 14px" style={{ marginBottom: 14 }}>
        <div style={{ ...lbl, marginBottom: 6 }}>League name</div>
        <input value={group?.name || ""} onChange={(e) => updateGroup(group.id, { name: e.target.value })} style={fld} />
      </SurfaceCard>

      <SurfaceCard radius={18} pad="4px 14px" style={{ marginBottom: 10 }}>
        {toggle("Doubles", "A separate doubles table, ratings and profile. Singles is untouched.", !!doublesEnabled,
          () => flip({ doubles_enabled: !doublesEnabled }, doublesEnabled ? "Doubles switched off" : "Doubles switched on"), !!isCreator)}
        {toggle("Competitions", "Leagues and knockouts, singles and doubles, set up from Start a competition.", !!competitionsEnabled,
          () => flip({ competitions_enabled: !competitionsEnabled }, competitionsEnabled ? "Competitions switched off" : "Competitions switched on"), !!isCreator)}
        {/* Was "Fair play: Open / Setup required", which named neither what
            it does nor who it affects. */}
        {toggle("Players need a level to be ranked", "On: anyone without a level stays greyed out and unranked until they set one — fairer for a serious league. Off: everyone is ranked straight away.",
          !!group?.requireSetup, () => updateGroup(group.id, { requireSetup: !group?.requireSetup }))}
      </SurfaceCard>
      {!isCreator && <div style={{ ...note, padding: "0 4px" }}>Only the person who created the league can switch doubles and competitions on or off.</div>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

function DataPage({ matches, onClearResults, onImportHistoricalMatches }: any) {
  const [confirmWipe, setConfirmWipe] = useState(false);
  const count = (matches || []).length;
  return (
    <>
      <SurfaceCard radius={18} pad="16px 14px" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15.5, color: FEED_TEXT_HI }}>Import old results</div>
        <div style={{ ...note, margin: "4px 0 12px" }}>Adds dated singles results from before the league used Rally, and creates any missing players without duplicating the ones already here.</div>
        <button onClick={onImportHistoricalMatches} style={{ ...btn(FEED_RAISED, FEED_TEXT_HI), width: "100%" }}>Import results</button>
      </SurfaceCard>
      {/* Two steps and the number out loud (§3). It sits alone on its own
          page now, rather than one mis-tap from the import button. */}
      <SurfaceCard radius={18} pad="16px 14px">
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15.5, color: DOT_LOSS }}>Clear all results</div>
        <div style={{ ...note, margin: "4px 0 12px" }}>Deletes every singles result in this league and keeps the players. For starting completely fresh — it cannot be undone.</div>
        {confirmWipe ? (
          <>
            <div style={{ fontFamily: body, fontSize: 14, color: FEED_TEXT_HI, lineHeight: 1.45, marginBottom: 10 }}>Delete all {count} results in this league? Players are kept. This cannot be undone.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setConfirmWipe(false); onClearResults(); }} style={btn(DOT_LOSS, FEED_LIME_INK)}>Delete {count}</button>
              <button onClick={() => setConfirmWipe(false)} style={btn(FEED_RAISED, FEED_TEXT_HI)}>Cancel</button>
            </div>
          </>
        ) : (
          <button disabled={!count} onClick={() => setConfirmWipe(true)} style={{ ...btn(FEED_RAISED, count ? DOT_LOSS : FEED_TEXT_LOW), width: "100%" }}>{count ? `Clear ${count} results…` : "No results to clear"}</button>
        )}
      </SurfaceCard>
    </>
  );
}
