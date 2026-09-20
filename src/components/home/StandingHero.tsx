"use client";
import React, { useEffect, useState } from "react";
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

/** How long each standing is up. Matched to the tile below it, so the two
 *  do not turn at slightly different rhythms in the corner of your eye. */
const DWELL_MS = 4200;

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
  /** The number under "rating". */
  rating: number;
  movement?: number | null;
  form?: FormResult[];
}

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
export function StandingHero({ rank, rating, movement, form, standings }: StandingHeroProps) {
  const list: Standing[] = standings && standings.length
    ? standings
    : [{ scope: "Your standing", rank, rating, movement, form }];
  const n = list.length;
  const [i, setI] = useState(0);

  const [still, setStill] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    if (n < 2 || still) return;
    const id = setInterval(() => setI((x) => (x + 1) % n), DWELL_MS);
    return () => clearInterval(id);
  }, [n, still]);

  const cur = list[i % n];
  const hasMovement = cur.movement !== null && cur.movement !== undefined;
  const hasForm = !!cur.form && cur.form.length > 0;

  // The card must not change height as it turns. Slides carry different
  // things — your own league has movement and form, a global standing has
  // neither, and "3 played" is a shorter numeral than a 52px rank — so
  // without this the whole page below the card jumps every four seconds.
  // The footer row is reserved whenever ANY slide will use it, and the
  // numeral row keeps the tall line's height whatever is in it.
  const anyFooter = list.some((s2) => (s2.movement !== null && s2.movement !== undefined) || (!!s2.form && s2.form.length > 0));

  return (
    <div
      onClick={n > 1 ? () => setI((x) => (x + 1) % n) : undefined}
      role={n > 1 ? "button" : undefined}
      tabIndex={n > 1 ? 0 : undefined}
      onKeyDown={n > 1 ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setI((x) => (x + 1) % n); } } : undefined}
      style={{ background: FEED_LIME, borderRadius: FEED_RADIUS, padding: FEED_PAD, cursor: n > 1 ? "pointer" : "default" }}
    >
      <style>{"@keyframes rally-standing-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.rally-standing{animation:none!important}}"}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <span style={{ ...labelStyle, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cur.scope}</span>
        {n > 1 && (
          <span style={{ display: "flex", gap: 3, flexShrink: 0 }} aria-hidden="true">
            {list.map((s2, x) => (
              <span key={s2.scope} style={{ width: 5, height: 5, borderRadius: 3, background: FEED_LIME_INK, opacity: x === i % n ? 1 : 0.28, transition: "opacity .3s ease" }} />
            ))}
          </span>
        )}
      </div>
      <div key={cur.scope} className="rally-standing" style={{ animation: "rally-standing-in .32s ease both" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", minHeight: 58 }}>
            {cur.rank === null ? (
              <StatNumeral size={30} tone="ink" style={{ letterSpacing: "-0.03em" }}>{cur.note || "Unplaced"}</StatNumeral>
            ) : (
              <>
                <StatNumeral size={52} tone="ink" style={{ letterSpacing: "-0.045em" }}>{cur.rank}</StatNumeral>
                <StatNumeral size={24} tone="ink" style={{ letterSpacing: "-0.045em", marginLeft: 1 }}>{ordinalSuffix(cur.rank)}</StatNumeral>
              </>
            )}
          </div>
        </div>
        {/* Baseline-aligned with the rank rather than centred, so two numerals
            of very different sizes sit on one line instead of floating. */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <StatNumeral size={26} tone="ink">{cur.rating}</StatNumeral>
          <div style={{ ...labelStyle, marginTop: 2 }}>rating</div>
        </div>
      </div>

      {anyFooter && (
        <>
          <div style={{ height: 1, background: FEED_LIME_DIVIDER, margin: "14px 0 12px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 17 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              {hasMovement && (
                <MovementIndicator delta={cur.movement} tone="onAccent" size={13} label={movementLabel(cur.movement as number)} />
              )}
            </span>
            {hasForm && <FormDots form={cur.form!} tone="ink" ink={FEED_LIME_INK} />}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
