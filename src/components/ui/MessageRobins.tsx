"use client";
import React, { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Robin, ROBIN_PALETTES } from "@/components/ui/Robin";
import { FEED_LIME, FEED_LIME_INK, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

// The unread count, as birds.
//
// Below four the birds ARE the badge — there is no dot, because a dot beside
// three robins is the same number said twice. At four and above the flock
// stops growing (four birds at this size is a smudge) and a count appears.
//
// The fly-in fires only when a poll sees the count go UP while the app is
// open. Never on mount and never on a tab switch: the header unmounts when
// you open Messages, so a naive "animate when I appear" would re-land the
// whole flock on every navigation, and the charm would be gone inside a day.
// The last count animated for is module state rather than component state
// precisely because it has to outlive that unmount.

let lastAnimatedCount: number | null = null;

/** Where each bird sits, how big, and which way round. */
const PERCHES = [
  { size: 25, right: -5, top: 5, flip: false, palette: 0, delay: 0 },
  { size: 23, right: 16, top: 9, flip: true, palette: 1, delay: 160 },
  { size: 20, right: 1, top: -11, flip: false, palette: 2, delay: 320 },
];

const MAX_BIRDS = 3;

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

export function MessageRobins({ count, size = 38 }: { count: number; size?: number }) {
  const [arriving, setArriving] = useState(false);
  // The flock has to outlive the count reaching zero, or reading your
  // messages makes three birds vanish mid-air. It holds the last non-zero
  // count while they leave.
  const [leaving, setLeaving] = useState(0);
  const birds = Math.min(count || leaving, MAX_BIRDS);
  // One random offset per mount, so the bobs are not breathing in sync.
  const offsets = useRef(PERCHES.map(() => Math.round(Math.random() * 800)));
  const prev = useRef<number | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = count;
    // First sight of a count this session is not an arrival.
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
        setLeaving(before);
        const t = setTimeout(() => setLeaving(0), 520);
        return () => clearTimeout(t);
      }
    }
  }, [count]);

  if (!count && !leaving) {
    return <MessageCircle size={19} color={FEED_TEXT_MID} strokeWidth={2} />;
  }

  return (
    <span style={{ position: "relative", display: "block", width: size, height: size, overflow: "visible" }}>
      <style>{KEYFRAMES}</style>
      {PERCHES.slice(0, birds).map((perch, i) => (
        <span
          key={i}
          className="rally-robin-perch"
          style={{
            position: "absolute",
            right: perch.right,
            top: perch.top,
            animation: leaving
              ? `rally-robin-out 500ms cubic-bezier(.4,0,.9,.4) ${i * 60}ms both`
              : arriving
                ? `rally-robin-in 850ms cubic-bezier(.22,.9,.3,1) ${perch.delay}ms both`
                : `rally-robin-bob 2.8s ease-in-out ${offsets.current[i]}ms infinite`,
          }}
        >
          {/* Three flaps on the approach, then one every five seconds or so
              — enough that a perched bird looks alive without becoming a
              thing you notice while reading. */}
          <Robin
            size={perch.size}
            colours={ROBIN_PALETTES[perch.palette]}
            flip={perch.flip}
            envelope={i === 0}
            wingStyle={{
              animation: arriving
                ? "rally-robin-flap 283ms ease-in-out 3"
                : `rally-robin-flap 420ms ease-in-out ${5000 + offsets.current[i]}ms infinite`,
            }}
          />
        </span>
      ))}
      {count > MAX_BIRDS && !leaving && (
        <span
          style={{
            ...tabular, position: "absolute", right: -6, bottom: -4, minWidth: 16, height: 16,
            borderRadius: 999, background: FEED_LIME, color: FEED_LIME_INK, fontFamily: body,
            fontWeight: 500, fontSize: 10, display: "grid", placeItems: "center", padding: "0 4px",
          }}
        >
          {count}
        </span>
      )}
    </span>
  );
}
