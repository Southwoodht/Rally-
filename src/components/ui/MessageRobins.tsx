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

const KEYFRAMES = `
@keyframes rally-robin-in {
  0%   { transform: translate(26px, -30px) rotate(9deg); opacity: 0; }
  70%  { transform: translate(-2px, 2px) rotate(-3deg); opacity: 1; }
  100% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
}
@keyframes rally-robin-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-1px); }
}
@keyframes rally-robin-flap {
  0%, 100% { transform: rotate(0deg); }
  50%      { transform: rotate(-52deg); }
}
@keyframes rally-robin-out {
  0%   { transform: translate(0, 0); opacity: 1; }
  100% { transform: translate(30px, -34px) rotate(11deg); opacity: 0; }
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
      const t = setTimeout(() => setArriving(false), 900);
      return () => clearTimeout(t);
    }
    if (count < before) {
      lastAnimatedCount = count;
      if (count === 0 && before > 0) {
        setLeaving(true);
        const t = setTimeout(() => setLeaving(false), 520);
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
                ? "rally-robin-out 500ms cubic-bezier(.4,0,.9,.4) both"
                : arriving
                  ? "rally-robin-in 850ms cubic-bezier(.22,.9,.3,1) both"
                  : `rally-robin-bob 2.8s ease-in-out ${bobDelay.current}ms infinite`,
            }}
          >
            {/* Three flaps on the approach, then one every five seconds, so a
                perched bird looks alive without becoming something you notice
                while reading. */}
            <Robin
              size={BIRD.size}
              colours={ROBIN_PALETTES[0]}
              envelope
              wingStyle={{
                animation: arriving
                  ? "rally-robin-flap 283ms ease-in-out 3"
                  : `rally-robin-flap 420ms ease-in-out ${5000 + bobDelay.current}ms infinite`,
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
