"use client";
import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * The app's touch feel — Sam, 2026-10-22: "button clicks, clicking back,
 * clicking messages — make them all smooth, like Apple".
 *
 * Three things, all in one place so no screen has to know about them:
 *
 *  1. PRESS. Anything you can tap sinks slightly under your finger and
 *     springs back, the way iOS buttons and cards do. One listener on the
 *     document finds the tappable thing under the pointer — a button, a link,
 *     or anything styled with a pointer cursor (most rows and cards here are
 *     divs with an onClick) — so the hundreds of call sites need no change.
 *     Wide things (rows, cards) sink less than small buttons, or a full-width
 *     row visibly shrinks from both edges. A scroll cancels the press.
 *
 *  2. SHEETS AND FULL-SCREEN VIEWS. Profile, match detail, the club picker,
 *     messages, the toast — every overlay in the app is a position: fixed
 *     element mounted when it opens. A MutationObserver gives each a short
 *     rise-and-fade as it arrives. It animates the `translate` property, not
 *     `transform`, so an element already centred with transform (the toast)
 *     keeps its own and the two compose.
 *
 *  3. SCREEN CHANGES. useScreenIn() replays a fade on a container's children
 *     when the screen key changes — tabs, Back — and leaves the header out
 *     so the part that does not change does not flicker.
 *
 * All of it is off under prefers-reduced-motion, in globals.css.
 */

const TAPPABLE = 'button, a[href], [role="button"], summary, label, select';

function pressable(start: Element | null): HTMLElement | null {
  if (!start) return null;
  const direct = start.closest(TAPPABLE) as HTMLElement | null;
  if (direct) return (direct as HTMLButtonElement).disabled ? null : direct;
  // Divs with an onClick: React leaves no trace in the DOM, but every one of
  // them in this app sets cursor: pointer. A few levels is enough to get from
  // a text span to its row.
  let el: Element | null = start;
  for (let i = 0; i < 6 && el && el !== document.body; i++, el = el.parentElement) {
    if (el instanceof HTMLElement && getComputedStyle(el).cursor === "pointer") return el;
  }
  return null;
}

export function MotionLayer() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let pressed: HTMLElement | null = null;
    let since = 0;
    const release = () => {
      const el = pressed;
      if (!el) return;
      pressed = null;
      // A quick tap still shows: hold the press for at least 80ms.
      const wait = Math.max(0, 80 - (performance.now() - since));
      window.setTimeout(() => {
        el.classList.remove("sw-pressed");
        window.setTimeout(() => { if (el !== pressed) el.classList.remove("sw-press"); }, 170);
      }, wait);
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = pressable(e.target as Element);
      if (!el || el.closest("[data-no-press]")) return;
      const r = el.getBoundingClientRect();
      // ~0.97 for buttons, cards and tabs (Sam, 2026-10-31). Only a row
      // wider than most phones' half-screen sinks less, or a full-width row
      // visibly pulls in from both edges.
      el.style.setProperty("--sw-press", r.width > 300 ? "0.985" : "0.97");
      el.classList.add("sw-press", "sw-pressed");
      pressed = el;
      since = performance.now();
    };
    document.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("pointerup", release, { passive: true });
    document.addEventListener("pointercancel", release, { passive: true });
    window.addEventListener("scroll", release, { passive: true, capture: true });

    const arrive = (node: Node) => {
      if (!(node instanceof HTMLElement)) return;
      // Something that animates itself (the splash lifting off) is left alone.
      if (node.hasAttribute("data-no-arrive")) return;
      for (const el of [node, node.firstElementChild]) {
        if (!(el instanceof HTMLElement)) continue;
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed") continue;
        // A bottom sheet — a full-screen backdrop holding its panel at the
        // foot (align-items: flex-end) — slides the panel up over a fading
        // backdrop, the iOS way. Everything else rises and fades in place.
        const panel = el.firstElementChild;
        if (cs.alignItems === "flex-end" && panel instanceof HTMLElement) {
          el.classList.remove("sw-fade-in"); panel.classList.remove("sw-sheet-in");
          void el.offsetWidth;
          el.classList.add("sw-fade-in"); panel.classList.add("sw-sheet-in");
          return;
        }
        el.classList.remove("sw-arrive");
        void el.offsetWidth;
        el.classList.add("sw-arrive");
        return;
      }
    };
    const observer = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach(arrive);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", release);
      window.removeEventListener("scroll", release, { capture: true } as any);
      observer.disconnect();
    };
  }, []);
  return null;
}

/** Replays the screen-in fade on `ref`'s children whenever `key` changes. */
export function useScreenIn<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) { first.current = false; return; }
    el.classList.remove("sw-screen-in");
    void el.offsetWidth;
    el.classList.add("sw-screen-in");
  }, [key]);
  return ref;
}
