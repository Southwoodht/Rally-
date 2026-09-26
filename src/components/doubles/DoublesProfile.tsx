"use client";
import React, { useMemo } from "react";
import { PartnersCard } from "@/components/doubles/PartnersCard";
import { ordinal } from "@/lib/format";
import { computeDoubles, DOUBLES_PROVISIONAL_GAMES, type DoublesMatch } from "@/core/doubles/elo";
import {
  FEED_CARD, FEED_LIME, FEED_MUTED_FILL, FEED_RADIUS, FEED_TEXT_HI, FEED_TEXT_MID,
  LINE, body, display, tabular,
} from "@/lib/theme";

/**
 * The doubles half of Profile — Appendix C.
 *
 * Its own W-D-L, last five, win rate, streaks, position and doubles Elo, then
 * the Partners card. The singles half is a different component entirely and
 * this never touches it.
 *
 * THE LAST-FIVE BARS ARE HEIGHT-BY-OPPOSITION, which is what the appendix
 * labels them: "height = opponents' level". Singles uses the opponent's
 * recorded level at the time, via levelAt. Doubles cannot — a pair has no
 * level, and averaging two dropdown guesses is arithmetic on a guess, which
 * is the exact objection matchGrade.ts raises against sub-levels.
 *
 * So the height here is the opposing PAIR'S DOUBLES RATING at the time, which
 * is measured rather than claimed. It is a different quantity from the
 * singles bars and it is honest about being one; what it must not do is look
 * identical while meaning something softer.
 */

interface Props {
  players: any[];
  matches: DoublesMatch[];
  playerId: string;
  leagueName: string;
}

const pct = (n: number) => Math.round(n * 100);

export function DoublesProfile({ players, matches, playerId, leagueName }: Props) {
  const stats = useMemo(() => computeDoubles(matches), [matches]);

  const played = stats.played[playerId] || 0;
  const won = stats.won[playerId] || 0;
  const lost = stats.lost[playerId] || 0;
  const drawn = stats.drawn[playerId] || 0;

  const ranked = useMemo(() => players
    .filter((p) => (stats.played[p.id] || 0) >= DOUBLES_PROVISIONAL_GAMES)
    .sort((a, b) => Math.round(stats.elo[b.id] ?? 0) - Math.round(stats.elo[a.id] ?? 0)),
    [players, stats]);
  const place = ranked.findIndex((p) => p.id === playerId) + 1;
  const provisional = played < DOUBLES_PROVISIONAL_GAMES;

  /**
   * Each of the last five, with the opposing pair's rating as it stood at the
   * time — taken from the deltas, which already record `before` per player.
   * Recomputing it here would be a second implementation of the same replay.
   */
  const last5 = useMemo(() => {
    const mine = matches
      .filter((m) => [...m.teamA, ...m.teamB].includes(playerId) && (m.status === undefined || m.status === "confirmed"))
      .sort((a, b) => a.playedAt - b.playedAt)
      .slice(-5);
    return mine.map((m) => {
      const onA = m.teamA.includes(playerId);
      const opp = onA ? m.teamB : m.teamA;
      // An unknown opponent was never rated, so they stand at 1500 -- the same
      // number the engine used for them in the team average.
      const before = (id: string | null) => id == null ? 1500 : stats.deltas.find((d) => d.matchId === m.id && d.playerId === id)?.before ?? 1500;
      const oppRating = (before(opp[0]) + before(opp[1])) / 2;
      const outcome: "w" | "d" | "l" =
        m.winner === "draw" ? "d" : (m.winner === "A") === onA ? "w" : "l";
      return { outcome, oppRating };
    });
  }, [matches, playerId, stats]);

  // Scaled across this player's own five, not the whole league: the bar is a
  // comparison between these five nights out, which is what somebody reads it
  // as. A league-wide scale would flatten all five into the same height for
  // anybody who plays similar opposition — which is most people.
  const lo = Math.min(...last5.map((x) => x.oppRating), 1500);
  const hi = Math.max(...last5.map((x) => x.oppRating), 1500);
  const barHeight = (r: number) => {
    if (hi - lo < 1) return 18;
    return 12 + Math.round(((r - lo) / (hi - lo)) * 12);
  };

  const rule = <div style={{ height: 1, background: LINE, margin: "16px 0" }} />;
  const numeral = (v: React.ReactNode, label: string, colour?: string) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ fontFamily: display, fontWeight: 700, fontSize: 50, lineHeight: 1, letterSpacing: -1, color: colour || FEED_TEXT_HI, ...tabular }}>{v}</div>
      <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID }}>{label}</div>
    </div>
  );
  const row = (label: string, value: React.ReactNode, accent?: boolean) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", gap: 10 }}>
      <span style={{ fontFamily: body, fontSize: 15, color: FEED_TEXT_MID }}>{label}</span>
      <span style={{ fontFamily: display, fontSize: 19, fontWeight: 700, color: accent ? FEED_LIME : FEED_TEXT_HI, ...tabular }}>{value}</span>
    </div>
  );

  if (!played) {
    return (
      <div style={{ margin: "12px 16px 0", padding: 22, borderRadius: FEED_RADIUS, background: FEED_CARD, fontFamily: body, fontSize: 15, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
        No doubles matches yet. Log one and this fills in.
      </div>
    );
  }

  return (
    <>
      <div style={{ margin: "12px 16px 0", padding: "22px 18px", borderRadius: FEED_RADIUS, background: FEED_CARD, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 14 }}>
          {numeral(won, "won", FEED_LIME)}
          <div style={{ width: 14, height: 2, background: FEED_MUTED_FILL, marginTop: 24 }} />
          {numeral(drawn, "drawn")}
          <div style={{ width: 14, height: 2, background: FEED_MUTED_FILL, marginTop: 24 }} />
          {numeral(lost, "lost", "var(--lost)")}
        </div>

        <div style={{ height: 1, background: LINE, margin: "20px 0 16px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID }}>
          <span>Last 5</span><span>height = opponents&apos; rating</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 10, height: 34, marginTop: 12 }}>
          {last5.map((x, i) => (
            <span
              key={i}
              style={{
                width: 10, height: barHeight(x.oppRating), borderRadius: 3,
                background: x.outcome === "w" ? FEED_LIME : x.outcome === "l" ? FEED_MUTED_FILL : LINE,
              }}
            />
          ))}
        </div>

        {rule}

        <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
          <div>
            <div style={{ fontFamily: display, fontWeight: 700, fontSize: 24, color: FEED_TEXT_HI, ...tabular }}>
              {pct(played ? (won + drawn * 0.5) / played : 0)}%
            </div>
            <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>win rate</div>
          </div>
          <div>
            <div style={{ fontFamily: display, fontWeight: 700, fontSize: 24, color: FEED_LIME, ...tabular }}>
              {Math.abs(stats.currentStreak[playerId] || 0)}
            </div>
            <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>current streak</div>
          </div>
          <div>
            <div style={{ fontFamily: display, fontWeight: 700, fontSize: 24, color: FEED_TEXT_HI, ...tabular }}>
              {stats.bestStreak[playerId] || 0}
            </div>
            <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>best streak</div>
          </div>
        </div>

        <div style={{ height: 1, background: LINE, margin: "16px 0 6px" }} />

        {row(
          `Doubles · ${leagueName}`,
          provisional ? `${played} of ${DOUBLES_PROVISIONAL_GAMES} played` : `${ordinal(place)} of ${ranked.length}`,
          true,
        )}
        {row("Doubles Elo", Math.round(stats.elo[playerId] ?? 0).toLocaleString())}
      </div>

      <PartnersCard players={players} matches={matches} playerId={playerId} />
    </>
  );
}
