"use client";
import { useEffect } from "react";

/**
 * Swipe from the left edge to go back, the iPhone way (Sam, 2026-11-02:
 * "when u swipe left to right it automatically goes back — most apps do
 * it"). Safari's own back-swipe does not exist in a home-screen web app,
 * and the app does not use browser history for its screens anyway, so this
 * is the app's own.
 *
 * WHAT "BACK" MEANS: the screen's own Back button. Every one in the app is a
 * button carrying the left chevron or aria-label="Back" (profile, public
 * profile, Messages, Find a player, Global, Compare, a competition, Run your
 * club's pages, the mixer, Plan next season...). The gesture takes the Back
 * of the screen under the finger (its fixed layer, else the page column),
 * even when that Back has scrolled out of view above; failing that, a
 * visible uncovered one in the top-left (elementFromPoint, so a Back buried
 * under an open profile is never the one pressed) — and presses it. So it always does exactly what tapping
 * Back does; nothing new to keep in step. No Back button on screen (a main
 * tab), no gesture.
 *
 * HOW IT FEELS (made easier the same day, Sam: "not as easy and smooth as
 * others — you have to go all the way"): the swipe can start ANYWHERE, not
 * just the edge, as long as it goes rightwards and mostly sideways — a
 * vertical scroll, a text box or a sideways-scrolling strip is left alone.
 * The screen Back would close (the fixed layer the button sits in, else the
 * page column) follows the finger with a soft shadow; let go past a quarter
 * of the width, or flick (0.3px/ms over the last 100ms, 30px is enough),
 * and it carries on off at the finger's speed and Back is pressed;
 * otherwise it springs home. Under reduce motion
 * nothing slides — a long enough swipe just goes back.
 */

/** Swipes that start here are someone using a control, not going back. */
function ownsSideways(target: EventTarget | null): boolean {
  for (let el = target as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    if (el.matches?.('input, textarea, select, [contenteditable="true"], [data-no-swipe]')) return true;
    const cs = getComputedStyle(el);
    if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 2) return true;
  }
  return false;
}

const isBack = (el: HTMLElement) =>
  (el.getAttribute("aria-label") === "Back" || !!el.querySelector("svg.lucide-chevron-left")) && !(el as HTMLButtonElement).disabled;

/** The screen under the finger: its nearest fixed layer, else the page. */
function screenAt(target: EventTarget | null): HTMLElement | null {
  for (let el = target as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    if (getComputedStyle(el).position === "fixed") return el;
  }
  return document.querySelector<HTMLElement>(".sw-main");
}

function backButton(target: EventTarget | null): HTMLElement | null {
  const vw = window.innerWidth, vh = window.innerHeight;
  // 1. The Back button of the screen being swiped — even scrolled out of
  //    view above (a long profile read to the bottom still goes back).
  const screen = screenAt(target);
  if (screen) {
    const inScreen = Array.from(screen.querySelectorAll<HTMLElement>('button, [role="button"], a'))
      .filter((el) => { const r = el.getBoundingClientRect(); return isBack(el) && r.width > 0 && r.left < vw * 0.5; });
    if (inScreen.length) return inScreen.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
  }
  // 2. Otherwise a visible, uncovered Back in the top-left of the screen.
  let best: HTMLElement | null = null, bestTop = Infinity;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"], a'))) {
    if (!isBack(el)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.top < 0 || r.top > vh * 0.4 || r.left > vw * 0.5) continue;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || !(el === hit || el.contains(hit))) continue;
    if (r.top < bestTop) { best = el; bestTop = r.top; }
  }
  return best;
}

/** What slides: the fixed screen the button lives in, else the page column. */
function layerOf(btn: HTMLElement): HTMLElement | null {
  for (let el: HTMLElement | null = btn; el && el !== document.body; el = el.parentElement) {
    if (getComputedStyle(el).position === "fixed") return el;
  }
  return document.querySelector<HTMLElement>(".sw-main");
}

export function SwipeBack() {
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let start: { x: number; y: number; t: number } | null = null;
    let btn: HTMLElement | null = null;
    let layer: HTMLElement | null = null;
    let saved = { transform: "", transition: "", boxShadow: "" };
    let dragging = false;
    let dx = 0;
    // The last few positions, for the speed of the flick at release.
    let trail: { x: number; t: number }[] = [];

    const restore = () => {
      if (!layer) return;
      layer.style.transform = saved.transform;
      layer.style.transition = saved.transition;
      layer.style.boxShadow = saved.boxShadow;
    };
    const reset = () => { start = null; btn = null; layer = null; dragging = false; dx = 0; trail = []; };

    const onStart = (e: TouchEvent) => {
      // Anywhere on the screen, not just the edge (Sam, 2026-11-02: "you have
      // to go all the way to the left… rather than an easy swipe").
      if (e.touches.length !== 1 || ownsSideways(e.target)) return;
      const b = backButton(e.target);
      if (!b) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
      btn = b;
    };

    const onMove = (e: TouchEvent) => {
      if (!start || !btn) return;
      const t = e.touches[0];
      const x = t.clientX - start.x, y = t.clientY - start.y;
      if (!dragging) {
        if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) { reset(); return; } // a scroll
        if (x < -10) { reset(); return; } // going the other way
        if (x < 10 || x < Math.abs(y) * 1.2) return;
        dragging = true;
        layer = reduce ? null : layerOf(btn);
        if (layer) {
          saved = { transform: layer.style.transform, transition: layer.style.transition, boxShadow: layer.style.boxShadow };
          layer.style.transition = "none";
          layer.style.boxShadow = "-8px 0 24px rgba(0,0,0,0.12)";
        }
      }
      e.preventDefault(); // the page must not scroll under a back-swipe
      dx = Math.max(0, x);
      const now = performance.now();
      trail.push({ x: dx, t: now });
      while (trail.length > 2 && now - trail[0].t > 100) trail.shift();
      if (layer) layer.style.transform = `translateX(${dx}px)`;
    };

    const onEnd = () => {
      if (!start || !btn) { reset(); return; }
      if (!dragging) { reset(); return; }
      // Speed over the last ~100ms, so a quick short flick counts even if
      // the finger rested first.
      const first = trail[0], last = trail[trail.length - 1];
      const speed = first && last && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
      const go = dx > window.innerWidth * 0.25 || (dx > 30 && speed > 0.3);
      const b = btn, l = layer;
      if (!l) { if (go) b.click(); reset(); return; }
      if (go) {
        // The rest of the way at about the finger's speed, never sluggish.
        const left = window.innerWidth - dx;
        const dur = Math.round(Math.min(260, Math.max(120, left / Math.max(speed, 1.6))));
        l.style.transition = `transform ${dur}ms cubic-bezier(0.2, 0.7, 0.3, 1)`;
        l.style.transform = "translateX(100%)";
        window.setTimeout(() => {
          b.click();
          // The screen usually unmounts on Back; if it stays (an in-page
          // back like a competition's), put it straight back in place.
          requestAnimationFrame(() => { restore(); reset(); });
        }, dur);
      } else {
        l.style.transition = "transform 220ms cubic-bezier(0.25, 1.1, 0.4, 1)";
        l.style.transform = "translateX(0)";
        window.setTimeout(() => { restore(); reset(); }, 230);
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);
  return null;
}
