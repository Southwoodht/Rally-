"use client";
import React, { useEffect, useLayoutEffect, useRef } from "react";
import { FEED_DEEP, FEED_LIME, FEED_PAGE, FEED_TEXT_MID, body, display } from "@/lib/theme";

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
 * THE BALL IS THE ICON'S BALL: solid accent, two seams cut into it in the
 * page colour and clipped to the circle so their round caps cannot poke out
 * past the edge (the same clip the icon master uses, for the same reason).
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
const HEIGHT = 42;

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

export function LoadingScreen({ label = "Loading your league" }: { label?: string }) {
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

  return (
    <div ref={root} style={{ minHeight: "100vh", background: FEED_PAGE, display: "grid", placeItems: "center", padding: 24 }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className={firstRef.current ? "rally-arrive" : undefined} style={{ textAlign: "center" }}>
        <div style={{ height: 40 + HEIGHT, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
          <div className="rally-hop" data-cycle={CYCLE_MS}>
            <svg className="rally-roll" data-cycle={SPIN_MS} width="38" height="38" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
              <defs>
                <clipPath id="rally-loader-ball">
                  <circle cx="12" cy="12" r="11" />
                </clipPath>
              </defs>
              <circle cx="12" cy="12" r="11" fill={FEED_LIME} />
              {/* The two seams, bowed towards each other as on the icon. */}
              <g clipPath="url(#rally-loader-ball)" fill="none" stroke={FEED_PAGE} strokeWidth="1.9" strokeLinecap="round">
                <path d="M3.6 3.4 Q10.2 12 3.6 20.6" />
                <path d="M20.4 3.4 Q13.8 12 20.4 20.6" />
              </g>
            </svg>
          </div>
          <div className="rally-shadow" data-cycle={CYCLE_MS} style={{ width: 30, height: 6, borderRadius: "50%", background: FEED_DEEP, marginTop: 6 }} />
        </div>

        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 30, letterSpacing: "0.02em", textTransform: "uppercase", color: FEED_LIME, marginTop: 22, lineHeight: 1 }}>
          Southwood
        </div>
        {/* The one thing that changes between the three screens. */}
        <div key={label} className="rally-arrive" style={{ fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_TEXT_MID, marginTop: 8 }}>
          {label}
        </div>
      </div>
    </div>
  );
}
