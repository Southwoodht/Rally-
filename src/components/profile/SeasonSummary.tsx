"use client";
import React from "react";
import { computeSeasonTrophies } from "@/core/achievements";
import { computeSeasonSummary } from "@/core/season";
import { fmtDate } from "@/lib/format";
import { BALL, CHALK, CLAY, COURT, LINE, MUTED, body, display, mono } from "@/lib/theme";

export function SeasonSummary({ player, players, matches, year, fixtures, group, nameOf, onClose, onOpenMatch }: any) {
  const s = computeSeasonSummary(player.id, players, matches, year);
  const compTrophies = computeSeasonTrophies(players, matches, fixtures, group).filter((t: any) => t.playerId === player.id && new Date(t.date).getFullYear() === year);
  const medalIcon: Record<string, string> = { gold: "🥇", silver: "🥈", bronze: "🥉" };
  const byId: Record<string, any> = {}; (players || []).forEach((p: any) => { byId[p.id] = p; });
  const nm = (id: string) => byId[id]?.name ? (byId[id].name + (byId[id].last ? " " + byId[id].last : "")) : nameOf(id);

  const Row = ({ label, children }: any) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "9px 0", borderTop: "1px solid " + LINE, gap: 12 }}>
      <span style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: MUTED }}>{label}</span>
      <span style={{ fontFamily: body, fontSize: 14, color: CHALK, textAlign: "right" }}>{children}</span>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 92 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "1px solid " + LINE, padding: "20px 18px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>Season summary</div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid " + LINE, color: MUTED, borderRadius: 6, padding: "4px 10px", fontFamily: mono, fontSize: 12, cursor: "pointer" }}>Close</button>
        </div>
        <div style={{ fontFamily: display, fontSize: 30, fontWeight: 800, color: BALL, textTransform: "uppercase", letterSpacing: -0.5, marginBottom: 2 }}>{year} Season</div>
        <div style={{ fontFamily: body, fontSize: 13, color: MUTED, marginBottom: 8 }}>{player.name}{player.last ? " " + player.last : ""}</div>

        <Row label="Record">{s.matchesPlayed ? `${s.record.w}-${s.record.d}-${s.record.l}` : "No matches this year"}</Row>
        {s.winPct != null && <Row label="Win %">{Math.round(s.winPct * 100)}%</Row>}
        {s.eloChange != null && <Row label="ELO change"><span style={{ color: s.eloChange > 0 ? BALL : s.eloChange < 0 ? CLAY : MUTED, fontWeight: 700 }}>{s.eloChange >= 0 ? "+" : ""}{Math.round(s.eloChange)}</span> ({Math.round(s.eloStart)} → {Math.round(s.eloEnd)})</Row>}
        {s.officialRank != null && <Row label="Official position">#{s.officialRank} of {s.officialOutOf}</Row>}
        {s.bestStreak > 0 && <Row label="Longest streak">{s.bestStreak} wins</Row>}
        {s.biggestWin && (() => {
          const bw = s.biggestWin;
          return (
            <button onClick={() => onOpenMatch && onOpenMatch(bw.match.id)} disabled={!onOpenMatch} style={{ display: "block", width: "100%", background: "transparent", border: "none", padding: "9px 0", borderTop: "1px solid " + LINE, cursor: onOpenMatch ? "pointer" : "default", textAlign: "left" }}>
              <Row label="Biggest win">{nm(bw.oid)} · {fmtDate(bw.match.date)}{onOpenMatch ? " ›" : ""}</Row>
            </button>
          );
        })()}
        <Row label="Matches played">{s.matchesPlayed}</Row>

        <div style={{ padding: "9px 0", borderTop: "1px solid " + LINE }}>
          <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: MUTED, marginBottom: 8 }}>Trophies won</div>
          {compTrophies.length === 0 && s.achievements.length === 0 ? (
            <div style={{ fontFamily: body, fontSize: 13, color: MUTED }}>None this year.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {compTrophies.map((t: any, i: number) => (
                <div key={"c" + i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{medalIcon[t.medal]}</span>
                  <span style={{ fontFamily: body, fontSize: 13, color: CHALK }}>{t.competition}</span>
                </div>
              ))}
              {s.achievements.map((a: any) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{a.icon}</span>
                  <span style={{ fontFamily: body, fontSize: 13, color: CHALK }}>{a.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
