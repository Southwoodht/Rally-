"use client";
import React from "react";
import {
  Bot, BrickWall, Crown, Dumbbell, Flame, Glasses, Mountain, Pizza,
  Shield, Squirrel, Swords, Target, Trophy, Turtle, Zap,
} from "lucide-react";

/**
 * Drawn avatars.
 *
 * The stored value on a player row is still the emoji character — it is an
 * **id**, not something we render. That is the whole trick, and it is why
 * this needed no migration and no editing of anybody's row: every player who
 * already picked 🔥 now gets a drawn flame, immediately, and a club is never
 * split between two styles.
 *
 * The reason for doing it at all is the same as for Glyph: an emoji is drawn
 * by the operating system. 🐐 is a cartoon goat on an iPhone, a different
 * cartoon goat on Android and a monochrome outline on some Windows builds,
 * so the one part of a profile nobody can style was the part with a face on
 * it. Sam raised this himself — "itll look weird on android".
 *
 * Each has a colour so they stay apart at 20px, where two lime outlines look
 * identical. Colours come from AV_COLORS, which already existed for exactly
 * this job.
 */

/**
 * The coloured circles.
 *
 * Not in AVATARS and easy to miss, which I did: the historical import gave
 * every Seacourt player one of these — 🟢 Sam, 🔵 Charlie, 🟠 Cheese, 🟣
 * Zaach — so without them the drawn-avatar work reached everybody except the
 * people actually using the app. Found by opening it and looking at a
 * profile.
 *
 * A filled disc in the same colour, which is what the emoji was always
 * trying to be, minus the operating system's opinion about gloss.
 */
const DOTS: Record<string, string> = {
  "🟢": "#8fd19e", "🔵": "#6fa8dc", "🟠": "#e0854b", "🔴": "#e06b6b",
  "🟤": "#a9784f", "🟣": "#b39ddb", "⚫": "#5b6f66", "⚪": "#d8dcd4",
  "🟡": "#e8c34a",
};

function Dot({ size = 24, color = "#8fd19e" }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="8.5" fill={color} />
    </svg>
  );
}

/** Emoji id → [icon, colour]. Order matches AVATARS in theme.ts. */
const ART: Record<string, [any, string]> = {
  "🎾": [Circleball, "#d9e84b"],
  "🏆": [Trophy, "#e8c34a"],
  "🔥": [Flame, "#f0946b"],
  "⚡": [Zap, "#e8c34a"],
  "🐐": [Mountain, "#cbd5c0"],
  "🦊": [Squirrel, "#e0854b"],
  "🐢": [Turtle, "#8fd19e"],
  "🎯": [Target, "#cb6d47"],
  "💪": [Dumbbell, "#6fa8dc"],
  "🧱": [BrickWall, "#cb6d47"],
  "👑": [Crown, "#e8c34a"],
  "🏓": [Swords, "#e0a3c3"],
  "🥊": [Shield, "#f0946b"],
  "😎": [Glasses, "#b39ddb"],
  "🍕": [Pizza, "#e8c34a"],
  "🤖": [Bot, "#8fd19e"],
};

/** A tennis ball: lucide has no such thing, and a plain circle is not one. */
function Circleball({ size = 24, color = "currentColor", strokeWidth = 2 }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      {/* The two seams are what make it a tennis ball rather than a circle. */}
      <path d="M4.2 6.6A9 9 0 0 1 9.3 20.6" />
      <path d="M19.8 6.6A9 9 0 0 0 14.7 20.6" />
    </svg>
  );
}

export function hasAvatarArt(key?: string | null): boolean {
  return !!key && (!!ART[key] || !!DOTS[key]);
}

/** The drawn mark for a stored avatar id, or null if it isn't one of ours. */
export function AvatarArt({ id, size = 20 }: { id?: string | null; size?: number }) {
  if (!id) return null;
  const dot = DOTS[id];
  if (dot) return <Dot size={size} color={dot} />;
  const entry = ART[id];
  if (!entry) return null;
  const [Icon, color] = entry;
  return <Icon size={size} color={color} strokeWidth={2.1} />;
}
