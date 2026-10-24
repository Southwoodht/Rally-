"use client";
import React from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { shortNameOf } from "@/lib/format";
import {
  FEED_CARD, FEED_DEEP, FEED_DOWN, FEED_LIME, FEED_LIME_INK, FEED_LIME_INK_2, FEED_PAD,
  FEED_RADIUS, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, FEED_TILE_RADIUS,
  FEED_UP, FORM_DRAW, FORM_LOSS, FORM_WIN, LINE, body, tabular, tight,
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
  children, tone = "card", radius = FEED_RADIUS, pad = FEED_PAD, clip = false, style, onClick, className,
}: {
  /** "sw-hero" marks the ONE hero card on a screen (Southwood draws a brass rim). */
  className?: string;
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
      className={className}
      style={{
        background: TONE_BG[tone], borderRadius: radius, padding: pad,
        // A 1px --line border in EVERY theme. On rally it is very nearly
        // invisible, which is why the card never had one; on the three light
        // themes a white card on a light page has no edge at all without it,
        // and the whole screen reads as one undifferentiated sheet.
        border: "1px solid " + LINE,
        boxSizing: "border-box",
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
export type NumeralTone = "hi" | "mid" | "lime" | "ink";

// "ink" is for numerals sitting ON the lime rather than made of it.
const NUMERAL_COLOR: Record<NumeralTone, string> = { hi: FEED_TEXT_HI, mid: FEED_TEXT_MID, lime: FEED_LIME, ink: FEED_LIME_INK };

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
/** Named by intent, not by colour, so a palette change can't strand it. */
export type MovementTone = "default" | "onAccent";

/**
 * Which way somebody moved, and by how much.
 *
 * `delta` is places gained: positive climbed, negative dropped, zero held.
 * Pass null for "we don't know" and it renders nothing — somebody who has
 * never been measured has not held still, and drawing a neutral dash would
 * state a fact nobody has.
 *
 * The arrow carries the direction on its own, which means the colour is
 * decoration rather than encoding: nothing is lost by a reader who can't
 * separate the green from the red, and nothing is lost on the lime card
 * where both collapse to one ink. That is why the arrow stays the same size
 * and weight in both tones instead of shrinking when the colour goes.
 */
export function MovementIndicator({
  delta, size = 13, tone = "default", label,
}: {
  delta: number | null | undefined;
  size?: number;
  tone?: MovementTone;
  /** Overrides the wording — the standing hero says "Up 1 this week". */
  label?: string;
}) {
  if (delta === null || delta === undefined) return null;
  const up = delta > 0, down = delta < 0;
  const color = tone === "onAccent"
    ? (delta === 0 ? FEED_LIME_INK_2 : FEED_LIME_INK)
    : (up ? FEED_UP : down ? FEED_DOWN : FEED_TEXT_LOW);
  const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
  const n = Math.abs(delta);
  const text = label ?? (n === 0 ? "no change" : (up ? "up " : "down ") + n + (n === 1 ? " place" : " places"));
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Icon size={size} color={color} strokeWidth={2} />
      <span style={{ fontFamily: body, fontWeight: 400, fontSize: size, color }}>{text}</span>
    </span>
  );
}

// ---------------------------------------------------------------- FormDots
export type FormResult = "W" | "D" | "L";

/**
 * Recent results, oldest first.
 *
 * Three outcomes, three colours: green won, grey drew, red lost, on every
 * theme and every card (FORM_* in lib/theme.ts). Not three opacities of one
 * colour — a draw is a third result, not a partial win, and three steps of
 * one colour at this size collapse into two outdoors. It used to be shapes
 * on the hero card and outlined losses in Southwood; Sam asked for the
 * plain three everywhere because they read at once.
 *
 * Folding draws into losses was the other option and it's worse — the stat
 * line beside this says 28-6-10, so six draws rendering as loss dots would
 * have the card disagreeing with the number next to it. In this league
 * that's not an edge case; two players have three apiece.
 *
 * Fewer than five results renders fewer dots, left aligned. No empty slots:
 * a placeholder for a match nobody has played is a promise, not a fact.
 */
const DOT_COLOUR = { W: FORM_WIN, D: FORM_DRAW, L: FORM_LOSS };

export function FormDots({ form, size = 10, bare = false }: {
  form: FormResult[];
  size?: number;
  /** Already on a cream chip (the leader card, Home's hero): skip the dark
   *  theme's own chip so there aren't two. */
  bare?: boolean;
  /** Kept so existing callers compile; the dots no longer change colour by
   *  card. They were "ink" on the hero card (one colour, shape for the
   *  outcome) and outlined losses in Southwood, and Sam asked for plain
   *  green / grey / red everywhere instead. */
  ink?: string;
  lossInk?: string;
  tone?: "colour" | "ink";
}) {
  if (!form || !form.length) return null;
  return (
    // --form-chip is set only by dark themes (styles/themes.css); everywhere
    // else this is a plain row of dots exactly as before.
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, ...(bare ? {} : { background: "var(--form-chip, transparent)", padding: "var(--form-chip-pad, 0)", borderRadius: 999 }) }}>
      {form.slice(-5).map((r, i) => (
        <span
          key={i}
          aria-label={r === "W" ? "win" : r === "D" ? "draw" : "loss"}
          style={{ width: size, height: size, borderRadius: size / 2, display: "block", flexShrink: 0, background: DOT_COLOUR[r] }}
        />
      ))}
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
