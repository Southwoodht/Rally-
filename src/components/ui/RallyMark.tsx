"use client";
import React from "react";

// The Southwood mark, for use inside the app. (Still named RallyMark: the
// app was Rally until 2026-09-27, and renaming the component would touch
// every importer for no change on screen.)
//
// Same letter as the app icon — Fraunces 600's S, the outline copied from
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
// theme: cream-on-green in Southwood, ink-on-cream in Paris, and so on. The app
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
      height={size * (568 / 654.3)}
      viewBox="178.8 228 654.3 568"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ flexShrink: 0, display: "block" }}
    >
      {/* Fraunces 600's "S", the same outline as public/icon.svg. */}
      <path fill="var(--text-hi)" d="M400.0 791.2L400.0 791.2Q368.6 791.2 346.0 783.8Q323.4 776.3 309.1 769.0Q294.7 761.7 287.8 761.7L287.8 761.7Q280.1 761.7 275.2 766.3Q270.2 770.9 265.8 776.9Q261.4 782.8 256.4 787.4Q251.4 792 244.1 792L244.1 792Q236.1 792 230.9 787.2Q225.7 782.4 223.8 771.3L223.8 771.3L197.4 646.4Q195.9 638.0 199.5 631.9Q203.1 625.8 211.6 623.1L211.6 623.1Q220.8 620.0 227.7 623.5Q234.6 626.9 239.5 636.9L239.5 636.9Q261.4 679.8 286.1 705.1Q310.8 730.3 337.6 741.1Q364.4 751.8 392.4 751.8L392.4 751.8Q431.4 751.8 454.0 731.5Q476.6 711.2 476.6 677.1L476.6 677.1Q477.0 654.9 466.7 637.1Q456.3 619.3 427.6 602.4Q398.9 585.5 342.6 567.2L342.6 567.2Q284.3 548.4 249.3 523.7Q214.3 499.0 198.5 466.0Q182.8 433.1 182.8 389.4L182.8 389.4Q182.8 343.1 204.9 307.8Q226.9 272.6 266.9 252.9Q306.9 233.1 360.6 233.1L360.6 233.1Q395.0 233.1 417.6 240.2Q440.2 247.3 454.8 254.6Q469.4 261.9 478.9 261.9L478.9 261.9Q487.4 261.9 492.0 254.4Q496.6 246.9 501.9 239.5Q507.3 232 518.0 232L518.0 232Q526.4 232 532.0 237.4Q537.5 242.7 541.7 257.3L541.7 257.3L577.8 382.9Q580.8 392.9 577.2 400.7Q573.5 408.6 564.7 411.3L564.7 411.3Q555.9 414.3 548.8 410.7Q541.7 407.0 537.2 398.2L537.2 398.2Q513.4 350.7 486.4 323.4Q459.4 296.0 430.7 284.1Q401.9 272.2 372.4 272.2L372.4 272.2Q333.4 272.2 310.2 294.6Q287.0 317.0 287.0 353.0L287.0 353.0Q287.0 374.9 297.2 393.6Q307.3 412.4 335.7 430.2Q364.0 448.0 417.6 468.0L417.6 468.0Q477.0 489.0 512.1 513.5Q547.1 538.0 562.2 568.9Q577.4 599.7 577.4 639.6L577.4 639.6Q577.4 681.3 556.3 715.8Q535.2 750.2 495.8 770.7Q456.3 791.2 400.0 791.2Z" />
      <circle cx={721.2} cy={684} r={108} fill="var(--mark-ball)" />
    </svg>
  );
}
