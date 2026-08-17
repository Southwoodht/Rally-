"use client";
import React, { useState, useMemo } from "react";
import { LegacyTable } from "@/components/table/LegacyTable";
import { PredictionCard } from "@/components/table/PredictionCard";
import { Rankings } from "@/components/table/Rankings";
import { RecapCard } from "@/components/table/RecapCard";
import { Empty, Toggle } from "@/components/ui/atoms";
import { START_ELO } from "@/core/constants";
import { computeStats } from "@/core/elo";
import { computeOfficial } from "@/core/official";
import { WEEK, currentStreakOf } from "@/core/rank";
import { winPct } from "@/lib/format";
import { BALL, CHALK, CLAY, LINE, MUTED, PANEL, PANEL2, body, display, miniInput, mono } from "@/lib/theme";

const ACTIVE_WINDOW_MS = 365 * 86400000;

export function LeagueHome({ players, matches, group, fixtures, mode, onMode, onOpen, onOpenLegacy, requireSetup, nameOf }: any) {
  const [view, setView] = useState<"active" | "legacy">("active");
  const season = group?.season;
  const [scope, setScope] = useState("season");
  const inSeason = !!(season && scope === "season");
  const [tableYr, setTableYr] = useState<"all" | number>("all");
  const years = useMemo(() => Array.from(new Set(matches.filter((m) => m.status !== "pending").map((m) => new Date(m.date).getFullYear()))).sort((a: number, b: number) => b - a), [matches]);
  const seasonFiltered = useMemo(() => inSeason ? matches.filter((m) => m.date >= season.start && (season.end == null || m.date <= season.end)) : matches, [matches, inSeason, season]);
  const filtered = useMemo(() => tableYr === "all" ? seasonFiltered : seasonFiltered.filter((m) => new Date(m.date).getFullYear() === tableYr), [seasonFiltered, tableYr]);
  const { elo, wdl, form, deltas } = useMemo(() => computeStats(players, filtered), [players, filtered]);
  const officialMap = useMemo(() => computeOfficial(players, filtered, wdl), [players, filtered, wdl]);
  const ranked = useMemo(() => {
    const arr = players.filter((p) => !p.inactive);
    const avgOpp = {}; players.forEach((p) => { avgOpp[p.id] = { sum: 0, n: 0 }; });
    filtered.filter((m) => m.status !== "pending").forEach((m) => { if (avgOpp[m.p1]) { avgOpp[m.p1].sum += (elo[m.p2] ?? 0); avgOpp[m.p1].n++; } if (avgOpp[m.p2]) { avgOpp[m.p2].sum += (elo[m.p1] ?? 0); avgOpp[m.p2].n++; } });
    const rec = (p) => { const r = wdl[p.id] || { gp: 0 }; if (!r.gp) return -1; const act = r.gp / (r.gp + 5); const ao = avgOpp[p.id].n ? avgOpp[p.id].sum / avgOpp[p.id].n : 0; const of = Math.max(0.5, Math.min(2, 1 + ao / 200)); return winPct(r) * act * of; };
    const formScoreOf = (p) => (form[p.id] || []).slice(-5).reduce((s, x) => s + (x === "W" ? 1 : x === "L" ? -1 : 0), 0);
    if (mode === "elo") arr.sort((a, b) => (elo[b.id] ?? START_ELO) - (elo[a.id] ?? START_ELO));
    else if (mode === "record") arr.sort((a, b) => rec(b) - rec(a) || (wdl[b.id]?.w ?? 0) - (wdl[a.id]?.w ?? 0));
    else if (mode === "winpct") arr.sort((a, b) => { const ra = wdl[a.id] || { gp: 0 }, rb = wdl[b.id] || { gp: 0 }; if (!ra.gp && !rb.gp) return 0; if (!ra.gp) return 1; if (!rb.gp) return -1; return winPct(rb) - winPct(ra) || rb.gp - ra.gp; });
    else if (mode === "form") arr.sort((a, b) => { const ra = wdl[a.id] || { gp: 0 }, rb = wdl[b.id] || { gp: 0 }; if (!ra.gp && !rb.gp) return 0; if (!ra.gp) return 1; if (!rb.gp) return -1; return formScoreOf(b) - formScoreOf(a) || (rb.w ?? 0) - (ra.w ?? 0); });
    else arr.sort((a, b) => ((officialMap[b.id] ?? -1e9) - (officialMap[a.id] ?? -1e9)) || ((elo[b.id] ?? 0) - (elo[a.id] ?? 0)) || ((wdl[a.id]?.gp ?? 0) - (wdl[b.id]?.gp ?? 0)));
    return arr;
  }, [players, filtered, elo, wdl, form, mode, officialMap]);

  // Active view only ever hides rows from this same ranked list — it never
  // changes anyone's actual rating or official position, just which of them
  // show up here. Someone who was brilliant three years ago and hasn't
  // played since shouldn't sit above people playing right now.
  const recentlyActiveIds = useMemo(() => {
    const cutoff = Date.now() - ACTIVE_WINDOW_MS;
    const ids = new Set<string>();
    matches.filter((m) => m.status !== "pending" && m.date >= cutoff).forEach((m) => { ids.add(m.p1); ids.add(m.p2); });
    return ids;
  }, [matches]);
  const activeRanked = useMemo(() => ranked.filter((p) => recentlyActiveIds.has(p.id)), [ranked, recentlyActiveIds]);
  const nonActiveRanked = useMemo(() => ranked.filter((p) => !recentlyActiveIds.has(p.id)), [ranked, recentlyActiveIds]);
  const [activeScope, setActiveScope] = useState<"active" | "nonactive" | "all">("active");
  const scopedRanked = activeScope === "active" ? activeRanked : activeScope === "nonactive" ? nonActiveRanked : ranked;

  const prediction = useMemo(() => {
    const cont = players.filter((p) => (wdl[p.id]?.gp || 0) > 0 && !p.inactive);
    if (!cont.length) return [];
    const SCALE = 70;
    const scoreOf = (p) => { const f = (form[p.id] || []).slice(-5); const fb = f.reduce((s, x) => s + (x === "W" ? 1 : x === "L" ? -1 : 0), 0) * 8; return (elo[p.id] ?? 0) + fb; };
    const raw = cont.map((p) => ({ p, e: Math.exp(scoreOf(p) / SCALE) }));
    const tot = raw.reduce((s, x) => s + x.e, 0) || 1;
    return raw.map((x) => ({ p: x.p, pct: Math.round((x.e / tot) * 100) })).sort((a, b) => b.pct - a.pct);
  }, [players, elo, form, wdl]);

  const recap = useMemo(() => {
    const confirmed = filtered.filter((m) => m.status !== "pending");
    if (!confirmed.length) return null;
    const anchor = Math.max(...confirmed.map((m) => m.date));
    const win = confirmed.filter((m) => m.date >= anchor - WEEK);
    if (!win.length) return null;
    const gained: Record<string, number> = {};
    win.forEach((m) => { if (deltas[m.id]) { gained[m.p1] = (gained[m.p1] || 0) + deltas[m.id][m.p1]; gained[m.p2] = (gained[m.p2] || 0) + deltas[m.id][m.p2]; } });
    let topGain: string | null = null, topGv = -1e9; (Object.entries(gained) as [string, number][]).forEach(([id, v]) => { if (v > topGv) { topGv = v; topGain = id; } });
    let upset: { m: any; wid: string } | null = null, upV = -1e9; win.forEach((m) => { if (m.winner === "draw") return; const wid = m.winner === "p1" ? m.p1 : m.p2; const dv = deltas[m.id]?.[wid] ?? 0; if (dv > upV) { upV = dv; upset = { m, wid }; } });
    let marquee: any = null, mV = -1e9; win.forEach((m) => { const c = (elo[m.p1] ?? 0) + (elo[m.p2] ?? 0); if (c > mV) { mV = c; marquee = m; } });
    let strP: string | null = null, strV = 0; players.forEach((p) => { const s = currentStreakOf(p.id, confirmed); if (s > strV) { strV = s; strP = p.id; } });
    return { topGain, topGv, upset, marquee, strP, strV };
  }, [filtered, deltas, elo, players]);

  const daysIn = season ? Math.max(1, Math.round((Date.now() - season.start) / 86400000)) : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <Toggle on={view === "active"} onClick={() => setView("active")} label="Active" icon="🟢" emphasize />
        <Toggle on={view === "legacy"} onClick={() => setView("legacy")} label="Legacy" icon="🏛️" />
      </div>
      <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, marginBottom: 14, lineHeight: 1.4 }}>
        {view === "active" ? "Active rankings measure current form." : "Legacy ranks by career impact — everyone who's ever played."}
      </div>

      {view === "legacy" ? (
        <LegacyTable players={players} matches={matches} onOpen={onOpenLegacy} />
      ) : (
        <>
      {season && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Toggle on={scope === "season"} onClick={() => setScope("season")} label={season.name || "Season"} />
          <Toggle on={scope === "all"} onClick={() => setScope("all")} label="All-time" />
        </div>
      )}
      {inSeason && (() => {
        if (!season.end) return <div style={{ fontFamily: mono, fontSize: 11, color: MUTED, marginBottom: 14 }}>Season live · day {daysIn} · ongoing</div>;
        const total = Math.max(1, Math.round((season.end - season.start) / 86400000));
        const left = Math.max(0, Math.round((season.end - Date.now()) / 86400000));
        const pctDone = Math.max(0, Math.min(100, Math.round(((total - left) / total) * 100)));
        return (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontFamily: display, fontSize: 15, fontWeight: 700, color: CHALK, textTransform: "uppercase" }}>{season.name}</span>
              <span style={{ fontFamily: mono, fontSize: 12, color: left <= 30 ? CLAY : BALL }}>{left > 0 ? left + " days left" : "Season over"}</span>
            </div>
            <div style={{ height: 6, background: PANEL2, borderRadius: 3, overflow: "hidden" }}><div style={{ width: pctDone + "%", height: "100%", background: BALL }} /></div>
          </div>
        );
      })()}
      {inSeason && (() => {
        const ended = season.end && Date.now() > season.end;
        const allPlayed = fixtures && fixtures.length > 0 && fixtures.every((f) => f.done);
        if (!ended && !allPlayed) return null;
        const fxIds = new Set((fixtures || []).filter((f) => f.done && f.matchId).map((f) => f.matchId));
        const useFx = fxIds.size > 0;
        const fxMatches = useFx ? matches.filter((m) => fxIds.has(m.id)) : filtered;
        const fxStats = computeStats(players, fxMatches);
        const fxWdl = fxStats.wdl;
        const fxOff = computeOfficial(players, fxMatches, fxWdl);
        const podium = players.filter((p) => (fxWdl[p.id]?.gp || 0) > 0 && !p.inactive).sort((a, b) => (fxOff[b.id] ?? -1e9) - (fxOff[a.id] ?? -1e9)).slice(0, 3);
        if (!podium.length) return null;
        const medals = ["🏆", "🥈", "🥉"], labels = ["Champion", "Runner-up", "Third"];
        return (
          <div style={{ background: PANEL, border: "1px solid " + BALL, borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: BALL, marginBottom: 4 }}>{ended ? "Season finished" : "All fixtures played"}{useFx ? " · fixture league only" : ""}</div>
            <div style={{ fontFamily: display, fontSize: 22, fontWeight: 800, color: CHALK, textTransform: "uppercase", letterSpacing: -0.5, marginBottom: 12 }}>{season.name} results</div>
            {podium.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i ? "1px solid " + LINE : "none" }}>
                <span style={{ fontSize: 22 }}>{medals[i]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700, color: i === 0 ? BALL : CHALK, textTransform: "uppercase", letterSpacing: -0.3 }}>{p.name}{p.last ? " " + p.last : ""}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>{labels[i]} · {(fxWdl[p.id]?.w ?? 0)}-{(fxWdl[p.id]?.d ?? 0)}-{(fxWdl[p.id]?.l ?? 0)}</div>
                </div>
              </div>
            ))}
            {players.filter((p) => !(fxWdl[p.id]?.gp)).length > 0 && (
              <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, marginTop: 10, lineHeight: 1.4 }}>Didn't play: {players.filter((p) => !(fxWdl[p.id]?.gp)).map((p) => p.name + (p.last ? " " + p.last : "")).join(", ")}</div>
            )}
          </div>
        );
      })()}
      {inSeason && prediction.length > 0 && <PredictionCard prediction={prediction} />}
      {inSeason && recap && <RecapCard recap={recap} nameOf={nameOf} leagueName={group.name} />}
      {years.length > 0 && (
        <select value={String(tableYr)} onChange={(e) => setTableYr(e.target.value === "all" ? "all" : Number(e.target.value))} style={{ ...miniInput, width: "100%", marginBottom: 14, boxSizing: "border-box" as const }}>
          <option value="all">All Time</option>
          {years.map((y: number) => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      )}
      <select value={activeScope} onChange={(e) => setActiveScope(e.target.value as any)} style={{ ...miniInput, width: "100%", marginBottom: 14, boxSizing: "border-box" as const }}>
        <option value="active">Active — last 12 months</option>
        <option value="nonactive">Non-active</option>
        <option value="all">All players</option>
      </select>
      {players.length > 0 && scopedRanked.length === 0 ? (
        <Empty msg={activeScope === "active" ? "No one's played in the last 12 months. Check Legacy for career history." : activeScope === "nonactive" ? "Everyone's played in the last 12 months." : "No players yet."} />
      ) : (
        <Rankings ranked={scopedRanked} elo={elo} wdl={wdl} form={form} official={officialMap} mode={mode} onMode={onMode} onOpen={(id) => onOpen(id, tableYr)} requireSetup={requireSetup} />
      )}
        </>
      )}
    </div>
  );
}
