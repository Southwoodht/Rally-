"use client";
import React from "react";
import { Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { SurfaceCard } from "@/components/ui/Surfaces";
import type { PodiumPlace } from "@/core/seasonStandings";
import { formatMatchDate, fullNameOf } from "@/lib/format";
import { FEED_LIME, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

/**
 * The final podium of an ended season, above its frozen table.
 *
 * Places are the standings' own (a tie shares one), and the line under the
 * title says the standings are final and when they froze, so nobody wonders
 * why a result logged last week is not in them.
 */
export function SeasonPodium({ season, podium, players, onOpen }: {
  season: any;
  podium: PodiumPlace[];
  players: any[];
  onOpen?: (id: string) => void;
}) {
  if (!season || !podium.length) return null;
  const word = (n: number) => (n === 1 ? "Champion" : n === 2 ? "2nd" : "3rd");
  return (
    <SurfaceCard radius={18} pad="14px" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <Trophy size={17} color={FEED_LIME} strokeWidth={2} />
        <span style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI }}>{season.name} · final</span>
      </div>
      <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginBottom: 10 }}>
        Standings froze {season.endedAt ? formatMatchDate(season.endedAt) : "when it ended"}. Results logged later count everywhere else.
      </div>
      {podium.map((p, i) => {
        const pl = players.find((x: any) => x.id === p.playerId);
        return (
          <div
            key={p.playerId}
            onClick={onOpen ? () => onOpen(p.playerId) : undefined}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i ? "0.5px solid " + FEED_RAISED : "none", cursor: onOpen ? "pointer" : "default" }}
          >
            <span style={{ width: 70, fontFamily: body, fontSize: 13, color: p.place === 1 ? FEED_LIME : FEED_TEXT_MID }}>{word(p.place)}</span>
            {pl && <Avatar player={pl} size={28} />}
            <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullNameOf(pl)}</span>
            <span style={{ ...tabular, fontFamily: body, fontSize: 13, color: FEED_TEXT_MID }}>{p.played} played</span>
          </div>
        );
      })}
    </SurfaceCard>
  );
}
