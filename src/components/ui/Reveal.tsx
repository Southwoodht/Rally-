"use client";
import React, { useEffect, useRef, useState } from "react";

// Cards arriving, once, in the order you read them.
//
// Sam, 2026-09-22: 8px up, 200ms, 40ms apart, hero first. It is the only
// animation on Home and it has the reason §4 asks for — the screen is
// assembled from several independent sources (your league is local, the global
// standing is an RPC, other leagues are a load each) and without it the block
// appears in whatever order the network happened to answer. The stagger
// imposes a reading order on something that genuinely does not have one.
//
// **Mount only, and guarded.** Home re-renders whenever one of those sources
// lands, and a transition keyed on render would replay on every one of them —
// the flock re-landing on every navigation, which is the mistake
// MessageRobins records in §4. The ref is what makes it once.
//
// Numbers do not count up. Sam ruled that out explicitly, and he is right:
// a number rolling towards its value is unreadable for the whole time it is
// wrong, on a screen whose entire job is to be read at a glance.

const DURATION_MS = 200;
const STAGGER_MS = 40;
const EASE = "cubic-bezier(0.2, 0, 0, 1)";
const RISE_PX = 8;

/** Read once, synchronously, so a reduced-motion reader never sees frame one
 *  of an animation they asked not to have. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

export function Reveal({ index = 0, children, style }: {
  /** Position down the screen. 0 is the hero and starts immediately. */
  index?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const reduced = useRef<boolean | null>(null);
  if (reduced.current === null) reduced.current = prefersReducedMotion();

  // Reduced motion starts in the final state and never transitions, so there
  // is no fade and no transform at all — not a faster one.
  const [shown, setShown] = useState(() => reduced.current === true);

  useEffect(() => {
    if (reduced.current) return;
    // A frame, so the browser paints the start state before the transition is
    // allowed to run. Setting both in the same tick animates nothing.
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // **The guard is the empty dependency array, and it must not be a ref.**
  //
  // The first version of this carried a `started` ref and returned early when
  // it was set — which is the obvious way to write "once" and is wrong here.
  // React runs every effect twice on mount in development: effect, cleanup,
  // effect. The first pass set the ref and scheduled the frame, the cleanup
  // cancelled the frame, and the second pass saw the ref and returned without
  // scheduling another. Every card on Home stayed at opacity 0. It looked
  // exactly like a blank screen, which is how it was found — the cards were
  // all in the DOM with their text intact.
  //
  // Empty deps already means once per mount. setShown(true) is idempotent, so
  // running it twice costs nothing and surviving the cleanup costs everything.

  if (reduced.current) return <div style={style}>{children}</div>;

  return (
    <div
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(" + RISE_PX + "px)",
        transition: `opacity ${DURATION_MS}ms ${EASE} ${index * STAGGER_MS}ms, transform ${DURATION_MS}ms ${EASE} ${index * STAGGER_MS}ms`,
        willChange: shown ? undefined : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
