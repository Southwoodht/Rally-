import React from "react";

/**
 * Two tennis rackets crossed, for Challenge — Sam: "like the swords but with
 * rackets". Drawn in currentColor so it takes the button's ink.
 *
 * Redrawn 2026-10-25 (Sam: "the two rackets don't look great"): no strings —
 * at 16-24px they were a grey smudge — just an open head, the V of the
 * throat and a heavier grip, crossed at the handles like crossed swords.
 */
export function CrossedRackets({ size = 16, strokeWidth = 1.6 }: { size?: number; strokeWidth?: number }) {
  // One racket upright, head at the top; the pair is then turned out to
  // the two top corners and crossed at the middle, like crossed swords.
  // A racket is mostly head: a big open oval, a short V for the throat,
  // a grip only a little heavier than the frame.
  // A racket is mostly head: a big open oval, a short V for the throat,
  // a grip only a little heavier than the frame. The pair crosses low, in
  // the handles, so the heads and throats stand clear of each other.
  const racket = (
    <>
      <ellipse cx="12" cy="5.6" rx="3.3" ry="4.3" />
      <path d="M10.6 9.6 L12 12 L13.4 9.6" />
      <path d="M12 12 L12 16.4" />
      <path d="M12 16.4 L12 21.4" strokeWidth={strokeWidth * 1.4} />
    </>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform="rotate(-40 12 16.8)">{racket}</g>
      <g transform="rotate(40 12 16.8)">{racket}</g>
      {/* The ball between the heads: what makes it rackets, not scissors. */}
      <circle cx="12" cy="6.4" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
