"use client";
import React, { useMemo } from "react";
import { fullNameOf } from "@/lib/format";
import { computeDoubles, DOUBLES_PROVISIONAL_GAMES, type DoublesMatch } from "@/core/doubles/elo";
import { partnersOf, bestPartner, mostPlayedWith } from "@/core/doubles/partners";
import {
  FEED_CTA, FEED_HERO, FEED_LIME_INK, FEED_ON_HERO, FEED_RADIUS, FEED_TEXT_MID,
  body, display, tabular, tight,
} from "@/lib/theme";

/**
 * Page 2 of the Home rank card — Appendix A.
 *
 * Page 1 is the singles card, exactly as it is today and rendered by Home.
 * This never touches it; the carousel puts the two side by side.
 *
 * THE ORDINAL COUNTS RANKED PLAYERS ONLY, and matches the Table for the same
 * reason the Table splits them out: under five doubles matches this app does
 * not claim a position. A provisional player is told how many they have
 * played instead of being given a place that will move for reasons they did
 * not cause.
 */

interface Props {
  players: any[];
  matches: DoublesMatch[];
  meId: string;
  leagueName: string;
  onLogDoubles?: () => void;
}

const ordinal = (n: number): string => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] || "th";
};

export function DoublesRankCard({ players, matches, meId, leagueName, onLogDoubles }: Props) {
  const stats = useMemo(() => computeDoubles(matches), [matches]);
  const mine = useMemo(() => matches.filter((m) =>
    [...m.teamA, ...m.teamB].includes(meId) && (m.status === undefined || m.status === "confirmed")),
    [matches, meId]);

  const played = stats.played[meId] || 0;

  // Nothing to show is a real state, not an empty card. The brief asks for a
  // way in from here, because somebody looking at this page is the person
  // most likely to want it.
  if (!played) {
    return (
      <div style={{ margin: "20px 16px 0", padding: "22px 18px", borderRadius: FEED_RADIUS, background: FEED_HERO, color: FEED_ON_HERO, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontFamily: body, fontSize: 14, fontWeight: 600 }}>{leagueName} · Doubles</div>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 30, lineHeight: 1.05, ...tight(30) }}>No doubles yet</div>
        {onLogDoubles && (
          <button
            onClick={onLogDoubles}
            style={{ marginTop: 6, height: 46, borderRadius: 23, border: "none", background: FEED_CTA, color: FEED_LIME_INK, fontFamily: body, fontSize: 16, fontWeight: 700, cursor: "pointer" }}
          >
            Log a doubles match
          </button>
        )}
      </div>
    );
  }

  const ranked = players
    .filter((p) => (stats.played[p.id] || 0) >= DOUBLES_PROVISIONAL_GAMES)
    .sort((a, b) => Math.round(stats.elo[b.id] ?? 0) - Math.round(stats.elo[a.id] ?? 0));
  const place = ranked.findIndex((p) => p.id === meId) + 1;
  const provisional = played < DOUBLES_PROVISIONAL_GAMES;

  const rows = partnersOf(matches, meId);
  const byId = new Map(players.map((p) => [p.id, p]));
  // The badge if it has been earned, otherwise who they actually play with —
  // "Best with" on three matches would be a claim the Partners card itself
  // refuses to make.
  const best = bestPartner(rows);
  const partnerId = best || mostPlayedWith(rows);

  // Last five, oldest first, so it reads left to right like a form guide.
  const last5 = mine.slice(-5);
  const outcome = (m: DoublesMatch): "w" | "d" | "l" => {
    if (m.winner === "draw") return "d";
    const onA = m.teamA.includes(meId);
    return (m.winner === "A") === onA ? "w" : "l";
  };

  return (
    <div style={{ margin: "20px 16px 0", padding: "20px 18px", borderRadius: FEED_RADIUS, background: FEED_HERO, color: FEED_ON_HERO, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontFamily: body, fontSize: 14, fontWeight: 600 }}>{leagueName} · Doubles</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 64, lineHeight: 1, ...tight(64), ...tabular }}>
          {provisional ? "–" : place}
          {!provisional && <span style={{ fontSize: 26, letterSpacing: 0 }}>{ordinal(place)}</span>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: display, fontSize: 34, fontWeight: 700, lineHeight: 1, ...tabular }}>
            {Math.round(stats.elo[meId] ?? 0).toLocaleString()}
          </div>
          <div style={{ fontFamily: body, fontSize: 11, letterSpacing: 1.6, marginTop: 6, fontWeight: 600 }}>
            DOUBLES ELO · ALL TIME
          </div>
        </div>
      </div>

      {/* --on-hero-line, not an opacity. Three of the five themes are light
          and an alpha only reads as "quieter" against a known background. */}
      <div style={{ height: 1, background: "var(--on-hero-line)", margin: "14px 0" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: body, fontSize: 13, fontWeight: 600, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {provisional
            ? `${played} of ${DOUBLES_PROVISIONAL_GAMES} played`
            : partnerId ? `${best ? "Best" : "Most"} with ${fullNameOf(byId.get(partnerId))}` : "No partners yet"}
        </span>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {last5.map((m, i) => {
            const o = outcome(m);
            return (
              <span
                key={i}
                style={{
                  width: 11, height: 11, borderRadius: 6,
                  background: o === "w" ? "var(--win-on-hero)" : o === "l" ? "var(--loss-on-hero)" : "var(--on-hero-line)",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
