"use client";
import React, { useEffect, useMemo, useState } from "react";
import { HistoryMode } from "@/components/matches/HistoryMode";
import { QualityMode } from "@/components/matches/QualityMode";
import { buildMatchQuality, type Voice } from "@/core/matchQuality";
import { shortNameOf } from "@/lib/format";
import { onSide } from "@/core/trophyTimeline";
import { listApprovedTrophiesForPlayer, type Trophy } from "@/lib/trophies";
import { segmentOption, segmentTrack } from "@/lib/theme";

// One route, two modes.
//
// Quality is the aggregates and History is the rows, and they are two
// presentations of one walk over one list — so the computation happens here,
// once, above the switch. Neither mode fetches or counts anything, and they
// cannot disagree with each other about what a match was worth.

export type MatchesMode = "quality" | "history";

export function YourMatches({
  viewerId, meId, players, matches, mode, onMode, onOpenPlayer, onOpenMatch, onFixLevels,
}: {
  /** Whose matches these are. Not necessarily the reader's. */
  viewerId: string;
  /** The reader, so the screen knows whether to say "you" or their name. */
  meId?: string;
  players: any[];
  matches: any[];
  mode: MatchesMode;
  onMode: (m: MatchesMode) => void;
  onOpenPlayer?: (playerId: string) => void;
  onOpenMatch?: (matchId: string) => void;
  onFixLevels?: () => void;
}) {
  // Everybody's schedule is readable, not just your own. Nothing here is
  // newly exposed — every one of these matches already shows in the feed, on
  // the table and on their profile; this is the same results asked a
  // different question.
  const v: Voice = useMemo(() => {
    const self = !meId || viewerId === meId;
    const p = players.find((x: any) => x.id === viewerId);
    return { self, name: self ? "" : shortNameOf(p) };
  }, [viewerId, meId, players]);
  const q = useMemo(() => buildMatchQuality(viewerId, players, matches, v), [viewerId, players, matches, v]);
  // Their trophies, for History. The one fetch on this screen: trophies are
  // not league data, so nothing above holds them. A failed read leaves the
  // history as it was without them rather than in an error state.
  const authId = players.find((x: any) => x.id === viewerId)?.auth_id ?? null;
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  useEffect(() => {
    let alive = true;
    listApprovedTrophiesForPlayer(viewerId, authId)
      .then((t) => { if (alive) setTrophies(t.filter((x) => x.kind === "trophy")); })
      .catch(() => {});
    return () => { alive = false; };
  }, [viewerId, authId]);
  // Singles matches, so singles honours.
  const historyTrophies = useMemo(() => trophies.filter((t) => onSide(t, "singles")).map((t) => ({ ...t, clubName: t.clubs?.name ?? null })), [trophies]);

  return (
    <div>
      <div style={{ ...segmentTrack, marginBottom: 14 }}>
        <button onClick={() => onMode("quality")} style={segmentOption(mode === "quality")}>Quality</button>
        <button onClick={() => onMode("history")} style={segmentOption(mode === "history")}>History</button>
      </div>

      {mode === "quality"
        ? <QualityMode q={q} v={v} onOpenPlayer={onOpenPlayer} />
        : <HistoryMode q={q} onOpenMatch={onOpenMatch} onOpenPlayer={onOpenPlayer} onFixLevels={onFixLevels} trophies={historyTrophies} />}
    </div>
  );
}
