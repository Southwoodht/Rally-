"use client";
import React, { useMemo } from "react";
import { WeeklyRoundupCard, type RoundupPeriod, type RoundupResult } from "@/components/games/WeeklyRoundupCard";
import type { DoublesMatch, DoublesSlot } from "@/core/doubles/elo";
import type { doublesHome } from "@/core/doubles/home";

/**
 * "Your week / Your month / Your year" for doubles — the singles roundup's
 * twin, drawn by the very same card so the two cannot drift apart.
 *
 * The same shape as singles: YOUR record and place on the tiles, and under
 * them every result in the league in that period (not just yours), newest
 * first and capped at five with the rest counted out loud. Winners first, and
 * the score from the winners' side.
 */

const RESULTS_MAX = 5;

const dayLabel = (t: number) => {
  const d = new Date(t);
  return d.getDate() + " " + d.toLocaleString("en-GB", { month: "short" });
};

export function DoublesRoundup({ matches, players, home }: {
  matches: Array<DoublesMatch & { sets?: Array<{ a: number; b: number }> }>;
  players: any[];
  home: ReturnType<typeof doublesHome>;
}) {
  const periods = useMemo<RoundupPeriod[]>(() => {
    const byId = new Map(players.map((p) => [p.id, p]));
    const first = (id: DoublesSlot) => (id == null ? "partner" : (byId.get(id)?.name || "?").trim());
    const pair = (t: [DoublesSlot, DoublesSlot]) => `${first(t[0])} & ${first(t[1])}`;
    const confirmed = matches.filter((m) => m.status === undefined || m.status === "confirmed");
    const now = Date.now();

    const resultsIn = (from: number): { list: RoundupResult[]; total: number } => {
      const within = confirmed.filter((m) => m.playedAt >= from && m.playedAt <= now).sort((a, b) => b.playedAt - a.playedAt);
      return {
        total: within.length,
        list: within.slice(0, RESULTS_MAX).map((m) => {
          const drawn = m.winner === "draw";
          const aWon = m.winner !== "B";
          const sets = m.sets || [];
          return {
            winnerName: pair(aWon ? m.teamA : m.teamB),
            loserName: pair(aWon ? m.teamB : m.teamA),
            score: sets.length ? sets.map((s) => (aWon ? `${s.a}-${s.b}` : `${s.b}-${s.a}`)).join(", ") : null,
            drawn,
          };
        }),
      };
    };

    const rank = home.standing?.rank ?? null;
    const titles = { week: "Your week", month: "Your month", year: "Your year" } as const;
    const d = new Date(now);
    const labels = {
      week: dayLabel(home.periods[0].from) + " – " + dayLabel(home.periods[0].from + 6 * 86400000),
      month: d.toLocaleString("en-GB", { month: "long" }) + " so far",
      year: d.getFullYear() + " so far",
    };

    return home.periods
      .map((p) => {
        const r = resultsIn(p.from);
        return {
          title: titles[p.key],
          rangeLabel: labels[p.key],
          record: { w: p.w, l: p.l },
          rank,
          // Only the week has a "this week" arrow, as on singles.
          movement: p.key === "week" && home.standing?.movement != null ? { placesGained: home.standing.movement } : null,
          swings: [],
          results: r.list,
          more: Math.max(0, r.total - RESULTS_MAX),
          highlight: null,
        } as RoundupPeriod;
      })
      // A period with nothing in the whole league is left out, as on singles.
      .filter((p) => p.results.length > 0);
  }, [matches, players, home]);

  if (!periods.length) return null;
  return <WeeklyRoundupCard periods={periods} />;
}
