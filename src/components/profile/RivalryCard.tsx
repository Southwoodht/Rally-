"use client";
import React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { shortNameOf } from "@/lib/format";
import {
  FEED_CARD, FEED_DRAW, FEED_LIME, FEED_LOSS, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID,
  FEED_THEY_LEAD, FEED_WIN, body, tabular,
} from "@/lib/theme";

// One repeated fixture, as a card.
//
// The split bar is the part that earns its place: 6-3-3 read as three
// numbers takes a moment, and read as three lengths takes none. Zero
// segments are omitted rather than drawn at zero width, because a segment
// that exists but cannot be seen is a segment somebody will later wonder
// about.

export interface RivalryCardProps {
  me: any;
  them: any;
  w: number;
  d: number;
  l: number;
  /** Most recent meetings, oldest first, up to five. */
  recent: Array<"W" | "D" | "L">;
  total: number;
  /** Already formatted — "29 Jul". */
  lastPlayed: string;
  onOpen?: (playerId: string) => void;
}

const DOT = 8;

function Dot({ outcome }: { outcome: "W" | "D" | "L" }) {
  return (
    <span
      aria-label={outcome === "W" ? "win" : outcome === "D" ? "draw" : "loss"}
      style={{
        width: DOT, height: DOT, borderRadius: DOT / 2, display: "block", flexShrink: 0,
        background: outcome === "D" ? "transparent" : outcome === "W" ? FEED_WIN : FEED_LOSS,
        border: outcome === "D" ? "1.5px solid " + FEED_LIME : undefined,
        boxSizing: "border-box",
      }}
    />
  );
}

function SplitBar({ w, d, l }: { w: number; d: number; l: number }) {
  const parts = [
    { n: w, colour: FEED_WIN, label: "won" },
    { n: d, colour: FEED_DRAW, label: "drawn" },
    { n: l, colour: FEED_LOSS, label: "lost" },
  ].filter((p) => p.n > 0);
  if (!parts.length) return null;
  return (
    <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginTop: 12 }} role="img" aria-label={`${w} won, ${d} drawn, ${l} lost`}>
      {parts.map((p) => <span key={p.label} style={{ flex: p.n, background: p.colour }} />)}
    </div>
  );
}

export function RivalryCard({ me, them, w, d, l, recent, total, lastPlayed, onOpen }: RivalryCardProps) {
  const leading = w > l ? "you" : l > w ? "them" : "level";
  const leadLabel = leading === "you" ? "You lead" : leading === "them" ? "They lead" : "All square";
  const leadColour = leading === "you" ? FEED_LIME : leading === "them" ? FEED_THEY_LEAD : FEED_TEXT_MID;

  return (
    <SurfaceCard radius={18} pad={16} onClick={onOpen && them?.id ? () => onOpen(them.id) : undefined}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* A gap between avatar and ring, not just a ring. Avatar colours
            are generated from the player id and one of them is the ball
            yellow — so a plain lime ring vanishes on whoever draws it, which
            in Seacourt happens to be Sam, the one person it exists to mark.
            The card-coloured gap makes it read on any avatar. */}
        <span style={{ borderRadius: "50%", boxShadow: "0 0 0 2px " + FEED_CARD + ", 0 0 0 4px " + FEED_LIME, display: "flex", flexShrink: 0 }}>
          <Avatar player={me} size={38} />
        </span>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <div style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 26, lineHeight: 1, letterSpacing: "-0.04em", color: FEED_TEXT_HI }}>
            {w}–{d}–{l}
          </div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: leadColour, marginTop: 4 }}>{leadLabel}</div>
        </div>
        <span style={{ display: "flex", flexShrink: 0 }}>
          <Avatar player={them} size={38} />
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
        <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID }}>You</span>
        <span style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {shortNameOf(them)}
        </span>
      </div>

      <SplitBar w={w} d={d} l={l} />

      <div style={{ borderTop: "0.5px solid " + FEED_RAISED, marginTop: 12, paddingTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID, flexShrink: 0 }}>
          {recent.length === 5 ? "Last 5" : "Last " + recent.length}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
          {recent.map((r, i) => <Dot key={i} outcome={r} />)}
        </span>
        <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID, flexShrink: 0 }}>
          {total} played · {lastPlayed}
        </span>
      </div>
    </SurfaceCard>
  );
}

/**
 * The rivalries section.
 *
 * Renders what qualifies and no more. An empty section is a real answer —
 * somebody who has played eleven people twice each has no rivalries, and
 * saying so is better than promoting their nearest miss.
 */
export function Rivalries({ items }: { items: RivalryCardProps[] }) {
  if (!items || !items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((it) => <RivalryCard key={it.them?.id || it.lastPlayed} {...it} />)}
    </div>
  );
}
