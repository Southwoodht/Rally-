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
 * club's pages, the mixer, Plan next season...). The gesture finds the one
 * that is on top and visible in the top-left of the screen — checked with
 * elementFromPoint, so a back button buried under an open profile is never
 * the one pressed — and presses it. So it always does exactly what tapping
 * Back does; nothing new to keep in step. No Back button on screen (a main
 * tab), no gesture.
 *
 * HOW IT FEELS: the touch must start within 24px of the left edge and move
 * mostly sideways. The screen that Back would close (the fixed layer the
 * button sits in, else the page column) follows the finger with a soft
 * shadow; let go past a third of the width, or flick, and it slides off
 * and Back is pressed; otherwise it springs home. Under reduce motion
 * nothing slides — a long enough swipe just goes back.
 */

const EDGE = 24;

function backButton(): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"], a'));
  const vw = window.innerWidth, vh = window.innerHeight;
  let best: HTMLElement | null = null, bestTop = Infinity;
  for (const el of all) {
    const isBack = el.getAttribute("aria-label") === "Back" || !!el.querySelector("svg.lucide-chevron-left");
    if (!isBack || (el as HTMLButtonElement).disabled) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.top < 0 || r.top > vh * 0.4 || r.left > vw * 0.5) continue;
    // On top, not covered by something opened over it.
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

    const restore = () => {
      if (!layer) return;
      layer.style.transform = saved.transform;
      layer.style.transition = saved.transition;
      layer.style.boxShadow = saved.boxShadow;
    };
    const reset = () => { start = null; btn = null; layer = null; dragging = false; dx = 0; };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || e.touches[0].clientX > EDGE) return;
      const b = backButton();
      if (!b) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
      btn = b;
    };

    const onMove = (e: TouchEvent) => {
      if (!start || !btn) return;
      const t = e.touches[0];
      const x = t.clientX - start.x, y = t.clientY - start.y;
      if (!dragging) {
        if (Math.abs(y) > 12 && Math.abs(y) > Math.abs(x)) { reset(); return; } // a scroll
        if (x < 10) return;
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
      if (layer) layer.style.transform = `translateX(${dx}px)`;
    };

    const onEnd = () => {
      if (!start || !btn) { reset(); return; }
      if (!dragging) { reset(); return; }
      const ms = Math.max(1, performance.now() - start.t);
      const go = dx > window.innerWidth / 3 || (dx > 40 && dx / ms > 0.5);
      const b = btn, l = layer;
      if (!l) { if (go) b.click(); reset(); return; }
      if (go) {
        l.style.transition = "transform 200ms ease-out";
        l.style.transform = "translateX(100%)";
        window.setTimeout(() => {
          b.click();
          // The screen usually unmounts on Back; if it stays (an in-page
          // back like a competition's), put it straight back in place.
          requestAnimationFrame(() => { restore(); reset(); });
        }, 200);
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
