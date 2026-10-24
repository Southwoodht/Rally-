"use client";
import React, { useId } from "react";

// The Southwood mark, for use inside the app. (Still named RallyMark: the
// app was Rally until 2026-09-27, and renaming the component would touch
// every importer for no change on screen.)
//
// Since 2026-10-24 it is the new icon's S and ball (Sam's design): the
// Fraunces Bold S at display size, outlined from the same path as
// public/icon.svg (in that file's 100-unit coordinates), and the gold ball
// with its two white seams. If the icon's geometry changes, change it here
// too — this is the fourth copy of the letter (scripts/build-icons.md).
//
// ONE DELIBERATE DIFFERENCE FROM THE ICON: no field and no rim. In the app
// the mark sits on whatever the page already is, and the S takes the theme's
// text colour, so it stays readable on the dark Southwood theme where the
// icon's ink would vanish. The ball keeps its gold on every theme: the seams
// are drawn on the ball itself, so they no longer depend on the background.

export function RallyMark({ size = 22, title }: { size?: number; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size * (68.5 / 63)}
      height={size}
      viewBox="20 21 68.5 63"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ flexShrink: 0, display: "block" }}
    >
      <defs>
        <radialGradient id={id + "b"} cx="0.35" cy="0.3" r="0.85"><stop offset="0" stopColor="#F0D488" /><stop offset="1" stopColor="#C99D3B" /></radialGradient>
        <clipPath id={id + "c"}><circle cx="79" cy="73" r="8.5" /></clipPath>
      </defs>
      <path fill="var(--text-hi)" d="M44.28 82.84L44.28 82.84Q40.59 82.84 38.19 81.75Q35.80 80.66 34.45 79.56Q33.11 78.47 32.60 78.47L32.60 78.47Q32.23 78.47 31.45 79.17Q30.67 79.86 29.73 80.78Q28.78 81.71 27.96 82.40Q27.14 83.09 26.68 83.09L26.68 83.09Q26.43 83.09 26.09 82.86Q25.76 82.63 25.67 82.25L25.67 82.25L22.69 62.76Q22.65 62.47 22.69 62.30Q22.73 62.13 22.82 62.09L22.82 62.09Q22.95 62.01 23.09 62.11Q23.24 62.22 23.36 62.43L23.36 62.43Q27.44 70.32 30.88 74.55Q34.33 78.77 37.31 80.36Q40.29 81.96 43.06 81.96L43.06 81.96Q47.35 81.96 49.89 79.69Q52.43 77.42 52.43 72.80L52.43 72.80Q52.43 69.86 51.27 67.49Q50.12 65.12 47.39 63.18Q44.66 61.25 39.91 59.61L39.91 59.61Q33.11 57.26 29.01 54.34Q24.92 51.42 23.09 47.83Q21.26 44.24 21.26 39.79L21.26 39.79Q21.26 34.62 23.93 30.70Q26.60 26.77 31.32 24.56Q36.05 22.36 42.27 22.36L42.27 22.36Q45.50 22.36 47.64 23.12Q49.78 23.87 51.11 24.63Q52.43 25.38 53.10 25.38L53.10 25.38Q53.77 25.38 55.14 24.56Q56.50 23.75 57.81 22.93Q59.11 22.11 59.70 22.11L59.70 22.11Q59.91 22.11 60.14 22.25Q60.37 22.40 60.41 22.78L60.41 22.78L65.03 41.72Q65.07 42.06 65.03 42.18Q64.99 42.31 64.86 42.39L64.86 42.39Q64.78 42.44 64.61 42.35Q64.44 42.27 64.36 42.10L64.36 42.10Q59.86 34.54 56.27 30.45Q52.68 26.35 49.51 24.82Q46.34 23.28 43.19 23.28L43.19 23.28Q39.28 23.28 36.78 25.91Q34.28 28.53 34.28 33.03L34.28 33.03Q34.28 36.09 35.38 38.53Q36.47 40.97 39.03 42.94Q41.59 44.91 46.05 46.47L46.05 46.47Q53.19 48.99 57.32 51.84Q61.46 54.70 63.20 58.10Q64.95 61.50 64.95 65.70L64.95 65.70Q64.95 70.49 62.49 74.38Q60.03 78.26 55.41 80.55Q50.79 82.84 44.28 82.84Z" />
      <circle cx="79" cy="73" r="8.5" fill={`url(#${id}b)`} />
      <g clipPath={`url(#${id}c)`} fill="none" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round">
        <path d="M70.5 66.6 Q77.7 73 70.5 79.4" />
        <path d="M87.5 66.6 Q80.3 73 87.5 79.4" />
      </g>
    </svg>
  );
}
