import React from "react";

/**
 * Two tennis rackets crossed, for Challenge — Sam: "like the swords but with
 * rackets". Drawn in currentColor so it takes the button's ink.
 */
export function CrossedRackets({ size = 16, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) {
  const racket = (
    <>
      <ellipse cx="8" cy="7" rx="4.6" ry="5.6" />
      <path d="M5.2 5.2 L10.8 5.2 M4.6 8.2 L11.4 8.2 M6.2 2.4 L6.2 11.8 M9.8 2.4 L9.8 11.8" strokeWidth={strokeWidth * 0.55} opacity="0.8" />
      <path d="M8 12.6 L8 15.2" />
      <path d="M8 15.2 L8 21.4" strokeWidth={strokeWidth * 1.6} />
    </>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform="rotate(-38 12 12) translate(4 0)">{racket}</g>
      <g transform="rotate(38 12 12) translate(4 0)">{racket}</g>
    </svg>
  );
}
