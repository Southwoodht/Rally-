"use client";
import React, { useState, useMemo } from "react";
import { Empty } from "@/components/ui/atoms";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { computeStats } from "@/core/elo";
import { levelAt, levelVal } from "@/core/levels";
import { explainFactors, predictProb, predictProbAtVenue, venuesFor } from "@/core/predict";
import { computeRivalry } from "@/core/rivalries";
import { D, fmtDate, winPct, winnerLabel } from "@/lib/format";
import { BALL, CHALK, CLAY, LINE, MUTED, PANEL2, body, card, display, miniInput, mono } from "@/lib/theme";
import {
  DOT_LOSS, FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_RAISED,
  FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, tabular,
} from "@/lib/theme";

const sectionLabel: React.CSSProperties = {
  fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID,
  textTransform: "uppercase", letterSpacing: 0.8,
};

export function HeadToHead({ players, matches, elo, wdl, nameOf, onOpen, onCreatePlayer, initialA, initialB }: any) {
  // Seeded when you arrive from a Table row: comparing an empty pair with
  // an empty pair is not what you asked for when you tapped somebody.
  const [a, setA] = useState(initialA || ""); const [b, setB] = useState(initialB || "");
  const [yr, setYr] = useState("all");
  const [venue, setVenue] = useState("");
  const byId = {}; players.forEach((p) => { byId[p.id] = p; });
  const years = useMemo(() => Array.from(new Set(matches.filter((m) => m.status !== "pending").map((m) => new Date(m.date).getFullYear()))).sort((x: any, y: any) => y - x), [matches]);
  const scoped = useMemo(() => yr === "all" ? matches : matches.filter((m) => new Date(m.date).getFullYear() === Number(yr)), [matches, yr]);
  const nm = (id) => byId[id] ? byId[id].name + (byId[id].last ? " " + byId[id].last : "") : nameOf(id);
  const games = useMemo(() => { if (!a || !b) return []; return scoped.filter((m) => (m.p1 === a && m.p2 === b) || (m.p1 === b && m.p2 === a)).sort((x, y) => y.date - x.date); }, [a, b, scoped]);
  const rivalry = useMemo(() => (a && b ? computeRivalry(a, b, scoped) : null), [a, b, scoped]);
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
    <div style={{ display: "flex", alignItems: "center", padding: "9px 0", borderTop: "none" }}>
      <span style={{ ...tabular, flex: 1, fontFamily: body, fontSize: 14, fontWeight: 500, color: hiA ? FEED_LIME : FEED_TEXT_HI, textAlign: "left" }}>{av}</span>
      <span style={{ width: 118, textAlign: "center", fontFamily: body, fontWeight: 400, fontSize: 11.5, color: FEED_TEXT_MID }}>{label}</span>
      <span style={{ ...tabular, flex: 1, fontFamily: body, fontSize: 14, fontWeight: 500, color: hiB ? FEED_LIME : FEED_TEXT_HI, textAlign: "right" }}>{bv}</span>
    </div>
  );
  const pa = byId[a], pb = byId[b];
  const scopedStats = useMemo(() => computeStats(players, scoped), [players, scoped]);
  const eloS = scopedStats.elo, wdlS = scopedStats.wdl;
  const ra = wdlS[a] || { w: 0, d: 0, l: 0, gp: 0 }, rb = wdlS[b] || { w: 0, d: 0, l: 0, gp: 0 };
  const sa = a ? statsFor(a) : null, sb = b ? statsFor(b) : null;
  const venues = useMemo(() => venuesFor(scoped), [scoped]);
  const venuePrediction = useMemo(() => (a && b && venue ? predictProbAtVenue(a, b, scoped, eloS, players, venue) : null), [a, b, scoped, eloS, players, venue]);
  const pctA = a && b ? (venuePrediction ? venuePrediction.pct : Math.round(predictProb(a, b, scoped, eloS, players) * 100)) : 50;
  const explanation = useMemo(() => {
    if (!a || !b) return "";
    const f = explainFactors(a, b, scoped, eloS, players);
    const favored = pctA >= 50 ? "A" : "B";
    const favoredName = favored === "A" ? nm(a) : nm(b);
    const otherName = favored === "A" ? nm(b) : nm(a);
    const reasons: { text: string; weight: number }[] = [];
    const eloDiff = favored === "A" ? f.eloDiff : -f.eloDiff;
    if (eloDiff >= 8) reasons.push({ text: `a ${eloDiff}-point ELO edge`, weight: eloDiff });
    const favH2H = favored === "A" ? f.h2h.aw : f.h2h.bw, othH2H = favored === "A" ? f.h2h.bw : f.h2h.aw;
    if (f.h2h.n > 0 && favH2H !== othH2H) reasons.push({ text: `a ${favH2H}-${othH2H}${f.h2h.d ? "-" + f.h2h.d : ""} head-to-head lead`, weight: (favH2H - othH2H) * 20 });
    const favForm = favored === "A" ? f.formA : f.formB, othForm = favored === "A" ? f.formB : f.formA;
    const favNet = favForm.w - favForm.l, othNet = othForm.w - othForm.l;
    if (favForm.n > 0 && favNet > othNet) reasons.push({ text: `better recent form (${favForm.w}-${favForm.l} in their last ${favForm.n})`, weight: (favNet - othNet) * 10 });
    const favLv = favored === "A" ? f.levelA : f.levelB, othLv = favored === "A" ? f.levelB : f.levelA;
    if (favLv != null && othLv != null && favLv > othLv) reasons.push({ text: "plays at a higher level", weight: (favLv - othLv) * 5 });
    reasons.sort((x, y) => y.weight - x.weight);
    const top = reasons.slice(0, 2).map((r) => r.text);
    if (!top.length) {
      return f.h2h.n === 0
        ? `${favoredName} and ${otherName} haven't played each other yet — this leans on overall form and level, and it's close.`
        : `This one's close — ${favoredName} has the slightest edge overall.`;
    }
    return `Rally favours ${favoredName} — ${top.join(" and ")}.`;
  }, [a, b, scoped, eloS, players, pctA]);
  return (
    <div style={{ background: FEED_CARD, borderRadius: 18, padding: 18 }}>
      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, marginBottom: 14, lineHeight: 1.45 }}>Pick any two players — works even if they've never played each other.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1 }}><PlayerPicker value={a} onChange={setA} players={players} exclude={b} placeholder="Player A" onCreatePlayer={onCreatePlayer} /></div>
        <div style={{ flex: 1 }}><PlayerPicker value={b} onChange={setB} players={players} exclude={a} placeholder="Player B" onCreatePlayer={onCreatePlayer} /></div>
      </div>
      <select value={yr} onChange={(e) => setYr(e.target.value)} style={{ ...miniInput, width: "100%", marginBottom: venues.length ? 8 : 16, boxSizing: "border-box" as const }}>
        <option value="all">All-time</option>
        {years.map((y: number) => <option key={y} value={String(y)}>{y}</option>)}
      </select>
      {venues.length > 0 && (
        <select value={venue} onChange={(e) => setVenue(e.target.value)} style={{ ...miniInput, width: "100%", marginBottom: 16, boxSizing: "border-box" as const }}>
          <option value="">Any venue</option>
          {venues.map((v) => <option key={v} value={v}>At {v}</option>)}
        </select>
      )}
      {a && b ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontFamily: body, fontSize: 17, fontWeight: 500, color: FEED_TEXT_HI, letterSpacing: "-0.02em" }}>{nm(a)}</span>
            <span style={{ fontFamily: body, fontSize: 17, fontWeight: 500, color: FEED_TEXT_HI, letterSpacing: "-0.02em" }}>{nm(b)}</span>
          </div>
          {rivalry && (() => {
            const leader = rivalry.w > rivalry.l ? nm(a) : rivalry.l > rivalry.w ? nm(b) : null;
            const leadRec = rivalry.w >= rivalry.l ? `${rivalry.w}-${rivalry.d}-${rivalry.l}` : `${rivalry.l}-${rivalry.d}-${rivalry.w}`;
            const streakName = rivalry.streak.holder === "me" ? nm(a) : rivalry.streak.holder === "opp" ? nm(b) : null;
            return (
              <div style={{ background: FEED_RAISED, borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ ...sectionLabel, color: FEED_LIME, marginBottom: 5 }}>Rivalry · {rivalry.total} matches</div>
                <div style={{ fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_HI, marginBottom: 3 }}>{leader ? `${leader} leads ${leadRec}` : `Tied ${rivalry.w}-${rivalry.d}-${rivalry.l}`}</div>
                <div style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID }}>{streakName ? `Current streak: ${streakName} W${rivalry.streak.count} · ` : ""}Last meeting: {fmtDate(rivalry.lastMeeting)}</div>
              </div>
            );
          })()}
          <div style={{ ...tabular, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: body, fontSize: 16, fontWeight: 500, marginBottom: 6 }}><span style={{ color: pctA >= 50 ? FEED_LIME : FEED_TEXT_MID }}>{pctA}%</span><span style={{ fontSize: 11.5, fontWeight: 400, color: FEED_TEXT_LOW }}>predicted win</span><span style={{ color: pctA < 50 ? FEED_LIME : FEED_TEXT_MID }}>{100 - pctA}%</span></div>
          <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: FEED_RAISED, marginBottom: 12 }}><div style={{ width: pctA + "%", background: FEED_LIME }} /><div style={{ width: (100 - pctA) + "%", background: DOT_LOSS }} /></div>
          {venue && (
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: venuePrediction?.confident ? FEED_LIME : FEED_TEXT_MID, marginBottom: 14, lineHeight: 1.45 }}>
              {venuePrediction?.confident ? `Factoring in results at ${venue}.` : `Not enough games at ${venue} yet to say — showing the overall prediction.`}
            </div>
          )}
          {explanation && <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.5, marginBottom: 18 }}>{explanation}</div>}
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
                <div style={{ ...sectionLabel, marginBottom: 7, textAlign: i ? "right" : "left" }}>Best wins</div>
                {s.top3.length ? s.top3.map((w, j) => (
                  <div key={j} style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_HI, padding: "4px 0", textAlign: i ? "right" : "left" }}><span style={{ ...tabular, color: FEED_TEXT_LOW }}>{j + 1}</span>  {nm(w.oid)} <span style={{ ...tabular, color: FEED_TEXT_MID }}>{w.yr}</span></div>
                )) : <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, textAlign: i ? "right" : "left" }}>None yet</div>}
              </div>
            ))}
          </div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 11.5, color: FEED_TEXT_MID, marginTop: 22, lineHeight: 1.5, borderTop: "0.5px solid " + FEED_HAIRLINE, paddingTop: 12 }}>Yellow = their record against that player. Grey = that player's level and overall record.</div>
          <div style={{ display: "flex", gap: 0, marginTop: 8 }}>
            {([[sa, 0], [sb, 1]] as any[]).map(([s, i]: any) => {
              const Line = ({ e }: any) => {
                const o = wdlS[e.oid] || { w: 0, d: 0, l: 0, gp: 0 };
                const lvl = levelAt(byId[e.oid], Date.now());
                return (
                  <button onClick={() => onOpen && onOpen(e.oid)} style={{ display: "block", width: "100%", background: "transparent", border: "none", padding: "5px 0", cursor: "pointer", textAlign: i ? "right" : "left" }}>
                    <div style={{ display: "flex", flexDirection: i ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontFamily: body, fontSize: 13, color: CHALK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nm(e.oid)}</span>
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
          {games.length ? games.map((m) => <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "none", fontFamily: body, fontSize: 13, color: CHALK }}><span style={{ color: MUTED, fontFamily: mono, fontSize: 11 }}>{fmtDate(m.date)}</span><span>{winnerLabel(m, nameOf)}{m.score ? <span style={{ color: MUTED }}> · {m.score}</span> : null}</span></div>) : <div style={{ fontFamily: body, fontSize: 13, color: MUTED, padding: "6px 0" }}>They've never played each other — the prediction above is based on their form, levels and results against others.</div>}
        </>
      ) : <Empty msg="Pick two players to compare." />}
    </div>
  );
}
