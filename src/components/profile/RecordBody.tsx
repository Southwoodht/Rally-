"use client";
import React, { useState } from "react";
import { H2HRow } from "@/components/profile/H2HRow";
import { Avatar } from "@/components/ui/Avatar";
import { FormRow } from "@/components/ui/FormRow";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { Empty, Stat, StreakTile } from "@/components/ui/atoms";
import { START_ELO } from "@/core/constants";
import { levelAt, levelVal } from "@/core/levels";
import { computeOfficial } from "@/core/official";
import { rankMaps } from "@/core/rank";
import { D, fmtDate, winPct } from "@/lib/format";
import { BALL, CHALK, CLAY, COURT, LINE, MUTED, PANEL2, body, display, mono } from "@/lib/theme";

export function RecordBody({ player, players, elo, wdl, form, deltas, matches, nameOf, ranked, showElo, onOpen }: any) {
  const r = wdl[player.id] || { w: 0, d: 0, l: 0, gp: 0 };
  const rank = ranked.findIndex((p) => p.id === player.id) + 1;
  const rating = Math.round(elo[player.id] ?? START_ELO);
  const offMap = computeOfficial(players, matches, wdl);
  const byOff = ranked.filter((p) => (wdl[p.id]?.gp || 0) > 0).sort((a, b) => (offMap[b.id] ?? -1e9) - (offMap[a.id] ?? -1e9));
  const offIdx = byOff.findIndex((p) => p.id === player.id);
  const above = offIdx > 0 ? byOff[offIdx - 1] : null;
  const gap = above ? Math.max(1, Math.round((offMap[above.id] ?? 0) - (offMap[player.id] ?? 0))) : null;
  const isTop = offIdx === 0;
  const pct = r.gp ? Math.round(winPct(r) * 100) : null;
  const last = (form[player.id] || []).slice(-5);
  const bouts = matches.filter((m) => m.p1 === player.id || m.p2 === player.id).sort((a, b) => b.date - a.date);
  const resultFor = (m) => m.winner === "draw" ? "D" : ((m.winner === "p1" && m.p1 === player.id) || (m.winner === "p2" && m.p2 === player.id)) ? "W" : "L";
  const oppId = (m) => m.p1 === player.id ? m.p2 : m.p1;
  const oppOf = (m) => nameOf(oppId(m));
  const byId = {}; (players || []).forEach((p) => { byId[p.id] = p; });
  const wins = bouts.filter((m) => resultFor(m) === "W" && m.status !== "pending").map((m) => { const oid = oppId(m); const lvAt = levelAt(byId[oid], m.date); const oppLv = levelVal(lvAt) ?? 0; const myLv = levelVal(levelAt(player, m.date)) ?? 0; const upset = Math.max(0, oppLv - myLv); return { oid, lvAt, upset, q: (oppLv + upset) * 1000 + (elo[oid] ?? 0), year: new Date(m.date).getFullYear() }; });
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
  chrono.forEach((m) => { const oid = oppId(m); const res = resultFor(m); const yr = new Date(m.date).getFullYear(); if (!h2h[oid]) h2h[oid] = { w: 0, d: 0, l: 0, minY: yr, maxY: yr }; if (res === "W") h2h[oid].w++; else if (res === "L") h2h[oid].l++; else h2h[oid].d++; h2h[oid].minY = Math.min(h2h[oid].minY, yr); h2h[oid].maxY = Math.max(h2h[oid].maxY, yr); });
  const h2hList = Object.keys(h2h).map((oid) => ({ oid, ...h2h[oid], net: h2h[oid].w - h2h[oid].l }));
  const winningVs = h2hList.filter((x) => x.net > 0).sort((a, b) => b.net - a.net);
  const evenVs = h2hList.filter((x) => x.net === 0);
  const losingVs = h2hList.filter((x) => x.net < 0).sort((a, b) => a.net - b.net);
  const recStr2 = (x) => (x.d > 0 ? x.w + "-" + x.d + "-" + x.l : x.w + "-" + x.l);
  const yrStr = (x) => x.minY === x.maxY ? String(x.minY) : x.minY + "–" + x.maxY;
  const nm = (oid) => byId[oid]?.name ? (byId[oid].name + (byId[oid].last ? " " + byId[oid].last : "")) : nameOf(oid);
  const ranks = rankMaps(players, matches, elo, wdl);
  const [openStreak, setOpenStreak] = useState<"now" | "best" | "tough" | null>(null);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <Avatar player={player} size={48} />
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ fontFamily: display, fontSize: 32, fontWeight: 800, color: CHALK, textTransform: "uppercase", letterSpacing: -0.5, margin: 0 }}>{player.name}{player.nick ? " \u201C" + player.nick + "\u201D" : ""}{player.last ? " " + player.last : ""}</h2>
            <LevelBadge level={player.level} />
          </div>
          {(player.age || player.home) && <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, marginTop: 3 }}>{[player.age ? player.age + " yrs" : null, player.home || null].filter(Boolean).join(" · ")}</div>}
          {player.inactive ? (
            <div style={{ fontFamily: mono, fontSize: 11, color: MUTED, marginTop: 3, textTransform: "uppercase", letterSpacing: 1 }}>Not active in this league · record kept</div>
          ) : r.gp > 0 ? (
            <div style={{ fontFamily: mono, fontSize: 12, color: MUTED, marginTop: 3 }}><span style={{ color: BALL, fontWeight: 700, fontSize: 14 }}>#{ranks.off[player.id]}</span> Official <span style={{ color: LINE }}>·</span> #{ranks.el[player.id]} ELO <span style={{ color: LINE }}>·</span> #{ranks.rec[player.id]} Record</div>
          ) : (
            <div style={{ fontFamily: mono, fontSize: 12, color: MUTED, marginTop: 3 }}>Unranked</div>
          )}
        </div>
      </div>
      {showElo && r.gp > 0 && !player.inactive && (isTop || (above && gap !== null)) && (
        <div style={{ background: PANEL2, border: "1px solid " + LINE, borderRadius: 8, padding: "10px 12px", marginBottom: 4, fontFamily: body, fontSize: 13, color: CHALK }}>
          {isTop ? <><strong style={{ color: BALL }}>Top of the table.</strong> Nobody above — keep winning to stay there.</>
                 : <><strong style={{ color: BALL }}>{gap} pts</strong> behind {above.name}{above.last ? " " + above.last : ""} — beat good players to close the gap.</>}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, margin: "16px 0 18px" }}>
        <Stat n={r.w} label="Won" c={BALL} /><Stat n={r.d} label="Drawn" c={MUTED} /><Stat n={r.l} label="Lost" c={CLAY} /><Stat n={pct === null ? "–" : pct + "%"} label="Win rate" c={BALL} />
      </div>
      {last.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}><span style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: MUTED }}>Recent form</span><FormRow items={last} /></div>}
      {r.gp > 0 && bestWins.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, marginBottom: 6 }}>Best wins</div>
          {bestWins.map((w, i) => (
            <button key={i} onClick={() => onOpen && onOpen(w.oid)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontSize: 16 }}>{["🥇", "🥈", "🥉"][i]}</span>
              <span style={{ fontFamily: body, fontSize: 14, color: CHALK }}>{byId[w.oid]?.name || nameOf(w.oid)}{w.lvAt ? <span style={{ color: MUTED }}> ({w.lvAt.cat})</span> : null}</span>
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
          <div style={{ background: PANEL2, border: "1px solid " + LINE, borderRadius: 8, padding: "10px 12px", marginBottom: 20 }}>
            <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: BALL, marginBottom: 6 }}>{title} · {run.length} {run.length === 1 ? "win" : "wins"}</div>
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
              <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: BALL, marginBottom: 4 }}>Winning records</div>
              {winningVs.map((x) => <H2HRow key={x.oid} name={nm(x.oid)} rec={recStr2(x)} yr={yrStr(x)} c={BALL} onClick={() => onOpen && onOpen(x.oid)} />)}
            </div>
          )}
          {evenVs.length > 0 && (
            <div>
              <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, margin: "12px 0 4px" }}>Even</div>
              {evenVs.map((x) => <H2HRow key={x.oid} name={nm(x.oid)} rec={recStr2(x)} yr={yrStr(x)} c={MUTED} onClick={() => onOpen && onOpen(x.oid)} />)}
            </div>
          )}
          {losingVs.length > 0 && (
            <div>
              <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: CLAY, margin: "12px 0 4px" }}>Losing records</div>
              {losingVs.map((x) => <H2HRow key={x.oid} name={nm(x.oid)} rec={recStr2(x)} yr={yrStr(x)} c={CLAY} onClick={() => onOpen && onOpen(x.oid)} />)}
            </div>
          )}
        </div>
      )}
      <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, marginBottom: 8 }}>Record</div>
      {bouts.length ? bouts.map((m) => {
        const res = resultFor(m);
        const dv = deltas ? deltas[m.id]?.[player.id] : null;
        return (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: "1px solid " + LINE }}>
            <span style={{ width: 22, height: 22, borderRadius: 4, display: "grid", placeItems: "center", fontFamily: mono, fontWeight: 800, fontSize: 11, color: COURT, background: res === "W" ? BALL : res === "L" ? CLAY : MUTED }}>{res}</span>
            <div style={{ flex: 1 }}><div style={{ fontFamily: body, fontSize: 15, color: CHALK }}>{res === "D" ? "Drew " : res === "W" ? "Beat " : "Lost to "}<strong>{oppOf(m)}</strong></div><div style={{ fontFamily: mono, fontSize: 11, color: MUTED, marginTop: 1 }}>{fmtDate(m.date)}{m.score ? " · " + m.score : ""}</div></div>
            {dv != null && <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: dv > 0.05 ? BALL : dv < -0.05 ? CLAY : MUTED }}>{(dv >= 0 ? "+" : "−") + Math.abs(dv).toFixed(1)}</span>}
          </div>
        );
      }) : <Empty msg="No matches logged yet." />}
    </>
  );
}
