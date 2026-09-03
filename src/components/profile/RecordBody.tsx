"use client";
import React, { useState, useMemo, useEffect } from "react";
import { H2HRow } from "@/components/profile/H2HRow";
import { Avatar } from "@/components/ui/Avatar";
import { FormRow } from "@/components/ui/FormRow";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { SeasonSummary } from "@/components/profile/SeasonSummary";
import { TrophyWall } from "@/components/profile/TrophyWall";
import { VerifiedTrophies } from "@/components/profile/VerifiedTrophies";
import { Empty, Stat, StreakTile } from "@/components/ui/atoms";
import { LEVELS, START_ELO } from "@/core/constants";
import { computeStats } from "@/core/elo";
import { levelAt, levelVal, yearOf } from "@/core/levels";
import { computeOfficial } from "@/core/official";
import { rankMaps } from "@/core/rank";
import { computeRivalries } from "@/core/rivalries";
import { ratingForMatch, ratingNow, TIER_COLOR, TIER_LABEL, TIER_RANK, type Tier } from "@/core/difficulty";
import { findMemory } from "@/core/memories";
import { FriendRow, getFriendshipWith, sendFriendRequest, acceptFriendRequest, removeFriendship } from "@/lib/friends";
import { globalKeyFor, globalRankFor } from "@/lib/globalTable";
import { D, fmtDate, winPct } from "@/lib/format";
import { BALL, CHALK, CLAY, COURT, LINE, MUTED, PANEL2, RADIUS_SM, body, miniInput, mono, pill } from "@/lib/theme";

// Only ever rendered for someone else's claimed profile, never your own.
// Friendship is between accounts (auth ids), not league players, so this
// looks nothing up from the league's player list.
function FriendAction({ theirAuthId, myAuthId }: { theirAuthId: string; myAuthId: string }) {
  const [row, setRow] = useState<FriendRow | null | "loading">("loading");
  const load = () => { setRow("loading"); getFriendshipWith(theirAuthId).then(setRow).catch(() => setRow(null)); };
  useEffect(load, [theirAuthId, myAuthId]);

  if (row === "loading") return null;
  const btn = (label: string, onClick: () => void, color = BALL, textColor = COURT) => (
    <button onClick={onClick} style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: textColor, background: color, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>{label}</button>
  );
  if (!row) return btn("Add friend", async () => { try { await sendFriendRequest(theirAuthId); load(); } catch {} });
  if (row.status === "accepted") return btn("Friends ✓", async () => { try { await removeFriendship(row.id); load(); } catch {} }, PANEL2, CHALK);
  if (row.requester_id === myAuthId) return btn("Request sent", async () => { try { await removeFriendship(row.id); load(); } catch {} }, PANEL2, MUTED);
  return btn("Accept friend request", async () => { try { await acceptFriendRequest(row.id); load(); } catch {} });
}

export function RecordBody({ player, players, elo, wdl, form, deltas, matches, nameOf, ranked, showElo, onOpen, fixtures, group, meId, myAuthId, onProposeEdit, onOpenMatch, initialYear }: any) {
  const [yr, setYr] = useState<"all" | number>(initialYear ?? "all");
  const [showSeason, setShowSeason] = useState(false);
  const years = useMemo(() => Array.from(new Set(matches.filter((m) => m.status !== "pending").map((m) => new Date(m.date).getFullYear()))).sort((a: number, b: number) => b - a), [matches]);
  const scopedMatches = useMemo(() => (yr === "all" ? matches : matches.filter((m) => new Date(m.date).getFullYear() === yr)), [matches, yr]);
  const yearStats = useMemo(() => (yr === "all" ? null : computeStats(players, scopedMatches)), [yr, players, scopedMatches]);
  const activeElo = yr === "all" ? elo : yearStats!.elo;
  const activeWdl = yr === "all" ? wdl : yearStats!.wdl;
  const activeDeltas = yr === "all" ? deltas : yearStats!.deltas;

  // Player-reported, from onboarding's "when did you start playing?" — not
  // Rally's own records, which is why LegacyProfile keeps it separately
  // labelled from firstYear elsewhere. Just a nice, low-stakes fact here.
  const tennisStart = yearOf(player.levelHistory?.[0]?.from ?? null);
  const tennisYears = tennisStart != null ? new Date().getFullYear() - tennisStart : null;
  const r = activeWdl[player.id] || { w: 0, d: 0, l: 0, gp: 0 };
  const rank = ranked.findIndex((p) => p.id === player.id) + 1;
  const rating = Math.round(activeElo[player.id] ?? START_ELO);
  const offMap = computeOfficial(players, scopedMatches, activeWdl);
  const byOff = ranked.filter((p) => (wdl[p.id]?.gp || 0) > 0).sort((a, b) => (offMap[b.id] ?? -1e9) - (offMap[a.id] ?? -1e9));
  const offIdx = byOff.findIndex((p) => p.id === player.id);
  const above = offIdx > 0 ? byOff[offIdx - 1] : null;
  const gap = above ? Math.max(1, Math.round((offMap[above.id] ?? 0) - (offMap[player.id] ?? 0))) : null;
  const isTop = offIdx === 0;
  const pct = r.gp ? Math.round(winPct(r) * 100) : null;
  const [resultFilter, setResultFilter] = useState<"W" | "D" | "L" | null>(null);
  const [openVs, setOpenVs] = useState<string | null>(null);
  const bouts = scopedMatches.filter((m) => m.p1 === player.id || m.p2 === player.id).sort((a, b) => b.date - a.date);
  const resultFor = (m) => m.winner === "draw" ? "D" : ((m.winner === "p1" && m.p1 === player.id) || (m.winner === "p2" && m.p2 === player.id)) ? "W" : "L";
  const oppId = (m) => m.p1 === player.id ? m.p2 : m.p1;
  const byId = {}; (players || []).forEach((p) => { byId[p.id] = p; });
  const wins = bouts.filter((m) => resultFor(m) === "W" && m.status !== "pending").map((m) => { const oid = oppId(m); const lvAt = levelAt(byId[oid], m.date); const oppLv = levelVal(lvAt) ?? 0; const myLv = levelVal(levelAt(player, m.date)) ?? 0; const upset = Math.max(0, oppLv - myLv); return { oid, lvAt, upset, q: (oppLv + upset) * 1000 + (activeElo[oid] ?? 0), year: new Date(m.date).getFullYear() }; });
  const bestWins = [...wins].sort((a, b) => b.q - a.q).slice(0, 3);
  const chrono = [...bouts].filter((m) => m.status !== "pending").sort((a, b) => a.date - b.date);
  let currentStreak = 0; for (let i = chrono.length - 1; i >= 0; i--) { if (resultFor(chrono[i]) === "W") currentStreak++; else break; }
  const runs: any[][] = []; let cur: any[] = [];
  chrono.forEach((m) => { if (resultFor(m) === "W") cur.push(m); else { if (cur.length) runs.push(cur); cur = []; } });
  if (cur.length) runs.push(cur);
  const bestStreak = runs.reduce((mx, run) => Math.max(mx, run.length), 0);
  const runQ = (run) => run.reduce((s, m) => s + (levelVal(levelAt(byId[oppId(m)], m.date)) ?? 0), 0);
  let impRun: any[] | null = null, impQ = -1; runs.forEach((run) => { const q = runQ(run); if (q > impQ) { impQ = q; impRun = run; } });
  const currentRun = currentStreak > 0 && runs.length ? runs[runs.length - 1] : [] as any[];
  const bestRun = runs.reduce((b, run) => run.length > b.length ? run : b, [] as any[]);
  const toughStreak = impRun ? (impRun as any[]).length : 0;
  const h2h = {};
  chrono.forEach((m) => { const oid = oppId(m); const res = resultFor(m); const year = new Date(m.date).getFullYear(); if (!h2h[oid]) h2h[oid] = { w: 0, d: 0, l: 0, minY: year, maxY: year }; if (res === "W") h2h[oid].w++; else if (res === "L") h2h[oid].l++; else h2h[oid].d++; h2h[oid].minY = Math.min(h2h[oid].minY, year); h2h[oid].maxY = Math.max(h2h[oid].maxY, year); });
  const h2hList = Object.keys(h2h).map((oid) => ({ oid, ...h2h[oid], net: h2h[oid].w - h2h[oid].l }));
  const tierRankOf = (oid: string) => TIER_RANK[ratingNow(player, byId[oid]).tier];
  const byToughness = (a: { oid: string }, b: { oid: string }) => tierRankOf(a.oid) - tierRankOf(b.oid);
  const winningVs = h2hList.filter((x) => x.net > 0).sort(byToughness);
  const evenVs = h2hList.filter((x) => x.net === 0).sort(byToughness);
  const losingVs = h2hList.filter((x) => x.net < 0).sort(byToughness);
  const recStr2 = (x) => (x.d > 0 ? x.w + "-" + x.d + "-" + x.l : x.w + "-" + x.l);
  const yrStr = (x) => x.minY === x.maxY ? String(x.minY) : x.minY + "–" + x.maxY;
  const nm = (oid) => byId[oid]?.name ? (byId[oid].name + (byId[oid].last ? " " + byId[oid].last : "")) : nameOf(oid);
  const vsMatches = (oid) => chrono.filter((m) => oppId(m) === oid).slice().sort((a, b) => b.date - a.date);
  const ranks = rankMaps(players, matches, elo, wdl);
  const [openStreak, setOpenStreak] = useState<"now" | "best" | "tough" | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [openTier, setOpenTier] = useState<Tier | null>(null);
  const [showLevels, setShowLevels] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [openLevel, setOpenLevel] = useState<string | null>(null);
  const rivalries = useMemo(() => computeRivalries(player.id, scopedMatches), [player.id, scopedMatches]);
  const memory = useMemo(() => findMemory(player.id, matches, nameOf), [player.id, matches, nameOf]);
  // Same underlying matches as the winning/losing lists above — grouped by
  // opponent difficulty tier instead of by opponent. Uses ratingForMatch (the
  // opponent's level at the time), same as each individual bout row.
  const qualityTiers: Tier[] = ["gold", "silver", "blue", "green", "orange", "red"];
  const qualityGroups = useMemo(() => {
    const g: Record<string, any[]> = {};
    qualityTiers.forEach((t) => (g[t] = []));
    chrono.forEach((m) => {
      const rt = ratingForMatch(player, byId[oppId(m)], m.date).tier;
      (g[rt] || (g[rt] = [])).push(m);
    });
    return qualityTiers.map((t) => ({ tier: t, matches: g[t] }));
  }, [chrono, player]);
  // Opponent Levels answers a different question from Opponent Quality.
  // Quality is relative — "how strong were they compared to me". This is
  // absolute — "what level have I actually beaten". It's the counterweight
  // to self-assessed levels: if someone claims Advanced and the record
  // against them is 15-0, that shows up here in plain sight. Grouped by the
  // opponent's category at the time of the match, never today's claim, so a
  // win doesn't retroactively get better because they promoted themselves.
  const levelGroups = useMemo(() => {
    const g: Record<string, { w: number; d: number; l: number; per: Record<string, { w: number; d: number; l: number }> }> = {};
    chrono.forEach((m: any) => {
      const cat = levelAt(byId[oppId(m)], m.date)?.cat;
      if (!cat) return;
      const res = resultFor(m);
      const bucket = g[cat] || (g[cat] = { w: 0, d: 0, l: 0, per: {} });
      const oid = oppId(m);
      const per = bucket.per[oid] || (bucket.per[oid] = { w: 0, d: 0, l: 0 });
      if (res === "W") { bucket.w++; per.w++; } else if (res === "L") { bucket.l++; per.l++; } else { bucket.d++; per.d++; }
    });
    return LEVELS.filter((c) => g[c]).map((cat) => ({ cat, ...g[cat] }));
  }, [chrono, player]);
  // The last five with who each was against. WWWWW reads identically whether
  // it was five semi-pros or five beginners; the bar underneath is the part
  // that tells you which.
  const last5 = useMemo(() => chrono.slice(-5).map((m: any) => ({
    res: resultFor(m),
    color: ratingForMatch(player, byId[oppId(m)], m.date).color,
  })), [chrono, player]);
  // One word for the schedule someone actually chooses to play. Strictly
  // about who they face, never about whether they win — you can be 2-20 and
  // still be the bravest player in the league. Needs five rated matches
  // before it says anything, because three easy games isn't a pattern.
  const playStyle = useMemo(() => {
    const tiers = chrono.map((m: any) => ratingForMatch(player, byId[oppId(m)], m.date).tier).filter((t: string) => t !== "muted");
    if (tiers.length < 5) return null;
    const share = tiers.filter((t: string) => t === "gold" || t === "silver" || t === "blue" || t === "green").length / tiers.length;
    const pctTxt = Math.round(share * 100) + "% of their matches are against their own level or above.";
    if (share >= 0.85) return { label: "Fearless", color: TIER_COLOR.gold, note: "Barely takes an easy match. " + pctTxt };
    if (share >= 0.65) return { label: "Tested", color: TIER_COLOR.blue, note: "Mostly plays up or level. " + pctTxt };
    if (share >= 0.4) return { label: "Balanced", color: TIER_COLOR.green, note: "A fair mix of hard and easy. " + pctTxt };
    if (share >= 0.2) return { label: "Comfortable", color: TIER_COLOR.orange, note: "More easy matches than hard ones. " + pctTxt };
    return { label: "Padding the record", color: TIER_COLOR.red, note: "Nearly every match is against someone below their level. " + pctTxt };
  }, [chrono, player]);
  useEffect(() => {
    let alive = true;
    globalRankFor(globalKeyFor(player)).then((n) => { if (alive) setGlobalRank(n); }).catch(() => {});
    return () => { alive = false; };
  }, [player.id, player.auth_id]);
  return (
    <>
      {memory && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: PANEL2, borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>🕰️</span>
          <span style={{ fontFamily: body, fontSize: 13, color: CHALK, lineHeight: 1.4 }}>{memory.text}</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <Avatar player={player} size={48} enlargeable />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ fontFamily: body, fontSize: 26, fontWeight: 800, color: CHALK, margin: 0 }}>{player.name}{player.nick ? " \u201C" + player.nick + "\u201D" : ""}{player.last ? " " + player.last : ""}</h2>
            <LevelBadge level={player.level} />
          </div>
          {(player.age || player.home || tennisYears != null) && <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, marginTop: 3 }}>{[player.age ? player.age + " yrs" : null, player.home || null, tennisYears != null ? "🎾 " + (tennisYears <= 0 ? "started this year" : tennisYears + " year" + (tennisYears === 1 ? "" : "s") + " playing") : null].filter(Boolean).join(" · ")}</div>}
          {player.inactive ? (
            <div style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: MUTED, marginTop: 3 }}>Not active in this league · record kept</div>
          ) : r.gp > 0 ? (
            <div style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: MUTED, marginTop: 3 }}><span style={{ fontFamily: mono, color: BALL, fontWeight: 700, fontSize: 14 }}>#{ranks.off[player.id]}</span> Official <span style={{ color: LINE }}>·</span> <span style={{ fontFamily: mono, fontWeight: 700 }}>#{ranks.el[player.id]}</span> ELO <span style={{ color: LINE }}>·</span> <span style={{ fontFamily: mono, fontWeight: 700 }}>#{ranks.rec[player.id]}</span> Record</div>
          ) : (
            <div style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: MUTED, marginTop: 3 }}>Unranked</div>
          )}
        </div>
        {player.auth_id && myAuthId && player.auth_id !== myAuthId && <FriendAction theirAuthId={player.auth_id} myAuthId={myAuthId} />}
      </div>
      {r.gp > 0 && !player.inactive && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "9px 14px", background: PANEL2, borderRadius: RADIUS_SM, padding: "11px 13px", margin: "10px 0 0" }}>
          {showElo && <span style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: MUTED }}>ELO <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 14, color: CHALK }}>{rating.toLocaleString()}</span></span>}
          {yr === "all" && globalRank != null && <span style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: MUTED }}>Global <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 14, color: CHALK }}>#{globalRank}</span></span>}
          {last5.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: MUTED }}>Form</span>
              <FormRow items={last5.map((x: any) => x.res)} colors={last5.map((x: any) => x.color)} />
            </span>
          )}
          {playStyle && (
            <button onClick={() => setShowStyle(!showStyle)} style={{ ...pill(playStyle.color + "26", playStyle.color), border: "none", cursor: "pointer" }}>{playStyle.label}</button>
          )}
        </div>
      )}
      {showStyle && playStyle && (
        <div style={{ fontFamily: body, fontSize: 12, color: MUTED, lineHeight: 1.45, background: PANEL2, borderRadius: RADIUS_SM, padding: "9px 13px", marginTop: 4 }}>
          {playStyle.note} The bars under Form show the same thing match by match.
        </div>
      )}
      {showElo && yr === "all" && r.gp > 0 && !player.inactive && (isTop || (above && gap !== null)) && (
        <div style={{ background: PANEL2, border: "none", borderRadius: 12, padding: "10px 12px", marginBottom: 4, fontFamily: body, fontSize: 13, color: CHALK }}>
          {isTop ? <><strong style={{ color: BALL }}>Top of the table.</strong> Nobody above — keep winning to stay there.</>
                 : <><strong style={{ color: BALL }}>{gap} pts</strong> behind {above.name}{above.last ? " " + above.last : ""} — beat good players to close the gap.</>}
        </div>
      )}
      {years.length > 0 && (
        <div style={{ display: "flex", gap: 6, margin: "12px 0 0" }}>
          <select value={String(yr)} onChange={(e) => { setYr(e.target.value === "all" ? "all" : Number(e.target.value)); setResultFilter(null); setOpenVs(null); }} style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }}>
            <option value="all">All Time</option>
            {years.map((y: number) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
          {yr !== "all" && <button onClick={() => setShowSeason(true)} style={{ ...miniInput, cursor: "pointer", color: BALL, flexShrink: 0, whiteSpace: "nowrap" as const }}>Season summary</button>}
        </div>
      )}
      {showSeason && yr !== "all" && <SeasonSummary player={player} players={players} matches={matches} year={yr} fixtures={fixtures} group={group} nameOf={nameOf} onOpenMatch={onOpenMatch} onClose={() => setShowSeason(false)} />}
      <div style={{ display: "flex", gap: 10, margin: "16px 0", marginBottom: resultFilter ? 10 : 18 }}>
        <Stat n={r.w} label="Won" c={BALL} big onClick={() => setResultFilter(resultFilter === "W" ? null : "W")} active={resultFilter === "W"} />
        <Stat n={r.d} label="Drawn" c={MUTED} big onClick={() => setResultFilter(resultFilter === "D" ? null : "D")} active={resultFilter === "D"} />
        <Stat n={r.l} label="Lost" c={CLAY} big onClick={() => setResultFilter(resultFilter === "L" ? null : "L")} active={resultFilter === "L"} />
        <Stat n={pct === null ? "–" : pct + "%"} label="Win rate" c={BALL} big />
      </div>
      {resultFilter && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: BALL }}>{resultFilter === "W" ? "Wins" : resultFilter === "D" ? "Draws" : "Losses"}</div>
            <button onClick={() => setResultFilter(null)} style={{ background: "transparent", border: "none", color: BALL, fontFamily: body, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>All ✕</button>
          </div>
          <div style={{ background: PANEL2, border: "1px solid " + BALL, borderRadius: 12, padding: "2px 12px" }}>
            {bouts.filter((m) => resultFor(m) === resultFilter).length
              ? bouts.filter((m) => resultFor(m) === resultFilter).map((m) => <BoutRow key={m.id} m={m} resultFor={resultFor} oppName={nm(oppId(m))} activeDeltas={activeDeltas} playerId={player.id} players={players} meId={meId} onProposeEdit={onProposeEdit} onOpenMatch={onOpenMatch} />)
              : <div style={{ fontFamily: body, fontSize: 13, color: MUTED, padding: "10px 0" }}>No matches in this category yet.</div>}
          </div>
        </div>
      )}
      {rivalries.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: MUTED, marginBottom: 6 }}>Rivalries</div>
          {rivalries.slice(0, 3).map((rv) => (
            <div key={rv.oid}>
              <RivalryRow rivalry={rv} name={nm(rv.oid)} onClick={() => setOpenVs(openVs === rv.oid ? null : rv.oid)} />
              {openVs === rv.oid && <VsMatches oid={rv.oid} matches={vsMatches(rv.oid)} resultFor={resultFor} onOpen={onOpen} selfPlayer={player} oppPlayer={byId[rv.oid]} />}
            </div>
          ))}
        </div>
      )}
      {r.gp > 0 && bestWins.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: MUTED, marginBottom: 6 }}>Best wins</div>
          {bestWins.map((w, i) => (
            <button key={i} onClick={() => onOpen && onOpen(w.oid)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontSize: 16 }}>{["🥇", "🥈", "🥉"][i]}</span>
              <span style={{ fontFamily: body, fontSize: 14, color: CHALK }}>{nm(w.oid)}{w.lvAt ? <span style={{ color: MUTED }}> ({w.lvAt.cat})</span> : null}</span>
              <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 11, color: MUTED }}>{w.year}</span>
              <span style={{ fontFamily: mono, fontSize: 12, color: MUTED }}>›</span>
            </button>
          ))}
        </div>
      )}
      {r.gp > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: openStreak ? 10 : 20 }}>
          <StreakTile n={currentStreak} label="Streak now" c={currentStreak > 0 ? BALL : MUTED} active={openStreak === "now"} onClick={() => setOpenStreak(openStreak === "now" ? null : "now")} />
          <StreakTile n={bestStreak} label="Best streak" c={CHALK} active={openStreak === "best"} onClick={() => setOpenStreak(openStreak === "best" ? null : "best")} />
          <StreakTile n={toughStreak} label="Toughest" c={BALL} active={openStreak === "tough"} onClick={() => setOpenStreak(openStreak === "tough" ? null : "tough")} />
        </div>
      )}
      {openStreak && (() => {
        const run = openStreak === "now" ? currentRun : openStreak === "best" ? bestRun : impRun;
        const title = openStreak === "now" ? "Current streak" : openStreak === "best" ? "Best streak" : "Toughest streak";
        if (!run || !run.length) return <div style={{ fontFamily: body, fontSize: 13, color: MUTED, marginBottom: 20 }}>No streak to show yet.</div>;
        return (
          <div style={{ background: PANEL2, border: "none", borderRadius: 12, padding: "10px 12px", marginBottom: 20 }}>
            <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: BALL, marginBottom: 6 }}>{title} · {run.length} {run.length === 1 ? "win" : "wins"}</div>
            {run.map((m, i) => (
              <button key={i} onClick={() => onOpen && onOpen(oppId(m))} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "transparent", border: "none", padding: "5px 0", cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontFamily: body, fontSize: 13, color: CHALK }}>def. {nm(oppId(m))}</span>
                <span style={{ fontFamily: mono, fontSize: 11, color: MUTED }}>{new Date(m.date).getFullYear()} ›</span>
              </button>
            ))}
          </div>
        );
      })()}
      {(winningVs.length > 0 || losingVs.length > 0 || evenVs.length > 0) && (
        <div style={{ marginBottom: 20 }}>
          {winningVs.length > 0 && (
            <div>
              <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: BALL, marginBottom: 4 }}>Winning records</div>
              {winningVs.map((x) => (
                <div key={x.oid}>
                  <H2HRow name={nm(x.oid)} rec={recStr2(x)} yr={yrStr(x)} c={BALL} level={byId[x.oid]?.level} onClick={() => setOpenVs(openVs === x.oid ? null : x.oid)} />
                  {openVs === x.oid && <VsMatches oid={x.oid} matches={vsMatches(x.oid)} resultFor={resultFor} onOpen={onOpen} selfPlayer={player} oppPlayer={byId[x.oid]} />}
                </div>
              ))}
            </div>
          )}
          {evenVs.length > 0 && (
            <div>
              <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: MUTED, margin: "12px 0 4px" }}>Even</div>
              {evenVs.map((x) => (
                <div key={x.oid}>
                  <H2HRow name={nm(x.oid)} rec={recStr2(x)} yr={yrStr(x)} c={MUTED} level={byId[x.oid]?.level} onClick={() => setOpenVs(openVs === x.oid ? null : x.oid)} />
                  {openVs === x.oid && <VsMatches oid={x.oid} matches={vsMatches(x.oid)} resultFor={resultFor} onOpen={onOpen} selfPlayer={player} oppPlayer={byId[x.oid]} />}
                </div>
              ))}
            </div>
          )}
          {losingVs.length > 0 && (
            <div>
              <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: CLAY, margin: "12px 0 4px" }}>Losing records</div>
              {losingVs.map((x) => (
                <div key={x.oid}>
                  <H2HRow name={nm(x.oid)} rec={recStr2(x)} yr={yrStr(x)} c={CLAY} level={byId[x.oid]?.level} onClick={() => setOpenVs(openVs === x.oid ? null : x.oid)} />
                  {openVs === x.oid && <VsMatches oid={x.oid} matches={vsMatches(x.oid)} resultFor={resultFor} onOpen={onOpen} selfPlayer={player} oppPlayer={byId[x.oid]} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {r.gp > 0 && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setShowQuality(!showQuality)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: PANEL2, border: "none", borderRadius: RADIUS_SM, padding: "13px 14px", marginBottom: showQuality ? 8 : 0, cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontFamily: body, fontWeight: 700, fontSize: 15, color: CHALK }}>Opponent quality</span>
            <span style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: BALL }}>{showQuality ? "Hide ▾" : "Show ›"}</span>
          </button>
          {showQuality && (
            <>
              {qualityGroups.map(({ tier, matches: tm }) => (
                <QualityTierRow key={tier} tier={tier} matches={tm} resultFor={resultFor} nm={nm} oppId={oppId} onOpenMatch={onOpenMatch} open={openTier === tier} onClick={() => setOpenTier(openTier === tier ? null : tier)} />
              ))}
              {levelGroups.length > 0 && (
                <div style={{ marginTop: 10, borderTop: "1px solid " + LINE, paddingTop: 10 }}>
                  <button onClick={() => setShowLevels(!showLevels)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                    <span style={{ fontFamily: body, fontWeight: 700, fontSize: 13.5, color: CHALK }}>Opponent Levels</span>
                    <span style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: BALL }}>{showLevels ? "Hide ▾" : "Show ›"}</span>
                  </button>
                  {showLevels && (
                    <>
                      <div style={{ fontFamily: body, fontSize: 12, color: MUTED, lineHeight: 1.45, margin: "6px 0 2px" }}>
                        What level they actually were, at the time — not how they compare to you. Tap a level for the player-by-player breakdown.
                      </div>
                      {levelGroups.map((lg: any) => (
                        <LevelRow key={lg.cat} {...lg} nm={nm} open={openLevel === lg.cat} onClick={() => setOpenLevel(openLevel === lg.cat ? null : lg.cat)} />
                      ))}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
      <VerifiedTrophies player={player} meId={meId} />
      {r.gp > 0 && <TrophyWall player={player} players={players} matches={matches} fixtures={fixtures} group={group} />}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: MUTED }}>Record</div>
        <button onClick={() => setShowKey(!showKey)} style={{ width: 18, height: 18, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.08)", color: MUTED, fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "grid", placeItems: "center" }}>i</button>
      </div>
      {showKey && <DifficultyKey />}
      {bouts.length
        ? bouts.map((m) => <BoutRow key={m.id} m={m} resultFor={resultFor} oppName={nm(oppId(m))} activeDeltas={activeDeltas} playerId={player.id} players={players} meId={meId} onProposeEdit={onProposeEdit} onOpenMatch={onOpenMatch} />)
        : <Empty msg="No matches logged yet." />}
    </>
  );
}

function BoutRow({ m, resultFor, oppName, activeDeltas, playerId, players, meId, onProposeEdit, onOpenMatch }: any) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const res = resultFor(m);
  const dv = activeDeltas ? activeDeltas[m.id]?.[playerId] : null;
  const canEdit = !!(onProposeEdit && meId && (m.p1 === meId || m.p2 === meId));
  const selfPlayer = (players || []).find((p: any) => p.id === playerId);
  const oppPlayer = (players || []).find((p: any) => p.id === (m.p1 === playerId ? m.p2 : m.p1));
  const needsApproval = !!(oppPlayer && oppPlayer.auth_id);
  const rating = ratingForMatch(selfPlayer, oppPlayer, m.date);

  const beginEdit = () => {
    setDraft({ date: new Date(m.date).toISOString().slice(0, 10), score: m.score || "", result: res });
    setEditing(true);
  };
  const save = () => {
    if (!draft) return;
    const winner = draft.result === "D" ? "draw" : draft.result === "W" ? (playerId === m.p1 ? "p1" : "p2") : (playerId === m.p1 ? "p2" : "p1");
    onProposeEdit(m.id, { date: draft.date ? new Date(draft.date).getTime() : m.date, score: draft.score.trim(), winner });
    setEditing(false);
    setDraft(null);
  };

  if (editing) {
    return (
      <div style={{ padding: "11px 0", borderTop: "none" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <input type="date" value={draft.date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDraft({ ...draft, date: e.target.value })} style={{ ...miniInput, colorScheme: "dark", boxSizing: "border-box" as const }} />
          <input value={draft.score} onChange={(e) => setDraft({ ...draft, score: e.target.value })} placeholder="Score (optional)" style={{ ...miniInput, boxSizing: "border-box" as const }} />
          <div style={{ display: "flex", gap: 6 }}>
            {(["W", "D", "L"] as const).map((r) => (
              <button key={r} onClick={() => setDraft({ ...draft, result: r })} style={{ flex: 1, fontFamily: body, fontSize: 13, padding: "9px 6px", borderRadius: 10, cursor: "pointer", border: "none", background: draft.result === r ? BALL : PANEL2, color: draft.result === r ? COURT : MUTED, fontWeight: 600 }}>{r === "W" ? "Won" : r === "D" ? "Drew" : "Lost"}</button>
            ))}
          </div>
          <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED }}>{needsApproval ? `${oppName} has a Rally account — this change needs their agreement before it counts.` : "They don't have an account, so this updates straight away."}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: COURT, background: BALL, border: "none", borderRadius: 10, padding: "7px 12px", cursor: "pointer" }}>Save</button>
            <button onClick={() => { setEditing(false); setDraft(null); }} style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: MUTED, background: "transparent", border: "none", borderRadius: 10, padding: "7px 12px", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 10, padding: "11px 0" }}>
      <div title={`Difficulty: ${rating.note}`} style={{ width: 6, borderRadius: 2, background: rating.color, flexShrink: 0 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        <span style={{ width: 22, height: 22, borderRadius: 4, display: "grid", placeItems: "center", fontFamily: mono, fontWeight: 800, fontSize: 11, color: COURT, background: res === "W" ? BALL : res === "L" ? CLAY : MUTED }}>{res}</span>
        <button onClick={() => onOpenMatch && onOpenMatch(m.id)} disabled={!onOpenMatch} style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: onOpenMatch ? "pointer" : "default" }}>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 16, color: CHALK }}>{res === "D" ? "Drew " : res === "W" ? "Beat " : "Lost to "}<strong>{oppName}</strong>{(m.notes || m.photoUrl) && <span style={{ marginLeft: 5 }}>{m.notes ? "💬" : ""}{m.photoUrl ? "📷" : ""}</span>}{m.pendingEdit && <span style={{ marginLeft: 6, fontFamily: body, fontWeight: 700, fontSize: 9.5, color: BALL, textTransform: "uppercase", letterSpacing: 0.5 }}>edit pending</span>}{m.deleteRequestedBy && <span style={{ marginLeft: 6, fontFamily: body, fontWeight: 700, fontSize: 9.5, color: CLAY, textTransform: "uppercase", letterSpacing: 0.5 }}>delete pending</span>}</div>
          <div style={{ fontFamily: mono, fontSize: 12, color: MUTED, marginTop: 2 }}>{fmtDate(m.date)}{m.score ? " · " + m.score : ""}</div>
        </button>
        {dv != null && <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: dv > 0.05 ? BALL : dv < -0.05 ? CLAY : MUTED }}>{(dv >= 0 ? "+" : "−") + Math.abs(dv).toFixed(1)}</span>}
        {canEdit && <button onClick={beginEdit} style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: BALL, background: "transparent", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", flexShrink: 0 }}>Edit</button>}
      </div>
    </div>
  );
}

function DifficultyKey() {
  const rows: Array<[Tier, string]> = [
    ["gold", "Opponent was 3+ levels above you at the time"],
    ["silver", "Opponent was 2 levels above you"],
    ["blue", "Opponent was 1 level above you"],
    ["green", "Same level as you"],
    ["orange", "Opponent was below your level"],
    ["red", "Opponent was well below your level"],
  ];
  return (
    <div style={{ background: PANEL2, borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
      <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginBottom: 8, lineHeight: 1.45 }}>
        The bar colour is how tough the opponent was, at their level then — not whether you won. Beating or losing to someone is a different story depending who they were.
      </div>
      <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
        {rows.map(([tier, text]) => (
          <div key={tier} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: body, fontSize: 12.5, color: CHALK }}>
            <span style={{ width: 5, height: 14, borderRadius: 2, background: TIER_COLOR[tier], flexShrink: 0 }} />
            <span style={{ color: MUTED }}>{text}</span>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: body, fontSize: 12, color: MUTED, lineHeight: 1.5, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
        A respectable record is mostly green and blue, maybe some gold, with the odd orange. Wall-to-wall red — win or lose — means the competition wasn't testing them.
      </div>
      <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, lineHeight: 1.5, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8, marginTop: 8 }}>
        This is relative to whoever's profile you're on — the same opponent can show up gold here and orange on theirs, and both are correct.
      </div>
    </div>
  );
}

function QualityTierRow({ tier, matches, resultFor, nm, oppId, onOpenMatch, open, onClick }: any) {
  let w = 0, d = 0, l = 0;
  matches.forEach((m: any) => { const res = resultFor(m); if (res === "W") w++; else if (res === "L") l++; else d++; });
  const rec = matches.length ? `${w}–${d}–${l}` : "none yet";
  return (
    <div>
      <button onClick={onClick} disabled={!matches.length} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent", border: "none", padding: "7px 0", cursor: matches.length ? "pointer" : "default", textAlign: "left" }}>
        <span style={{ width: 4, height: 13, borderRadius: 2, background: TIER_COLOR[tier], flexShrink: 0 }} />
        <span style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: matches.length ? CHALK : MUTED, flex: 1 }}>{TIER_LABEL[tier]}</span>
        <span style={{ fontFamily: matches.length ? mono : body, fontWeight: matches.length ? 700 : 500, fontSize: 12.5, color: MUTED }}>{rec}</span>
      </button>
      {open && matches.length > 0 && (
        <div style={{ background: PANEL2, border: "none", borderRadius: 12, padding: "8px 10px", margin: "2px 0 8px" }}>
          {matches.slice().sort((a: any, b: any) => b.date - a.date).map((m: any, i: number) => {
            const res = resultFor(m);
            return (
              <button key={m.id} onClick={() => onOpenMatch && onOpenMatch(m.id)} disabled={!onOpenMatch} style={{ display: "flex", alignItems: "center", width: "100%", background: "transparent", border: "none", padding: "5px 0", borderTop: i ? "1px solid " + LINE : "none", cursor: onOpenMatch ? "pointer" : "default", textAlign: "left" }}>
                <span style={{ fontFamily: body, fontSize: 11.5, fontWeight: 800, color: res === "W" ? BALL : res === "L" ? CLAY : MUTED, width: 16 }}>{res}</span>
                <span style={{ fontFamily: body, fontSize: 12.5, color: CHALK, flex: 1, marginLeft: 8 }}>{nm(oppId(m))}</span>
                <span style={{ fontFamily: mono, fontSize: 11, color: MUTED, marginRight: 8 }}>{fmtDate(m.date)}</span>
                <span style={{ fontFamily: mono, fontSize: 11, color: MUTED }}>{m.score || "—"}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// One category (Beginner, Intermediate…) inside Opponent Levels. Always
// shows the full W–D–L, never just the wins — a bare win count is the
// flattering half of the story and hides exactly what this section is for.
function LevelRow({ cat, w, d, l, per, nm, open, onClick }: any) {
  const people = Object.entries(per as Record<string, { w: number; d: number; l: number }>)
    .sort((a, b) => (b[1].w + b[1].d + b[1].l) - (a[1].w + a[1].d + a[1].l));
  return (
    <div>
      <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent", border: "none", padding: "7px 0", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: CHALK, flex: 1 }}>{cat}</span>
        <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 12.5, color: MUTED }}>{w}–{d}–{l}</span>
        <span style={{ fontFamily: body, fontSize: 12, color: BALL }}>{open ? "▾" : "›"}</span>
      </button>
      {open && (
        <div style={{ background: PANEL2, borderRadius: 12, padding: "8px 10px", margin: "2px 0 8px" }}>
          {people.map(([oid, x], i) => (
            <div key={oid} style={{ display: "flex", alignItems: "center", padding: "5px 0", borderTop: i ? "1px solid " + LINE : "none" }}>
              <span style={{ fontFamily: body, fontSize: 12.5, color: CHALK, flex: 1 }}>{nm(oid)}</span>
              <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 12, color: MUTED }}>{x.w}–{x.d}–{x.l}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RivalryRow({ rivalry, name, onClick }: any) {
  const recStr = rivalry.d > 0 ? `${rivalry.w}-${rivalry.d}-${rivalry.l}` : `${rivalry.w}-${rivalry.l}`;
  const streakText = rivalry.streak.holder === "me" ? `W${rivalry.streak.count}` : rivalry.streak.holder === "opp" ? `L${rivalry.streak.count}` : null;
  return (
    <button onClick={onClick} style={{ display: "block", width: "100%", background: PANEL2, border: "none", borderRadius: 12, padding: "10px 12px", marginBottom: 6, cursor: "pointer", textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: body, fontSize: 14, color: CHALK, fontWeight: 700 }}>🔥 {name}</span>
        <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: BALL }}>{recStr}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontFamily: mono, fontSize: 10.5, color: MUTED }}>
        <span>{rivalry.total} matches{streakText ? " · streak " + streakText : ""}</span>
        <span>Last {fmtDate(rivalry.lastMeeting)}</span>
      </div>
    </button>
  );
}

function VsMatches({ oid, matches, resultFor, onOpen, selfPlayer, oppPlayer }: any) {
  return (
    <div style={{ background: PANEL2, border: "none", borderRadius: 12, padding: "8px 10px", margin: "2px 0 8px" }}>
      {matches.length ? matches.map((m, i) => {
        const res = resultFor(m);
        const rating = ratingForMatch(selfPlayer, oppPlayer, m.date);
        return (
          <button key={m.id} onClick={() => onOpen && onOpen(oid)} style={{ display: "flex", alignItems: "stretch", width: "100%", background: "transparent", border: "none", padding: 0, borderTop: i ? "1px solid " + LINE : "none", cursor: "pointer", textAlign: "left" }}>
            <span title={`Difficulty: ${rating.note}`} style={{ width: 4, borderRadius: 2, background: rating.color, flexShrink: 0, marginRight: 8 }} />
            <span style={{ display: "flex", alignItems: "center", flex: 1, padding: "5px 0" }}>
              <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 800, color: res === "W" ? BALL : res === "L" ? CLAY : MUTED, width: 16 }}>{res}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: MUTED, flex: 1, marginLeft: 8 }}>{fmtDate(m.date)}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: MUTED }}>{m.score || "—"}</span>
            </span>
          </button>
        );
      }) : <div style={{ fontFamily: body, fontSize: 12, color: MUTED, padding: "4px 0" }}>No matches to show.</div>}
    </div>
  );
}
