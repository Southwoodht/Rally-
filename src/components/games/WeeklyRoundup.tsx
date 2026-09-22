"use client";
import { countsAsPlayed } from "@/core/matchStatus";
import React, { useEffect, useMemo, useState } from "react";
import { WeeklyRoundupCard, type RoundupPeriod, type RoundupResult, type RoundupSwing } from "@/components/games/WeeklyRoundupCard";
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
//
// THE MONTH AND YEAR ARE TO DATE, and the week deliberately is not.
//
// Sam asked for this card to fade through week, month and year. The obvious
// way to add the other two is to make them completed periods like the week,
// and that gives you "Your year: 2025" all through 2026 — a true number
// nobody wants. The other way is to make the week run to today for
// consistency, which throws away the reason the card exists: a half-finished
// week is the wrong thing to be told about on a Wednesday, and the movement
// arrow comes from weekly snapshots that only exist for completed weeks.
//
// So the spans differ, and the label says which is which — "14 Sep – 20 Sep"
// against "September so far" against "2026 so far". A difference a reader can
// see stated is not an inconsistency; one they have to infer is.
//
// Movement, swings and the highlight stay on the WEEK slide alone. All three
// come from the weekly snapshots or say "this week" in so many words, and
// there is no monthly equivalent to show — an empty row is better than one
// carrying a weekly number under a yearly heading.

const dayLabel = (isoDate: string): string => {
  const d = new Date(isoDate + "T12:00:00");
  return d.getDate() + " " + d.toLocaleString("en-GB", { month: "short" });
};

/** As many results as a card can hold without becoming a list. The rest are
 *  counted out loud — see RoundupPeriod.more. */
const RESULTS_MAX = 5;

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

    const byId: Record<string, any> = {};
    players.forEach((p: any) => { byId[p.id] = p; });
    const nameOf = (id: string) => shortNameOf(byId[id]);

    const ranks = rankMaps(players, matches, elo, wdl).off;
    const rank = ranks[meId];
    if (typeof rank !== "number") return null;

    const played = (matches || []).filter((m: any) => countsAsPlayed(m));
    const within = (a: number, b: number) => played.filter((m: any) => m.date >= a && m.date <= b);

    const recordIn = (list: any[]) => {
      let w = 0, l = 0;
      for (const m of list) {
        if (m.p1 !== meId && m.p2 !== meId) continue;
        if (m.winner === "draw") continue;
        const won = (m.winner === "p1" ? m.p1 : m.p2) === meId;
        if (won) w++; else l++;
      }
      return { w, l };
    };

    const resultsIn = (list: any[]): RoundupResult[] => [...list]
      .sort((a: any, b: any) => b.date - a.date)
      .slice(0, RESULTS_MAX)
      .map((m: any) => {
        const drawn = m.winner === "draw";
        const winId = drawn ? m.p1 : m.winner === "p1" ? m.p1 : m.p2;
        const loseId = drawn ? m.p2 : m.winner === "p1" ? m.p2 : m.p1;
        return { winnerName: nameOf(winId), loserName: nameOf(loseId), score: m.score || null, drawn };
      });

    const now = new Date();
    const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const yearFrom = new Date(now.getFullYear(), 0, 1).getTime();
    const nowMs = now.getTime();

    const inWeek = within(from, to);
    const inMonth = within(monthFrom, nowMs);
    const inYear = within(yearFrom, nowMs);

    const snaps = snapshots || [];
    const movement = movementFor(meId, rank, snaps, week);
    const swings: RoundupSwing[] = topSwings(ranks, snaps, 2, meId).map((s) => ({
      name: nameOf(s.playerId),
      placesGained: s.placesGained,
    }));


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

    const monthLabel = now.toLocaleString("en-GB", { month: "long" }) + " so far";
    const spans: RoundupPeriod[] = [
      {
        title: "Your week",
        rangeLabel: dayLabel(start) + " – " + dayLabel(week),
        record: recordIn(inWeek), rank, movement, swings,
        results: resultsIn(inWeek), more: Math.max(0, inWeek.length - RESULTS_MAX),
        highlight,
      },
      {
        title: "Your month",
        rangeLabel: monthLabel,
        record: recordIn(inMonth), rank, movement: null, swings: [],
        results: resultsIn(inMonth), more: Math.max(0, inMonth.length - RESULTS_MAX),
        highlight: null,
      },
      {
        title: "Your year",
        rangeLabel: now.getFullYear() + " so far",
        record: recordIn(inYear), rank, movement: null, swings: [],
        results: resultsIn(inYear), more: Math.max(0, inYear.length - RESULTS_MAX),
        highlight: null,
      },
    ];

    // A span nobody played in has nothing to roundup, and a slide reading
    // "0–0 / Results:" with an empty list is worse than one fewer slide. If
    // that empties the set the card does not render at all, which is what it
    // did before when the week was empty.
    const periods = spans.filter((p) => p.results.length > 0);
    return periods.length ? { periods } : null;
  }, [players, matches, elo, wdl, meId, snapshots]);

  if (!data) return null;
  return <WeeklyRoundupCard {...data} />;
}
