"use client";
import React, { useEffect, useMemo, useState } from "react";
import { OFFENSIVE_NAME_MESSAGE, isOffensiveName } from "@/core/nameFilter";
import { Calendar, Check, ChevronLeft, ChevronRight, Database, Link2, Settings2, Shield, Trophy, Upload, Users } from "lucide-react";
import { ImportResults } from "@/components/settings/ImportResults";
import { AccountCard } from "@/components/settings/AccountCard";
import { LeagueMembers } from "@/components/settings/LeagueMembers";
import { PlayerEditSheet } from "@/components/settings/PlayerEditSheet";
import { LevelSuggestionsPage, levelSuggestionsFor } from "@/components/settings/LevelSuggestions";
import { Avatar } from "@/components/ui/Avatar";
import { ClubMark } from "@/components/ui/ClubMark";
import { readPhotoAsDataUrl } from "@/lib/photo";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { levelNow } from "@/core/levels";
import { isDisputed } from "@/core/matchStatus";
import { inviteUrl } from "@/lib/invite";
import { isFriendlyLeague } from "@/lib/leagueData";
import { fmtDate, formatMatchDate, fullNameOf, uid } from "@/lib/format";
import { daysLeftLabel, londonDay, seasonWindow } from "@/core/seasons";
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

type Page = "home" | "players" | "singles" | "seasons" | "roles" | "settings" | "data" | "import" | "levels" | "disputes" | "suggest";

const lbl: React.CSSProperties = {
  fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID,
  letterSpacing: 0,
};
const fld: React.CSSProperties = {
  ...miniInput, fontFamily: body, fontSize: 15, background: FEED_RAISED, color: FEED_TEXT_HI,
  padding: "10px 12px", width: "100%", boxSizing: "border-box",
};
const btn = (fill: string, ink: string): React.CSSProperties => ({
  flex: 1, fontFamily: body, fontWeight: 600, fontSize: 14, padding: "11px 10px",
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
    if (!link) { flash("This club has no invite code."); return; }
    const text = `Join ${group?.name || "our club"} on Southwood`;
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title: text, text, url: link });
        return;
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return; // they closed the sheet
    }
    try { await navigator.clipboard.writeText(link); flash("Invite link copied — paste it into your group chat"); }
    catch { flash("Club code: " + leagueJoinCode); }
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

  if (page === "players") return <><>{back("Run your club")}</><PlayersPage {...props} /></>;
  // Competition ties are managed from their competition, not from here.
  if (page === "singles") return <><>{back("Run your club")}</><SinglesFixturesPage {...props} fixtures={(fixtures || []).filter((f: any) => !f.competitionId)} /></>;
  if (page === "seasons") return <><>{back("Run your club")}</><SeasonsPage group={group} updateGroup={updateGroup} seasonsState={props.seasonsState} onStartSeason={props.onStartSeason} onEditSeason={props.onEditSeason} onEndSeason={props.onEndSeason} flash={flash} /></>;
  if (page === "disputes") return <><>{back("Run your club")}</><DisputesPage players={players} matches={matches} onKeep={props.onKeepDisputed} onRemove={props.onRemoveDisputed} /></>;
  if (page === "suggest") return <><>{back("Run your club")}</><LevelSuggestionsPage players={players} matches={matches} leagueId={leagueId} onSetLevel={props.onSetLevelFor} /></>;
  if (page === "levels") return <><>{back("Run your club")}</><LevelRequestsPage players={players} requests={props.levelRequests} onDecide={props.onDecideLevelRequest} flash={flash} /></>;
  if (page === "roles") return <><>{back("Run your club")}</><LeagueMembers leagueId={leagueId} leagueName={group?.name} onRemoved={props.onReload} /></>;
  if (page === "settings") return <><>{back("Run your club")}</><SettingsPage {...props} /></>;
  if (page === "data") return <><>{back("Run your club")}</><DataPage {...props} onImport={() => setPage("import")} /></>;
  if (page === "import") return (
    <ImportResults
      players={players} matches={matches} meId={meId} leagueName={group?.name}
      onImport={props.onImportResults} onBack={() => setPage("home")}
    />
  );

  // --- members' screen ------------------------------------------------------
  if (!canManage && !friendly) {
    return (
      <div>
        <SurfaceCard radius={18} pad="18px 16px" style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: body, fontWeight: 600, fontSize: 18, color: FEED_TEXT_HI }}>{group?.name || "Your club"}</div>
          <div style={{ ...note, marginTop: 4 }}>{active} players{doublesEnabled ? " · singles and doubles" : ""}</div>
          {leagueJoinCode && (
            <button onClick={invite} style={{ ...btn(FEED_LIME, FEED_LIME_INK), width: "100%", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Link2 size={17} strokeWidth={2.2} />Invite someone
            </button>
          )}
          <div style={{ ...note, marginTop: 12 }}>The club&apos;s organisers look after players, competitions and settings.</div>
        </SurfaceCard>
        <AccountCard displayName={displayName} />
      </div>
    );
  }

  // --- the hub --------------------------------------------------------------
  const tile = (icon: React.ReactNode, title: string, onClick: () => void, primary = false) => (
    <button onClick={onClick} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, background: primary ? FEED_LIME : FEED_CARD, color: primary ? FEED_LIME_INK : FEED_TEXT_HI, border: "none", borderRadius: 16, padding: "14px 12px", cursor: "pointer", textAlign: "left" }}>
      {icon}
      <span style={{ fontFamily: body, fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>{title}</span>
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

  const suggestCount = !friendly && isCreator && props.onSetLevelFor ? levelSuggestionsFor(players || [], matches || []).length : 0;
  const toPlay = (fixtures || []).filter((f: any) => !f.done && !f.competitionId).length;
  const ic = (C: any) => <C size={18} color={FEED_LIME} strokeWidth={2} />;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {!friendly && leagueJoinCode && tile(<Link2 size={20} strokeWidth={2.2} />, "Invite players", invite, true)}
        {!friendly && tile(<Trophy size={20} color={FEED_LIME} strokeWidth={2} />, "Start a competition", () => setChoosing(true))}
        {tile(<Users size={20} color={FEED_LIME} strokeWidth={2} />, `Players · ${active}`, () => setPage("players"))}
      </div>

      {/* The code itself, on screen (Sam, 2026-10-22: "can't even see a code
          to give to people"). The share sheet carries it inside a link, and
          iOS's Copy can take the title instead — so it is also here to read
          out in the clubhouse or type into Join a club, with the link one tap
          away. */}
      {!friendly && leagueJoinCode && (
        <SurfaceCard radius={18} pad="12px 14px" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID }}>Club code — anyone can join with it</div>
            <div style={{ fontFamily: body, fontSize: 24, fontWeight: 600, letterSpacing: 3, color: FEED_TEXT_HI, ...tabular }}>{leagueJoinCode}</div>
          </div>
          <button
            onClick={async () => {
              const link = inviteUrl(leagueJoinCode);
              try { await navigator.clipboard.writeText(link || leagueJoinCode); flash("Link copied"); }
              catch { flash("Club code: " + leagueJoinCode); }
            }}
            style={{ ...btn(FEED_RAISED, FEED_TEXT_HI), flex: "0 0 auto", padding: "10px 14px" }}
          >
            Copy link
          </button>
        </SurfaceCard>
      )}

      {showChecklist && (
        <SurfaceCard radius={18} pad="16px 14px 8px" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI }}>Getting started</span>
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
          {!friendly && row(ic(Calendar), "Seasons", group?.season ? `${group.season.name} · ${daysLeftLabel(group.season).toLowerCase()}` : "None running", "seasons")}
          {!friendly && row(ic(Trophy), "Arranged matches", toPlay ? `${toPlay} to play` : "Hand-picked singles matches, outside any competition", "singles")}
          {!friendly && props.onKeepDisputed && row(ic(Shield), "Disputed results", (() => { const n = (matches || []).filter((m: any) => isDisputed(m)).length; return n ? `${n} to decide` : "None"; })(), "disputes")}
          {!friendly && props.levelRequests && row(ic(Users), "Level requests", (() => { const n = props.levelRequests.filter((r: any) => r.status === "pending").length; return n ? `${n} waiting` : "None waiting"; })(), "levels")}
          {/* Level suggestions: the club's creator only for now, so Sam can
              check who it flags before other organisers see it. */}
          {!friendly && isCreator && props.onSetLevelFor && row(ic(Users), "Level suggestions", suggestCount ? `${suggestCount} to look at` : "Everyone's stars match their results", "suggest")}
          {!friendly && row(ic(Shield), "Who helps run it", "Organisers and helpers", "roles")}
          {!friendly && row(ic(Settings2), "Club settings", `${group?.name || "Name"} · doubles ${doublesEnabled ? "on" : "off"}`, "settings")}
          {!friendly && row(ic(Upload), "Import old results", "Paste them from a spreadsheet or notes", "import")}
          {row(ic(Database), "Data", "Clear results", "data")}
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
      <span style={{ display: "block", fontFamily: body, fontWeight: 600, fontSize: 15.5, color: FEED_TEXT_HI }}>{title}</span>
      <span style={{ display: "block", ...note, marginTop: 3 }}>{sub}</span>
    </button>
  );
  // What is off, and one tap to turn it on for whoever is allowed to.
  const off = (what: string, patch: Record<string, boolean>) => (
    <div style={{ ...note, margin: "-4px 2px 12px" }}>
      {what} switched off for this league.{" "}
      {isCreator
        ? <button onClick={() => onTurnOn(patch)} style={{ background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 12.5, cursor: "pointer", padding: 0 }}>Switch on</button>
        : "The person who created the club can switch it on."}
    </div>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: FEED_OVERLAY, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 97 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: FEED_RAISED, width: "100%", maxWidth: 620, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: "18px 16px 34px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontFamily: body, fontWeight: 600, fontSize: 17, color: FEED_TEXT_HI }}>Start a competition</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: FEED_TEXT_MID, fontFamily: body, fontSize: 14, cursor: "pointer" }}>Close</button>
        </div>
        <div style={{ ...note, marginBottom: 14 }}>A league (everyone plays everyone, with a table) or a knockout (winners go through). You choose next.</div>
        {option("Singles", "Pick the players — or add everyone in one tap. Southwood draws the matches, keeps the table and moves winners through.", onSingles, !competitions)}
        {option("Doubles", "Fixed pairs, the same way.", onDoubles, !competitions || !doubles)}
        {!competitions ? off("Competitions are", { competitions_enabled: true }) : !doubles ? off("Doubles is", { doubles_enabled: true }) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

function PlayersPage({ players, setPlayers, matches, onRemovePlayer, meId, flash, leagueId, onSetLevelFor, onSetHistoryFor, onSetStartFor, onSetUtrFor, onRenameFor }: any) {
  const friendly = isFriendlyLeague(leagueId);
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
    if (isOffensiveName(n)) return flash(OFFENSIVE_NAME_MESSAGE);
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
          onSetLevel={friendly
            // Friendlies have no organisers: the old direct edit, as before.
            ? async (level) => { setPlayers(players.map((x: any) => (x.id === editingPlayer.id ? { ...x, level } : x))); }
            : onSetLevelFor ? (level) => onSetLevelFor(editingPlayer.id, level).catch(() => {}) : undefined}
          onSetHistory={friendly
            ? async (h) => { setPlayers(players.map((x: any) => (x.id === editingPlayer.id ? { ...x, levelHistory: h } : x))); }
            : onSetHistoryFor ? (h) => onSetHistoryFor(editingPlayer.id, h).catch(() => {}) : undefined}
          onSetStart={friendly
            ? async (elo, record) => { setPlayers(players.map((x: any) => (x.id === editingPlayer.id ? { ...x, initialElo: elo ?? undefined, initialRecord: record ?? undefined } : x))); }
            : onSetStartFor ? (elo, record) => onSetStartFor(editingPlayer.id, elo, record) : undefined}
          onRename={!friendly && onRenameFor ? (n, l) => onRenameFor(editingPlayer.id, n, l) : undefined}
          onSetUtr={!friendly && onSetUtrFor ? (u) => onSetUtrFor(editingPlayer.id, u) : undefined}
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
  const open = (fixtures || []).filter((f: any) => !f.done && !f.outcome);
  const opts = players.slice().sort((x: any, y: any) => fullNameOf(x).localeCompare(fullNameOf(y)));

  return (
    <div>
      <SurfaceCard radius={18} pad="16px 14px" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15.5, color: FEED_TEXT_HI }}>Everyone plays everyone</div>
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
        <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15.5, color: FEED_TEXT_HI, marginBottom: 10 }}>Add one match</div>
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

// The date box that does not run off the card. iOS Safari draws a date input
// at its own width, ignoring width: 100%, so two of them side by side pushed
// "Ends" past the right edge of the card (brief item 4). Stacked, with
// appearance off so the stylesheet decides the width.
const dateFld: React.CSSProperties = {
  ...fld, display: "block", width: "100%", minWidth: 0, boxSizing: "border-box",
  WebkitAppearance: "none", appearance: "none", textAlign: "left", colorScheme: "dark",
};

function SeasonsPage({ group, updateGroup, seasonsState, onStartSeason, onEditSeason, onEndSeason, flash }: any) {
  const [name, setName] = useState("");
  const [start, setStart] = useState(londonDay());
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const installed = !!seasonsState?.installed;
  const current = seasonsState?.current || null;
  const past = (seasonsState?.seasons || []).filter((x: any) => x.status === "ended");

  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e: any) { flash?.(e?.message || "Couldn't save that."); }
    setBusy(false);
  };

  // ---- before schema_seasons.sql: the old one-season blob, as it was, with
  // the date boxes fixed. Ending one here still deletes it — which is the
  // reason the table exists — so the page says so.
  if (!installed) {
    const s = group?.season;
    return (
      <SurfaceCard radius={18} pad="16px 14px">
        {s ? (
          <>
            <div style={{ fontFamily: body, fontWeight: 600, fontSize: 17, color: FEED_TEXT_HI }}>{s.name}</div>
            <div style={{ ...note, marginTop: 4 }}>{fmtDate(s.start)}{s.end ? " to " + fmtDate(s.end) : " · no end date"}</div>
            <div style={{ ...note, marginTop: 10 }}>Ending a season here removes it. Once supabase/schema_seasons.sql has been run, finished seasons are kept with their final standings.</div>
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
            <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15.5, color: FEED_TEXT_HI, marginBottom: 4 }}>Start a season</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Winter 2026/27" style={{ ...fld, marginBottom: 10 }} />
            <div style={{ ...lbl, marginBottom: 6 }}>Starts</div>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...dateFld, marginBottom: 10 }} />
            <div style={{ ...lbl, marginBottom: 6 }}>Ends (optional)</div>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ ...dateFld, marginBottom: 12 }} />
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

  // ---- the seasons table.
  return (
    <>
      {current ? (
        <SurfaceCard radius={18} pad="16px 14px" style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: body, fontWeight: 600, fontSize: 17, color: FEED_TEXT_HI }}>{current.name}</div>
          <div style={{ ...note, marginTop: 4 }}>
            {formatMatchDate(seasonWindow(current).start)}{current.endsOn ? " to " + formatMatchDate(seasonWindow(current).end) : " · no end date"} · {daysLeftLabel(current)}
          </div>
          <div style={{ ...note, marginTop: 10 }}>
            The table opens on this season. It closes by itself the day after it ends: the standings freeze, the podium shows, and the winners are posted to the feed.
          </div>
          {editing ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...lbl, marginBottom: 6 }}>Name</div>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...fld, marginBottom: 10 }} />
              <div style={{ ...lbl, marginBottom: 6 }}>Ends</div>
              <input type="date" value={editEnd} min={current.startsOn} onChange={(e) => setEditEnd(e.target.value)} style={{ ...dateFld, marginBottom: 12 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button disabled={busy} onClick={() => act(async () => { await onEditSeason(current.id, { name: editName.trim() || current.name, endsOn: editEnd || null }); setEditing(false); })} style={btn(FEED_LIME, FEED_LIME_INK)}>Save</button>
                <button onClick={() => setEditing(false)} style={btn(FEED_RAISED, FEED_TEXT_HI)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => { setEditName(current.name); setEditEnd(current.endsOn || ""); setEditing(true); setConfirmEnd(false); }} style={{ ...btn(FEED_RAISED, FEED_TEXT_HI), flex: 1 }}>Edit</button>
              {!confirmEnd && <button onClick={() => setConfirmEnd(true)} style={{ ...btn(FEED_RAISED, DOT_LOSS), flex: 1 }}>End now…</button>}
            </div>
          )}
          {confirmEnd && !editing && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: body, fontSize: 14, color: FEED_TEXT_HI, lineHeight: 1.45, marginBottom: 10 }}>
                End {current.name} today? Its standings freeze now and the winners are posted to the feed. The season is kept.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button disabled={busy} onClick={() => act(async () => { await onEndSeason(current); setConfirmEnd(false); })} style={btn(DOT_LOSS, FEED_LIME_INK)}>End {current.name}</button>
                <button onClick={() => setConfirmEnd(false)} style={btn(FEED_RAISED, FEED_TEXT_HI)}>Keep it</button>
              </div>
            </div>
          )}
        </SurfaceCard>
      ) : (
        <SurfaceCard radius={18} pad="16px 14px" style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15.5, color: FEED_TEXT_HI, marginBottom: 4 }}>Start a season</div>
          <div style={{ ...note, marginBottom: 12 }}>
            Gives the table a This season view and a countdown on Home. Competitions can be added to it, and take its dates. No results are touched.
          </div>
          <div style={{ ...lbl, marginBottom: 6 }}>Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winter 2026/27" style={{ ...fld, marginBottom: 10 }} />
          <div style={{ ...lbl, marginBottom: 6 }}>Starts</div>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...dateFld, marginBottom: 10 }} />
          <div style={{ ...lbl, marginBottom: 6 }}>Ends</div>
          <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} style={{ ...dateFld, marginBottom: 6 }} />
          <div style={{ ...note, marginBottom: 12 }}>Needed for competitions and the countdown. Leave it empty for a season with no end.</div>
          <button
            disabled={busy || !start}
            onClick={() => act(async () => {
              if (end && end < start) throw new Error("The end date is before the start.");
              await onStartSeason({ name: name.trim() || "Season", startsOn: start, endsOn: end || null });
              setName(""); setEnd("");
            })}
            style={{ ...btn(FEED_LIME, FEED_LIME_INK), width: "100%" }}
          >
            {busy ? "Starting…" : "Start season"}
          </button>
        </SurfaceCard>
      )}

      {past.length > 0 && (
        <SurfaceCard radius={18} pad="14px">
          <div style={{ ...lbl, marginBottom: 8 }}>Past seasons</div>
          {past.map((p: any, i: number) => (
            <div key={p.id} style={{ padding: "8px 0", borderTop: i ? "0.5px solid " + FEED_RAISED : "none" }}>
              <div style={{ fontFamily: body, fontSize: 15, color: FEED_TEXT_HI }}>{p.name}</div>
              <div style={{ ...note, fontSize: 12 }}>
                {formatMatchDate(seasonWindow(p).start)}{p.endsOn ? " to " + formatMatchDate(seasonWindow(p).end) : ""} · final standings {p.endedAt ? "from " + formatMatchDate(p.endedAt) : ""}
              </div>
            </div>
          ))}
        </SurfaceCard>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Disputed results (winter Phase 2, Sam 2026-10-21)
// ---------------------------------------------------------------------------
//
// A dispute used to delete the match, which let one person wipe a result they
// lost. Now it waits here, counting for nothing, until an organiser keeps it
// (it counts, as logged) or removes it. Two taps each, because either way
// somebody is told they were wrong.

function DisputesPage({ players, matches, onKeep, onRemove }: any) {
  const [busy, setBusy] = useState<string | null>(null);
  const [sure, setSure] = useState<string | null>(null);
  const list = (matches || []).filter((m: any) => isDisputed(m)).sort((a: any, b: any) => b.date - a.date);
  const nameOf = (id: string) => fullNameOf(players.find((p: any) => p.id === id)) || "Someone";
  const act = async (id: string, fn: (id: string) => any) => {
    setBusy(id);
    try { await fn(id); } finally { setBusy(null); setSure(null); }
  };
  return (
    <SurfaceCard radius={18} pad="14px">
      <div style={{ ...lbl, marginBottom: 6 }}>To decide</div>
      {!list.length && <div style={note}>Nothing disputed. When a player disputes a result it comes here, and it doesn&apos;t count until you decide.</div>}
      {list.map((m: any, i: number) => {
        const result = m.winner === "draw" ? `${nameOf(m.p1)} drew with ${nameOf(m.p2)}` : `${nameOf(m.winner === "p1" ? m.p1 : m.p2)} beat ${nameOf(m.winner === "p1" ? m.p2 : m.p1)}`;
        return (
          <div key={m.id} style={{ padding: "10px 0", borderTop: i ? "0.5px solid " + FEED_RAISED : "none" }}>
            <div style={{ fontFamily: body, fontSize: 15, color: FEED_TEXT_HI }}>{result}{m.score ? " · " + m.score : ""}</div>
            <div style={{ ...note, marginTop: 2 }}>{fmtDate(m.date)} · {m.reportedBy && players.some((p: any) => p.id === m.reportedBy) ? `logged by ${nameOf(m.reportedBy)}, disputed by the other side` : "disputed"}</div>
            {sure === m.id ? (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button disabled={busy === m.id} onClick={() => act(m.id, onRemove)} style={btn(DOT_LOSS, FEED_LIME_INK)}>Remove it for good</button>
                <button onClick={() => setSure(null)} style={btn(FEED_RAISED, FEED_TEXT_HI)}>Back</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button disabled={busy === m.id} onClick={() => act(m.id, onKeep)} style={btn(FEED_LIME, FEED_LIME_INK)}>Keep the result</button>
                <button onClick={() => setSure(m.id)} style={btn(FEED_RAISED, FEED_TEXT_HI)}>Remove it…</button>
              </div>
            )}
          </div>
        );
      })}
    </SurfaceCard>
  );
}

// ---------------------------------------------------------------------------
// Level requests (brief item 2)
// ---------------------------------------------------------------------------

/**
 * Players asking for a different level. Only organisers set levels now; a
 * player asks from their profile, and the request waits here. Approving sets
 * the level from this month, with the dated period in their history, exactly
 * as setting it by hand does.
 */
function LevelRequestsPage({ players, requests, onDecide, flash }: any) {
  const [busy, setBusy] = useState<string | null>(null);
  const pending = (requests || []).filter((r: any) => r.status === "pending");
  const decided = (requests || []).filter((r: any) => r.status !== "pending").slice(-10).reverse();
  const nameOf = (id: string) => fullNameOf(players.find((p: any) => p.id === id));
  const levelOf = (id: string) => { const l = levelNow(players.find((p: any) => p.id === id)); return l ? `${l.cat} · ${l.sub}` : "no level"; };
  const act = async (r: any, ok: boolean) => {
    setBusy(r.id);
    try { await onDecide(r, ok); } catch (e: any) { flash?.(e?.message || "Couldn't save that."); }
    setBusy(null);
  };
  return (
    <>
      <SurfaceCard radius={18} pad="14px" style={{ marginBottom: 14 }}>
        <div style={{ ...lbl, marginBottom: 6 }}>Waiting</div>
        {!pending.length && <div style={note}>Nobody has asked. Players ask from their profile, and you can set anyone's level yourself from Players.</div>}
        {pending.map((r: any, i: number) => (
          <div key={r.id} style={{ padding: "10px 0", borderTop: i ? "0.5px solid " + FEED_RAISED : "none" }}>
            <div style={{ fontFamily: body, fontSize: 15, color: FEED_TEXT_HI }}>{nameOf(r.playerId)}</div>
            <div style={{ ...note, marginTop: 2 }}>
              Now {levelOf(r.playerId)} · asks for <span style={{ color: FEED_TEXT_HI }}>{r.level.cat} · {r.level.sub}</span>
            </div>
            {r.note && <div style={{ ...note, marginTop: 4, fontStyle: "italic" }}>“{r.note}”</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button disabled={busy === r.id} onClick={() => act(r, true)} style={btn(FEED_LIME, FEED_LIME_INK)}>Approve</button>
              <button disabled={busy === r.id} onClick={() => act(r, false)} style={btn(FEED_RAISED, FEED_TEXT_HI)}>Decline</button>
            </div>
          </div>
        ))}
      </SurfaceCard>
      {decided.length > 0 && (
        <SurfaceCard radius={18} pad="14px">
          <div style={{ ...lbl, marginBottom: 6 }}>Recently decided</div>
          {decided.map((r: any, i: number) => (
            <div key={r.id} style={{ ...note, padding: "6px 0", borderTop: i ? "0.5px solid " + FEED_RAISED : "none" }}>
              {nameOf(r.playerId)} · {r.level.cat} · {r.level.sub} · {r.status}
            </div>
          ))}
        </SurfaceCard>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// League settings
// ---------------------------------------------------------------------------

function SettingsPage({ group, updateGroup, isCreator, doublesEnabled, competitionsEnabled, onSetFlags, flash, clubLogo, onSetLogo, canManage, friendly }: any) {
  const [busy, setBusy] = useState(false);
  const [logo, setLogo] = useState<string | null>(clubLogo ?? null);
  const [savingLogo, setSavingLogo] = useState(false);
  const logoInput = React.useRef<HTMLInputElement>(null);
  // The club's logo (schema_club_logo.sql), shown in its circle on the start
  // page and in the club switcher. Fitted whole on white, not cropped.
  const saveLogo = async (next: string | null) => {
    setSavingLogo(true);
    try { await onSetLogo(next); setLogo(next); flash(next ? "Logo saved" : "Logo removed"); }
    catch (e: any) { flash(e?.message || "Couldn't save that logo."); }
    setSavingLogo(false);
  };
  const pickLogo = async (file: File) => {
    try { await saveLogo(await readPhotoAsDataUrl(file, 256, { fit: "contain" })); }
    catch { flash("Couldn't read that picture. Try a PNG or JPEG."); }
  };
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
        <div style={{ ...lbl, marginBottom: 6 }}>Club name</div>
        <input value={group?.name || ""} onChange={(e) => updateGroup(group.id, { name: e.target.value })} style={fld} />
      </SurfaceCard>

      {onSetLogo && canManage && !friendly && (
        <SurfaceCard radius={18} pad="16px 14px" style={{ marginBottom: 14 }}>
          <div style={{ ...lbl, marginBottom: 10 }}>Club logo</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <ClubMark club={{ name: group?.name, logo_url: logo }} size={56} />
            <input ref={logoInput} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickLogo(f); e.target.value = ""; }} />
            <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
              <button disabled={savingLogo} onClick={() => logoInput.current?.click()} style={{ ...btn(FEED_RAISED, FEED_TEXT_HI), flex: "0 0 auto", padding: "10px 14px", opacity: savingLogo ? 0.5 : 1 }}>
                {savingLogo ? "Saving…" : logo ? "Change logo" : "Upload a logo"}
              </button>
              {logo && <button disabled={savingLogo} onClick={() => void saveLogo(null)} style={{ ...btn("transparent", FEED_TEXT_MID), flex: "0 0 auto", padding: "10px 6px" }}>Remove</button>}
            </div>
          </div>
          <div style={{ ...note, marginTop: 10 }}>Shown in the club&apos;s circle for everyone. Without one, it&apos;s the club&apos;s first letter.</div>
        </SurfaceCard>
      )}

      <SurfaceCard radius={18} pad="4px 14px" style={{ marginBottom: 10 }}>
        {toggle("Doubles", "A separate doubles table, ratings and profile. Singles is untouched.", !!doublesEnabled,
          () => flip({ doubles_enabled: !doublesEnabled }, doublesEnabled ? "Doubles switched off" : "Doubles switched on"), !!isCreator)}
        {toggle("Competitions", "Leagues and knockouts, singles and doubles, set up from Start a competition.", !!competitionsEnabled,
          () => flip({ competitions_enabled: !competitionsEnabled }, competitionsEnabled ? "Competitions switched off" : "Competitions switched on"), !!isCreator)}
        {/* Was "Fair play: Open / Setup required", which named neither what
            it does nor who it affects. */}
        {toggle("Players need a level to be ranked", "On: anyone without a level stays greyed out and unranked until they set one — fairer for a serious club. Off: everyone is ranked straight away.",
          !!group?.requireSetup, () => updateGroup(group.id, { requireSetup: !group?.requireSetup }))}
      </SurfaceCard>
      {!isCreator && <div style={{ ...note, padding: "0 4px" }}>Only the person who created the club can switch doubles and competitions on or off.</div>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

function DataPage({ matches, onClearResults, onImport, isOwner, group, leagueId }: any) {
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [typed, setTyped] = useState("");
  const count = (matches || []).length;
  // Brief item 4: owner only, and the owner types the club's name. Two taps
  // was the rule (§3), and two taps is still one thumb resting in the wrong
  // place twice; a name has to be meant. Friendlies have no owner to ask, so
  // there it stays as it was, behind the same typed confirmation.
  const friendly = isFriendlyLeague(leagueId);
  const clubName = String(group?.name || "").trim();
  const typedOk = typed.trim().toLowerCase() === clubName.toLowerCase() && clubName.length > 0;
  return (
    <>
      {/* This button used to import a list of results written into the code
          — one club's own history, Sam v Cheese and all — into whichever
          league pressed it. It now opens the real importer. */}
      <SurfaceCard radius={18} pad="16px 14px" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15.5, color: FEED_TEXT_HI }}>Import old results</div>
        <div style={{ ...note, margin: "4px 0 12px" }}>Paste results from before the club used Southwood — from a spreadsheet, notes or a group chat. You check every one before it&apos;s added.</div>
        <button onClick={onImport} style={{ ...btn(FEED_RAISED, FEED_TEXT_HI), width: "100%" }}>Import results</button>
      </SurfaceCard>
      {/* Two steps and the number out loud (§3). It sits alone on its own
          page now, rather than one mis-tap from the import button. */}
      <SurfaceCard radius={18} pad="16px 14px">
        <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15.5, color: DOT_LOSS }}>Clear all results</div>
        <div style={{ ...note, margin: "4px 0 12px" }}>Deletes every singles result in this club and keeps the players. For starting completely fresh — it cannot be undone.</div>
        {!isOwner && !friendly ? (
          <div style={note}>Only the club's owner can clear results.</div>
        ) : confirmWipe ? (
          <>
            <div style={{ fontFamily: body, fontSize: 14, color: FEED_TEXT_HI, lineHeight: 1.45, marginBottom: 10 }}>
              Delete all {count} results in {clubName || "this club"}? Players are kept. This cannot be undone.
            </div>
            <div style={{ ...lbl, marginBottom: 6 }}>Type the club's name to confirm</div>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={clubName} autoComplete="off" style={{ ...fld, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={!typedOk} onClick={() => { setConfirmWipe(false); setTyped(""); onClearResults(); }} style={{ ...btn(typedOk ? DOT_LOSS : FEED_RAISED, typedOk ? FEED_LIME_INK : FEED_TEXT_LOW), cursor: typedOk ? "pointer" : "default" }}>Delete {count}</button>
              <button onClick={() => { setConfirmWipe(false); setTyped(""); }} style={btn(FEED_RAISED, FEED_TEXT_HI)}>Cancel</button>
            </div>
          </>
        ) : (
          <button disabled={!count} onClick={() => setConfirmWipe(true)} style={{ ...btn(FEED_RAISED, count ? DOT_LOSS : FEED_TEXT_LOW), width: "100%" }}>{count ? `Clear ${count} results…` : "No results to clear"}</button>
        )}
      </SurfaceCard>
    </>
  );
}
