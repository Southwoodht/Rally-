"use client";
import React, { useEffect, useLayoutEffect, useRef } from "react";
import { body } from "@/lib/theme";
import { BALL_DEFS, BALL_SVG, MARK_BG, MARK_INK, MARK_VIEWBOX, MARK_WIDTH, S_PATH } from "@/lib/splashMark";

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
const HEIGHT = 14; // in the drawing's units (about 18px on a phone)

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
/** Loading screens on the page right now (the cold open hands between three). */
let mountedCount = 0;
/** Whether the splash has lifted off the app once this page load. After
 *  that, a club switch shows the skeleton instead of the splash. */
let revealed = false;
export const splashHasLifted = () => revealed;

const REDUCED = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * THE HAND-OFF TO HOME (Sam, 2026-10-31, launch screen brief). When the last
 * loading screen of an open unmounts, the app is already underneath.
 *  - If the launch cover (#sw-splash, layout.tsx) is still up, it is told to
 *    go: it fades 300ms ease-out with the S growing to 1.04, never before
 *    400ms from the tap.
 *  - If the cover already went at its 1.5s limit, this screen was showing
 *    instead; a copy of it is left on top and leaves the same way.
 *  - Warm opens and reduce motion (data-splash="off") just cut.
 * If another loading screen mounts in the meantime — a hand-off, not the end
 * — nothing happens.
 */
function liftSplash(from: HTMLElement) {
  // Hidden (signed out: the landing page is showing, not this): nothing to
  // lift, and not "shown" either, so the wait after signing in still gets
  // this screen rather than the skeleton.
  const visible = !!from.getClientRects().length;
  const copy = visible ? (from.cloneNode(true) as HTMLElement) : null;
  if (copy) {
    copy.removeAttribute("data-on-clock");
    Object.assign(copy.style, { zIndex: "9999", pointerEvents: "none" });
    copy.setAttribute("aria-hidden", "true");
    copy.setAttribute("data-no-arrive", "");
    copy.querySelectorAll(".rally-arrive").forEach((n) => n.classList.remove("rally-arrive"));
    document.body.appendChild(copy);
    // A cloned node restarts its animations; put it back on the shared clock.
    const now = (document.timeline?.currentTime as number | null) ?? performance.now();
    const elapsed = clockStart === null ? 0 : now - clockStart;
    copy.querySelectorAll<HTMLElement>("[data-cycle]").forEach((node) => {
      node.style.animationDelay = `-${elapsed % Number(node.dataset.cycle)}ms`;
    });
  }
  requestAnimationFrame(() => {
    if (mountedCount > 0) { copy?.remove(); return; }
    const cover = (window as any).__swSplashOut as (() => void) | null | undefined;
    if (cover) cover();
    if (!visible) return;
    revealed = true;
    const off = document.documentElement.getAttribute("data-splash") === "off";
    if (!copy || cover || off || REDUCED()) { copy?.remove(); return; }
    const mark = copy.querySelector<HTMLElement>(".sw-mark");
    copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease-out", fill: "forwards" }).onfinish = () => copy.remove();
    mark?.animate([{ transform: "scale(1)" }, { transform: "scale(1.04)" }], { duration: 300, easing: "ease-out", fill: "forwards" });
    // Belt and braces: never leave a splash over the app.
    window.setTimeout(() => copy.remove(), 800);
  });
}

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

  .rally-hop    { animation: rally-bounce ${CYCLE_MS}ms infinite; }
  .rally-roll   { animation: rally-roll ${SPIN_MS}ms linear infinite; transform-box: fill-box; transform-origin: 50% 50%; }
  .rally-shadow { animation: rally-shadow ${CYCLE_MS}ms infinite; transform-box: fill-box; transform-origin: 50% 50%; }
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
  // Counted, and lifted off on the way out (see liftSplash).
  useBeforePaint(() => {
    mountedCount += 1;
    const el = root.current;
    return () => {
      mountedCount -= 1;
      if (el && mountedCount === 0) liftSplash(el);
    };
  }, []);

  useBeforePaint(() => {
    const el = root.current;
    // Only a splash somebody SAW counts as arrived: the one hidden behind the
    // landing page must not stop the first visible one (after signing in)
    // fading in — it used to pop up at full strength.
    if (el && el.getClientRects().length) arrived = true;
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

  // The mark exactly where the launch picture and the cover put it
  // (lib/splashMark.ts): one drawing, centred on the whole screen at
  // MARK_WIDTH, so nothing jumps between them. Only the ball moves here — it
  // bounces and rolls in the drawing's own units — and the words sit below,
  // outside the centring, so they never push the mark off its spot.
  return (
    <div ref={root} data-no-arrive="" style={{ position: "fixed", inset: 0, background: MARK_BG, display: "grid", placeItems: "center", zIndex: 1 }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sw-mark" style={{ position: "relative", width: MARK_WIDTH }}>
        <svg viewBox={MARK_VIEWBOX} aria-hidden="true" style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
          {/* Own ids: the cover's copies of these may be display:none, and a
              gradient inside a hidden element paints nothing. */}
          <defs dangerouslySetInnerHTML={{ __html: BALL_DEFS.replace(/sw-mark-/g, "sw-load-") }} />
          <ellipse className="rally-shadow" data-cycle={CYCLE_MS} cx="79" cy="83.4" rx="6" ry="1.1" fill="#CDBF9F" />
          <path fill={MARK_INK} d={S_PATH} />
          <g className="rally-hop" data-cycle={CYCLE_MS}>
            <g className="rally-roll" data-cycle={SPIN_MS} dangerouslySetInnerHTML={{ __html: BALL_SVG.replace(/sw-mark-/g, "sw-load-") }} />
          </g>
        </svg>
        {/* The one thing that changes between the loading screens. */}
        <div key={label} className="rally-arrive" style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", fontFamily: body, fontWeight: 600, fontSize: 14, color: SPLASH_MUTED, marginTop: 22 }}>
          {label}
        </div>
      </div>
    </div>
  );
}
