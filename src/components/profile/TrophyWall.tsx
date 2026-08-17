"use client";
import React from "react";
import { computeAchievements, computeSeasonTrophies } from "@/core/achievements";
import { BALL, CHALK, LINE, MUTED, PANEL2, body, mono } from "@/lib/theme";

export function TrophyWall({ player, players, matches, fixtures, group }: any) {
  const achievements = computeAchievements(player.id, matches);
  const trophies = computeSeasonTrophies(players, matches, fixtures, group).filter((t) => t.playerId === player.id);
  const medalIcon: Record<string, string> = { gold: "🥇", silver: "🥈", bronze: "🥉" };
  const medalLabel: Record<string, string> = { gold: "Champion", silver: "Runner-up", bronze: "Third" };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, marginBottom: 8 }}>Achievements</div>
      {trophies.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {trophies.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: PANEL2, border: "1px solid " + BALL, borderRadius: 8, padding: "10px 12px" }}>
              <span style={{ fontSize: 22 }}>{medalIcon[t.medal]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: body, fontSize: 14, color: CHALK, fontWeight: 700 }}>{t.competition}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>{medalLabel[t.medal]} · {new Date(t.date).getFullYear()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {achievements.map((a) => (
          <div key={a.id} style={{ background: a.achieved ? PANEL2 : "transparent", opacity: a.achieved ? 1 : 0.4, border: "1px solid " + (a.achieved ? BALL : LINE), borderRadius: 8, padding: "10px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 18 }}>{a.icon}</div>
            <div style={{ fontFamily: mono, fontSize: 8.5, color: a.achieved ? CHALK : MUTED, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.3, lineHeight: 1.3 }}>{a.label}</div>
            {a.achieved && a.date != null && <div style={{ fontFamily: mono, fontSize: 8, color: MUTED, marginTop: 2 }}>{new Date(a.date).getFullYear()}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
