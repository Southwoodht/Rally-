"use client";
import React from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { shortNameOf } from "@/lib/format";
import {
  FEED_CARD, FEED_DEEP, FEED_DOWN, FEED_LIME, FEED_PAD, FEED_RADIUS, FEED_RAISED,
  FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, FEED_TILE_RADIUS, FEED_UP, body, tabular, tight,
} from "@/lib/theme";

// The scoreboard primitives, shared by the newsfeed cards and by the Table
// screen after them.
//
// They exist because the same four things kept being restated inline, and
// the second statement of a thing is where it starts to drift: a numeral
// that's 32px here and 34px there, an arrow that's green on one screen and
// lime on the next. Each of these owns one decision so there's one place to
// change it.

// ------------------------------------------------------------- SurfaceCard
export type SurfaceTone = "card" | "raised" | "deep";

const TONE_BG: Record<SurfaceTone, string> = {
  card: FEED_CARD,     // the default surface a card sits on
  raised: FEED_RAISED, // a card on top of a card
  deep: FEED_DEEP,     // a tile inset INTO a card, reading as recessed
};

export function SurfaceCard({
  children, tone = "card", radius = FEED_RADIUS, pad = FEED_PAD, clip = false, style, onClick,
}: {
  children: React.ReactNode;
  tone?: SurfaceTone;
  radius?: number;
  pad?: number | string;
  /** Needed when something inside bleeds to the edge — a full-width bar
   *  cancels the padding and has to be clipped back to the corner radius. */
  clip?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: TONE_BG[tone], borderRadius: radius, padding: pad,
        overflow: clip ? "hidden" : undefined,
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** An inset tile — the small recessed panels inside a card. */
export function SurfaceTile({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <SurfaceCard tone="deep" radius={FEED_TILE_RADIUS} pad={14} style={{ minWidth: 0, ...style }}>{children}</SurfaceCard>;
}

// ------------------------------------------------------------- StatNumeral
export type NumeralTone = "hi" | "mid" | "lime";

const NUMERAL_COLOR: Record<NumeralTone, string> = { hi: FEED_TEXT_HI, mid: FEED_TEXT_MID, lime: FEED_LIME };

/**
 * A big number: tabular so columns of them line up, tracking pulled in
 * because large type set at default tracking looks typed rather than set,
 * and weight 500 because emphasis in this system comes from size and colour
 * and never from a heavier font.
 */
export function StatNumeral({
  children, size = 32, tone = "hi", style,
}: {
  children: React.ReactNode;
  size?: number;
  tone?: NumeralTone;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        ...tabular, ...tight(size),
        fontFamily: body, fontWeight: 500, fontSize: size, lineHeight: 1,
        color: NUMERAL_COLOR[tone], ...style,
      }}
    >
      {children}
    </span>
  );
}

// ------------------------------------------------------- MovementIndicator
/**
 * Which way somebody moved, and by how much.
 *
 * `delta` is places gained: positive climbed, negative dropped, zero held.
 * Pass null for "we don't know" and it renders nothing — somebody who has
 * never been measured has not held still, and drawing a neutral dash would
 * state a fact nobody has.
 */
export function MovementIndicator({ delta, size = 13 }: { delta: number | null | undefined; size?: number }) {
  if (delta === null || delta === undefined) return null;
  const up = delta > 0, down = delta < 0;
  const color = up ? FEED_UP : down ? FEED_DOWN : FEED_TEXT_LOW;
  const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
  const n = Math.abs(delta);
  const label = n === 0 ? "no change" : (up ? "up " : "down ") + n + (n === 1 ? " place" : " places");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Icon size={size} color={color} strokeWidth={2} />
      <span style={{ fontFamily: body, fontWeight: 400, fontSize: size, color }}>{label}</span>
    </span>
  );
}

// ----------------------------------------------------------- PlayerIdentity
/**
 * Who somebody is, wherever they appear: face, name, and optionally a line
 * of detail under it.
 *
 * The name comes from shortNameOf, in one place, so no screen can decide to
 * name people differently from the rest. Names never wrap — every layout
 * that uses this gives them a single line and expects to keep it.
 */
export function PlayerIdentity({
  player, name, statLine, size = 40, nameSize = 19, dim = false, onOpen, trailing,
}: {
  player?: any;
  /** Used when there's no player record to name — an opponent from a league
   *  we can only see the outside of. */
  name?: string;
  statLine?: React.ReactNode;
  size?: number;
  nameSize?: number;
  /** The losing side of a scoreline: quieter name, faded face. */
  dim?: boolean;
  onOpen?: (playerId: string) => void;
  trailing?: React.ReactNode;
}) {
  const label = player ? shortNameOf(player) : (name || "Someone");
  const id = player?.id;
  const nameEl = (
    <span
      style={{
        ...tight(nameSize),
        fontFamily: body, fontWeight: dim ? 400 : 500, fontSize: nameSize,
        color: dim ? FEED_TEXT_MID : FEED_TEXT_HI,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block",
      }}
    >
      {label}
    </span>
  );
  const block = (
    <span style={{ display: "block", minWidth: 0 }}>
      {nameEl}
      {statLine && (
        <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {statLine}
        </span>
      )}
    </span>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      {size > 0 && (
        <span style={{ opacity: dim ? 0.6 : 1, display: "flex", flexShrink: 0 }}>
          <Avatar player={player} size={size} />
        </span>
      )}
      {id && onOpen ? (
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(id); }}
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
        >
          {block}
        </button>
      ) : (
        <span style={{ flex: 1, minWidth: 0 }}>{block}</span>
      )}
      {trailing}
    </div>
  );
}
