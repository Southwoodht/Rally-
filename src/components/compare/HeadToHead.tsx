"use client";
import React, { useState, useMemo } from "react";
import { Empty, Select } from "@/components/ui/atoms";
import { computeStats } from "@/core/elo";
import { levelAt, levelVal } from "@/core/levels";
import { predictProb } from "@/core/predict";
import { D, fmtDate, winPct, winnerLabel } from "@/lib/format";
import { BALL, CHALK, CLAY, LINE, MUTED, PANEL2, body, card, display, miniInput, mono } from "@/lib/theme";

export function HeadToHead({ players, matches, elo, wdl, nameOf, onOpen }: any) {
  const [a, setA] = useState(""); const [b, setB] = useState("");
  const [yr, setYr] = useState("all");
  const byId = {}; players.forEach((p) => { byId[p.id] = p; });
  const years = useMemo(() => Array.from(new Set(matches.filter((m) => m.status !== "pending").map((m) => new Date(m.date).getFullYear()))).sort((x: any, y: any) => y - x), [matches]);
  const scoped = useMemo(() => yr === "all" ? matches : matches.filter((m) => new Date(m.date).getFullYear() === Number(yr)), [matches, yr]);
  const nm = (id) => byId[id] ? byId[id].name + (byId[id].last ? " " + byId[id].last : "") : nameOf(id);
  const games = useMemo(() => { if (!a || !b) return []; return scoped.filter((m) => (m.p1 === a && m.p2 === b) || (m.p1 === b && m.p2 === a)).sort((x, y) => y.date - x.date); }, [a, b, scoped]);
  let aw = 0, bw = 0, d = 0;
  games.forEach((m) => { if (m.winner === "draw") d++; else if ((m.winner === "p1" && m.p1 === a) || (m.winner === "p2" && m.p2 === a)) aw++; else bw++; });
  const statsFor = (pid) => {
    const conf = scoped.filter((m) => m.status !== "pending" && (m.p1 === pid || m.p2 === pid)).sort((x, y) => x.date - y.date);
    const res = (m) => m.winner === "draw" ? "D" : ((m.winner === "p1" && m.p1 === pid) || (m.winner === "p2" && m.p2 === pid)) ? "W" : "L";
    const opp = (m) => m.p1 === pid ? m.p2 : m.p1;
    let cur = 0; for (let i = conf.length - 1; i >= 0; i--) { if (res(conf[i]) === "W") cur++; else break; }
    const runs: any[][] = []; let run: any[] = [];
    conf.forEach((m) => { if (res(m) === "W") run.push(m); else { if (run.length) runs.push(run); run = []; } });
    if (run.length) runs.push(run);
    const best = runs.reduce((mx, r) => Math.max(mx, r.length), 0);
    const wins = conf.filter((m) => res(m) === "W").map((m) => { const o = opp(m); const oppLv = levelVal(levelAt(byId[o], m.date)) ?? 0; const myLv = levelVal(levelAt(byId[pid], m.date)) ?? 0; const upset = Math.max(0, oppLv - myLv); return { oid: o, lv: (oppLv + upset) * 1000 + ((elo && elo[o]) || 0), yr: new Date(m.date).getFullYear() }; });
    const top3 = [...wins].sort((x, y) => y.lv - x.lv).slice(0, 3);
    const h2hMap = {};
    conf.forEach((m) => { const o = opp(m); if (!h2hMap[o]) h2hMap[o] = { w: 0, d: 0, l: 0 }; const r = res(m); if (r === "W") h2hMap[o].w++; else if (r === "L") h2hMap[o].l++; else h2hMap[o].d++; });
    const entries = Object.keys(h2hMap).map((o) => ({ oid: o, ...h2hMap[o], net: h2hMap[o].w - h2hMap[o].l }));
    const winning = entries.filter((e) => e.net > 0).sort((x, y) => y.net - x.net);
    const losing = entries.filter((e) => e.net < 0).sort((x, y) => x.net - y.net);
    const even = entries.filter((e) => e.net === 0);
    return { cur, best, top3, winning, losing, even };
  };
  const Row = ({ label, av, bv, hiA, hiB }: any) => (
    <div style={{ display: "flex", alignItems: "center", padding: "9px 0", borderTop: "1px solid " + LINE }}>
      <span style={{ flex: 1, fontFamily: mono, fontSize: 12.5, fontWeight: 700, color: hiA ? BALL : CHALK, textAlign: "left" }}>{av}</span>
      <span style={{ width: 108, textAlign: "center", fontFamily: mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: MUTED }}>{label}</span>
      <span style={{ flex: 1, fontFamily: mono, fontSize: 12.5, fontWeight: 700, color: hiB ? BALL : CHALK, textAlign: "right" }}>{bv}</span>
    </div>
  );
  const pa = byId[a], pb = byId[b];
  const scopedStats = useMemo(() => computeStats(players, scoped), [players, scoped]);
  const eloS = scopedStats.elo, wdlS = scopedStats.wdl;
  const ra = wdlS[a] || { w: 0, d: 0, l: 0, gp: 0 }, rb = wdlS[b] || { w: 0, d: 0, l: 0, gp: 0 };
  const sa = a ? statsFor(a) : null, sb = b ? statsFor(b) : null;
  const pctA = a && b ? Math.round(predictProb(a, b, scoped, eloS, players) * 100) : 50;
  return (
    <div style={card}>
      <div style={{ fontFamily: body, fontSize: 13, color: MUTED, marginBottom: 12 }}>Pick any two players — works even if they've never played each other.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1 }}><Select value={a} onChange={setA} players={players} exclude={b} placeholder="Player A" /></div>
        <div style={{ flex: 1 }}><Select value={b} onChange={setB} players={players} exclude={a} placeholder="Player B" /></div>
      </div>
      <select value={yr} onChange={(e) => setYr(e.target.value)} style={{ ...miniInput, width: "100%", marginBottom: 16, boxSizing: "border-box" as const }}>
        <option value="all">All-time</option>
        {years.map((y: number) => <option key={y} value={String(y)}>{y}</option>)}
      </select>
      {a && b ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontFamily: display, fontSize: 17, fontWeight: 700, color: CHALK, textTransform: "uppercase" }}>{nm(a)}</span>
            <span style={{ fontFamily: display, fontSize: 17, fontWeight: 700, color: CHALK, textTransform: "uppercase" }}>{nm(b)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 15, fontWeight: 700, marginBottom: 4 }}><span style={{ color: pctA >= 50 ? BALL : MUTED }}>{pctA}%</span><span style={{ fontSize: 9, color: MUTED, letterSpacing: 1, alignSelf: "center" }}>PREDICTED WIN</span><span style={{ color: pctA < 50 ? BALL : MUTED }}>{100 - pctA}%</span></div>
          <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: PANEL2, marginBottom: 16 }}><div style={{ width: pctA + "%", background: BALL }} /><div style={{ width: (100 - pctA) + "%", background: MUTED }} /></div>
          <Row label="Head to head" av={aw + "-" + d + "-" + bw} bv={bw + "-" + d + "-" + aw} hiA={aw > bw} hiB={bw > aw} />
          <Row label="Record" av={ra.w + "-" + ra.d + "-" + ra.l} bv={rb.w + "-" + rb.d + "-" + rb.l} />
          <Row label="Win rate" av={ra.gp ? Math.round(winPct(ra) * 100) + "%" : "–"} bv={rb.gp ? Math.round(winPct(rb) * 100) + "%" : "–"} hiA={ra.gp && rb.gp && winPct(ra) > winPct(rb)} hiB={ra.gp && rb.gp && winPct(rb) > winPct(ra)} />
          <Row label="Games" av={ra.gp} bv={rb.gp} hiA={ra.gp > rb.gp} hiB={rb.gp > ra.gp} />
          <Row label="ELO" av={Math.round(eloS[a] ?? 0)} bv={Math.round(eloS[b] ?? 0)} hiA={(eloS[a] ?? 0) > (eloS[b] ?? 0)} hiB={(eloS[b] ?? 0) > (eloS[a] ?? 0)} />
          <Row label="Level" av={pa?.level ? pa.level.cat : "–"} bv={pb?.level ? pb.level.cat : "–"} />
          <Row label="Streak now" av={sa?.cur ?? 0} bv={sb?.cur ?? 0} hiA={(sa?.cur ?? 0) > (sb?.cur ?? 0)} hiB={(sb?.cur ?? 0) > (sa?.cur ?? 0)} />
          <Row label="Best streak" av={sa?.best ?? 0} bv={sb?.best ?? 0} hiA={(sa?.best ?? 0) > (sb?.best ?? 0)} hiB={(sb?.best ?? 0) > (sa?.best ?? 0)} />
          <Row label="Winning recs" av={sa?.winning?.length ?? 0} bv={sb?.winning?.length ?? 0} hiA={(sa?.winning?.length ?? 0) > (sb?.winning?.length ?? 0)} hiB={(sb?.winning?.length ?? 0) > (sa?.winning?.length ?? 0)} />
          <Row label="Losing recs" av={sa?.losing?.length ?? 0} bv={sb?.losing?.length ?? 0} hiA={(sa?.losing?.length ?? 0) < (sb?.losing?.length ?? 0)} hiB={(sb?.losing?.length ?? 0) < (sa?.losing?.length ?? 0)} />
          <Row label="Home" av={pa?.home || "–"} bv={pb?.home || "–"} />
          <Row label="Age" av={pa?.age || "–"} bv={pb?.age || "–"} />
          <div style={{ display: "flex", gap: 0, marginTop: 16 }}>
            {([[sa, a], [sb, b]] as any[]).map(([s, pid]: any, i: number) => (
              <div key={i} style={{ flex: 1, minWidth: 0, paddingLeft: i ? 12 : 0, paddingRight: i ? 0 : 12, borderLeft: i ? "1px solid " + LINE : "none" }}>
                <div style={{ fontFamily: mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: MUTED, marginBottom: 6, textAlign: i ? "right" : "left" }}>Best wins</div>
                {s.top3.length ? s.top3.map((w, j) => (
                  <div key={j} style={{ fontFamily: body, fontSize: 12, color: CHALK, padding: "3px 0", textAlign: i ? "right" : "left" }}>{["🥇", "🥈", "🥉"][j]} {byId[w.oid]?.name || nameOf(w.oid)} <span style={{ color: MUTED }}>{w.yr}</span></div>
                )) : <div style={{ fontFamily: body, fontSize: 12, color: MUTED, textAlign: i ? "right" : "left" }}>None yet</div>}
              </div>
            ))}
          </div>
          <div style={{ fontFamily: body, fontSize: 11, color: MUTED, marginTop: 20, lineHeight: 1.4 }}>Yellow = their record against that player. Grey = that player's level and overall record.</div>
          <div style={{ display: "flex", gap: 0, marginTop: 8 }}>
            {([[sa, 0], [sb, 1]] as any[]).map(([s, i]: any) => {
              const Line = ({ e }: any) => {
                const o = wdlS[e.oid] || { w: 0, d: 0, l: 0, gp: 0 };
                const lvl = levelAt(byId[e.oid], Date.now());
                return (
                  <button onClick={() => onOpen && onOpen(e.oid)} style={{ display: "block", width: "100%", background: "transparent", border: "none", padding: "5px 0", cursor: "pointer", textAlign: i ? "right" : "left" }}>
                    <div style={{ display: "flex", flexDirection: i ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontFamily: body, fontSize: 13, color: CHALK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{byId[e.oid]?.name || nameOf(e.oid)}</span>
                      <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: BALL }}>{e.w}-{e.l}</span>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 9.5, color: MUTED, letterSpacing: 0.5, marginTop: 1 }}>{lvl ? lvl.cat.slice(0, 3).toUpperCase() + " · " : ""}{o.w}-{o.l}</div>
                  </button>
                );
              };
              return (
                <div key={i} style={{ flex: 1, minWidth: 0, textAlign: i ? "right" : "left", paddingLeft: i ? 12 : 0, paddingRight: i ? 0 : 12, borderLeft: i ? "1px solid " + LINE : "none" }}>
                  <div style={{ fontFamily: mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: BALL, marginBottom: 5 }}>Winning rec vs</div>
                  {s.winning.length ? s.winning.slice(0, 6).map((e) => <Line key={e.oid} e={e} />) : <div style={{ fontFamily: body, fontSize: 12, color: MUTED }}>None</div>}
                  <div style={{ fontFamily: mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: CLAY, margin: "12px 0 5px" }}>Losing rec vs</div>
                  {s.losing.length ? s.losing.slice(0, 6).map((e) => <Line key={e.oid} e={e} />) : <div style={{ fontFamily: body, fontSize: 12, color: MUTED }}>Nobody</div>}
                </div>
              );
            })}
          </div>
          <div style={{ fontFamily: mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: MUTED, margin: "20px 0 6px" }}>Their matches</div>
          {games.length ? games.map((m) => <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid " + LINE, fontFamily: body, fontSize: 13, color: CHALK }}><span style={{ color: MUTED, fontFamily: mono, fontSize: 11 }}>{fmtDate(m.date)}</span><span>{winnerLabel(m, nameOf)}{m.score ? <span style={{ color: MUTED }}> · {m.score}</span> : null}</span></div>) : <div style={{ fontFamily: body, fontSize: 13, color: MUTED, padding: "6px 0" }}>They've never played each other — the prediction above is based on their form, levels and results against others.</div>}
        </>
      ) : <Empty msg="Pick two players to compare." />}
    </div>
  );
}
