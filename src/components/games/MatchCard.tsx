"use client";
import React from "react";
import { Avatar } from "@/components/ui/Avatar";
import {
  FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_LIME_INK_2, FEED_PAD,
  FEED_RADIUS, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, tabular, tight,
} from "@/lib/theme";

// A scoreline card, in the Apple Sports direction: the result is the loudest
// thing on it and everything else gets out of the way.
//
// No tennis-ball icon. Every row in the feed had the same one, so it told
// you nothing about the match it sat on — it was punctuation, not
// information, and it was taking the space the score wanted.
//
// Emphasis is size and colour only, never weight: 400 and 500 throughout, so
// the winner reads as the winner because their name is brighter and their
// numbers are bigger, not because the font got heavier. Anything with digits
// in it is tabular so two rows of set scores line up in columns instead of
// drifting; anything over 18px gets its tracking pulled in, which is most of
// what makes large type look set rather than typed.
//
// Presentational only. It receives two sides and renders them; it does not
// know what a match is, work out who won, or fetch anything.

export interface MatchCardSide {
  /** The player record, for the avatar and the nickname. */
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

// The nickname is the name here. Full names belong in match detail, where
// there's room to be formal and a reason to be precise.
const shortNameOf = (p: any): string => (p?.nick || p?.name || "Someone");

const SET_COL = 30;

function Sets({ sets, color }: { sets?: number[]; color: string }) {
  // No score logged: render nothing at all rather than a dash or a zero. The
  // rows keep their height from the name and avatar beside them, so the card
  // is the same shape either way and the lime bar carries the result on its
  // own — which is what it is for.
  if (!sets || !sets.length) return null;
  return (
    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
      {sets.map((n, i) => (
        <span
          key={i}
          style={{
            ...tabular, ...tight(34),
            width: SET_COL, textAlign: "right", fontFamily: body, fontWeight: 500,
            fontSize: 34, lineHeight: 1, color,
          }}
        >
          {n}
        </span>
      ))}
    </div>
  );
}

function Side({ side, dim, onOpenProfile }: { side: MatchCardSide; dim: boolean; onOpenProfile?: (id: string) => void }) {
  const name = shortNameOf(side.player);
  const nameColor = dim ? FEED_TEXT_MID : FEED_TEXT_HI;
  const id = side.player?.id;
  const nameEl = (
    <span
      style={{
        ...tight(19),
        fontFamily: body, fontWeight: dim ? 400 : 500, fontSize: 19, color: nameColor,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
      }}
    >
      {name}
    </span>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 48 }}>
      <span style={{ opacity: dim ? 0.6 : 1, display: "flex", flexShrink: 0 }}>
        <Avatar player={side.player} size={40} />
      </span>
      {id && onOpenProfile ? (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenProfile(id); }}
          style={{ flex: 1, minWidth: 0, display: "flex", background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
        >
          {nameEl}
        </button>
      ) : (
        <span style={{ flex: 1, minWidth: 0, display: "flex" }}>{nameEl}</span>
      )}
      <Sets sets={side.sets} color={dim ? FEED_TEXT_MID : FEED_TEXT_HI} />
    </div>
  );
}

export function MatchCard({ sport, dateLabel, format, winner, loser, drawn, context, onOpenProfile, onOpenMatch }: MatchCardProps) {
  const meta = [sport, dateLabel].filter(Boolean).join(" · ");
  const barText = drawn
    ? "Drew"
    : shortNameOf(winner.player) + " won";

  return (
    <div
      style={{
        background: FEED_CARD, borderRadius: FEED_RADIUS, padding: FEED_PAD,
        // The lime bar bleeds to the card edge by cancelling this padding,
        // so the card has to clip it back to the corner radius.
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {meta}
        </span>
        {format && (
          <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, flexShrink: 0 }}>{format}</span>
        )}
      </div>

      <Side side={winner} dim={false} onOpenProfile={onOpenProfile} />
      <div style={{ height: 1, background: FEED_HAIRLINE, margin: "2px 0" }} />
      <Side side={loser} dim={!drawn} onOpenProfile={onOpenProfile} />

      <div
        onClick={onOpenMatch}
        style={{
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
    </div>
  );
}
