"use client";
import { countsAsPlayed } from "@/core/matchStatus";
import React, { useState, useMemo, useEffect } from "react";
import { LegacyTable } from "@/components/table/LegacyTable";
import { PredictionCard } from "@/components/table/PredictionCard";
import { FilterChips, type FilterDef } from "@/components/table/FilterChips";
import { RankingInfo } from "@/components/table/RankingInfo";
import { StandingsList, type StandingsPlayer } from "@/components/table/StandingsList";
import { RecapCard } from "@/components/table/RecapCard";
import { Empty, Toggle } from "@/components/ui/atoms";
import { START_ELO } from "@/core/constants";
import { ratingForMatch } from "@/core/difficulty";
import { computeStats } from "@/core/elo";
import { computeOfficial } from "@/core/official";
import { WEEK, currentStreakOf } from "@/core/rank";
import { winPct } from "@/lib/format";
import { BALL, CHALK, CLAY, LINE, MUTED, PANEL, PANEL2, body, miniInput, mono } from "@/lib/theme";

const ACTIVE_WINDOW_MS = 365 * 86400000;

export function LeagueHome({ players, matches, group, fixtures, mode, onMode, onOpen, onOpenLegacy, onCompare, requireSetup, nameOf, meId, movement, onGoGlobal }: any) {
  const [view, setView] = useState<"active" | "legacy">("active");
  const season = group?.season;
  // This used to reset to "season" on every page load, which meant the table
  // quietly went back to season-only records after each deploy — and a career
  // record of 32-0-12 showing as 4-0 reads as lost data, not as a filter.
  // Remembered per league instead.
  const scopeKey = "rally.scope." + (group?.id || "none");
  const [scope, setScope] = useState<string>(() => {
    if (typeof window === "undefined") return "season";
    try { return window.localStorage.getItem("rally.scope." + (group?.id || "none")) || "season"; } catch { return "season"; }
  });
  useEffect(() => {
    try { setScope(window.localStorage.getItem(scopeKey) || "season"); } catch {}
  }, [scopeKey]);
  useEffect(() => {
    try { window.localStorage.setItem(scopeKey, scope); } catch {}
  }, [scopeKey, scope]);
  const inSeason = !!(season && scope === "season");
  const [tableYr, setTableYr] = useState<"all" | number>("all");
  const years = useMemo(() => Array.from(new Set(matches.filter((m) => countsAsPlayed(m)).map((m) => new Date(m.date).getFullYear()))).sort((a: number, b: number) => b - a), [matches]);
  const seasonFiltered = useMemo(() => inSeason ? matches.filter((m) => m.date >= season.start && (season.end == null || m.date <= season.end)) : matches, [matches, inSeason, season]);
  const filtered = useMemo(() => tableYr === "all" ? seasonFiltered : seasonFiltered.filter((m) => new Date(m.date).getFullYear() === tableYr), [seasonFiltered, tableYr]);
  const { elo, wdl, form, deltas } = useMemo(() => computeStats(players, filtered), [players, filtered]);
  const officialMap = useMemo(() => computeOfficial(players, filtered, wdl), [players, filtered, wdl]);
  const ranked = useMemo(() => {
    const arr = players.filter((p) => !p.inactive);
    const avgOpp = {}; players.forEach((p) => { avgOpp[p.id] = { sum: 0, n: 0 }; });
    filtered.filter((m) => countsAsPlayed(m)).forEach((m) => { if (avgOpp[m.p1]) { avgOpp[m.p1].sum += (elo[m.p2] ?? 0); avgOpp[m.p1].n++; } if (avgOpp[m.p2]) { avgOpp[m.p2].sum += (elo[m.p1] ?? 0); avgOpp[m.p2].n++; } });
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
    matches.filter((m) => countsAsPlayed(m) && m.date >= cutoff).forEach((m) => { ids.add(m.p1); ids.add(m.p2); });
    return ids;
  }, [matches]);
  const activeRanked = useMemo(() => ranked.filter((p) => recentlyActiveIds.has(p.id)), [ranked, recentlyActiveIds]);
  const nonActiveRanked = useMemo(() => ranked.filter((p) => !recentlyActiveIds.has(p.id)), [ranked, recentlyActiveIds]);
  const [activeScope, setActiveScope] = useState<"active" | "nonactive" | "all">("active");
  const [query, setQuery] = useState("");
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
    const confirmed = filtered.filter((m) => countsAsPlayed(m));
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

  // The colour under each of the last five results — same question the
  // profile's form row answers: were those wins against anybody?
  const formColors = useMemo(() => {
    const byId: any = {}; players.forEach((p: any) => (byId[p.id] = p));
    const out: Record<string, string[]> = {};
    players.forEach((p: any) => {
      const mine = filtered
        .filter((m: any) => countsAsPlayed(m) && (m.p1 === p.id || m.p2 === p.id))
        .sort((a: any, b: any) => a.date - b.date)
        .slice(-5);
      out[p.id] = mine.map((m: any) => ratingForMatch(p, byId[m.p1 === p.id ? m.p2 : m.p1], m.date).color);
    });
    return out;
  }, [players, filtered]);

  const daysIn = season ? Math.max(1, Math.round((Date.now() - season.start) / 86400000)) : 0;

  // Every control that used to stack down the screen, as one scrolling row
  // of chips. The stack ran to roughly 1400px of chrome before rank 1
  // appeared, which is more table than table.
  const METRICS = [
    { value: "official", label: "Official", note: "Your five best wins by opponent quality, times how regularly you play." },
    { value: "elo", label: "Elo", note: "Moves every match, by how surprising the result was." },
    { value: "record", label: "Record", note: "Win rate, weighted by opposition and how much you have played." },
    { value: "winpct", label: "Win %", note: "The plain share of games won. A draw counts as half." },
    { value: "form", label: "Form", note: "The last five results and nothing else." },
  ];
  const periodValue = tableYr !== "all" ? String(tableYr) : (inSeason ? "season" : "all");
  // "overall" is what the stored setting has always called Official.
  const metricValue = !mode || mode === "overall" ? "official" : mode;
  const filters: FilterDef[] = [
    { key: "metric", label: "Ranked by", value: metricValue, options: METRICS, onChange: (v: string) => onMode && onMode(v) },
    {
      key: "scope", label: "Who is included",
      value: view === "legacy" ? "legacy" : activeScope,
      options: [
        { value: "active", label: "Active", note: "Played in the last 12 months." },
        { value: "nonactive", label: "Not active", note: "Everyone who has not." },
        { value: "all", label: "Everyone in this league" },
        { value: "legacy", label: "Legacy", note: "Career impact, including people who have stopped playing." },
        ...(onGoGlobal ? [{ value: "global", label: "Global table", note: "Everyone you have crossed paths with, across every league." }] : []),
      ],
      onChange: (v: string) => {
        if (v === "global") return onGoGlobal && onGoGlobal();
        if (v === "legacy") return setView("legacy");
        setView("active");
        setActiveScope(v as any);
      },
    },
    {
      key: "period", label: "When",
      value: periodValue,
      options: [
        ...(season ? [{ value: "season", label: season.name || "This season" }] : []),
        { value: "all", label: "All time" },
        ...years.map((y: number) => ({ value: String(y), label: String(y) })),
      ],
      onChange: (v: string) => {
        if (v === "season") { setScope("season"); setTableYr("all"); return; }
        setScope("all");
        setTableYr(v === "all" ? "all" : Number(v));
      },
    },
  ];

  // What the big number on a row is, and what it is called. Record keeps its
  // own display string, because "28-6-10" is not a rating and cannot be one,
  // while still sorting and drawing its bar on the numeric score behind it.
  const valueOf = (id: string): number => {
    const r = wdl[id] || { w: 0, d: 0, l: 0, gp: 0 };
    if (mode === "elo") return elo[id] ?? START_ELO;
    if (mode === "winpct") return r.gp ? Math.round(winPct(r) * 100) : 0;
    if (mode === "form") return (form[id] || []).slice(-5).reduce((sum: number, x: string) => sum + (x === "W" ? 1 : x === "L" ? -1 : 0), 0);
    if (mode === "record") return r.gp ? winPct(r) * 100 : 0;
    return officialMap[id] ?? 0;
  };
  const unit = mode === "elo" ? "elo" : mode === "winpct" ? "win %" : mode === "form" ? "form" : mode === "record" ? "record" : "rating";

  const q = query.trim().toLowerCase();
  const searched = q
    ? scopedRanked.filter((pl: any) => ((pl.name || "") + " " + (pl.last || "") + " " + (pl.nick || "")).toLowerCase().includes(q))
    : scopedRanked;

  const standingsPlayers: StandingsPlayer[] = searched.map((pl: any) => {
    const r = wdl[pl.id] || { w: 0, d: 0, l: 0, gp: 0 };
    return {
      player: pl,
      rating: valueOf(pl.id),
      displayOverride: mode === "record" ? r.w + "-" + r.d + "-" + r.l : undefined,
      w: r.w, d: r.d, l: r.l,
      form: (form[pl.id] || []).slice(-5) as any,
      movement: movement ? movement[pl.id] : undefined,
    };
  });

  return (
    <div>
      <FilterChips
        filters={filters}
        search={{ value: query, onChange: setQuery }}
        overflow={{ title: "How the ranking works", content: <RankingInfo /> }}
      />

      {view === "legacy" ? (
        <LegacyTable players={players} matches={matches} onOpen={onOpenLegacy} />
      ) : (
        <>
          {players.length > 0 && standingsPlayers.length === 0 ? (
            <Empty msg={q ? "Nobody here by that name." : activeScope === "active" ? "No one has played in the last 12 months. Try Legacy for career history." : activeScope === "nonactive" ? "Everyone has played in the last 12 months." : "No players yet."} />
          ) : (
            <StandingsList
              players={standingsPlayers}
              matches={filtered}
              meId={meId}
              unit={unit}
              onOpen={(id: string) => onOpen(id, tableYr)}
            />
          )}

          {/* Season progress, the prediction and the recap moved below the
              table. All three are worth reading and none of them is worth
              reading before you can see who is top, which is what somebody
              opened this screen for. */}
          {inSeason && season && (
            <div style={{ marginTop: 22 }}>
              {!season.end ? (
                <div style={{ fontFamily: mono, fontSize: 11, color: MUTED }}>Season live · day {daysIn} · ongoing</div>
              ) : (() => {
                const total = Math.max(1, Math.round((season.end - season.start) / 86400000));
                const left = Math.max(0, Math.round((season.end - Date.now()) / 86400000));
                const pctDone = Math.max(0, Math.min(100, Math.round(((total - left) / total) * 100)));
                return (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <span style={{ fontFamily: body, fontSize: 15, fontWeight: 700, color: CHALK }}>{season.name}</span>
                      <span style={{ fontFamily: mono, fontSize: 12, color: left <= 30 ? CLAY : BALL }}>{left > 0 ? left + " days left" : "Season over"}</span>
                    </div>
                    <div style={{ height: 6, background: PANEL2, borderRadius: 3, overflow: "hidden" }}><div style={{ width: pctDone + "%", height: "100%", background: BALL }} /></div>
                  </div>
                );
              })()}
            </div>
          )}
          {inSeason && prediction.length > 0 && <div style={{ marginTop: 18 }}><PredictionCard prediction={prediction} /></div>}
          {inSeason && recap && <div style={{ marginTop: 18 }}><RecapCard recap={recap} nameOf={nameOf} leagueName={group.name} /></div>}
        </>
      )}
    </div>
  );
}
