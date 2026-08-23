"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Trophy, Swords, Plus, Clock, User, Settings as Gear, ChevronLeft, ChevronDown, Check, HelpCircle } from "lucide-react";
import { storage } from "@/lib/storage";
import { ClubAdminReview } from "@/components/admin/ClubAdminReview";
import { listMyAdminClubs } from "@/lib/clubs";
import { HeadToHead } from "@/components/compare/HeadToHead";
import { HelpGuide } from "@/components/help/HelpGuide";
import { History } from "@/components/games/History";
import { LogResult } from "@/components/games/LogResult";
import { BottomNav } from "@/components/layout/BottomNav";
import { GroupSheet } from "@/components/layout/GroupSheet";
import { SubHeader } from "@/components/layout/SubHeader";
import { MyProfile } from "@/components/profile/MyProfile";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { MatchDetail } from "@/components/games/MatchDetail";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { LegacyProfile } from "@/components/profile/LegacyProfile";
import { ProfileScreen } from "@/components/profile/ProfileScreen";
import { Onboarding } from "@/components/settings/Onboarding";
import { SettingsTab } from "@/components/settings/SettingsTab";
import { LeagueHome } from "@/components/table/LeagueHome";
import PlayerClaim from "@/components/auth/PlayerClaim";
import { Avatar } from "@/components/ui/Avatar";
import { START_ELO } from "@/core/constants";
import { computeStats } from "@/core/elo";
import { computeOfficial } from "@/core/official";
import { gkey } from "@/data/seed";
import { uid, winPct } from "@/lib/format";
import { BALL, CHALK, COURT, LINE, MUTED, PANEL, body, display, fontImport, menuRow, mono, wrap } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { importHistoricalMatches, normalizePlayerName } from "@/lib/historyImport";

type LeagueData = {
  players: any[];
  matches: any[];
  me: any;
  fixtures?: any[];
  posts?: any[];
};

const emptyLeagueData: LeagueData = { players: [], matches: [], fixtures: [], posts: [], me: null };

export default function RallyApp({ leagueId, leagueName, leagueRole, displayName }: any) {
  const [groups, setGroups] = useState<Array<{ id: string; name: string; requireSetup?: boolean; season?: any }>>([]);
  const [gid, setGid] = useState<string | null>(null);
  const [gdata, setGdata] = useState<LeagueData>(emptyLeagueData);
  const [rankingMode, setRankingMode] = useState("overall");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ladder");
  const [profileId, setProfileId] = useState(null);
  const [matchDetailId, setMatchDetailId] = useState(null);
  const [legacyId, setLegacyId] = useState(null);
  const [profileYear, setProfileYear] = useState<"all" | number>("all");
  const openProfile = (id: any, year?: "all" | number) => { setProfileId(id); setProfileYear(year ?? "all"); };
  const [groupSheet, setGroupSheet] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [onboarded, setOnboarded] = useState(true);
  const [toast, setToast] = useState("");
  const [claimUI, setClaimUI] = useState<{ candidate: any; others: any[]; authId: string; nameToUse: string; data: LeagueData; cur: any; gs: any[]; st: any } | null>(null);
  const [declinedCandidate, setDeclinedCandidate] = useState(false);
  const [isClubAdmin, setIsClubAdmin] = useState(false);

  useEffect(() => {
    listMyAdminClubs().then((cs) => setIsClubAdmin(cs.length > 0)).catch(() => {});
  }, []);

  const finishBoot = async (data: LeagueData, cur: any, gs: any[], st: any) => {
    const nextGroup = { ...gs[0], ownerId: (st?.ownerId || data.me || null) };
    setGroups([nextGroup]); setGid(cur); setGdata(data);
    setRankingMode(st?.rankingMode || "overall");
    setOnboarded(st ? (st.onboarded ?? false) : false);
    setLoading(false);
  };

  const resolveClaim = async (chosenPlayer: any | null) => {
    if (!claimUI) return;
    const { authId, nameToUse, data, cur, gs, st } = claimUI;
    let next: LeagueData;
    if (chosenPlayer) {
      // Explicit, user-picked claim — never inferred from a name match alone.
      next = { ...data, players: (data.players || []).map((p) => p.id === chosenPlayer.id ? { ...p, auth_id: authId, claimedAt: Date.now() } : p), me: chosenPlayer.id };
    } else {
      const init = { id: uid(), name: nameToUse || "player", level: null, avatar: null, auth_id: authId };
      next = { ...data, players: [...(data.players || []), init], me: init.id };
      try {
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('__dev_auto') === '1') {
          window.localStorage.setItem('rally:diag_seed', JSON.stringify({ init, league: cur }));
        }
      } catch {}
    }
    try { await storage.set(gkey(cur), JSON.stringify(next), true); } catch {}
    setClaimUI(null);
    setDeclinedCandidate(false);
    setLoading(true);
    await finishBoot(next, cur, gs, st);
  };

  useEffect(() => {
    (async () => {
     try {
      // One real league, from Supabase. No demo data — a new league starts empty.
      const cur = leagueId;
      const gs = [{ id: leagueId, name: leagueName || "League", ownerId: null }];
      let st: any = null;
      try { const r = await storage.get("settings_" + leagueId, true); st = r ? JSON.parse(r.value) : null; } catch {}
      let data: LeagueData = { ...emptyLeagueData };
      try { const r = await storage.get(gkey(cur), true); const loaded = r ? JSON.parse(r.value) : null; if (loaded && Array.isArray(loaded.players) && Array.isArray(loaded.matches)) data = loaded as LeagueData; } catch {}

      // Link the signed-in account to a player using the Supabase auth user id
      // (stored as `auth_id`). Never by name alone: a name match only ever
      // becomes a *suggestion* the person explicitly confirms or rejects.
      let nameToUse = displayName;
      let authId: string | null = null;
      if (typeof window !== 'undefined' && supabase) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const u = (userData as any)?.user;
          authId = u?.id || null;
          nameToUse = nameToUse || (u?.user_metadata?.full_name) || (u?.email?.split("@")[0]) || nameToUse;
        } catch {}
      }

      const alreadyLinked = authId ? (data.players || []).find((p) => p.auth_id === authId) : null;
      if (alreadyLinked) {
        data.me = alreadyLinked.id;
        await finishBoot(data, cur, gs, st);
        return;
      }

      const unclaimed = authId ? (data.players || []).filter((p) => !p.auth_id) : [];
      if (authId && unclaimed.length > 0) {
        const candidate = nameToUse ? unclaimed.find((p) => normalizePlayerName(p.name || "") === normalizePlayerName(nameToUse)) || null : null;
        setClaimUI({ candidate, others: unclaimed, authId, nameToUse: nameToUse || "player", data, cur, gs, st });
        setLoading(false);
        return;
      }

      // No auth id, no players at all, or no unclaimed players to offer — start fresh.
      const init = { id: uid(), name: nameToUse || "player", level: null, avatar: null, auth_id: authId };
      data.players = [...(data.players || []), init];
      data.me = init.id;
      try { await storage.set(gkey(cur), JSON.stringify(data), true); } catch {}
      try {
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('__dev_auto') === '1') {
          window.localStorage.setItem('rally:diag_seed', JSON.stringify({ init, league: cur }));
        }
      } catch {}
      await finishBoot(data, cur, gs, st);
     } catch (e) {
      console.error(e);
      setLoading(false);
     }
    })();
  }, []);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2200); };
  const persistSettings = async (extra) => { try { await storage.set("settings_" + gid, JSON.stringify({ currentGroupId: gid, rankingMode, onboarded, ...extra }), true); } catch {} };
  const saveGroups = async (n) => { setGroups(n); try { await storage.set("groups_" + gid, JSON.stringify(n), true); } catch { flash("Couldn't save"); } };
  const saveData = async (n) => { setGdata(n); try { await storage.set(gkey(gid), JSON.stringify(n), true); } catch { flash("Couldn't save"); } };
  const importHistoricalResults = async () => {
    try {
      const result = await importHistoricalMatches(leagueId, { userName: displayName || me?.name || "Sam" });
      await saveData({ ...gdata, players: result.data.players, matches: result.data.matches, me: result.data.me || gdata.me, fixtures: result.data.fixtures || gdata.fixtures, posts: result.data.posts || gdata.posts });
      flash(`${result.imported} historical matches imported${result.skipped ? `, ${result.skipped} already present` : ""}`);
    } catch (error) {
      console.error(error);
      flash("Import failed");
    }
  };

  const setPlayers = (np) => saveData({ ...gdata, players: np });
  const addPlayer = (p) => setPlayers([...players, p]);
  const setMatches = (nm) => saveData({ ...gdata, matches: nm });
  const setMe = (mid) => {
    if (!mid || mid !== gdata.me) {
      flash("Your account stays linked to one player profile.");
      return;
    }
    saveData({ ...gdata, me: mid });
  };
  const editMatch = (id, patch) => saveData({ ...gdata, matches: gdata.matches.map((m) => m.id === id ? { ...m, ...patch } : m) });
  // Editing a match you played: if the opponent has a real account, the change
  // is only a proposal until they agree it — never a unilateral rewrite of
  // their record. A shell opponent has nobody who could agree, so it applies
  // straight away, same as logging a new result against one.
  const proposeEdit = (id, patch) => {
    const m = gdata.matches.find((x) => x.id === id);
    if (!m) return;
    const actingId = players.some((p) => p.id === gdata.me) ? gdata.me : null;
    const oppId = actingId ? (m.p1 === actingId ? m.p2 : m.p2 === actingId ? m.p1 : null) : null;
    const opp = oppId ? players.find((p) => p.id === oppId) : null;
    if (opp && opp.auth_id) {
      saveData({ ...gdata, matches: gdata.matches.map((x) => x.id === id ? { ...x, pendingEdit: { ...patch, proposedBy: actingId, proposedAt: Date.now() } } : x) });
      flash("Change sent — waiting for them to agree");
    } else {
      editMatch(id, patch);
      flash("Updated");
    }
  };
  const approveEdit = (id) => saveData({ ...gdata, matches: gdata.matches.map((m) => { if (m.id !== id || !m.pendingEdit) return m; const { proposedBy, proposedAt, ...patch } = m.pendingEdit; return { ...m, ...patch, pendingEdit: null }; }) });
  const rejectEdit = (id) => saveData({ ...gdata, matches: gdata.matches.map((m) => m.id === id ? { ...m, pendingEdit: null } : m) });
  const deleteBetween = (a, b, year?: number) => saveData({ ...gdata, matches: gdata.matches.filter((m) => { const between = (m.p1 === a && m.p2 === b) || (m.p1 === b && m.p2 === a); if (!between) return true; if (year == null) return false; return new Date(m.date).getFullYear() !== year; }) });
  const deleteMatch = (id) => saveData({ ...gdata, matches: gdata.matches.filter((m) => m.id !== id) });
  const setMode = (m) => { setRankingMode(m); persistSettings({ rankingMode: m }); };
  const fixtures = gdata.fixtures || [];
  const generateFixtures = (rounds = 1) => {
    const ps = gdata.players; const fx: Array<{ id: string; p1: string; p2: string; done: boolean }> = [];
    for (let r = 0; r < rounds; r++) for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) fx.push({ id: uid(), p1: ps[i].id, p2: ps[j].id, done: false });
    saveData({ ...gdata, fixtures: fx });
    flash(fx.length + " fixtures created");
  };
  const clearFixtures = () => saveData({ ...gdata, fixtures: [] });
  const posts = gdata.posts || [];
  const addPost = (text, isAnnouncement) => saveData({ ...gdata, posts: [...(gdata.posts || []), { id: uid(), by: gdata.me, text, date: Date.now(), isAnnouncement: !!isAnnouncement }] });
  const removePost = (id) => saveData({ ...gdata, posts: (gdata.posts || []).filter((x) => x.id !== id) });
  const addFixture = (p1, p2) => saveData({ ...gdata, fixtures: [...(gdata.fixtures || []), { id: uid(), p1, p2, done: false }] });
  const removeFixture = (id) => saveData({ ...gdata, fixtures: (gdata.fixtures || []).filter((f) => f.id !== id) });
  const bookFixture = (id, when) => saveData({ ...gdata, fixtures: (gdata.fixtures || []).map((f) => f.id === id ? { ...f, booked: when || null } : f) });
  const resolveFixture = (fx, winner, score) => {
    if (winner === null) {
      saveData({ ...gdata, matches: gdata.matches.filter((m) => m.id !== fx.matchId), fixtures: (gdata.fixtures || []).map((f) => f.id === fx.id ? { ...f, done: false, winner: undefined, matchId: undefined } : f) });
      return;
    }
    const mid = uid();
    const match = { id: mid, date: Date.now(), p1: fx.p1, p2: fx.p2, winner, score: score || "", status: "confirmed", reportedBy: gdata.me };
    saveData({ ...gdata, matches: [...gdata.matches, match], fixtures: (gdata.fixtures || []).map((f) => f.id === fx.id ? { ...f, done: true, winner, matchId: mid, booked: null } : f) });
  };

  const switchGroup = async (id) => {
    let data: LeagueData | null = null;
    try { const r = await storage.get(gkey(id), true); data = r ? JSON.parse(r.value) : null; } catch {}
    if (data && (!Array.isArray(data.players) || !Array.isArray(data.matches))) data = null;
    if (!data || !data.players || !data.players.length) {
      data = { ...emptyLeagueData };
      try { await storage.set(gkey(id), JSON.stringify(data), true); } catch {}
    }
    setGid(id); setGdata(data); setGroupSheet(false); setProfileId(null); setTab("ladder");
    try { await storage.set("settings_c5", JSON.stringify({ currentGroupId: id, rankingMode, onboarded }), true); } catch {}
  };
  const addGroup = async (name) => {
    const id = "g_" + uid(); const g = { id, name };
    try { await storage.set(gkey(id), JSON.stringify({ players: [], matches: [], me: null }), true); } catch {}
    await saveGroups([...groups, g]); switchGroup(id);
  };
  const renameGroup = (id, name) => saveGroups(groups.map((g) => g.id === id ? { ...g, name } : g));
  const deleteGroup = async (id) => {
    if (groups.length <= 1) return flash("Keep at least one league");
    const next = groups.filter((g) => g.id !== id);
    await saveGroups(next);
    if (gid === id) switchGroup(next[0].id);
  };

  const players = gdata.players, matches = gdata.matches;
  const { elo, wdl, form, deltas } = useMemo(() => computeStats(players, matches), [players, matches]);
  // First names alone collide often enough (two Sams, two Charlies) that
  // this always includes the surname when there is one.
  const nameOf = (id) => { const p = players.find((p) => p.id === id); return p ? p.name + (p.last ? " " + p.last : "") : "—"; };

  // A pending result waits for the opponent to agree it — but only ever for
  // matches logged after this existed (`loggedAt`), so we never mass-confirm
  // an old backlog someone hasn't dealt with yet.
  useEffect(() => {
    const DAY = 24 * 3600 * 1000;
    const now = Date.now();
    const stale = matches.filter((m) => m.status === "pending" && m.loggedAt && now - m.loggedAt > DAY);
    if (stale.length) {
      const ids = new Set(stale.map((m) => m.id));
      setMatches(matches.map((m) => (ids.has(m.id) ? { ...m, status: "confirmed" } : m)));
    }
  }, [matches]);
  const confirmMatch = (id) => setMatches(matches.map((m) => m.id === id ? { ...m, status: "confirmed" } : m));
  const disputeMatch = (id) => setMatches(matches.filter((m) => m.id !== id));
  const updateGroup = (id, patch) => saveGroups(groups.map((g) => g.id === id ? { ...g, ...patch } : g));
  const removePlayer = (id) => saveData({ ...gdata, players: gdata.players.filter((p) => p.id !== id), matches: gdata.matches.filter((m) => m.p1 !== id && m.p2 !== id) });
  const ranked = useMemo(() => {
    const arr = players.filter((p) => !p.inactive);
    const avgOpp = {};
    players.forEach((p) => { avgOpp[p.id] = { sum: 0, n: 0 }; });
    matches.filter((m) => m.status !== "pending").forEach((m) => {
      if (avgOpp[m.p1]) { avgOpp[m.p1].sum += (elo[m.p2] ?? 0); avgOpp[m.p1].n++; }
      if (avgOpp[m.p2]) { avgOpp[m.p2].sum += (elo[m.p1] ?? 0); avgOpp[m.p2].n++; }
    });
    const recScore = (p) => {
      const r = wdl[p.id] || { w: 0, d: 0, l: 0, gp: 0 };
      if (!r.gp) return -1;
      const activity = r.gp / (r.gp + 5);
      const ao = avgOpp[p.id].n ? avgOpp[p.id].sum / avgOpp[p.id].n : 0;
      const oppFactor = Math.max(0.5, Math.min(2, 1 + ao / 200));
      return winPct(r) * activity * oppFactor;
    };
    const formScoreOf = (p) => (form[p.id] || []).slice(-5).reduce((s, x) => s + (x === "W" ? 1 : x === "L" ? -1 : 0), 0);
    if (rankingMode === "elo") arr.sort((a, b) => (elo[b.id] ?? START_ELO) - (elo[a.id] ?? START_ELO));
    else if (rankingMode === "record") arr.sort((a, b) => recScore(b) - recScore(a) || (wdl[b.id]?.w ?? 0) - (wdl[a.id]?.w ?? 0));
    else if (rankingMode === "winpct") arr.sort((a, b) => { const ra = wdl[a.id] || { gp: 0 }, rb = wdl[b.id] || { gp: 0 }; if (!ra.gp && !rb.gp) return 0; if (!ra.gp) return 1; if (!rb.gp) return -1; return winPct(rb) - winPct(ra) || rb.gp - ra.gp; });
    else if (rankingMode === "form") arr.sort((a, b) => { const ra = wdl[a.id] || { gp: 0 }, rb = wdl[b.id] || { gp: 0 }; if (!ra.gp && !rb.gp) return 0; if (!ra.gp) return 1; if (!rb.gp) return -1; return formScoreOf(b) - formScoreOf(a) || (rb.w ?? 0) - (ra.w ?? 0); });
    else { const off = computeOfficial(players, matches, wdl); arr.sort((a, b) => ((off[b.id] ?? -1e9) - (off[a.id] ?? -1e9)) || ((elo[b.id] ?? 0) - (elo[a.id] ?? 0)) || ((wdl[a.id]?.gp ?? 0) - (wdl[b.id]?.gp ?? 0))); }
    return arr;
  }, [players, elo, wdl, form, matches, rankingMode]);

  if (loading) return <div style={{ ...wrap, display: "grid", placeItems: "center", minHeight: "100vh" }}><div style={{ color: MUTED, fontFamily: body }}>Loading…</div></div>;

  if (claimUI) {
    const showSuggestion = claimUI.candidate && !declinedCandidate;
    return (
      <div style={{ position: "fixed", inset: 0, background: COURT, zIndex: 100, overflowY: "auto" }}>
        <style>{fontImport}</style>
        {showSuggestion ? (
          <PlayerClaim player={claimUI.candidate} onClaim={() => resolveClaim(claimUI.candidate)} onNotMe={() => setDeclinedCandidate(true)} />
        ) : (
          <div style={{ maxWidth: 620, margin: "0 auto", padding: "40px 20px 60px" }}>
            <div style={{ fontFamily: mono, letterSpacing: 3, color: BALL, fontSize: 11, textTransform: "uppercase" }}>Welcome{claimUI.nameToUse ? ", " + claimUI.nameToUse : ""}</div>
            <h1 style={{ fontFamily: display, fontWeight: 800, color: CHALK, margin: "6px 0 16px", fontSize: 32, lineHeight: 1, textTransform: "uppercase", letterSpacing: -0.5 }}>Is one of these you?</h1>
            <div style={{ fontFamily: body, fontSize: 13, color: MUTED, marginBottom: 18, lineHeight: 1.5 }}>Pick your existing player to inherit its history — nothing gets claimed automatically, you choose. Or start a brand new profile.</div>
            {claimUI.others.filter((p) => !claimUI.candidate || p.id !== claimUI.candidate.id).map((p) => (
              <button key={p.id} onClick={() => resolveClaim(p)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: PANEL, border: "1px solid " + LINE, borderRadius: 10, padding: "12px 14px", marginBottom: 10, cursor: "pointer", textAlign: "left" }}>
                <Avatar player={p} size={36} />
                <span style={{ flex: 1, fontFamily: body, fontSize: 15, color: CHALK, fontWeight: 600 }}>{p.name}{p.last ? " " + p.last : ""}</span>
                <span style={{ color: BALL, fontFamily: mono, fontSize: 12 }}>Claim ›</span>
              </button>
            ))}
            <button onClick={() => resolveClaim(null)} style={{ width: "100%", background: "transparent", border: "1px solid " + LINE, borderRadius: 10, padding: "12px 14px", marginTop: 8, cursor: "pointer", color: MUTED, fontFamily: mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
              None of these — create a new profile
            </button>
          </div>
        )}
      </div>
    );
  }

  const group = groups.find((g) => g.id === gid) || { id: gid, name: "League", ownerId: null, requireSetup: undefined, season: undefined };
  const meId = players.some((p) => p.id === gdata.me) ? gdata.me : players[0]?.id;
  // Gated on the real league_members.role from Postgres, not the group's
  // ownerId field — that field is never actually persisted anywhere, so it
  // silently fell back to "whoever's currently looking at the screen" and
  // gave every member the same bulk-delete/direct-edit powers as the
  // league's real owner. Only owner/editor gets these.
  const canManageMatches = !!meId && (leagueRole === "owner" || leagueRole === "editor");
  const me = players.find((p) => p.id === meId);
  const finishOnboarding = (hist) => {
    if (hist && meId) {
      // `hist` may be either the previous array form or the new object form
      // { levelHistory, initialRecord, initialElo } — handle both.
      if (Array.isArray(hist)) {
        const last = hist[hist.length - 1];
        setPlayers(players.map((p) => p.id === meId ? { ...p, levelHistory: hist, level: last ? { cat: last.cat, sub: last.sub } : p.level } : p));
      } else {
        const last = (hist.levelHistory || []).slice(-1)[0];
        setPlayers(players.map((p) => p.id === meId ? {
          ...p,
          levelHistory: hist.levelHistory || p.levelHistory,
          level: last ? { cat: last.cat, sub: last.sub } : p.level,
          initialRecord: hist.initialRecord || p.initialRecord,
          initialElo: hist.initialElo || p.initialElo,
        } : p));
      }
    }
    setOnboarded(true); persistSettings({ onboarded: true });
  };
  const pendingForMe = matches.filter((m) => m.status === "pending" && (m.p1 === meId || m.p2 === meId) && m.reportedBy !== meId).length;
  const profilePlayer = players.find((p) => p.id === profileId);
  const matchDetailMatch = matches.find((m) => m.id === matchDetailId);
  const legacyPlayer = players.find((p) => p.id === legacyId);
  const shared = { players, elo, wdl, form, deltas, matches, nameOf, ranked, showElo: true, onOpen: openProfile, fixtures, group, meId, onProposeEdit: proposeEdit, onOpenMatch: setMatchDetailId };
  const main = tab === "ladder" || tab === "add" || tab === "history" || tab === "profile";

  return (
    <div style={wrap}>
      <style>{fontImport}</style>
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "22px 16px 110px" }}>
        {main && (
          <header style={{ marginBottom: 18 }}>
            <button onClick={() => setGroupSheet(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: PANEL, border: "1px solid " + LINE, borderRadius: 999, padding: "5px 12px", cursor: "pointer", color: BALL, fontFamily: mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
              {group?.name || "League"} <ChevronDown size={13} />
            </button>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
              <h1 style={{ fontFamily: display, fontWeight: 800, color: CHALK, margin: "8px 0 0", fontSize: 38, lineHeight: 0.95, textTransform: "uppercase", letterSpacing: -0.5 }}>
                {tab === "ladder" ? "Table" : tab === "add" ? "Add result" : tab === "history" ? "Games" : "Profile"}
              </h1>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <NotificationBell meId={meId} players={players} matches={matches} posts={posts} nameOf={nameOf} onOpenMatch={setMatchDetailId} />
                {tab === "profile" && (
                  <button onClick={() => setMenuOpen(true)} aria-label="Menu" style={{ background: PANEL, border: "1px solid " + LINE, borderRadius: 10, padding: "9px 10px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 3.5, flexShrink: 0 }}>
                    {[0, 1, 2].map((i) => <span key={i} style={{ display: "block", width: 17, height: 2, background: BALL, borderRadius: 2 }} />)}
                  </button>
                )}
              </div>
            </div>
          </header>
        )}

        {tab === "ladder" && pendingForMe > 0 && <button onClick={() => setTab("history")} style={{ width: "100%", background: PANEL, border: "1px solid " + BALL, borderRadius: 10, padding: "12px 14px", marginBottom: 14, cursor: "pointer", color: BALL, fontFamily: body, fontSize: 14, fontWeight: 600, textAlign: "left" }}>{pendingForMe} result{pendingForMe > 1 ? "s" : ""} waiting for you to agree →</button>}
        {tab === "ladder" && <LeagueHome players={players} matches={matches} group={group} fixtures={fixtures} mode={rankingMode} onMode={setMode} onOpen={openProfile} onOpenLegacy={setLegacyId} requireSetup={group?.requireSetup} nameOf={nameOf} />}
        {tab === "add" && <LogResult players={players} matches={matches} elo={elo} meId={meId} onSave={(mt) => { setMatches([mt, ...matches]); flash(mt.status === "pending" ? "Logged — awaiting opponent's OK" : "Logged"); setTab("history"); }} onSaveMany={(arr) => { setMatches([...arr, ...matches]); flash("Added " + arr.length + " results"); setTab("ladder"); }} onCreatePlayer={addPlayer} onDeleteBetween={canManageMatches ? (a, b, year) => { deleteBetween(a, b, year); flash(year ? "Cleared " + year : "Cleared"); } : null} />}
        {tab === "history" && <History posts={posts} onPost={addPost} onRemovePost={removePost} matches={matches} players={players} elo={elo} nameOf={nameOf} meId={meId} groupName={group?.name} fixtures={fixtures} onGenerate={generateFixtures} onClearFixtures={clearFixtures} onResolveFixture={resolveFixture} onBookFixture={bookFixture} onConfirm={confirmMatch} onDispute={disputeMatch} onDelete={disputeMatch} canEditMatches={canManageMatches} onEditMatch={editMatch} onApproveEdit={approveEdit} onRejectEdit={rejectEdit} onOpenMatch={setMatchDetailId} />}
        {tab === "h2h" && <SubHeader title="Compare" onBack={() => setTab("profile")} />}
        {tab === "h2h" && <HeadToHead players={players} matches={matches} elo={elo} wdl={wdl} nameOf={nameOf} onOpen={openProfile} onCreatePlayer={addPlayer} />}
        {tab === "profile" && <ProfileScreen players={players} meId={meId} shared={shared} onSetMe={setMe} goH2H={() => setTab("h2h")} goSettings={() => setTab("settings")} goEdit={() => setTab("myprofile")} />}
        {tab === "myprofile" && <SubHeader title="My profile" onBack={() => setTab("profile")} />}
        {tab === "myprofile" && <MyProfile players={players} meId={meId} setPlayers={setPlayers} flash={flash} />}
        {tab === "settings" && <SubHeader title="Settings" onBack={() => setTab("profile")} />}
        {tab === "settings" && <SettingsTab group={group} updateGroup={updateGroup} onRemovePlayer={removePlayer} fixtures={fixtures} onGenerate={generateFixtures} onClearFixtures={clearFixtures} onAddFixture={addFixture} onRemoveFixture={removeFixture} onLoadDemo={() => { flash("Demo data is off in the live app"); }} onClearResults={() => { setMatches([]); flash("Results cleared"); }} onImportHistoricalMatches={importHistoricalResults} players={players} setPlayers={setPlayers} matches={matches} flash={flash} />}
        {tab === "clubadmin" && <SubHeader title="Club admin" onBack={() => setTab("profile")} />}
        {tab === "clubadmin" && <ClubAdminReview />}
        {tab === "help" && <SubHeader title="Help" onBack={() => setTab("profile")} />}
        {tab === "help" && <HelpGuide />}
      </div>

      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 96 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "1px solid " + LINE, padding: "18px 16px 36px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>Menu</span>
              <button onClick={() => setMenuOpen(false)} style={{ background: "transparent", border: "1px solid " + LINE, color: MUTED, borderRadius: 6, padding: "4px 10px", fontFamily: mono, fontSize: 12, cursor: "pointer" }}>Close</button>
            </div>
            <button onClick={() => { setMenuOpen(false); setTab("myprofile"); }} style={menuRow}><User size={18} color={BALL} /><span style={{ flex: 1, textAlign: "left", fontFamily: body, fontSize: 15, color: CHALK }}>Edit my profile</span><span style={{ color: MUTED, fontFamily: mono }}>\u203A</span></button>
            <button onClick={() => { setMenuOpen(false); setTab("h2h"); }} style={menuRow}><Swords size={18} color={BALL} /><span style={{ flex: 1, textAlign: "left", fontFamily: body, fontSize: 15, color: CHALK }}>Compare players</span><span style={{ color: MUTED, fontFamily: mono }}>\u203A</span></button>
            <button onClick={() => { setMenuOpen(false); setTab("settings"); }} style={menuRow}><Gear size={18} color={BALL} /><span style={{ flex: 1, textAlign: "left", fontFamily: body, fontSize: 15, color: CHALK }}>Manage players &amp; league</span><span style={{ color: MUTED, fontFamily: mono }}>\u203A</span></button>
            {isClubAdmin && <button onClick={() => { setMenuOpen(false); setTab("clubadmin"); }} style={menuRow}><Trophy size={18} color={BALL} /><span style={{ flex: 1, textAlign: "left", fontFamily: body, fontSize: 15, color: CHALK }}>Club admin</span><span style={{ color: MUTED, fontFamily: mono }}>\u203A</span></button>}
            <button onClick={() => { setMenuOpen(false); setTab("help"); }} style={menuRow}><HelpCircle size={18} color={BALL} /><span style={{ flex: 1, textAlign: "left", fontFamily: body, fontSize: 15, color: CHALK }}>Help</span><span style={{ color: MUTED, fontFamily: mono }}>\u203A</span></button>
          </div>
        </div>
      )}
      {profilePlayer && <ProfileModal player={profilePlayer} {...shared} profileYear={profileYear} onClose={() => setProfileId(null)} />}
      {legacyPlayer && <LegacyProfile player={legacyPlayer} players={players} matches={matches} meId={meId} nameOf={nameOf} onOpenMatch={setMatchDetailId} onClose={() => setLegacyId(null)} />}
      {matchDetailMatch && <MatchDetail match={matchDetailMatch} players={players} matches={matches} nameOf={nameOf} meId={meId} onProposeEdit={proposeEdit} onUpdateExtras={editMatch} onDeleteMatch={deleteMatch} groupName={group?.name} season={(group as any)?.season} onOpenProfile={(id) => { setMatchDetailId(null); openProfile(id); }} onClose={() => setMatchDetailId(null)} />}
      {groupSheet && <GroupSheet groups={groups} currentId={gid} onSwitch={switchGroup} onAdd={addGroup} onDelete={deleteGroup} onClose={() => setGroupSheet(false)} />}
      {!onboarded && meId && <Onboarding me={me} onFinish={finishOnboarding} />}
      <BottomNav tab={tab} setTab={(t) => { setProfileId(null); setTab(t); }} />
      {toast && <div style={{ position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", background: BALL, color: COURT, fontFamily: body, fontWeight: 700, padding: "10px 18px", borderRadius: 999, fontSize: 13, boxShadow: "0 8px 24px rgba(0,0,0,.4)", zIndex: 80 }}>{toast}</div>}
    </div>
  );
}
