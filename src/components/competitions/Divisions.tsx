"use client";
import React, { useMemo } from "react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { LeagueTable } from "@/components/competitions/Competitions";
import type { Competition, CompetitionKind, CompetitionPair, CompetitionResult } from "@/core/doubles/competition";
import { fullNameOf } from "@/lib/format";
import { FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, body } from "@/lib/theme";

/**
 * Which tier a division is, from its place in the order — Sam, 2026-10-22:
 * "top tier, middle tier, bottom tier, so the app knows which way". Nothing
 * to set: Division 1 is the top because the order is the number in the name.
 * Two divisions are top and bottom; three add a middle; beyond that the
 * middle ones are numbered.
 */
export function tierLabel(index: number, count: number): string | null {
  if (count < 2) return null;
  if (index === 0) return "Top tier";
  if (index === count - 1) return "Bottom tier";
  return count === 3 ? "Middle tier" : `Tier ${index + 1}`;
}

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
export function Divisions({ kind, competitions, entries, players, meId, resultsOf, remainingOf, onOpenPlayer, onAdd, onPlanNext }: {
  kind: CompetitionKind;
  /** Running league-format competitions of this kind. */
  competitions: Competition[];
  entries: CompetitionPair[];
  players: any[];
  meId: string;
  resultsOf: (c: Competition) => CompetitionResult[];
  remainingOf: (c: Competition) => Record<string, number>;
  onOpenPlayer: (id: string) => void;
  /** Organisers: make the next division. Absent for everyone else. */
  onAdd?: () => void;
  /** Organisers: propose next season's divisions from these tables. */
  onPlanNext?: () => void;
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
      {ordered.map((c, i) => {
        const mine = entries.filter((e) => e.competitionId === c.id);
        const tier = tierLabel(i, ordered.length);
        return (
          <SurfaceCard key={c.id} radius={16} pad="16px 14px">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: body, fontWeight: 500, fontSize: 19, color: FEED_TEXT_HI, flex: 1, minWidth: 0 }}>{c.name}</span>
              {tier && <span style={{ fontFamily: body, fontWeight: 500, fontSize: 11.5, background: i === 0 ? FEED_LIME : FEED_RAISED, color: i === 0 ? FEED_LIME_INK : FEED_TEXT_MID, borderRadius: 999, padding: "3px 9px", flexShrink: 0 }}>{tier}</span>}
            </div>
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
      {onPlanNext && (
        <SurfaceCard radius={16} pad="14px 16px">
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 16, color: FEED_TEXT_HI }}>End of the season?</div>
          <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, marginTop: 4 }}>
            Southwood proposes next season&apos;s divisions from these tables — promotions and relegations done — for you to check and confirm.
          </div>
          <button onClick={onPlanNext} style={{ marginTop: 10, background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 999, padding: "10px 16px", fontFamily: body, fontWeight: 500, fontSize: 14.5, cursor: "pointer" }}>
            Plan next season
          </button>
        </SurfaceCard>
      )}
      {onAdd && (
        <button onClick={onAdd} style={{ alignSelf: "flex-start", background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 999, padding: "10px 16px", fontFamily: body, fontWeight: 500, fontSize: 14.5, cursor: "pointer" }}>
          + Add a division
        </button>
      )}
      {ordered.length > 1 && (
        <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
          Division 1 is the top tier; the order follows the number in each name.
        </div>
      )}
    </div>
  );
}
