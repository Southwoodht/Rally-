"use client";
import React from "react";
import { ChevronRight } from "lucide-react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { shortNameOf } from "@/lib/format";
import { FEED_LIME, FEED_LIME_INK, FEED_LOSS, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

// The three wins worth remembering.
//
// Ranked on the opponent's RATING at the date of the match, not their level
// tier. Tier produced ties it could not break — beating the same person
// twice in the same category gave two identical entries with nothing to
// separate them — and it also judged an old win by who that opponent has
// since become. Rating at the time is a real number, different for every
// match, and it is what the player actually beat that day.
//
// The caveat, worth knowing rather than hiding: early-career ratings are
// provisional and jumpy, so a 2017 win can rank higher than it feels. That
// is still better than a tie nobody can break.

export interface BestWin {
  matchId: string;
  opponent: any;
  /** "Intermediate · 2026" — level at the time, and the year. */
  subtitle: string;
}

export interface BestWinsProps {
  wins: BestWin[];
  onOpenMatch?: (matchId: string) => void;
}

function Badge({ place }: { place: number }) {
  const gold = place === 1;
  return (
    <span
      style={{
        width: 22, height: 22, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center",
        background: gold ? FEED_LIME : FEED_RAISED,
        color: gold ? FEED_LIME_INK : FEED_TEXT_HI,
        ...tabular, fontFamily: body, fontWeight: 500, fontSize: 12,
      }}
    >
      {place}
    </span>
  );
}

export function BestWins({ wins, onOpenMatch }: BestWinsProps) {
  if (!wins || !wins.length) return null;
  return (
    <SurfaceCard radius={18} pad={0} clip>
      {wins.slice(0, 3).map((w, i) => (
        <button
          key={w.matchId}
          onClick={onOpenMatch ? () => onOpenMatch(w.matchId) : undefined}
          style={{
            display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
            background: "transparent", border: "none", padding: "13px 16px",
            cursor: onOpenMatch ? "pointer" : "default",
            boxShadow: i === Math.min(wins.length, 3) - 1 ? undefined : "inset 0 -0.5px 0 " + FEED_LOSS,
          }}
        >
          <Badge place={i + 1} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {shortNameOf(w.opponent)}
            </span>
            <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, marginTop: 1 }}>{w.subtitle}</span>
          </span>
          {onOpenMatch && <ChevronRight size={16} color={FEED_TEXT_MID} strokeWidth={2} style={{ flexShrink: 0 }} />}
        </button>
      ))}
    </SurfaceCard>
  );
}
