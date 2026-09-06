"use client";
import React, { useMemo } from "react";
import { HistoryMode } from "@/components/matches/HistoryMode";
import { QualityMode } from "@/components/matches/QualityMode";
import { buildMatchQuality } from "@/core/matchQuality";
import { segmentOption, segmentTrack } from "@/lib/theme";

// One route, two modes.
//
// Quality is the aggregates and History is the rows, and they are two
// presentations of one walk over one list — so the computation happens here,
// once, above the switch. Neither mode fetches or counts anything, and they
// cannot disagree with each other about what a match was worth.

export type MatchesMode = "quality" | "history";

export function YourMatches({
  viewerId, players, matches, mode, onMode, onOpenPlayer, onOpenMatch, onFixLevels,
}: {
  viewerId: string;
  players: any[];
  matches: any[];
  mode: MatchesMode;
  onMode: (m: MatchesMode) => void;
  onOpenPlayer?: (playerId: string) => void;
  onOpenMatch?: (matchId: string) => void;
  onFixLevels?: () => void;
}) {
  const q = useMemo(() => buildMatchQuality(viewerId, players, matches), [viewerId, players, matches]);

  return (
    <div>
      <div style={{ ...segmentTrack, marginBottom: 14 }}>
        <button onClick={() => onMode("quality")} style={segmentOption(mode === "quality")}>Quality</button>
        <button onClick={() => onMode("history")} style={segmentOption(mode === "history")}>History</button>
      </div>

      {mode === "quality"
        ? <QualityMode q={q} onOpenPlayer={onOpenPlayer} />
        : <HistoryMode q={q} onOpenMatch={onOpenMatch} onOpenPlayer={onOpenPlayer} onFixLevels={onFixLevels} />}
    </div>
  );
}
