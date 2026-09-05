"use client";
import React from "react";
import { Award, Flame, TrendingUp } from "lucide-react";
import { MovementIndicator, StatNumeral, SurfaceCard, SurfaceTile } from "@/components/ui/Surfaces";
import { FEED_HAIRLINE, FEED_LIME, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, tabular, tight } from "@/lib/theme";

// The Sunday-night roundup: one card, the week in about six seconds.
//
// It renders finished numbers and holds no rating logic of its own — the W-L,
// the rank, the movement and the highlight all arrive as props, worked out in
// core/. That matters more here than usual, because rank movement can't be
// derived from today's standings at all: they're a full recompute over all
// history, so a match logged this week for a game played in 2019 changes last
// week too. Movement comes from a stored weekly snapshot (core/snapshots.ts),
// and if this card did the arithmetic it would be quietly making it up.
//
// Deliberately not a standings table. The viewer's own movement, at most two
// other swings, and one highlight — a week in a mates' league has about that
// much worth saying, and the full table already exists on its own screen.

export interface RoundupResult {
  winnerName: string;
  loserName: string;
  /** Already formatted — "6-2, 6-4". An em-dash is rendered when absent. */
  score?: string | null;
  drawn?: boolean;
}

export interface RoundupMovement {
  /** Positive climbed, negative dropped, zero held. */
  placesGained: number;
}

export interface RoundupSwing {
  name: string;
  placesGained: number;
}

export interface WeeklyRoundupCardProps {
  /** Already formatted — "31 Aug – 6 Sep". */
  rangeLabel: string;
  record: { w: number; l: number };
  rank: number;
  /** Null when there's no earlier week to compare against. Null is not
   *  "no change": somebody who has never been measured hasn't held still,
   *  so the line is left off rather than claiming they stayed put. */
  movement?: RoundupMovement | null;
  /** Other people's weeks. Capped at two here rather than trusted to the
   *  caller, because "only the top two swings" is the rule this card exists
   *  to keep. */
  swings?: RoundupSwing[];
  results: RoundupResult[];
  highlight?: { kind: "climb" | "streak" | "firstWin"; sentence: string } | null;
}

const ordinal = (n: number): string => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] || "th";
};

const HIGHLIGHT_ICON = { climb: TrendingUp, streak: Flame, firstWin: Award };

const labelStyle: React.CSSProperties = { fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW };

export function WeeklyRoundupCard({ rangeLabel, record, rank, movement, swings, results, highlight }: WeeklyRoundupCardProps) {
  const HighlightIcon = highlight ? HIGHLIGHT_ICON[highlight.kind] : null;
  const shown = (swings || []).slice(0, 2);

  return (
    <SurfaceCard>
      <div style={{ ...labelStyle, ...tabular }}>{rangeLabel}</div>
      <div style={{ ...tight(26), fontFamily: body, fontWeight: 500, fontSize: 26, color: FEED_TEXT_HI, marginTop: 2, marginBottom: 14 }}>
        Your week
      </div>

      {/* Two, never three. At phone width a third tile turns readable
          numbers into a row of cramped ones. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <SurfaceTile>
          <div style={labelStyle}>Won / lost</div>
          <div style={{ marginTop: 4 }}>
            <StatNumeral size={32} tone="lime">{record.w}–{record.l}</StatNumeral>
          </div>
        </SurfaceTile>
        <SurfaceTile>
          <div style={labelStyle}>Rank</div>
          <div style={{ marginTop: 4 }}>
            <StatNumeral size={32} tone="hi">
              {rank}
              <span style={{ fontSize: 15, verticalAlign: "super", marginLeft: 1 }}>{ordinal(rank)}</span>
            </StatNumeral>
          </div>
          {movement && <div style={{ marginTop: 4 }}><MovementIndicator delta={movement.placesGained} size={12} /></div>}
        </SurfaceTile>
      </div>

      {shown.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
          {shown.map((s) => (
            <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID, whiteSpace: "nowrap" }}>{s.name}</span>
              <MovementIndicator delta={s.placesGained} size={12} />
            </span>
          ))}
        </div>
      )}

      <div style={{ ...labelStyle, marginBottom: 6 }}>Results</div>
      <div>
        {results.map((r, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 0",
              borderTop: i === 0 ? "none" : "1px solid " + FEED_HAIRLINE,
            }}
          >
            <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ fontWeight: 500 }}>{r.winnerName}</span>
              <span style={{ fontWeight: 400, color: FEED_TEXT_LOW }}>{r.drawn ? " drew with " : " beat "}</span>
              <span style={{ fontWeight: 400, color: FEED_TEXT_MID }}>{r.loserName}</span>
            </span>
            <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 15, color: FEED_TEXT_MID, flexShrink: 0 }}>
              {r.score || "—"}
            </span>
          </div>
        ))}
      </div>

      {highlight && HighlightIcon && (
        <SurfaceTile style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          <HighlightIcon size={18} color={FEED_LIME} strokeWidth={2} />
          <span style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_HI, lineHeight: 1.35 }}>{highlight.sentence}</span>
        </SurfaceTile>
      )}
    </SurfaceCard>
  );
}
