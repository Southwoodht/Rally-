"use client";
import { countsAsPlayed } from "@/core/matchStatus";
import React, { useState, useMemo } from "react";
import { AlertCircle, ArrowLeftRight, Info } from "lucide-react";
import { Empty } from "@/components/ui/atoms";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { PROVISIONAL_GAMES } from "@/lib/globalTable";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { computeStats } from "@/core/elo";
import { levelAt, levelNow, levelVal } from "@/core/levels";
import { explainFactors, predictProb, predictProbAtVenue, venuesFor } from "@/core/predict";
import { computeRivalry } from "@/core/rivalries";
import { D, fmtDate, winPct, winnerLabel } from "@/lib/format";
import { BALL, CHALK, CLAY, LINE, MUTED, PANEL2, body, card, display, miniInput, mono } from "@/lib/theme";
import { FEED_THEY_LEAD } from "@/lib/theme";
import {
  FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_LOSS, FEED_PAGE, FEED_RAISED,
  FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, tabular,
} from "@/lib/theme";

// The filter chips, matching the Standings row: lime fill when the filter is
// doing something, a card chip when it is not.
function FilterChip({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? FEED_LIME : FEED_CARD, border: "none", borderRadius: 999,
        padding: "7px 14px", cursor: "pointer", fontFamily: body, fontWeight: active ? 500 : 400,
        fontSize: 12.5, color: active ? FEED_LIME_INK : FEED_TEXT_MID, whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

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
  // Read once, then in the way. Behind the icon it stays available without
  // costing every later visit six lines of screen.
  const [explainerOpen, setExplainerOpen] = useState(false);
  // Which filter sheet is open, if any.
  const [sheet, setSheet] = useState<null | "year" | "venue">(null);
  const byId = {}; players.forEach((p) => { byId[p.id] = p; });
  const years = useMemo(() => Array.from(new Set(matches.filter((m) => countsAsPlayed(m)).map((m) => new Date(m.date).getFullYear()))).sort((x: any, y: any) => y - x), [matches]);
  const scoped = useMemo(() => yr === "all" ? matches : matches.filter((m) => new Date(m.date).getFullYear() === Number(yr)), [matches, yr]);
  const nm = (id) => byId[id] ? byId[id].name + (byId[id].last ? " " + byId[id].last : "") : nameOf(id);
  const games = useMemo(() => { if (!a || !b) return []; return scoped.filter((m) => (m.p1 === a && m.p2 === b) || (m.p1 === b && m.p2 === a)).sort((x, y) => y.date - x.date); }, [a, b, scoped]);
  const rivalry = useMemo(() => (a && b ? computeRivalry(a, b, scoped) : null), [a, b, scoped]);
  let aw = 0, bw = 0, d = 0;
  games.forEach((m) => { if (m.winner === "draw") d++; else if ((m.winner === "p1" && m.p1 === a) || (m.winner === "p2" && m.p2 === a)) aw++; else bw++; });
  const statsFor = (pid) => {
    const conf = scoped.filter((m) => countsAsPlayed(m) && (m.p1 === pid || m.p2 === pid)).sort((x, y) => x.date - y.date);
    const res = (m) => m.winner === "draw" ? "D" : ((m.winner === "p1" && m.p1 === pid) || (m.winner === "p2" && m.p2 === pid)) ? "W" : "L";
    const opp = (m) => m.p1 === pid ? m.p2 : m.p1;
    let cur = 0; for (let i = conf.length - 1; i >= 0; i--) { if (res(conf[i]) === "W") cur++; else break; }
    const runs: any[][] = []; let run: any[] = [];
    conf.forEach((m) => { if (res(m) === "W") run.push(m); else { if (run.length) runs.push(run); run = []; } });
    if (run.length) runs.push(run);
    const best = runs.reduce((mx, r) => Math.max(mx, r.length), 0);
    const wins = conf.filter((m) => res(m) === "W").map((m) => { const o = opp(m); const oppLv = levelVal(levelAt(byId[o], m.date)); const myLv = levelVal(levelAt(byId[pid], m.date)); const lvTerm = oppLv == null || myLv == null ? 0 : oppLv + Math.max(0, oppLv - myLv); return { oid: o, lv: lvTerm * 1000 + ((elo && elo[o]) || 0), yr: new Date(m.date).getFullYear() }; });
    const top3 = [...wins].sort((x, y) => y.lv - x.lv).slice(0, 3);
    const h2hMap = {};
    conf.forEach((m) => { const o = opp(m); if (!h2hMap[o]) h2hMap[o] = { w: 0, d: 0, l: 0 }; const r = res(m); if (r === "W") h2hMap[o].w++; else if (r === "L") h2hMap[o].l++; else h2hMap[o].d++; });
    const entries = Object.keys(h2hMap).map((o) => ({ oid: o, ...h2hMap[o], net: h2hMap[o].w - h2hMap[o].l }));
    const winning = entries.filter((e) => e.net > 0).sort((x, y) => y.net - x.net);
    const losing = entries.filter((e) => e.net < 0).sort((x, y) => x.net - y.net);
    const even = entries.filter((e) => e.net === 0);
    return { cur, best, top3, winning, losing, even };
  };
/**
   * One comparison, with the arithmetic done for the reader.
   *
   * Two columns of numbers make you subtract them yourself, and most people
   * don't — the bar is the whole point of the row.
   *
   * `na`/`nb` are the numeric values behind the displayed strings. Passing
   * neither draws no bar, which is right for anything that is not a single
   * comparable magnitude: a record is three numbers and a level is a name,
   * and drawing either as a proportion would invent a quantity.
   *
   * `base` shifts both values before weighting, for scales that go below
   * zero. Elo does, and weighting a negative directly yields a negative
   * width. The base is the LEAGUE's floor rather than the pair's, because
   * pair-normalising always puts one of two values at the minimum and every
   * bar would read as a whitewash.
   */
  const StatRow = ({ label, av, bv, na, nb, base = 0, lowerWins = false, last = false }: any) => {
    const both = Number.isFinite(na) && Number.isFinite(nb);
    const aWins = both && (lowerWins ? na < nb : na > nb);
    const bWins = both && (lowerWins ? nb < na : nb > na);
    const sa = both ? Math.max(0, na - base) : 0;
    const sb = both ? Math.max(0, nb - base) : 0;
    const total = sa + sb;
    return (
      <div style={{ padding: "10px 0", borderBottom: last ? undefined : "0.5px solid " + FEED_HAIRLINE }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ ...tabular, flex: 1, minWidth: 0, fontFamily: body, fontSize: 16, fontWeight: 500, color: aWins ? FEED_LIME : FEED_TEXT_MID, textAlign: "left" }}>{av}</span>
          <span style={{ flex: "none", textAlign: "center", fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID }}>{label}</span>
          <span style={{ ...tabular, flex: 1, minWidth: 0, fontFamily: body, fontSize: 16, fontWeight: 500, color: bWins ? FEED_LIME : FEED_TEXT_MID, textAlign: "right" }}>{bv}</span>
        </div>
        {both && total > 0 && (
          <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", marginTop: 7, background: FEED_RAISED }}>
            <div style={{ width: (sa / total) * 100 + "%", background: aWins ? FEED_LIME : FEED_RAISED }} />
            <div style={{ width: (sb / total) * 100 + "%", background: bWins ? FEED_LIME : FEED_RAISED }} />
          </div>
        )}
      </div>
    );
  };
  const pa = byId[a], pb = byId[b];
  const scopedStats = useMemo(() => computeStats(players, scoped), [players, scoped]);
  const eloS = scopedStats.elo, wdlS = scopedStats.wdl;
  const ra = wdlS[a] || { w: 0, d: 0, l: 0, gp: 0 }, rb = wdlS[b] || { w: 0, d: 0, l: 0, gp: 0 };
  const sa = a ? statsFor(a) : null, sb = b ? statsFor(b) : null;
  const venues = useMemo(() => venuesFor(scoped), [scoped]);
  // Elo runs below zero, so the bars are weighted from the league's floor
  // rather than from the pair's — pair-normalising always pins one of two
  // values at the minimum, and every row would read as a whitewash.
  const eloFloor = useMemo(() => Math.min(0, ...Object.values(eloS).map((v: any) => Number(v) || 0)), [eloS]);
  // Whoever the app would not yet place on the global table is also whoever
  // it should not sound certain about here. One threshold, not two.
  const thin = useMemo(() => {
    const out: { name: string; gp: number }[] = [];
    [a, b].forEach((id) => {
      if (!id) return;
      const r = wdlS[id];
      const gp = r?.gp ?? 0;
      if (gp < PROVISIONAL_GAMES) out.push({ name: nm(id), gp });
    });
    return out;
  }, [a, b, wdlS]);
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
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 10 }}>
        <button
          onClick={() => setExplainerOpen(!explainerOpen)}
          aria-label="What is this?"
          aria-expanded={explainerOpen}
          style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", display: "grid", placeItems: "center" }}
        >
          <Info size={15} color={explainerOpen ? FEED_LIME : FEED_TEXT_MID} strokeWidth={2} />
        </button>
      </div>
      {explainerOpen && (
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.5, marginBottom: 14 }}>
          Pick any two players — this works even if they have never played each other.
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}><PlayerPicker value={a} onChange={setA} players={players} exclude={b} placeholder="Player A" onCreatePlayer={onCreatePlayer} /></div>
        <div style={{ flex: 1, minWidth: 0 }}><PlayerPicker value={b} onChange={setB} players={players} exclude={a} placeholder="Player B" onCreatePlayer={onCreatePlayer} /></div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        <FilterChip active={yr !== "all"} onClick={() => setSheet("year")}>{yr === "all" ? "All time" : yr}</FilterChip>
        {venues.length > 0 && (
          <FilterChip active={!!venue} onClick={() => setSheet("venue")}>{venue ? "At " + venue : "Any venue"}</FilterChip>
        )}
        {/* Comparing the other way round is a thing people do constantly, and
            it used to cost two trips through the pickers. */}
        <button
          onClick={() => { const t = a; setA(b); setB(t); }}
          aria-label="Swap the two players"
          disabled={!a && !b}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, background: FEED_CARD, border: "none",
            borderRadius: 999, padding: "7px 12px", cursor: a || b ? "pointer" : "default",
            fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, opacity: a || b ? 1 : 0.5,
          }}
        >
          <ArrowLeftRight size={13} strokeWidth={2} />Swap
        </button>
      </div>

      {sheet && (
        <div onClick={() => setSheet(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 97 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: FEED_PAGE, width: "100%", maxWidth: 620, maxHeight: "70vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "18px 16px 32px" }}>
            <div style={{ ...sectionLabel, marginBottom: 12 }}>{sheet === "year" ? "Period" : "Venue"}</div>
            {(sheet === "year"
              ? [{ v: "all", l: "All time" }, ...years.map((y: number) => ({ v: String(y), l: String(y) }))]
              : [{ v: "", l: "Any venue" }, ...venues.map((v: string) => ({ v, l: "At " + v }))]
            ).map((o: any) => {
              const on = sheet === "year" ? yr === o.v : venue === o.v;
              return (
                <button
                  key={o.v || "any"}
                  onClick={() => { if (sheet === "year") setYr(o.v); else setVenue(o.v); setSheet(null); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left", background: on ? FEED_RAISED : "transparent",
                    border: "none", borderRadius: 12, padding: "12px 14px", cursor: "pointer",
                    fontFamily: body, fontWeight: on ? 500 : 400, fontSize: 15, color: on ? FEED_LIME : FEED_TEXT_HI,
                  }}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {a && b ? (
        <>
          {rivalry && (() => {
            const leader = rivalry.w > rivalry.l ? nm(a) : rivalry.l > rivalry.w ? nm(b) : null;
            const leadRec = rivalry.w >= rivalry.l ? `${rivalry.w}-${rivalry.d}-${rivalry.l}` : `${rivalry.l}-${rivalry.d}-${rivalry.w}`;
            const streakName = rivalry.streak.holder === "me" ? nm(a) : rivalry.streak.holder === "opp" ? nm(b) : null;
            return (
              <div style={{ background: FEED_CARD, borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
                <div style={{ ...sectionLabel, color: FEED_LIME, marginBottom: 5 }}>Rivalry · {rivalry.total} matches</div>
                <div style={{ fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_HI, marginBottom: 3 }}>{leader ? `${leader} leads ${leadRec}` : `Tied ${rivalry.w}-${rivalry.d}-${rivalry.l}`}</div>
                <div style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID }}>{streakName ? `Current streak: ${streakName} W${rivalry.streak.count} · ` : ""}Last meeting: {fmtDate(rivalry.lastMeeting)}</div>
              </div>
            );
          })()}
          <SurfaceCard radius={18} style={{ marginBottom: 12 }}>
            <div style={{ textAlign: "center", fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID, textTransform: "uppercase", letterSpacing: 0.8 }}>Predicted win</div>
            <div style={{ ...tabular, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginTop: 8 }}>
              <span style={{ fontFamily: body, fontSize: 34, fontWeight: 500, letterSpacing: "-0.04em", color: pctA >= 50 ? FEED_LIME : FEED_TEXT_MID }}>{pctA}%</span>
              <span style={{ fontFamily: body, fontSize: 34, fontWeight: 500, letterSpacing: "-0.04em", color: pctA < 50 ? FEED_LIME : FEED_TEXT_MID }}>{100 - pctA}%</span>
            </div>
            {/* The underdog's half is the loss green, not a red: red against
                lime frames the other player as an error state, and coral was
                never in this palette to begin with. */}
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: FEED_RAISED, marginTop: 8 }}>
              <div style={{ width: pctA + "%", background: FEED_LIME }} />
              <div style={{ width: (100 - pctA) + "%", background: FEED_LOSS }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6 }}>
              <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nm(a)}</span>
              <span style={{ flex: 1, minWidth: 0, textAlign: "right", fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nm(b)}</span>
            </div>
            {(explanation || venue) && (
              <div style={{ borderTop: "0.5px solid " + FEED_HAIRLINE, marginTop: 14, paddingTop: 12 }}>
                {venue && (
                  <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: venuePrediction?.confident ? FEED_LIME : FEED_TEXT_MID, lineHeight: 1.5, marginBottom: explanation ? 6 : 0 }}>
                    {venuePrediction?.confident ? `Factoring in results at ${venue}.` : `Not enough games at ${venue} yet to say — showing the overall prediction.`}
                  </div>
                )}
                {explanation && <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.5 }}>{explanation}</div>}
              </div>
            )}
          </SurfaceCard>

          {/* A prediction off four games is not the same object as one off
              forty-six, and the screen used to present them identically. The
              threshold is the app's existing one rather than a second number
              invented here. */}
          {thin.length > 0 && (
            <SurfaceCard radius={16} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <AlertCircle size={16} color={FEED_LIME} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
                  {thin.map((t: any) => t.name + " has played " + t.gp + (t.gp === 1 ? " match" : " matches")).join(", and ")}.
                  {" "}Treat the prediction as a rough guide.
                </div>
              </div>
            </SurfaceCard>
          )}
          <SurfaceCard radius={18} style={{ marginBottom: 4 }}>
            <StatRow label="Head to head" av={aw + "–" + d + "–" + bw} bv={bw + "–" + d + "–" + aw} na={aw} nb={bw} />
            {/* No bar: 28–6–10 is three numbers, not a magnitude. */}
            <StatRow label="Record" av={ra.w + "–" + ra.d + "–" + ra.l} bv={rb.w + "–" + rb.d + "–" + rb.l} />
            <StatRow label="Win rate" av={ra.gp ? Math.round(winPct(ra) * 100) + "%" : "–"} bv={rb.gp ? Math.round(winPct(rb) * 100) + "%" : "–"} na={ra.gp ? winPct(ra) : undefined} nb={rb.gp ? winPct(rb) : undefined} />
            <StatRow label="Matches played" av={ra.gp} bv={rb.gp} na={ra.gp} nb={rb.gp} />
            <StatRow label="Elo" av={Math.round(eloS[a] ?? 0)} bv={Math.round(eloS[b] ?? 0)} na={eloS[a] ?? 0} nb={eloS[b] ?? 0} base={eloFloor} />
            {/* No bar: a level is a name. */}
            <StatRow label="Level" av={pa?.level ? pa.level.cat : "–"} bv={pb?.level ? pb.level.cat : "–"} />
            <StatRow label="Streak now" av={sa?.cur ?? 0} bv={sb?.cur ?? 0} na={sa?.cur ?? 0} nb={sb?.cur ?? 0} />
            <StatRow label="Best streak" av={sa?.best ?? 0} bv={sb?.best ?? 0} na={sa?.best ?? 0} nb={sb?.best ?? 0} />
            <StatRow label="Winning records" av={sa?.winning?.length ?? 0} bv={sb?.winning?.length ?? 0} na={sa?.winning?.length ?? 0} nb={sb?.winning?.length ?? 0} />
            <StatRow label="Losing records" av={sa?.losing?.length ?? 0} bv={sb?.losing?.length ?? 0} na={sa?.losing?.length ?? 0} nb={sb?.losing?.length ?? 0} lowerWins />
            <StatRow label="Home" av={pa?.home || "–"} bv={pb?.home || "–"} />
            <StatRow label="Age" av={pa?.age || "–"} bv={pb?.age || "–"} last />
          </SurfaceCard>
          <div style={{ display: "flex", gap: 0, marginTop: 16 }}>
            {([[sa, a], [sb, b]] as any[]).map(([s, pid]: any, i: number) => (
              <div key={i} style={{ flex: 1, minWidth: 0, paddingLeft: i ? 12 : 0, paddingRight: i ? 0 : 12, borderLeft: i ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
                <div style={{ ...sectionLabel, marginBottom: 7, textAlign: i ? "right" : "left" }}>Best wins</div>
                {s.top3.length ? s.top3.map((w, j) => (
                  <div key={j} style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_HI, padding: "4px 0", textAlign: i ? "right" : "left" }}><span style={{ ...tabular, color: FEED_TEXT_LOW }}>{j + 1}</span>  {nm(w.oid)} <span style={{ ...tabular, color: FEED_TEXT_MID }}>{w.yr}</span></div>
                )) : <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, textAlign: i ? "right" : "left" }}>None yet</div>}
              </div>
            ))}
          </div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 11.5, color: FEED_TEXT_MID, marginTop: 22, lineHeight: 1.5, paddingTop: 12 }}>Yellow = their record against that player. Grey = that player's level and overall record.</div>
          <div style={{ display: "flex", gap: 0, marginTop: 8 }}>
            {([[sa, 0], [sb, 1]] as any[]).map(([s, i]: any) => {
              const Line = ({ e }: any) => {
                const o = wdlS[e.oid] || { w: 0, d: 0, l: 0, gp: 0 };
                const lvl = levelNow(byId[e.oid]);
                return (
                  <button onClick={() => onOpen && onOpen(e.oid)} style={{ display: "block", width: "100%", background: "transparent", border: "none", padding: "5px 0", cursor: "pointer", textAlign: i ? "right" : "left" }}>
                    <div style={{ display: "flex", flexDirection: i ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nm(e.oid)}</span>
                      <span style={{ ...tabular, fontFamily: body, fontSize: 13, fontWeight: 500, color: FEED_LIME }}>{e.w}–{e.l}</span>
                    </div>
                    <div style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 11.5, color: FEED_TEXT_MID, marginTop: 2 }}>{lvl ? lvl.cat + " · " : ""}{o.w}–{o.l}</div>
                  </button>
                );
              };
              return (
                <div key={i} style={{ flex: 1, minWidth: 0, textAlign: i ? "right" : "left", paddingLeft: i ? 12 : 0, paddingRight: i ? 0 : 12, borderLeft: i ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
                  <div style={{ ...sectionLabel, color: FEED_LIME, marginBottom: 6, textAlign: i ? "right" : "left" }}>Winning against</div>
                  {s.winning.length ? s.winning.slice(0, 6).map((e) => <Line key={e.oid} e={e} />) : <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID }}>None</div>}
                  <div style={{ ...sectionLabel, color: FEED_THEY_LEAD, margin: "14px 0 6px", textAlign: i ? "right" : "left" }}>Losing against</div>
                  {s.losing.length ? s.losing.slice(0, 6).map((e) => <Line key={e.oid} e={e} />) : <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID }}>Nobody</div>}
                </div>
              );
            })}
          </div>
          <div style={{ ...sectionLabel, margin: "22px 0 8px" }}>Their matches</div>
          {games.length ? games.map((m) => <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_TEXT_HI }}><span style={{ ...tabular, color: FEED_TEXT_MID, flexShrink: 0 }}>{fmtDate(m.date)}</span><span style={{ textAlign: "right" }}>{winnerLabel(m, nameOf)}{m.score ? <span style={{ ...tabular, color: FEED_TEXT_MID }}> · {m.score}</span> : null}</span></div>) : <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, padding: "6px 0" }}>They've never played each other — the prediction above is based on their form, levels and results against others.</div>}
        </>
      ) : <Empty msg="Pick two players to compare." />}
    </div>
  );
}
