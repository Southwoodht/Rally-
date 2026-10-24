"use client";
import React, { useEffect, useLayoutEffect, useRef } from "react";
import { body } from "@/lib/theme";

/**
 * The first thing anybody sees.
 *
 * It replaced the word "Loading…" in 14px grey. The ball bounces because the
 * wait is the reason — CLAUDE.md's rule is that animation needs one, and
 * "this is still happening" is the clearest there is. `prefers-reduced-motion`
 * holds it still.
 *
 * ---
 *
 * REBUILT 27 Sep 2026. Sam: "The loading screen has a jolt kind of thing. Can
 * u make it more like the logo ball ... and have it smoothly bouncing."
 *
 * THE JOLT WAS THREE SCREENS, NOT ONE. A cold open shows this component three
 * times in a row — "Signing you in" (AuthGate), "Getting your leagues"
 * (Dashboard), "Loading your league" (RallyApp) — and each is a fresh mount.
 * The old version ran its entrance on every mount: the ball dropped in from
 * above and the words rose again, so every hand-off restarted the animation
 * mid-bounce. That was the jolt, and no amount of easing could fix it.
 *
 * So the three share ONE CLOCK. Every animation's delay is set, before the
 * first paint of each mount, to minus the time since this module loaded, so a
 * new mount joins the bounce at exactly the phase the old one left it. And
 * the arrival (a fade) happens once per page load, not once per mount. Across
 * a hand-off the only thing that changes is the line of text.
 *
 * THE BOUNCE IS SMOOTH ON PURPOSE. No squash on contact — the 70ms squash of
 * the old version was a second, smaller twitch. Up is ease-out, down is
 * ease-in, like a ball under gravity, and the turnaround at the floor is the
 * only sharp moment, which is what makes it read as a bounce rather than a
 * float. The ball also rolls slowly (one turn every two bounces) so the
 * seams move; a rigid disc going up and down reads as a UI element, a
 * turning one reads as a ball.
 *
 * THE BALL IS THE ICON'S BALL (since 2026-10-24): gold, with the two white
 * seams clipped to the circle, sitting beside the icon's S on the icon's
 * cream. The S stays still; the ball is what bounces and rolls.
 *
 * THE SHADOW is phase-locked to the bounce — same duration, contact at
 * 0%/100%, apex at 50%. If one changes the other must. Its fill is
 * FEED_DEEP, never black: black on this green reads as a hole, not a shadow.
 */

/** One bounce, floor to floor. */
const CYCLE_MS = 1200;
/** One full turn of the ball: two bounces, so it rolls, not spins. */
const SPIN_MS = CYCLE_MS * 2;
/** How high it goes. */
const HEIGHT = 34;

/** The icon's own colours (public/icon.svg). */
const SPLASH_BG = "#F8F4EB";
const SPLASH_INK = "#1C2D23";
const SPLASH_MUTED = "#6E6A5C";

/** Layout effect in the browser (before paint), plain effect on the server. */
const useBeforePaint = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** The shared clock: when the first loading screen of this page load appeared. */
let clockStart: number | null = null;
/** Whether the arrival fade has already been seen this page load. */
let arrived = false;

const CSS = `
  @keyframes rally-bounce {
    0%   { transform: translateY(0);          animation-timing-function: cubic-bezier(.2, .6, .35, 1); }
    50%  { transform: translateY(-${HEIGHT}px); animation-timing-function: cubic-bezier(.65, 0, .8, .4); }
    100% { transform: translateY(0); }
  }
  @keyframes rally-roll { to { transform: rotate(360deg); } }
  @keyframes rally-shadow {
    0%   { transform: scaleX(1);   opacity: .5;  animation-timing-function: cubic-bezier(.2, .6, .35, 1); }
    50%  { transform: scaleX(.55); opacity: .18; animation-timing-function: cubic-bezier(.65, 0, .8, .4); }
    100% { transform: scaleX(1);   opacity: .5; }
  }
  @keyframes rally-arrive { from { opacity: 0 } to { opacity: 1 } }

  .rally-hop    { animation: rally-bounce ${CYCLE_MS}ms infinite; will-change: transform; }
  .rally-roll   { animation: rally-roll ${SPIN_MS}ms linear infinite; transform-origin: 50% 50%; }
  .rally-shadow { animation: rally-shadow ${CYCLE_MS}ms infinite; transform-origin: 50% 50%; }
  .rally-arrive { animation: rally-arrive 450ms ease-out both; }

  @media (prefers-reduced-motion: reduce) {
    .rally-hop, .rally-roll, .rally-shadow { animation: none; }
    .rally-shadow { opacity: .4; }
  }
`;

export function LoadingScreen({ label = "Loading your club" }: { label?: string }) {
  const root = useRef<HTMLDivElement>(null);
  // Decided once per mount, before paint: only the first screen of a page
  // load fades in; the ones that follow it are already there.
  const firstRef = useRef<boolean | null>(null);
  if (firstRef.current === null) firstRef.current = !arrived;

  // Before the first paint of this mount: join the shared clock. A negative
  // delay starts an animation part-way through, so a remount carries on from
  // the phase the last one reached instead of starting the bounce over.
  useBeforePaint(() => {
    arrived = true;
    const el = root.current;
    // Once per screen. Re-setting a running animation's delay shifts it by
    // the new amount on top of the time it has already run, so a second pass
    // (React runs effects twice in development) would knock this screen out
    // of the very phase it is meant to share. Found by logging each
    // animation's start time and phase, not by watching it.
    if (!el || el.dataset.onClock) return;
    el.dataset.onClock = "1";
    // Everything is measured on the document timeline, which is the clock
    // CSS animations themselves run on.
    const now = (document.timeline?.currentTime as number | null) ?? performance.now();
    if (clockStart === null) {
      // The FIRST screen is left exactly as it is, and the clock is read off
      // it rather than set here. It is drawn by the server and starts
      // animating when that HTML paints — before this code has run — so
      // "now" would be late and the next screen would join out of phase.
      // Measured: a 20px jump at the first hand-off until this read the
      // animation's real start time.
      const hop = el.querySelector<HTMLElement>(".rally-hop");
      const started = hop?.getAnimations?.()[0]?.startTime;
      clockStart = typeof started === "number" ? started : now;
      return;
    }
    const elapsed = now - clockStart;
    el.querySelectorAll<HTMLElement>("[data-cycle]").forEach((node) => {
      node.style.animationDelay = `-${elapsed % Number(node.dataset.cycle)}ms`;
    });
  }, []);

  // The icon on its own cream (Sam, 2026-10-24: the splash should match the
  // home-screen icon): the S still, the gold ball beside it doing the
  // bouncing, on the shared clock as before. Fixed colours rather than theme
  // tokens, because this is the icon and the icon is the same in every theme.
  return (
    <div ref={root} style={{ minHeight: "100vh", background: SPLASH_BG, display: "grid", placeItems: "center", padding: 24 }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className={firstRef.current ? "rally-arrive" : undefined} style={{ textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4 }}>
          <svg width="74" height="102" viewBox="20 21 46 63" aria-hidden="true" style={{ display: "block" }}>
            <path fill={SPLASH_INK} d="M44.28 82.84L44.28 82.84Q40.59 82.84 38.19 81.75Q35.80 80.66 34.45 79.56Q33.11 78.47 32.60 78.47L32.60 78.47Q32.23 78.47 31.45 79.17Q30.67 79.86 29.73 80.78Q28.78 81.71 27.96 82.40Q27.14 83.09 26.68 83.09L26.68 83.09Q26.43 83.09 26.09 82.86Q25.76 82.63 25.67 82.25L25.67 82.25L22.69 62.76Q22.65 62.47 22.69 62.30Q22.73 62.13 22.82 62.09L22.82 62.09Q22.95 62.01 23.09 62.11Q23.24 62.22 23.36 62.43L23.36 62.43Q27.44 70.32 30.88 74.55Q34.33 78.77 37.31 80.36Q40.29 81.96 43.06 81.96L43.06 81.96Q47.35 81.96 49.89 79.69Q52.43 77.42 52.43 72.80L52.43 72.80Q52.43 69.86 51.27 67.49Q50.12 65.12 47.39 63.18Q44.66 61.25 39.91 59.61L39.91 59.61Q33.11 57.26 29.01 54.34Q24.92 51.42 23.09 47.83Q21.26 44.24 21.26 39.79L21.26 39.79Q21.26 34.62 23.93 30.70Q26.60 26.77 31.32 24.56Q36.05 22.36 42.27 22.36L42.27 22.36Q45.50 22.36 47.64 23.12Q49.78 23.87 51.11 24.63Q52.43 25.38 53.10 25.38L53.10 25.38Q53.77 25.38 55.14 24.56Q56.50 23.75 57.81 22.93Q59.11 22.11 59.70 22.11L59.70 22.11Q59.91 22.11 60.14 22.25Q60.37 22.40 60.41 22.78L60.41 22.78L65.03 41.72Q65.07 42.06 65.03 42.18Q64.99 42.31 64.86 42.39L64.86 42.39Q64.78 42.44 64.61 42.35Q64.44 42.27 64.36 42.10L64.36 42.10Q59.86 34.54 56.27 30.45Q52.68 26.35 49.51 24.82Q46.34 23.28 43.19 23.28L43.19 23.28Q39.28 23.28 36.78 25.91Q34.28 28.53 34.28 33.03L34.28 33.03Q34.28 36.09 35.38 38.53Q36.47 40.97 39.03 42.94Q41.59 44.91 46.05 46.47L46.05 46.47Q53.19 48.99 57.32 51.84Q61.46 54.70 63.20 58.10Q64.95 61.50 64.95 65.70L64.95 65.70Q64.95 70.49 62.49 74.38Q60.03 78.26 55.41 80.55Q50.79 82.84 44.28 82.84Z" />
          </svg>
          <div style={{ height: 30 + HEIGHT, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", marginBottom: 2 }}>
            <div className="rally-hop" data-cycle={CYCLE_MS}>
              <svg className="rally-roll" data-cycle={SPIN_MS} width="28" height="28" viewBox="70.5 64.5 17 17" aria-hidden="true" style={{ display: "block" }}>
                <defs>
                  <radialGradient id="rally-loader-gold" cx="0.35" cy="0.3" r="0.85"><stop offset="0" stopColor="#F0D488" /><stop offset="1" stopColor="#C99D3B" /></radialGradient>
                  <clipPath id="rally-loader-ball"><circle cx="79" cy="73" r="8.5" /></clipPath>
                </defs>
                <circle cx="79" cy="73" r="8.5" fill="url(#rally-loader-gold)" />
                <g clipPath="url(#rally-loader-ball)" fill="none" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round">
                  <path d="M70.5 66.6 Q77.7 73 70.5 79.4" />
                  <path d="M87.5 66.6 Q80.3 73 87.5 79.4" />
                </g>
              </svg>
            </div>
            <div className="rally-shadow" data-cycle={CYCLE_MS} style={{ width: 22, height: 5, borderRadius: "50%", background: "#CDBF9F", marginTop: 4 }} />
          </div>
        </div>
        {/* The one thing that changes between the three screens. */}
        <div key={label} className="rally-arrive" style={{ fontFamily: body, fontWeight: 500, fontSize: 14, color: SPLASH_MUTED, marginTop: 18 }}>
          {label}
        </div>
      </div>
    </div>

  );
}
