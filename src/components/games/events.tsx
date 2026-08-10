"use client";
import React from "react";
import { computeStats } from "@/core/elo";
import { levelAt, levelVal } from "@/core/levels";
import { computeOfficial } from "@/core/official";

export function buildEvents(players, matches, wdl) {
  const conf = matches.filter((m) => m.status !== "pending").sort((a, b) => a.date - b.date);
  const byId = {}; players.forEach((p) => { byId[p.id] = p; });
  const nm = (id) => byId[id] ? byId[id].name + (byId[id].last ? " " + byId[id].last : "") : "Someone";
  const ev: Array<{ id: string; date: number; icon: string; text: string }> = [];
  const w: Record<string, number> = {}, gp: Record<string, number> = {}, streak: Record<string, number> = {};
  let leader: string | null = null;
  const running: any[] = [];
  conf.forEach((m) => {
    running.push(m);
    [m.p1, m.p2].forEach((id) => { gp[id] = (gp[id] || 0) + 1; });
    if (m.winner !== "draw") {
      const win = m.winner === "p1" ? m.p1 : m.p2, lose = m.winner === "p1" ? m.p2 : m.p1;
      w[win] = (w[win] || 0) + 1;
      streak[win] = (streak[win] || 0) + 1; streak[lose] = 0;
      if (w[win] === 1) ev.push({ id: "e" + m.id + "fw", date: m.date, icon: "\uD83C\uDF89", text: nm(win) + "'s first win!" });
      if ([3, 5, 10].includes(streak[win])) ev.push({ id: "e" + m.id + "st", date: m.date, icon: "\uD83D\uDD25", text: nm(win) + " is on a " + streak[win] + "-match winning streak" });
      const lvW = levelVal(levelAt(byId[win], m.date)) ?? 0, lvL = levelVal(levelAt(byId[lose], m.date)) ?? 0;
      if (lvL - lvW >= 3) ev.push({ id: "e" + m.id + "up", date: m.date, icon: "\u26A1", text: "Upset \u2014 " + nm(win) + " beat " + nm(lose) + ", a level above" });
    }
    [m.p1, m.p2].forEach((id) => { if ([25, 50, 100].includes(gp[id])) ev.push({ id: "e" + m.id + "gp" + id, date: m.date, icon: "\uD83C\uDFBE", text: nm(id) + " played their " + gp[id] + "th match" }); });
    const stats = computeStats(players, running);
    const off = computeOfficial(players, running, stats.wdl);
    const top = players.filter((p) => !p.inactive && stats.wdl[p.id]?.gp).sort((a, b) => (off[b.id] ?? -1e9) - (off[a.id] ?? -1e9))[0];
    if (top && leader && top.id !== leader && (w[top.id] || 0) >= 3) ev.push({ id: "e" + m.id + "no1", date: m.date, icon: "\uD83D\uDC51", text: nm(top.id) + " overtook " + nm(leader) + " at the top" });
    if (top) leader = top.id;
  });
  return ev;
}
