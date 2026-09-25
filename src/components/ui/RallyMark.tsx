"use client";
import React from "react";

// The Rally mark, for use inside the app.
//
// Same letter as the app icon — the three paths are copied from
// public/icon.svg and the ball sits at the same place, so the thing in the
// corner of the header and the thing on the home screen are one mark. If the
// icon's geometry is ever changed, change it here too; the build notes in
// scripts/build-icons.md say the same about the three SVG masters and this is
// now the fourth copy.
//
// TWO DELIBERATE DIFFERENCES FROM THE ICON:
//
// No field. The icon carries a dark green tile because a home screen needs
// one; in the app the mark sits on whatever the page already is, and a tile
// would read as a sticker somebody pasted on the header.
//
// No seams on the ball. At 22px a seam is under two pixels, and drawing it
// needs a colour that matches the surface behind the ball — which on five
// themes is five different colours, and on a card is not the same as on the
// page. A plain disc says "tennis ball" next to an R at this size and owes
// nothing to its background.
//
// The colours are tokens, not the icon's hexes, so the mark follows the
// theme: cream-on-green in Rally, ink-on-cream in Paris, and so on. The app
// icon cannot do that — it is baked into a PNG the operating system owns —
// and that is the right split: the icon is the brand, this is the interface.
//
// The ball is --mark-ball and NOT --accent. Using the accent looked obviously
// right and was wrong on two of the five themes: sw19 and melbourne both have
// a dark accent and dark --text-hi, so at 22px the R and the ball were the
// same colour and the mark read as one blob. Seen on screen, not reasoned
// about. Each theme names its own ball in themes.css.

export function RallyMark({ size = 22, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size * (602 / 612)}
      viewBox="276 211 612 602"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ flexShrink: 0, display: "block" }}
    >
      <g
        fill="none"
        stroke="var(--text-hi)"
        strokeWidth={92}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M322 257V767" />
        <path d="M322 257H529A133 133 0 0 1 529 523H322" />
        <path d="M412 523L646 767" />
      </g>
      <circle cx={780} cy={692} r={108} fill="var(--mark-ball)" />
    </svg>
  );
}
