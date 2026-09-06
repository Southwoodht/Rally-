"use client";
import React from "react";

// A robin, because Victorian postmen were nicknamed robins after their red
// uniforms — which is why robins deliver the letters on Christmas cards.
// British, and the red breast is the one feature that survives at icon size.
//
// Drawn rather than an emoji: an emoji renders as whatever the device decides
// and never matches the app. This is a placeholder in the sense that a
// commissioned bird would be better, but it is built the way the real one
// needs to be built — the wing is its own group with its own transform
// origin, so the flap has something to rotate that isn't the whole bird.

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
  const legs = size >= LEGS_MIN_SIZE;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", transform: flip ? "scaleX(-1)" : undefined, overflow: "visible", ...style }}
    >
      {legs && (
        <g stroke={colours.beak} strokeWidth={0.9} strokeLinecap="round">
          <path d="M10.6 18.2 V20.4" />
          <path d="M13.4 18.2 V20.4" />
        </g>
      )}

      {/* Tail, then body, then head: one silhouette in the darker colour.
          The tail sweeps down and back from the rump — drawn level with the
          shoulders it reads as a broken wing, which is how it looked first
          time round. */}
      <path d="M6.6 11.4 C4.2 12.4 2.2 14.4 1.1 17.2 C3.6 16.9 6.0 15.6 7.8 13.6 Z" fill={colours.body} />
      <ellipse cx="12" cy="12.6" rx="6.4" ry="6.0" fill={colours.body} />
      <circle cx="16.3" cy="8.3" r="3.9" fill={colours.body} />

      {/* The breast, overlapping both, which is what makes it read as a robin
          rather than a brown blob with a red dot. */}
      <path
        d="M9.4 12.9 C9.4 9.6 11.6 7.2 14.6 7.2 C17.0 7.2 18.6 8.6 18.6 10.6 C18.6 14.2 15.8 17.4 12.8 17.4 C10.6 17.4 9.4 15.6 9.4 12.9 Z"
        fill={colours.breast}
      />

      {/* Wing: its own group, rotating about the shoulder. */}
      <g
        className="rally-robin-wing"
        style={{ transformBox: "fill-box", transformOrigin: "78% 18%", transform: wingAngle ? `rotate(${wingAngle}deg)` : undefined, ...wingStyle }}
      >
        <path d="M6.4 10.6 C8.6 9.4 11.4 9.6 13.2 11.2 C11.8 13.8 9.2 15.2 6.6 14.6 C5.4 13.4 5.4 11.7 6.4 10.6 Z" fill={colours.body} opacity={0.82} />
      </g>

      <circle cx="17.9" cy="7.6" r="0.85" fill="#1A1410" />
      <path d="M19.9 8.6 L23.0 9.4 L19.9 10.2 Z" fill={colours.beak} />

      {envelope && (
        <g transform="translate(19.6 9.6)">
          <rect x="0" y="0" width="4.4" height="3.1" rx="0.4" fill="#F5F2E9" />
          <path d="M0.3 0.4 L2.2 1.8 L4.1 0.4" stroke="#B9B29E" strokeWidth={0.45} fill="none" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
