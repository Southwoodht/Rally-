"use client";
import React from "react";
import { Award, Flame, TrendingUp } from "lucide-react";
import { Cycler } from "@/components/ui/Cycler";
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

export interface RoundupPeriod {
  /** The heading inside the card — "Your week", "Your month", "Your year". */
  title: string;
  /** Already formatted, and the Cycler's own label — "31 Aug – 6 Sep",
   *  "September so far", "2026 so far". Must be distinct across the set: it
   *  is the key on the position dots. */
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
  /** Results there was no room to print. The card says so rather than
   *  quietly showing five of nineteen. */
  more?: number;
  highlight?: { kind: "climb" | "streak" | "firstWin"; sentence: string } | null;
}

export interface WeeklyRoundupCardProps {
  /** Narrowest first. One slide each, on the shared clock. */
  periods: RoundupPeriod[];
}

const ordinal = (n: number): string => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] || "th";
};

const HIGHLIGHT_ICON = { climb: TrendingUp, streak: Flame, firstWin: Award };

const labelStyle: React.CSSProperties = { fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW };

export function WeeklyRoundupCard({ periods }: WeeklyRoundupCardProps) {
  const slide = (i: number) => {
    const p = periods[i];
    return <Period p={p} />;
  };

  return (
    <SurfaceCard>
      {/* The range is the Cycler's own label, which is where the 12px line
          and the position dots already live — so the card keeps exactly the
          shape it had and gains the turning. */}
      <Cycler
        labels={periods.map((p) => p.rangeLabel)}
        render={slide}
        labelColor={FEED_TEXT_LOW}
        dotColor={FEED_LIME}
        labelStyle={tabular}
        // Only when it can actually turn. One slide cannot jump, and
        // reserving the tallest height for it would just be dead space.
        minBodyHeight={periods.length > 1 ? bodyHeightFor(periods) : undefined}
        ariaLabel="Your record, by period"
      />
    </SurfaceCard>
  );
}

/**
 * Reserved so a turn never changes the page height.
 *
 * A fixed number will not do here. The slides differ by whole result rows — a
 * week with two against a year with five — which is about 160px, where the
 * standing card's version of this bug was 7px and was still worth pinning.
 * Every five seconds the composer and the whole feed below would step up and
 * down.
 *
 * So it is computed from the set actually being shown: the tallest slide
 * decides, and a card whose periods all hold two results reserves room for
 * two rather than for five. Nothing is measured from the DOM — these are the
 * component's own paddings, listed where they are used so a layout change
 * that breaks the arithmetic is at least next to it.
 */
const ROW_H = 40;          // 15px line + 9px padding either side, plus a hairline
const HEAD_H = 196;        // title, the two tiles, and the "Results" label
const MORE_H = 22;         // "and 54 more"
const HIGHLIGHT_H = 62;    // the tile, plus its margin

function bodyHeightFor(periods: RoundupPeriod[]): number {
  return periods.reduce((tallest, p) => {
    const h = HEAD_H
      + p.results.length * ROW_H
      + (p.more ? MORE_H : 0)
      + (p.highlight ? HIGHLIGHT_H : 0)
      + ((p.swings || []).length ? 30 : 0);
    return Math.max(tallest, h);
  }, 0);
}

function Period({ p }: { p: RoundupPeriod }) {
  const { record, rank, movement, swings, results, more, highlight, title } = p;
  const HighlightIcon = highlight ? HIGHLIGHT_ICON[highlight.kind] : null;
  const shown = (swings || []).slice(0, 2);

  return (
    <>
      <div style={{ ...tight(26), fontFamily: body, fontWeight: 500, fontSize: 26, color: FEED_TEXT_HI, marginTop: 2, marginBottom: 14 }}>
        {title}
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

      {/* Said out loud rather than left as a short list pretending to be the
          whole one. A year has more results than a card, and "and 14 more" is
          the difference between a summary and a wrong number. */}
      {!!more && more > 0 && (
        <div style={{ ...labelStyle, marginTop: 8 }}>and {more} more</div>
      )}

      {highlight && HighlightIcon && (
        <SurfaceTile style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          <HighlightIcon size={18} color={FEED_LIME} strokeWidth={2} />
          <span style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_HI, lineHeight: 1.35 }}>{highlight.sentence}</span>
        </SurfaceTile>
      )}
    </>
  );
}
