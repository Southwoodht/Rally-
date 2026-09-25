"use client";
import React, { useMemo } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { fullNameOf } from "@/lib/format";
import { computeDoubles, DOUBLES_PROVISIONAL_GAMES, type DoublesMatch, type DoublesStats } from "@/core/doubles/elo";
import {
  FEED_CARD, FEED_LIME, FEED_RADIUS, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID,
  body, display, tabular,
} from "@/lib/theme";

/**
 * The Doubles half of the Table screen — Appendix B.
 *
 * Pure: it takes players and doubles matches and renders. No fetching, no
 * state. The Singles half is untouched and is not rendered from here.
 *
 * PROVISIONAL PLAYERS ARE SPLIT OUT, NOT RANKED LOW. This is the same ruling
 * §9 records for the Global table, arrived at for the same reason: the old
 * screen ranked provisional players 1 and 2 *while labelling them
 * provisional*, and both of those cannot be true. A place number is a claim
 * about where somebody stands, and under five doubles matches this app is not
 * willing to make it. They keep their rating and their record — they just get
 * a dash instead of a position.
 */

interface Props {
  players: any[];
  matches: DoublesMatch[];
  meId?: string | null;
  onOpen?: (playerId: string) => void;
}

interface Row {
  id: string;
  player: any;
  elo: number;
  won: number;
  lost: number;
  played: number;
}

const buildRows = (players: any[], s: DoublesStats): Row[] =>
  players
    .filter((p) => (s.played[p.id] || 0) > 0)
    .map((p) => ({
      id: p.id,
      player: p,
      elo: s.elo[p.id] ?? 0,
      won: s.won[p.id] || 0,
      lost: s.lost[p.id] || 0,
      played: s.played[p.id] || 0,
    }));

/**
 * Ranked on the ROUNDED rating, deliberately.
 *
 * StandingsList does the same on singles and §10 explains why: two players
 * printing the same number should be treated as level rather than separated
 * by a difference nobody can see on screen. Doubles Elo is a four-figure
 * number, so rounding to the whole point already gives plenty of resolution —
 * the scaling problem §10 describes for the 0-12 network rating does not
 * arise here.
 */
const byRating = (a: Row, b: Row): number =>
  (Math.round(b.elo) - Math.round(a.elo)) ||
  (b.won - a.won) ||
  (a.player.name || "").localeCompare(b.player.name || "");

export function DoublesStandings({ players, matches, meId, onOpen }: Props) {
  const stats = useMemo(() => computeDoubles(matches), [matches]);
  const { ranked, provisional } = useMemo(() => {
    const all = buildRows(players, stats).sort(byRating);
    return {
      ranked: all.filter((r) => r.played >= DOUBLES_PROVISIONAL_GAMES),
      provisional: all.filter((r) => r.played < DOUBLES_PROVISIONAL_GAMES),
    };
  }, [players, stats]);

  if (!ranked.length && !provisional.length) {
    return (
      <div style={{ margin: "14px 16px 0", padding: 22, borderRadius: FEED_RADIUS, background: FEED_CARD, fontFamily: body, fontSize: 15, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
        No doubles played yet. Log one from the + button and the table starts here.
      </div>
    );
  }

  const row = (r: Row, place: string, mine: boolean) => (
    <button
      key={r.id}
      onClick={onOpen ? () => onOpen(r.id) : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: 10, width: "100%",
        background: mine ? FEED_RAISED : "transparent",
        borderRadius: mine ? 16 : 0, border: "none",
        cursor: onOpen ? "pointer" : "default", textAlign: "left", boxSizing: "border-box",
      }}
    >
      <span style={{ width: 22, flexShrink: 0, fontFamily: display, fontWeight: 700, fontSize: 17, ...tabular, color: mine ? FEED_LIME : FEED_TEXT_HI }}>{place}</span>
      <Avatar player={r.player} size={40} />
      <span style={{ flexGrow: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: body, fontWeight: 600, fontSize: 16, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {/* fullNameOf, never player.nick — the nick field is a joke field and
              a session that reached for it printed a second man's name on
              Charlie Henry's row. */}
          {fullNameOf(r.player)}
          {mine && <span style={{ fontFamily: body, fontSize: 12, fontWeight: 500, color: FEED_TEXT_MID, marginLeft: 6 }}>You</span>}
        </span>
        <span style={{ display: "block", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, ...tabular }}>
          {r.won}–{r.lost}
          {r.played < DOUBLES_PROVISIONAL_GAMES && ` · ${r.played} of ${DOUBLES_PROVISIONAL_GAMES} played`}
        </span>
      </span>
      <span style={{ fontFamily: display, fontWeight: 700, fontSize: 18, ...tabular, color: mine ? FEED_LIME : (r.played < DOUBLES_PROVISIONAL_GAMES ? FEED_TEXT_MID : FEED_TEXT_HI) }}>
        {Math.round(r.elo).toLocaleString()}
      </span>
    </button>
  );

  return (
    <>
      <div style={{ margin: "14px 16px 0", padding: "0 10px", display: "flex", justifyContent: "space-between", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID }}>
        <span>Player · W–L</span>
        <span>Doubles Elo</span>
      </div>

      {!!ranked.length && (
        <div style={{ margin: "8px 16px 0", padding: 8, borderRadius: FEED_RADIUS, background: FEED_CARD, display: "flex", flexDirection: "column", gap: 2 }}>
          {ranked.map((r, i) => row(r, String(i + 1), r.id === meId))}
        </div>
      )}

      {!!provisional.length && (
        <>
          <div style={{ margin: "16px 26px 0", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID }}>
            Provisional · fewer than {DOUBLES_PROVISIONAL_GAMES} matches
          </div>
          <div style={{ margin: "8px 16px 0", padding: 8, borderRadius: FEED_RADIUS, background: FEED_CARD, display: "flex", flexDirection: "column", gap: 2 }}>
            {/* A dash, not a number. See the header. */}
            {provisional.map((r) => row(r, "–", r.id === meId))}
          </div>
        </>
      )}
    </>
  );
}
