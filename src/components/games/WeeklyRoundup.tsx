"use client";
import React, { useEffect, useMemo, useState } from "react";
import { WeeklyRoundupCard, type RoundupResult, type RoundupSwing } from "@/components/games/WeeklyRoundupCard";
import { feedContexts } from "@/core/feedContext";
import { currentStreakOf, rankMaps } from "@/core/rank";
import { movementFor, topSwings, weekEndingFor, weekStartFor, type RankSnapshot } from "@/core/snapshots";
import { loadSnapshots } from "@/lib/rankSnapshots";
import { shortNameOf } from "@/lib/format";

// The container for the Sunday roundup: it does the loading and the counting
// so the card can stay a card. Everything it hands down is a finished number.
//
// The week it covers is the last completed one — Monday to the most recent
// Sunday — so on a Wednesday you're reading about the week that ended, not a
// half-finished one.

const dayLabel = (isoDate: string): string => {
  const d = new Date(isoDate + "T12:00:00");
  return d.getDate() + " " + d.toLocaleString("en-GB", { month: "short" });
};

export function WeeklyRoundup({ players, matches, elo, wdl, meId, leagueId }: any) {
  const [snapshots, setSnapshots] = useState<RankSnapshot[] | null>(null);

  useEffect(() => {
    let alive = true;
    if (!leagueId) return;
    loadSnapshots(leagueId)
      .then((s) => { if (alive) setSnapshots(s); })
      // A failed read is not an empty history. Leaving it null keeps the
      // movement line off rather than telling somebody they held station
      // when we simply couldn't find out.
      .catch(() => { if (alive) setSnapshots(null); });
    return () => { alive = false; };
  }, [leagueId]);

  const data = useMemo(() => {
    if (!meId || !players?.length) return null;
    const week = weekEndingFor();
    const start = weekStartFor(week);
    const from = new Date(start + "T00:00:00").getTime();
    const to = new Date(week + "T23:59:59").getTime();

    const inWeek = (matches || []).filter(
      (m: any) => m.status !== "pending" && m.date >= from && m.date <= to,
    );
    if (!inWeek.length) return null;

    const byId: Record<string, any> = {};
    players.forEach((p: any) => { byId[p.id] = p; });
    const nameOf = (id: string) => shortNameOf(byId[id]);

    let w = 0, l = 0;
    for (const m of inWeek) {
      if (m.p1 !== meId && m.p2 !== meId) continue;
      if (m.winner === "draw") continue;
      const won = (m.winner === "p1" ? m.p1 : m.p2) === meId;
      if (won) w++; else l++;
    }

    const ranks = rankMaps(players, matches, elo, wdl).off;
    const rank = ranks[meId];
    if (typeof rank !== "number") return null;

    const snaps = snapshots || [];
    const movement = movementFor(meId, rank, snaps, week);
    const swings: RoundupSwing[] = topSwings(ranks, snaps, 2, meId).map((s) => ({
      name: nameOf(s.playerId),
      placesGained: s.placesGained,
    }));

    const results: RoundupResult[] = [...inWeek]
      .sort((a: any, b: any) => b.date - a.date)
      .map((m: any) => {
        const drawn = m.winner === "draw";
        const winId = drawn ? m.p1 : m.winner === "p1" ? m.p1 : m.p2;
        const loseId = drawn ? m.p2 : m.winner === "p1" ? m.p2 : m.p1;
        return { winnerName: nameOf(winId), loserName: nameOf(loseId), score: m.score || null, drawn };
      });

    // One highlight, never a stack of them. Ordered by how much it would
    // actually make somebody look up: moving places beats a streak, a streak
    // beats a first win, and most weeks have none of the three.
    const contexts = feedContexts(matches || [], nameOf);
    const myFirstWin = inWeek.find(
      (m: any) => (m.p1 === meId || m.p2 === meId) && (contexts[m.id] || "").startsWith("First win"),
    );
    const streak = currentStreakOf(meId, matches || []);
    let highlight: { kind: "climb" | "streak" | "firstWin"; sentence: string } | null = null;
    if (movement && movement.placesGained >= 2) {
      highlight = { kind: "climb", sentence: "You climbed " + movement.placesGained + " places this week." };
    } else if (streak >= 3) {
      highlight = { kind: "streak", sentence: streak + " wins in a row, and counting." };
    } else if (myFirstWin) {
      highlight = { kind: "firstWin", sentence: contexts[myFirstWin.id] + " — first time." };
    }

    return {
      rangeLabel: dayLabel(start) + " – " + dayLabel(week),
      record: { w, l },
      rank,
      movement,
      swings,
      results,
      highlight,
    };
  }, [players, matches, elo, wdl, meId, snapshots]);

  if (!data) return null;
  return <WeeklyRoundupCard {...data} />;
}
