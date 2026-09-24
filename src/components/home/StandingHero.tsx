"use client";
import React from "react";
import { Cycler } from "@/components/ui/Cycler";
import { FormDots, MovementIndicator, StatNumeral, type FormResult } from "@/components/ui/Surfaces";
import { FEED_HERO, FEED_LIME_DIVIDER, FEED_LIME_INK_2, FEED_LOSS_ON_HERO, FEED_ON_HERO, FEED_PAD, FEED_RADIUS, FEED_WIN_ON_HERO, body, display, tabular } from "@/lib/theme";

// Where you stand, as the one thing you see first.
//
// The whole card is lime, so it isn't a SurfaceCard — those own the three
// dark surfaces and this is the accent. Everything on it is one ink at two
// volumes rather than a second palette.
//
// Presentational. Rank, rating, movement and form arrive finished; nothing
// here counts anything.

/**
 * What the league slides call their number.
 *
 * "all time" is in the caption because it is TRUE and currently unavoidable:
 * Home computes Official over every match a league has ever had, while the
 * Table computes it over the season-and-year filter showing on that screen.
 * Both are Official points and they are entitled to differ — but only if the
 * card says which one it is. Aligning them is a separate job; see the report.
 */
export const OFFICIAL_UNIT = "official · all time";

export interface Standing {
  /**
   * Where this place is — the league's name, or "Across Rally". It replaces
   * "Your standing" as the label, because with more than one of these the
   * scope is the thing you need to know and "your standing" is obvious from
   * the card it is on.
   */
  scope: string;
  /** Place. Null where there is a standing but no place to print — a
   *  provisional player on the global table gets a dash there, and a number
   *  here would contradict the screen it came from. */
  rank: number | null;
  /** What to say instead of a place. */
  note?: string | null;
  /** The number under the caption. */
  rating: number;
  /**
   * What that number IS, printed under it.
   *
   * It used to say "rating" on every slide, and the slides do not all carry
   * the same metric: your league is Official points and Across Rally is the
   * network rating x100. One word over two scales is how 78 and 778 come to
   * look like the same measurement disagreeing with itself.
   */
  unit?: string;
  movement?: number | null;
  form?: FormResult[];
  /**
   * A line for the footer row on a slide that has no movement and no form.
   *
   * That row is reserved on every slide so the card keeps its height, and a
   * reserved row with nothing in it is just a gap under a rule. Only your own
   * league has weekly movement and recent form — the rank snapshots are
   * per-league — so without this the global slide and every other-league
   * slide would show an empty one. "of 48 ranked" is the thing a place number
   * is missing anyway: #6 means nothing until you know six of what.
   */
  footer?: string | null;
}

export interface StandingHeroProps {
  /** Place in the league. */
  rank: number;
  /** The number under the caption. */
  rating: number;
  /** What that number is. See Standing.unit. */
  unit?: string;
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
  /**
   * Every standing to cycle through, this league first. When absent or empty
   * the card falls back to the four props above as a single slide, so a
   * caller that has only one standing needs to know nothing about cycling.
   */
  standings?: Standing[] | null;
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

// Sentence case, like the rest of the app. These two were the last labels
// still shouting.
const labelStyle: React.CSSProperties = {
  fontFamily: body, fontWeight: 400, fontSize: 11.5, color: FEED_LIME_INK_2,
  letterSpacing: 0,
};

/**
 * The word under the number, in the Table leader card's exact treatment.
 *
 * Deliberately identical to StandingsList: the two cards are the same shape in
 * the same lime and the caption is doing the same job on both, so a caption
 * that looked different here would read as a different kind of thing.
 */
// The mockup's caption: 11px, weight 600, letter-spacing 1.6, 6px above.
const unitStyle: React.CSSProperties = {
  fontFamily: body, fontWeight: 600, fontSize: 11, color: FEED_ON_HERO,
  textTransform: "uppercase", letterSpacing: 1.6, marginTop: 6,
  whiteSpace: "nowrap",
};

/**
 * One card, one standing at a time, on a loop.
 *
 * Your league, then across Rally, then any other league you are in — the same
 * cycle as the tile below, because they are the same idea: several answers to
 * one question that will not fit side by side on a phone. Tap moves it on.
 *
 * The extra standings arrive after the first paint (one is an RPC, the rest
 * are a league load each), so this renders with one and grows to three or
 * four. That is deliberate: the league you are looking at is the one you came
 * for, and it should not wait behind a network call for the others.
 */
export function StandingHero({ rank, rating, unit, movement, form, standings }: StandingHeroProps) {
  const list: Standing[] = standings && standings.length
    ? standings
    : [{ scope: "Your standing", rank, rating, unit, movement, form }];

  // The card must not change height as it turns. Slides carry different
  // things — your own league has movement and form, a global standing has
  // neither, and "3 played" is a shorter numeral than a 52px rank — so
  // without this the whole page below jumps every four seconds. The footer
  // row is reserved whenever ANY slide will use it, and Cycler holds the
  // body's height for the rest.
  const anyFooter = list.some((s2) => (s2.movement !== null && s2.movement !== undefined) || (!!s2.form && s2.form.length > 0) || !!s2.footer);

  const slide = (i: number) => {
    const cur = list[i];
    const hasMovement = cur.movement !== null && cur.movement !== undefined;
    const hasForm = !!cur.form && cur.form.length > 0;
    return (
      <>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", minHeight: 58 }}>
              {cur.rank === null ? (
                <StatNumeral size={30} tone="ink" style={{ letterSpacing: "-0.03em" }}>{cur.note || "Unplaced"}</StatNumeral>
              ) : (
                <>
                  {/* 64 with a 26 suffix, letter-spacing -2 and 0 — the
                      mockup's exact figures. The suffix deliberately does NOT
                      inherit the tracking; at 26px it would collide. */}
                  <span style={{ fontFamily: display, fontWeight: 700, fontSize: 64, lineHeight: 1, letterSpacing: "-2px", color: FEED_ON_HERO }}>{cur.rank}</span>
                  <span style={{ fontFamily: display, fontWeight: 700, fontSize: 26, lineHeight: 1, letterSpacing: 0, color: FEED_ON_HERO }}>{ordinalSuffix(cur.rank)}</span>
                </>
              )}
            </div>
          </div>
          {/* Baseline-aligned with the rank rather than centred, so two numerals
              of very different sizes sit on one line instead of floating. */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontFamily: display, fontWeight: 700, fontSize: 34, lineHeight: 1, color: FEED_ON_HERO }}>{cur.rating}</div>
            <div style={unitStyle}>{cur.unit || "rating"}</div>
          </div>
        </div>

        {anyFooter && (
          <>
            <div style={{ height: 1, background: FEED_LIME_DIVIDER, margin: "14px 0 12px" }} />
            {/* A fixed height, not a minimum. The three things that can sit
                here are different heights — a movement arrow, a row of form
                dots, and a line of 12.5px text — and a minimum let the text
                one run 7px taller, which moved everything below the card by
                7px every four seconds. Measured, then pinned. */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, height: 18 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                {hasMovement ? (
                  <MovementIndicator delta={cur.movement} tone="onAccent" size={13} label={movementLabel(cur.movement as number)} />
                ) : cur.footer ? (
                  <span style={{ ...labelStyle, fontSize: 12.5, lineHeight: 1, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cur.footer}</span>
                ) : null}
              </span>
              {/* Dots drawn ON cream need their own pair — the page's win and
                  loss colours have nothing to sit against here. §1 names them
                  --win-on-hero and --loss-on-hero. */}
              {hasForm && <FormDots form={cur.form!} tone="ink" ink={FEED_WIN_ON_HERO} lossInk={FEED_LOSS_ON_HERO} />}
            </div>
          </>
        )}
      </>
    );
  };

  return (
    // Cream, per §2: this is the biggest filled surface in the app and the
    // single clearest case of "if the old lime filled a big card, it becomes
    // cream". 20px vertical / 18px horizontal padding, radius 26.
    <div style={{ background: FEED_HERO, color: FEED_ON_HERO, borderRadius: FEED_RADIUS, padding: "20px " + FEED_PAD + "px" }}>
      <Cycler
        labels={list.map((s2) => s2.scope)}
        render={slide}
        labelColor={FEED_LIME_INK_2}
        dotColor={FEED_ON_HERO}
        ariaLabel="Where you stand, by league"
      />
    </div>
  );
}
