"use client";
import React, { useId } from "react";

// A robin, because Victorian postmen were nicknamed robins after their red
// uniforms — which is why robins deliver the letters on Christmas cards.
// British, and the red breast is the one feature that survives at icon size.
//
// Drawn rather than an emoji: an emoji renders as whatever the device decides
// and never matches the app.
//
// REDRAWN 2026-09-20, to Sam's "more Apple style". What that meant in practice
// was less about adding and more about joining up:
//
//   * **One silhouette, not three shapes.** The first version was an ellipse
//     with a circle stuck on for a head and a path stuck on for a tail. At
//     200px you could see all three joins, and the head read as a ball
//     balanced on a body. The body and head are now a single path with a real
//     nape curve, which is the difference between a bird and a snowman.
//   * **Gradients, barely.** Two stops, a few per cent apart, running down
//     each shape. Apple's icons are not flat; they are lit from above so
//     gently that you only notice when it is taken away. Big enough to see at
//     96px, invisible at 20px, costs nothing either way.
//   * **A catchlight in the eye.** One white dot at 0.3 units. It is the
//     single highest-value mark on the whole drawing — an eye without one is
//     a bead, an eye with one is alive.
//   * **A tapered beak and tail**, curved rather than straight-sided. Nothing
//     in a bird is a triangle.
//
// The wing is still its own group with its own transform origin, because the
// flap has to rotate something that isn't the whole bird.
//
// Gradient ids come from useId(). Two robins on one page with the same
// hardcoded id is one robin borrowing the other's fill, which is the classic
// way inline SVG breaks the second time you use it.

export interface RobinColours {
  /** Back, head and tail. */
  body: string;
  /** The breast. The only part that reads at 20px. */
  breast: string;
  /** Beak and legs. Warm orange: a dark beak vanishes against dark green. */
  beak: string;
}

export const ROBIN_PALETTES: RobinColours[] = [
  { body: "#7A5C43", breast: "#D9613C", beak: "#E2A03C" },
  { body: "#8A6A4B", breast: "#C9502F", beak: "#E8AC4A" },
  { body: "#6E5139", breast: "#E0714A", beak: "#DB9832" },
];

/** Below this the legs are more noise than bird. */
const LEGS_MIN_SIZE = 24;
/** And below this the gradients and the catchlight are sub-pixel anyway. */
const DETAIL_MIN_SIZE = 22;

/** Mix a #rrggbb towards white (positive) or black (negative). */
function shift(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const to = amount >= 0 ? 255 : 0;
  const a = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (to - c) * a);
  return "#" + [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)]
    .map((c) => c.toString(16).padStart(2, "0")).join("");
}

export function Robin({
  size = 25,
  colours = ROBIN_PALETTES[0],
  flip = false,
  wingAngle = 0,
  wingStyle,
  envelope = false,
  style,
}: {
  size?: number;
  colours?: RobinColours;
  /** Mirror it, so two birds side by side are not the same drawing twice. */
  flip?: boolean;
  /** Degrees, for a static pose. */
  wingAngle?: number;
  /** Applied to the wing group — this is where the flap animation goes.
   *  Passed in rather than selected for, because a CSS selector reaching in
   *  from the parent has to guess at the element tree and gets it wrong. */
  wingStyle?: React.CSSProperties;
  envelope?: boolean;
  style?: React.CSSProperties;
}) {
  const uid = useId().replace(/:/g, "");
  const bodyGrad = "rb" + uid + "b";
  const breastGrad = "rb" + uid + "r";
  const legs = size >= LEGS_MIN_SIZE;
  const detail = size >= DETAIL_MIN_SIZE;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", transform: flip ? "scaleX(-1)" : undefined, overflow: "visible", ...style }}
    >
      {detail && (
        <defs>
          {/* Lit from above-left, a few per cent. Any more and it stops
              looking like a bird and starts looking like a button. */}
          <linearGradient id={bodyGrad} x1="0.3" y1="0" x2="0.7" y2="1">
            <stop offset="0" stopColor={shift(colours.body, 0.17)} />
            <stop offset="1" stopColor={colours.body} />
          </linearGradient>
          <linearGradient id={breastGrad} x1="0.35" y1="0" x2="0.65" y2="1">
            <stop offset="0" stopColor={shift(colours.breast, 0.13)} />
            <stop offset="1" stopColor={colours.breast} />
          </linearGradient>
        </defs>
      )}

      {legs && (
        <g stroke={colours.beak} strokeWidth={0.9} strokeLinecap="round">
          <path d="M11.0 17.9 V20.3" />
          <path d="M13.8 17.9 V20.3" />
        </g>
      )}

      {/* Tail. Swept down and back off the rump, tapered to a point and
          slightly curved — drawn level with the shoulders it reads as a
          broken wing, which is how it looked first time round. */}
      <path
        d="M7.2 12.4 C5.2 13.6 3.0 15.9 1.3 18.9 C4.2 18.3 6.7 16.6 8.4 14.2 Z"
        fill={detail ? `url(#${bodyGrad})` : colours.body}
      />

      {/* Head and body as ONE path. The nape — the curve from the back of the
          skull down into the shoulders — is the whole job: it is what stops a
          head-sized circle reading as a separate object sitting on top. */}
      <path
        d="M15.5 3.5
           C17.9 3.5 19.9 5.3 19.9 7.7
           C19.9 9.1 19.4 10.3 18.7 11.2
           C19.5 13.3 18.7 15.7 16.6 17.1
           C14.6 18.5 11.7 18.8 9.5 17.7
           C7.0 16.4 5.8 14.0 5.9 11.4
           C6.0 8.6 7.7 6.3 10.1 5.3
           C11.6 4.1 13.4 3.5 15.5 3.5 Z"
        fill={detail ? `url(#${bodyGrad})` : colours.body}
      />

      {/* The bib: face, throat and upper chest, and then it stops.
          On a real robin the orange runs up over the face and round the eye,
          which is what makes it read as a robin rather than a brown bird with
          a red dot — but it does NOT run all the way to the tail. Drawn that
          far it covered the whole body, left the brown as a crescent up one
          side, and put a hard vertical seam down the middle of the bird. */}
      <path
        d="M13.1 5.1
           C15.9 4.2 18.5 5.4 19.5 7.5
           C20.0 8.7 19.4 10.4 18.7 11.3
           C19.3 12.7 19.1 14.2 18.2 15.4
           C15.7 16.8 12.4 16.6 10.5 15.1
           C10.2 12.1 10.6 9.4 11.5 7.9
           C11.9 6.7 12.4 5.7 13.1 5.1 Z"
        fill={detail ? `url(#${breastGrad})` : colours.breast}
      />

      {/* Wing: its own group, rotating about the shoulder. It sits on the
          brown flank, which is where a folded wing is anyway — over the
          orange it reads as a bite taken out of the breast. */}
      <g
        className="rally-robin-wing"
        style={{ transformBox: "fill-box", transformOrigin: "84% 18%", transform: wingAngle ? `rotate(${wingAngle}deg)` : undefined, ...wingStyle }}
      >
        {/* A solid shape a shade darker than the back, and a teardrop rather
            than an oval: the tip runs down and back toward the tail, which is
            the direction a folded wing actually lies. Round, it read as a
            hole in the flank.

            It was a translucent blob over a gradient before that, which at
            200px read as a bruise — a wing needs an edge, and two
            half-transparent fills do not make one. */}
        <path
          d="M8.6 9.8
             C10.7 9.4 12.3 10.7 12.7 12.5
             C12.3 14.8 10.4 16.6 7.6 17.0
             C6.5 15.7 6.1 13.5 6.7 11.6
             C7.1 10.4 7.9 9.9 8.6 9.8 Z"
          fill={shift(colours.body, -0.22)}
        />
        {/* One covert line. A single mark that says "feathers" where five
            would say "clutter" at 29px. */}
        <path
          d="M8.6 11.0 C10.1 10.9 11.4 11.7 11.9 13.0"
          stroke={shift(colours.body, -0.4)}
          strokeWidth={0.5}
          strokeLinecap="round"
          fill="none"
          opacity={detail ? 0.75 : 0}
        />
      </g>

      {/* The eye, and the one mark that does the most work on the whole
          drawing. A bead is a bead; a bead with a catchlight is looking at
          you. Dropped below DETAIL_MIN_SIZE, where it is a third of a pixel. */}
      <circle cx="17.3" cy="7.5" r="0.95" fill="#1A1410" />
      {detail && <circle cx="17.62" cy="7.18" r="0.3" fill="#FFFFFF" opacity={0.92} />}

      {/* Beak. Curved top and bottom and tapered to the tip — nothing on a
          bird is a triangle, and the flat-sided one read as a traffic cone. */}
      <path
        d="M19.6 8.1 C21.3 8.3 22.8 8.9 23.5 9.4 C22.7 10.0 21.2 10.5 19.7 10.5 C19.9 9.7 19.9 8.9 19.6 8.1 Z"
        fill={colours.beak}
      />

      {envelope && (
        <g transform="translate(19.8 9.9)">
          <rect x="0" y="0" width="4.4" height="3.1" rx="0.5" fill="#F5F2E9" />
          <path d="M0.35 0.45 L2.2 1.85 L4.05 0.45" stroke="#B9B29E" strokeWidth={0.45} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  );
}
