"use client";
import { countsAsPlayed } from "@/core/matchStatus";
import React, { useState, useMemo, useEffect } from "react";
import { ChevronDown } from "lucide-react";
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
import { computeGlicko } from "@/core/glicko";
import { computeRatings, type Edge } from "@/core/rating";
import { WEEK, currentStreakOf } from "@/core/rank";
import { fullNameOf, winPct } from "@/lib/format";
import { PROVISIONAL_GAMES } from "@/lib/globalTable";
import { SEASON_RANK_GAMES } from "@/core/seasons";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { BALL, CHALK, CLAY, LINE, MUTED, PANEL, PANEL2, body, miniInput, segmentOption, segmentTrack } from "@/lib/theme";
import { SeasonPodium } from "@/components/seasons/SeasonPodium";
import { seasonMatches, seasonPodium } from "@/core/seasonStandings";

const ACTIVE_WINDOW_MS = 365 * 86400000;

export function LeagueHome({ players, matches, group, fixtures, onOpen, onOpenLegacy, onCompare, requireSetup, nameOf, meId, onGoGlobal }: any) {
  // ONE ranking: Glicko (Sam, 2026-10-22 — "members want one table"). The
  // Ranked-by switcher and the year chips are gone from this screen; Official,
  // Elo and Strength are still computed below because the prediction card,
  // the recap and other screens read them. `mode` stays a variable so the
  // machinery that served six modes is untouched and one line brings them back.
  // Weekly movement arrows are off: the snapshots record Official places, and
  // an arrow measured on a different ranking would point the wrong way.
  const mode: string = "glicko";
  const [view, setView] = useState<"active" | "legacy">("active");
  // The running season, or — between seasons — the one that just ended, so
  // its final table and podium stay one tap away.
  const season = group?.season || group?.lastSeason;
  const seasonEnded = season?.status === "ended";
  // Brief item 1: "Default to This season while one is active." This used to
  // remember the last choice per league, because the season view was a quiet
  // filter and a career of 32-0-12 showing as 4-0 read as lost data. Now the
  // switch sits on the screen saying which it is, so opening on the season is
  // no longer a surprise. A pinned default (FilterChips' pin) still wins.
  const [scope, setScope] = useState<string>(group?.season ? "season" : "all");
  useEffect(() => { setScope(group?.season ? "season" : "all"); }, [group?.id, group?.season?.id]);
  const inSeason = !!(season && scope === "season");
  // An ended season shows its FROZEN results (seasonMatches): dated in it and
  // logged before it closed. A running one, everything dated in it so far.
  const seasonFiltered = useMemo(() => {
    if (!inSeason) return matches;
    if (seasonEnded) return seasonMatches(matches, season);
    return matches.filter((m) => m.date >= season.start && (season.end == null || m.date <= season.end));
  }, [matches, inSeason, season, seasonEnded]);
  const podium = useMemo(() => (inSeason && seasonEnded ? seasonPodium(players, matches, season, SEASON_RANK_GAMES) : []), [inSeason, seasonEnded, players, matches, season]);
  const filtered = seasonFiltered;
  const { elo, wdl, form, deltas } = useMemo(() => computeStats(players, filtered), [players, filtered]);
  const officialMap = useMemo(() => computeOfficial(players, filtered, wdl), [players, filtered, wdl]);

  /**
   * The network rating, over this league's own matches.
   *
   * Sam, 2026-09-20: "I want it to look at opponents — if Sam played Charlie's
   * opponents and Charlie played Sam's." Every other mode here answers that
   * with a summary statistic, and a summary cannot hold a chain. This one is
   * built on who beat whom and settles by iteration, which is exactly the
   * question he asked.
   *
   * It is not new and it is not tuned for this: computeRatings has run the
   * Global table since 2026-09-04. This hands it one league's matches instead
   * of every league's, and nothing else changes — same function, same
   * constants, same spread.
   *
   * Win, draw or loss only (Sam, 2026-10-22): the score feeds predictions,
   * never a rating. It used to blend in the margin.
   */
  const networkMap = useMemo(() => {
    const edges: Edge[] = [];
    filtered.filter((m: any) => countsAsPlayed(m) && m.winner).forEach((m: any) => {
      const r1 = m.winner === "draw" ? 0.5 : m.winner === "p1" ? 1 : 0;
      edges.push({ key: m.p1, opp: m.p2, result: r1 });
      edges.push({ key: m.p2, opp: m.p1, result: 1 - r1 });
    });
    // x100, exactly as withNetworkRating does for the Global table. Not
    // decoration: computeRatings works on a 0-12 scale where a whole category
    // is 3, and StandingsList ranks on Math.round(rating) so that two players
    // printing the same number are treated as level. On that scale almost the
    // whole club rounds to the same handful of integers, every one of those
    // groups is then separated by head-to-head, and ratingColumn reveals a
    // decimal that contradicts the order it was given — 6.6 printed above 6.8,
    // which was on screen before this line existed.
    //
    // Scaled up, rounding means something again and the ties are real ties.
    // Same rating, same constants, same presentation as the Global table.
    const raw = computeRatings(edges);
    const out: Record<string, number> = {};
    for (const k of Object.keys(raw)) out[k] = raw[k] * 100;
    return out;
  }, [filtered]);
  // Glicko-2 over the same matches (core/glicko.ts): a rating with a ± for
  // how sure it is, levels only as the starting point. Beside Official, not
  // instead of it — Sam, 2026-10-22.
  const glicko = useMemo(() => computeGlicko(players, filtered), [players, filtered]);
  const ranked = useMemo(() => {
    const arr = players.filter((p) => !p.inactive);
    const avgOpp = {}; players.forEach((p) => { avgOpp[p.id] = { sum: 0, n: 0 }; });
    filtered.filter((m) => countsAsPlayed(m)).forEach((m) => { if (avgOpp[m.p1]) { avgOpp[m.p1].sum += (elo[m.p2] ?? 0); avgOpp[m.p1].n++; } if (avgOpp[m.p2]) { avgOpp[m.p2].sum += (elo[m.p1] ?? 0); avgOpp[m.p2].n++; } });
    const rec = (p) => { const r = wdl[p.id] || { gp: 0 }; if (!r.gp) return -1; const act = r.gp / (r.gp + 5); const ao = avgOpp[p.id].n ? avgOpp[p.id].sum / avgOpp[p.id].n : 0; const of = Math.max(0.5, Math.min(2, 1 + ao / 200)); return winPct(r) * act * of; };
    const formScoreOf = (p) => (form[p.id] || []).slice(-5).reduce((s, x) => s + (x === "W" ? 1 : x === "L" ? -1 : 0), 0);
    if (mode === "glicko") arr.sort((a, b) => (glicko.rating[b.id] ?? -1e9) - (glicko.rating[a.id] ?? -1e9) || (glicko.rd[a.id] ?? 1e9) - (glicko.rd[b.id] ?? 1e9));
    else if (mode === "network") arr.sort((a, b) => (networkMap[b.id] ?? -1e9) - (networkMap[a.id] ?? -1e9) || (wdl[b.id]?.gp ?? 0) - (wdl[a.id]?.gp ?? 0));
    else if (mode === "elo") arr.sort((a, b) => (elo[b.id] ?? START_ELO) - (elo[a.id] ?? START_ELO));
    else if (mode === "record") arr.sort((a, b) => rec(b) - rec(a) || (wdl[b.id]?.w ?? 0) - (wdl[a.id]?.w ?? 0));
    else if (mode === "winpct") arr.sort((a, b) => { const ra = wdl[a.id] || { gp: 0 }, rb = wdl[b.id] || { gp: 0 }; if (!ra.gp && !rb.gp) return 0; if (!ra.gp) return 1; if (!rb.gp) return -1; return winPct(rb) - winPct(ra) || rb.gp - ra.gp; });
    else if (mode === "form") arr.sort((a, b) => { const ra = wdl[a.id] || { gp: 0 }, rb = wdl[b.id] || { gp: 0 }; if (!ra.gp && !rb.gp) return 0; if (!ra.gp) return 1; if (!rb.gp) return -1; return formScoreOf(b) - formScoreOf(a) || (rb.w ?? 0) - (ra.w ?? 0); });
    else arr.sort((a, b) => ((officialMap[b.id] ?? -1e9) - (officialMap[a.id] ?? -1e9)) || ((elo[b.id] ?? 0) - (elo[a.id] ?? 0)) || ((wdl[a.id]?.gp ?? 0) - (wdl[b.id]?.gp ?? 0)));
    return arr;
  }, [players, filtered, elo, wdl, form, mode, officialMap, networkMap, glicko]);

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

  // The view this table opens on — Sam, 27 Sep: "a small option next to the
  // dots and search so when I log in it's on that default unless turned
  // off". Saved per league on this device, the way the season toggle above
  // already is: it is a preference about how YOU read the table, not a
  // league setting, so nobody else's table changes.
  const defaultKey = "rally.tableDefault." + (group?.id || "none");
  type TableDefault = { metric: string; who: string; when: string };
  const [savedDefault, setSavedDefault] = useState<TableDefault | null>(null);
  useEffect(() => {
    let d: TableDefault | null = null;
    try { const raw = window.localStorage.getItem(defaultKey); d = raw ? JSON.parse(raw) : null; } catch { d = null; }
    setSavedDefault(d);
    if (!d) return;
    // Applied once, when the table opens for this league. After that the
    // chips are yours to change for the visit; the pin just shows it is no
    // longer the default view.
    if (d.who === "legacy") setView("legacy");
    else if (d.who === "active" || d.who === "nonactive" || d.who === "all") { setView("active"); setActiveScope(d.who); }
    // A pin saved with a year (the year chips are gone) opens on all time.
    if (d.when === "season") setScope("season");
    else if (d.when) setScope("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultKey]);
  const [query, setQuery] = useState("");
  const [showUnranked, setShowUnranked] = useState(false);
  const scopedRanked = activeScope === "active" ? activeRanked : activeScope === "nonactive" ? nonActiveRanked : ranked;

  // Who is most likely to top the season, on the Table's own rating (Sam,
  // 2026-10-22: it was Elo plus form, and had Charlie ahead of Zaach while
  // the table above it had Zaach clear). Each player's chance is their share
  // of 10^(rating/400) — the chess odds, so 200 points apart is about three
  // to one.
  const prediction = useMemo(() => {
    const cont = players.filter((p) => (wdl[p.id]?.gp || 0) > 0 && !p.inactive && glicko.rating[p.id] != null);
    if (!cont.length) return [];
    const raw = cont.map((p) => ({ p, e: Math.pow(10, glicko.rating[p.id] / 400) }));
    const tot = raw.reduce((s, x) => s + x.e, 0) || 1;
    return raw.map((x) => ({ p: x.p, pct: Math.round((x.e / tot) * 100) })).sort((a, b) => b.pct - a.pct);
  }, [players, wdl, glicko]);

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


  // Every control that used to stack down the screen, as one scrolling row
  // of chips. The stack ran to roughly 1400px of chrome before rank 1
  // appeared, which is more table than table.
  const periodValue = inSeason ? "season" : "all";
  const metricValue = mode;
  const filters: FilterDef[] = [
    {
      key: "scope", label: "Who is included",
      value: view === "legacy" ? "legacy" : activeScope,
      options: [
        { value: "active", label: "Active", note: "Played in the last 12 months." },
        { value: "nonactive", label: "Not active", note: "Everyone who has not." },
        { value: "all", label: "Everyone in this club" },
        { value: "legacy", label: "Legacy", note: "Career impact, including people who have stopped playing." },
        ...(onGoGlobal ? [{ value: "global", label: "Global table", note: "Everyone you have crossed paths with, across every club." }] : []),
      ],
      onChange: (v: string) => {
        if (v === "global") return onGoGlobal && onGoGlobal();
        if (v === "legacy") return setView("legacy");
        setView("active");
        setActiveScope(v as any);
      },
    },
  ];

  // What the big number on a row is, and what it is called. Record keeps its
  // own display string, because "28-6-10" is not a rating and cannot be one,
  // while still sorting and drawing its bar on the numeric score behind it.
  const valueOf = (id: string): number => {
    const r = wdl[id] || { w: 0, d: 0, l: 0, gp: 0 };
    if (mode === "glicko") return glicko.rating[id] ?? 0;
    if (mode === "network") return networkMap[id] ?? 0;
    if (mode === "elo") return elo[id] ?? START_ELO;
    if (mode === "winpct") return r.gp ? Math.round(winPct(r) * 100) : 0;
    if (mode === "form") return (form[id] || []).slice(-5).reduce((sum: number, x: string) => sum + (x === "W" ? 1 : x === "L" ? -1 : 0), 0);
    if (mode === "record") return r.gp ? winPct(r) * 100 : 0;
    return officialMap[id] ?? 0;
  };
  // "rating", not "glicko": with one table there is nothing to tell it apart
  // from, and the name means nothing to a member. How the ranking works says.
  const unit = mode === "glicko" ? "rating" : mode === "network" ? "strength" : mode === "elo" ? "elo" : mode === "winpct" ? "win %" : mode === "form" ? "form" : mode === "record" ? "record" : "rating";

  const q = query.trim().toLowerCase();
  const searched = q
    ? scopedRanked.filter((pl: any) => ((pl.name || "") + " " + (pl.last || "") + " " + (pl.nick || "")).toLowerCase().includes(q))
    : scopedRanked;

  // In a season, only the people who have played in it. Everyone else would
  // be listed "1=" with "no games yet" — a table of ties nobody earned.
  const seasonal = inSeason ? searched.filter((pl: any) => (wdl[pl.id]?.gp || 0) > 0) : searched;
  // A place is a claim about where somebody stands, and too few matches
  // cannot back one (brief item 4; the Global table has drawn this line since
  // 2026-09-06). Below it you are listed underneath with how many more you
  // need — "Dan T · 2 more matches to rank" — rather than shown as "1st of 1".
  // Counted on what this view counts: all time asks for PROVISIONAL_GAMES (5),
  // a season for SEASON_RANK_GAMES (3) played IN the season.
  const minGames = inSeason ? SEASON_RANK_GAMES : PROVISIONAL_GAMES;
  const isRanked = (id: string) => (wdl[id]?.gp || 0) >= minGames;
  const standingsPlayers: StandingsPlayer[] = seasonal.map((pl: any) => {
    const r = wdl[pl.id] || { w: 0, d: 0, l: 0, gp: 0 };
    return {
      player: pl,
      rating: valueOf(pl.id),
      displayOverride: mode === "record" ? r.w + "-" + r.d + "-" + r.l : undefined,
      uncertainty: mode === "glicko" && glicko.rd[pl.id] != null ? glicko.rd[pl.id] : undefined,
      provisional: mode === "glicko" ? !!glicko.provisional[pl.id] : undefined,
      w: r.w, d: r.d, l: r.l,
      form: (form[pl.id] || []).slice(-5) as any,
      movement: undefined,
    };
  });

  // Enough matches to be listed, then split on the ±: established players
  // hold the places, provisional ones follow underneath without a place —
  // Sam, 2026-10-22: provisional players listed below established ones.
  const rankedRows = standingsPlayers.filter((sp: any) => isRanked(sp.player.id) && !sp.provisional);
  const provisionalRows = standingsPlayers.filter((sp: any) => isRanked(sp.player.id) && sp.provisional);
  const unrankedRows = standingsPlayers.filter((sp: any) => !isRanked(sp.player.id))
    .sort((x: any, y: any) => (wdl[y.player.id]?.gp || 0) - (wdl[x.player.id]?.gp || 0));
  const current: TableDefault = { metric: metricValue, who: view === "legacy" ? "legacy" : activeScope, when: periodValue };
  // Metric is not compared: there is only one now, and a pin saved under
  // Official before the change should still read as pinned.
  const pinned = !!savedDefault && savedDefault.who === current.who && savedDefault.when === current.when;
  const togglePin = () => {
    if (pinned) {
      try { window.localStorage.removeItem(defaultKey); } catch { /* nothing saved to remove */ }
      setSavedDefault(null);
      return;
    }
    try { window.localStorage.setItem(defaultKey, JSON.stringify(current)); } catch { /* private window: it lasts this visit */ }
    setSavedDefault(current);
  };

  return (
    <div>
      {/* No season banner here (Sam, 2026-10-22): the This season / All time
          switch right below already says which you are looking at, and Home
          carries the countdown. */}
      {season && view !== "legacy" && (
        <div style={{ ...segmentTrack, marginBottom: 12 }}>
          <button onClick={() => setScope("season")} style={segmentOption(inSeason)}>
            {seasonEnded ? season.name : "This season"}
          </button>
          <button onClick={() => setScope("all")} style={segmentOption(!inSeason)}>All time</button>
        </div>
      )}
      <FilterChips
        filters={filters}
        pin={{ on: pinned, onToggle: togglePin }}
        search={{ value: query, onChange: setQuery }}
        overflow={{ title: "How the ranking works", content: <RankingInfo /> }}
      />

      {view === "legacy" ? (
        <LegacyTable players={players} matches={matches} onOpen={onOpenLegacy} />
      ) : (
        <>
          {podium.length > 0 && <SeasonPodium season={season} podium={podium} players={players} onOpen={(id: string) => onOpen(id, "all")} />}
          {players.length > 0 && standingsPlayers.length === 0 ? (
            <Empty msg={q ? "Nobody here by that name." : inSeason ? `No results yet in ${season.name}. The table fills in as matches are logged.` : activeScope === "active" ? "No one has played in the last 12 months. Try Legacy for career history." : activeScope === "nonactive" ? "Everyone has played in the last 12 months." : "No players yet."} />
          ) : (
            <>
            {rankedRows.length === 0 && (
              <Empty msg={provisionalRows.length
                ? "Nobody has an established rating yet. Everyone so far is provisional, listed below."
                : `Nobody has played ${minGames} matches${inSeason ? " this season" : ""} yet, so nobody is ranked.`} />
            )}
            {rankedRows.length > 0 && <StandingsList
              players={rankedRows}
              matches={filtered}
              vsMatches={matches}
              meId={meId}
              unit={unit}
              onOpen={(id: string) => onOpen(id, "all")}
            />}
            {provisionalRows.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontFamily: body, fontSize: 13, color: MUTED, letterSpacing: 0, padding: "0 4px 2px" }}>Provisional</div>
                <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, lineHeight: 1.45, padding: "0 4px 8px" }}>
                  Rated, but the ± is still wide — a few more results and they take a place.
                </div>
                <StandingsList
                  players={provisionalRows}
                  matches={filtered}
                  vsMatches={matches}
                  meId={meId}
                  unit={unit}
                  placeless
                  onOpen={(id: string) => onOpen(id, "all")}
                />
              </div>
            )}
            {unrankedRows.length > 0 && (
              <SurfaceCard radius={18} pad="0 14px" style={{ marginTop: 14 }}>
                {/* One line until tapped: a list of everybody who has played
                    once or twice was half the screen, under the table it was
                    meant to be a footnote to. */}
                <button
                  onClick={() => setShowUnranked(!showUnranked)}
                  aria-expanded={showUnranked}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: "14px 0", cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ flex: 1, fontFamily: body, fontSize: 14.5, color: CHALK }}>
                    {unrankedRows.length === 1 ? "1 player needs a few more matches" : `${unrankedRows.length} players need a few more matches`}
                  </span>
                  <ChevronDown size={16} color={MUTED} style={{ transform: showUnranked ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
                </button>
                {showUnranked && unrankedRows.map((sp: any) => {
                  const gp = wdl[sp.player.id]?.gp || 0;
                  const left = minGames - gp;
                  const pl = sp.player;
                  const short = (pl.name || "").trim() + (pl.last ? " " + String(pl.last).trim()[0].toUpperCase() : "");
                  return (
                    <div key={pl.id} onClick={() => onOpen(pl.id, "all")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "0.5px solid " + PANEL2, cursor: "pointer" }}>
                      <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 15, color: pl.id === meId ? BALL : CHALK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{short || fullNameOf(pl)}</span>
                      <span style={{ fontFamily: body, fontSize: 12.5, color: MUTED, flexShrink: 0 }}>{left === 1 ? "1 more match" : `${left} more matches`}</span>
                    </div>
                  );
                })}
                {showUnranked && <div style={{ height: 6 }} />}
              </SurfaceCard>
            )}
            </>
          )}

          {/* The prediction and the recap sit below the table: worth reading,
              but not before you can see who is top. The season countdown that
              used to live here is the banner at the top now. */}
          {inSeason && !seasonEnded && prediction.length > 0 && <div style={{ marginTop: 18 }}><PredictionCard prediction={prediction} /></div>}
          {inSeason && !seasonEnded && recap && <div style={{ marginTop: 18 }}><RecapCard recap={recap} nameOf={nameOf} leagueName={group.name} /></div>}
        </>
      )}
    </div>
  );
}
