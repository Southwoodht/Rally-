"use client";
import React, { useEffect, useState } from "react";
import { body } from "@/lib/theme";

/**
 * A panel that turns through several answers to one question.
 *
 * Three of these sit on Home now — your standing across your leagues, your
 * record over three spans, and who you played over the same three — and they
 * are next to each other on purpose. Which means they cannot each keep their
 * own timer: three panels started at three different moments, all turning
 * every four seconds, is a corner of the screen that never settles.
 *
 * So there is one clock for the whole screen. Every panel advances on the
 * same beat whatever it is showing and however many slides it has, and a tap
 * on any of them moves all of them. The lists are different lengths — a
 * standing has one slide or four, a span always has three — and that is fine:
 * each takes the beat modulo its own length, so they stay on the same
 * heartbeat without having to agree about anything else.
 */

const DWELL_MS = 4200;
/** The dissolve. Long enough to read as a turn rather than a flicker. */
const FADE_MS = 240;

// ---- the shared clock ---------------------------------------------------
//
// Module state rather than a context, for the same reason MessageRobins keeps
// its last-count outside React: the panels mount and unmount independently as
// tabs change, and a beat that resets whenever one of them remounts would put
// the others out of step with it. Subscribers joining late are handed the
// current beat, so a panel that appears halfway through is already in time.

let beat = 0;
const subscribers = new Set<(n: number) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function fire() {
  beat++;
  subscribers.forEach((f) => f(beat));
}

function start() {
  if (timer) clearInterval(timer);
  timer = setInterval(fire, DWELL_MS);
}

function subscribe(fn: (n: number) => void): () => void {
  subscribers.add(fn);
  if (!timer) start();
  return () => {
    subscribers.delete(fn);
    if (!subscribers.size && timer) { clearInterval(timer); timer = null; beat = 0; }
  };
}

/** Move everything on now, and restart the dwell so the next turn is a full
 *  interval away rather than whatever was left of one. */
function advanceAll() {
  fire();
  if (timer) start();
}

// ---- the panel ----------------------------------------------------------

export interface CyclerProps {
  /** One per slide, in order. Its own label is the panel's heading. */
  labels: string[];
  /** Draws slide `i`. Called for the visible slide only. */
  render: (i: number) => React.ReactNode;
  /** Ink for the label and dots — a dark card or the lime one. */
  labelColor: string;
  dotColor: string;
  /** Reserved for the tallest slide, so a turn never changes the page height. */
  minBodyHeight?: number;
  /** Extra styles for the heading row. */
  labelStyle?: React.CSSProperties;
  /** Announced to a screen reader in place of the raw slide. */
  ariaLabel?: string;
}

export function Cycler({ labels, render, labelColor, dotColor, minBodyHeight, labelStyle, ariaLabel }: CyclerProps) {
  const count = labels.length;

  // Somebody who has asked their phone to stop moving things has asked for
  // this too. They keep the tap, and lose only the turning-on-its-own.
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  const [tick, setTick] = useState(beat);
  useEffect(() => {
    if (count < 2) return;
    return subscribe(setTick);
  }, [count]);

  const target = count ? ((tick % count) + count) % count : 0;
  const [shown, setShown] = useState(target);
  const [lit, setLit] = useState(true);

  // Dissolve out, swap underneath, dissolve back. Both halves are the same
  // 240ms, so a turn takes about half a second of a four-second dwell — a
  // fade rather than a cut, which is the whole of what was asked for.
  useEffect(() => {
    if (target === shown) return;
    if (still) { setShown(target); return; }
    setLit(false);
    const id = setTimeout(() => { setShown(target); setLit(true); }, FADE_MS);
    return () => clearTimeout(id);
  }, [target, shown, still]);

  const many = count > 1;

  return (
    <div
      onClick={many ? advanceAll : undefined}
      role={many ? "button" : undefined}
      tabIndex={many ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={many ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); advanceAll(); } } : undefined}
      style={{ cursor: many ? "pointer" : "default" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontFamily: body, fontWeight: 400, fontSize: 12, color: labelColor,
            flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            opacity: lit ? 1 : 0, transition: `opacity ${FADE_MS}ms ease`,
            ...labelStyle,
          }}
        >
          {labels[shown]}
        </span>
        {/* Which of them you are on. Dots read as a position in a set; "2/3"
            reads as a number somebody wants you to do something with. */}
        {many && (
          <span style={{ display: "flex", gap: 3, flexShrink: 0 }} aria-hidden="true">
            {labels.map((l, x) => (
              <span
                key={l}
                style={{
                  width: 5, height: 5, borderRadius: 3, background: dotColor,
                  opacity: x === target ? 1 : 0.3, transition: "opacity .3s ease",
                }}
              />
            ))}
          </span>
        )}
      </div>
      <div
        style={{
          minHeight: minBodyHeight,
          opacity: lit ? 1 : 0,
          transform: lit ? "none" : "translateY(4px)",
          transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
        }}
      >
        {render(shown)}
      </div>
    </div>
  );
}
