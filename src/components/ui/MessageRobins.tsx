"use client";
import React, { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Robin, ROBIN_PALETTES } from "@/components/ui/Robin";
import { FEED_LIME, FEED_LIME_INK, FEED_PAGE, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

// The unread count, as a robin perched on the button.
//
// The message icon stays put at every count. The first version replaced it
// with the birds, which meant the button stopped saying "messages" at all —
// and at zero unread there was nothing in it. The robin is decoration on top
// of a control, never the control.
//
// One bird, not three. Three read fine at mockup scale and are a brown smudge
// on a real 44px button, so anything above one goes in a badge and the bird
// stays legible as a bird.
//
// The fly-in fires only when a poll sees the count go UP while the app is
// open. Never on mount and never on a tab switch: the header unmounts when
// you open Messages, so a naive "animate when I appear" would re-land the
// bird on every navigation and the charm would be gone inside a day. The last
// count animated for is module state precisely so it outlives that unmount.

let lastAnimatedCount: number | null = null;

/** Perched on the rim, outside the circle, overlapping it. */
const BIRD = { size: 29, top: -19, right: -7 };

// Every one of these is keyframe-shaped rather than curve-shaped: the timing
// function smooths between steps, the steps carry the character. A single
// cubic-bezier cannot express "overshoot, come back, overshoot less".
const KEYFRAMES = `
/* Landing, as a decaying settle rather than one overshoot. Real things that
   land do not stop dead on the second bounce, and three diminishing ones is
   the difference between "animated" and "alive". Scale comes in from 0.92 so
   it reads as approaching from distance rather than sliding in from off-screen
   at full size. */
@keyframes rally-robin-in {
  0%   { transform: translate(30px, -34px) rotate(12deg) scale(.92); opacity: 0; }
  18%  { opacity: 1; }
  55%  { transform: translate(6px, -6px) rotate(4deg) scale(1); }
  74%  { transform: translate(-2.5px, 2.5px) rotate(-5deg); }
  86%  { transform: translate(1px, -1px) rotate(2deg); }
  94%  { transform: translate(-.5px, .5px) rotate(-1deg); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}
/* The bob carries a degree of rotation with it. Pure vertical translation is
   a lift, not a breath. */
@keyframes rally-robin-bob {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50%      { transform: translateY(-1.2px) rotate(-1.2deg); }
}
/* Asymmetric, because a wingbeat is: a fast upstroke, a slower recovery, and
   a little past neutral on the way back. Symmetric 0 -> -52 -> 0 is a
   windscreen wiper. */
@keyframes rally-robin-flap {
  0%   { transform: rotate(0deg); }
  28%  { transform: rotate(-62deg); }
  64%  { transform: rotate(10deg); }
  82%  { transform: rotate(-6deg); }
  100% { transform: rotate(0deg); }
}
/* Leaving gets an anticipation beat — it dips and turns away before it goes.
   Launching straight from rest reads as the bird being deleted. */
@keyframes rally-robin-out {
  0%   { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
  22%  { transform: translate(-3px, 3px) rotate(-7deg) scale(.98); opacity: 1; }
  100% { transform: translate(34px, -38px) rotate(14deg) scale(.9); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .rally-robin-perch, .rally-robin-perch * { animation: none !important; }
}
`;

export function MessageRobins({ count }: { count: number; size?: number }) {
  const [arriving, setArriving] = useState(false);
  // The bird has to outlive the count reaching zero, or reading your messages
  // makes it vanish mid-air.
  const [leaving, setLeaving] = useState(false);
  // A random offset per mount, so two of these on screen are not bobbing in
  // lockstep.
  const bobDelay = useRef(Math.round(Math.random() * 800));
  const prev = useRef<number | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = count;
    if (before === null) {
      if (lastAnimatedCount === null) lastAnimatedCount = count;
      return;
    }
    if (count > before && count > (lastAnimatedCount ?? 0)) {
      lastAnimatedCount = count;
      setArriving(true);
      const t = setTimeout(() => setArriving(false), 1000);
      return () => clearTimeout(t);
    }
    if (count < before) {
      lastAnimatedCount = count;
      if (count === 0 && before > 0) {
        setLeaving(true);
        const t = setTimeout(() => setLeaving(false), 580);
        return () => clearTimeout(t);
      }
    }
  }, [count]);

  const showBird = count > 0 || leaving;

  return (
    <span style={{ position: "relative", display: "grid", placeItems: "center", width: "100%", height: "100%" }}>
      {/* The control. Always here, whatever the count. */}
      <MessageCircle size={19} color={count > 0 ? FEED_LIME : FEED_TEXT_MID} strokeWidth={2} />

      {showBird && (
        <>
          <style>{KEYFRAMES}</style>
          <span
            className="rally-robin-perch"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: BIRD.top,
              right: BIRD.right,
              pointerEvents: "none",
              animation: leaving
                ? "rally-robin-out 560ms cubic-bezier(.45,0,.85,.35) both"
                : arriving
                  ? "rally-robin-in 960ms cubic-bezier(.33,.1,.25,1) both"
                  : `rally-robin-bob 3.2s ease-in-out ${bobDelay.current}ms infinite`,
            }}
          >
            {/* Four flaps across the approach, then one every five seconds, so
                a perched bird looks alive without becoming something you
                notice while reading. Four rather than three because the
                landing is longer now and three left it gliding the last
                third. */}
            <Robin
              size={BIRD.size}
              colours={ROBIN_PALETTES[0]}
              envelope
              wingStyle={{
                animation: arriving
                  ? "rally-robin-flap 240ms ease-in-out 4"
                  : `rally-robin-flap 460ms ease-in-out ${5000 + bobDelay.current}ms infinite`,
              }}
            />
          </span>
        </>
      )}

      {/* One bird means one bird, so anything above one is a number. The
          page-colour ring keeps it legible where it overlaps the rim. */}
      {count > 1 && !leaving && (
        <span
          aria-hidden="true"
          style={{
            ...tabular, position: "absolute", right: -9, bottom: -7, minWidth: 17, height: 17,
            borderRadius: 999, background: FEED_LIME, color: FEED_LIME_INK, fontFamily: body,
            fontWeight: 500, fontSize: 10.5, display: "grid", placeItems: "center", padding: "0 4px",
            border: "2px solid " + FEED_PAGE, boxSizing: "content-box",
          }}
        >
          {count}
        </span>
      )}
    </span>
  );
}
