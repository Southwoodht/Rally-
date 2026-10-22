"use client";
import React, { useMemo } from "react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { LeagueTable } from "@/components/competitions/Competitions";
import type { Competition, CompetitionKind, CompetitionPair, CompetitionResult } from "@/core/doubles/competition";
import { fullNameOf } from "@/lib/format";
import { FEED_TEXT_HI, FEED_TEXT_MID, body } from "@/lib/theme";

/**
 * Every running league table, one under another, on the Table tab — Division
 * 1, Division 2, Division 3, like the football tables on the back page.
 *
 * Sam, 2026-10-22: the division tables were inside Fixtures → Competitions,
 * one screen each, and "I just want this super easy and simple". Same
 * LeagueTable as the competition's own screen, so the two cannot disagree.
 * Ordered by name with numbers read as numbers, so Division 10 follows 9.
 * Tapping a row opens the player (singles) or the first of the pair.
 */
export function Divisions({ kind, competitions, entries, players, meId, resultsOf, remainingOf, onOpenPlayer }: {
  kind: CompetitionKind;
  /** Running league-format competitions of this kind. */
  competitions: Competition[];
  entries: CompetitionPair[];
  players: any[];
  meId: string;
  resultsOf: (c: Competition) => CompetitionResult[];
  remainingOf: (c: Competition) => Record<string, number>;
  onOpenPlayer: (id: string) => void;
}) {
  const ordered = useMemo(
    () => [...competitions].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [competitions],
  );
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const entryName = (eid: string | null | undefined) => {
    const e = entries.find((x) => x.id === eid);
    if (!e) return "";
    const n = (id: string) => { const p = byId.get(id); return p ? fullNameOf(p) : "?"; };
    return e.p2 ? `${(byId.get(e.p1)?.name || "?").trim()} & ${(byId.get(e.p2)?.name || "?").trim()}` : n(e.p1);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {ordered.map((c) => {
        const mine = entries.filter((e) => e.competitionId === c.id);
        return (
          <SurfaceCard key={c.id} radius={16} pad="16px 14px">
            <div style={{ fontFamily: body, fontWeight: 500, fontSize: 19, color: FEED_TEXT_HI }}>{c.name}</div>
            <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 2 }}>
              {mine.length} {kind === "doubles" ? "pairs" : "players"} · play each {c.legs === 1 ? "once" : c.legs === 2 ? "twice" : c.legs + " times"} · {c.pointsWin} for a win
            </div>
            <LeagueTable
              kind={kind} entries={mine} results={resultsOf(c)} pointsWin={c.pointsWin} pointsDraw={c.pointsDraw}
              left={remainingOf(c)} meId={meId} entryName={entryName}
              onOpenEntry={(e) => onOpenPlayer(e.p1)}
            />
          </SurfaceCard>
        );
      })}
    </div>
  );
}
