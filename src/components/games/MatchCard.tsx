"use client";
import React from "react";
import { PlayerIdentity, StatNumeral, SurfaceCard } from "@/components/ui/Surfaces";
import { shortNameOf } from "@/lib/format";
import {
  FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_LIME_INK_2, FEED_PAD,
  FEED_TEXT_LOW, body, tabular,
} from "@/lib/theme";

// A scoreline card, in the Apple Sports direction: the result is the loudest
// thing on it and everything else gets out of the way.
//
// No tennis-ball icon. Every row in the feed had the same one, so it told
// you nothing about the match it sat on — it was punctuation, not
// information, and it was taking the space the score wanted.
//
// Built from the shared primitives rather than styled inline: the face and
// name are a PlayerIdentity, the games are StatNumerals, the container is a
// SurfaceCard. Emphasis is size and colour only, never weight — the winner
// reads as the winner because their name is brighter and their numbers are
// bigger, not because the font got heavier.
//
// Presentational only. It receives two sides and renders them; it does not
// know what a match is, work out who won, or fetch anything.

export interface MatchCardSide {
  /** The player record, for the face and the name. */
  player: any;
  /** Games taken in each set, in order. Omit when no score was logged. */
  sets?: number[];
}

export interface MatchCardProps {
  /** e.g. "Tennis". Omitted rather than guessed when the league hasn't said. */
  sport?: string;
  /** Already formatted — "22 Aug". This card does no date maths. */
  dateLabel: string;
  /** e.g. "Best of 3". */
  format?: string;
  winner: MatchCardSide;
  loser: MatchCardSide;
  /** A draw has no winner: both sides read as equals and the bar says so. */
  drawn?: boolean;
  /** One short phrase for the right of the lime bar — "3rd straight",
   *  "First win vs Charlie". Left off entirely when there's nothing to say,
   *  because a bar with a lonely label on one end looks broken. */
  context?: string;
  onOpenProfile?: (playerId: string) => void;
  onOpenMatch?: () => void;
}

const SET_COL = 30;

function Sets({ sets, dim }: { sets?: number[]; dim: boolean }) {
  // No score logged: render nothing at all rather than a dash or a zero. The
  // rows keep their height from the face and name beside them, so the card is
  // the same shape either way and the lime bar carries the result on its own
  // — which is what it is for.
  if (!sets || !sets.length) return null;
  return (
    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
      {sets.map((n, i) => (
        <StatNumeral key={i} size={34} tone={dim ? "mid" : "hi"} style={{ width: SET_COL, textAlign: "right", display: "inline-block" }}>
          {n}
        </StatNumeral>
      ))}
    </div>
  );
}

export function MatchCard({ sport, dateLabel, format, winner, loser, drawn, context, onOpenProfile, onOpenMatch }: MatchCardProps) {
  const meta = [sport, dateLabel].filter(Boolean).join(" · ");
  const barText = drawn ? "Drew" : shortNameOf(winner.player) + " won";
  const metaStyle: React.CSSProperties = { fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW };

  return (
    <SurfaceCard clip>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ ...metaStyle, ...tabular, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {meta}
        </span>
        {format && <span style={{ ...metaStyle, flexShrink: 0 }}>{format}</span>}
      </div>

      <div style={{ minHeight: 48, display: "flex", alignItems: "center" }}>
        <PlayerIdentity
          player={winner.player}
          onOpen={onOpenProfile}
          trailing={<Sets sets={winner.sets} dim={false} />}
        />
      </div>
      <div style={{ height: 1, background: FEED_HAIRLINE, margin: "2px 0" }} />
      <div style={{ minHeight: 48, display: "flex", alignItems: "center" }}>
        <PlayerIdentity
          player={loser.player}
          dim={!drawn}
          onOpen={onOpenProfile}
          trailing={<Sets sets={loser.sets} dim={!drawn} />}
        />
      </div>

      <div
        onClick={onOpenMatch}
        style={{
          // Cancels the card's padding so the bar reaches the edges; the card
          // clips it back to the corner radius.
          marginLeft: -FEED_PAD, marginRight: -FEED_PAD, marginBottom: -FEED_PAD, marginTop: 14,
          background: FEED_LIME, padding: "10px " + FEED_PAD + "px",
          display: "flex", alignItems: "center", gap: 10,
          cursor: onOpenMatch ? "pointer" : "default",
        }}
      >
        <span style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_LIME_INK, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {barText}
        </span>
        {context && (
          <span style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_LIME_INK_2, flexShrink: 0, whiteSpace: "nowrap" }}>{context}</span>
        )}
      </div>
    </SurfaceCard>
  );
}
