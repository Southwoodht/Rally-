"use client";
import React from "react";
import { FormDots, MovementIndicator, StatNumeral, type FormResult } from "@/components/ui/Surfaces";
import { FEED_LIME, FEED_LIME_DIVIDER, FEED_LIME_INK, FEED_LIME_INK_2, FEED_PAD, FEED_RADIUS, body, tabular } from "@/lib/theme";

// Where you stand, as the one thing you see first.
//
// The whole card is lime, so it isn't a SurfaceCard — those own the three
// dark surfaces and this is the accent. Everything on it is one ink at two
// volumes rather than a second palette.
//
// Presentational. Rank, rating, movement and form arrive finished; nothing
// here counts anything.

export interface StandingHeroProps {
  /** Place in the league. */
  rank: number;
  /** The number under "rating". */
  rating: number;
  /**
   * Places gained this week: positive climbed, negative dropped, zero held.
   *
   * null means there is no earlier snapshot to compare against, and the line
   * is hidden completely — not rendered as "0". Somebody nobody has measured
   * yet has not held station, and saying they did is inventing a fact. Zero
   * itself is a real answer and does show.
   */
  movement?: number | null;
  /** Recent results, oldest first. Up to five; fewer draws fewer dots. */
  form?: FormResult[];
}

const ordinalSuffix = (n: number): string => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] || "th";
};

const movementLabel = (delta: number): string => {
  if (delta === 0) return "Level this week";
  return (delta > 0 ? "Up " : "Down ") + Math.abs(delta) + " this week";
};

const labelStyle: React.CSSProperties = {
  fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_LIME_INK_2,
  textTransform: "uppercase", letterSpacing: 0.6,
};

export function StandingHero({ rank, rating, movement, form }: StandingHeroProps) {
  const hasMovement = movement !== null && movement !== undefined;
  const hasForm = !!form && form.length > 0;

  return (
    <div style={{ background: FEED_LIME, borderRadius: FEED_RADIUS, padding: FEED_PAD }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={labelStyle}>Your standing</div>
          <div style={{ marginTop: 4, display: "flex", alignItems: "baseline" }}>
            <StatNumeral size={52} tone="ink" style={{ letterSpacing: "-0.045em" }}>{rank}</StatNumeral>
            <StatNumeral size={24} tone="ink" style={{ letterSpacing: "-0.045em", marginLeft: 1 }}>{ordinalSuffix(rank)}</StatNumeral>
          </div>
        </div>
        {/* Baseline-aligned with the rank rather than centred, so two numerals
            of very different sizes sit on one line instead of floating. */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <StatNumeral size={26} tone="ink">{rating}</StatNumeral>
          <div style={{ ...labelStyle, marginTop: 2 }}>rating</div>
        </div>
      </div>

      {(hasMovement || hasForm) && (
        <>
          <div style={{ height: 1, background: FEED_LIME_DIVIDER, margin: "14px 0 12px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              {hasMovement && (
                <MovementIndicator delta={movement} tone="onAccent" size={13} label={movementLabel(movement as number)} />
              )}
            </span>
            {hasForm && <FormDots form={form!} ink={FEED_LIME_INK} />}
          </div>
        </>
      )}
    </div>
  );
}
