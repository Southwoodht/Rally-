"use client";
import React from "react";
import { BALL } from "@/lib/theme";

// A bell, for notifications.
//
// The pigeon moved to messages, where the metaphor actually holds — a
// messenger pigeon carries a message. Notifications are the other thing: not
// something a person sent you, something that happened. A bell says that, and
// the complaint was never the bell, it was 🔔 rendering as Apple's glossy 3D
// one on an iPhone and something else everywhere else. This is drawn.
//
// `ring` swings it while there's something waiting. It stops the moment the
// count clears, because a permanently animating icon on a screen someone is
// reading is an irritation rather than an alert.
export function Bell({
  size = 18,
  color = BALL,
  ring = false,
}: { size?: number; color?: string; ring?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ display: "block" }}>
      <style>{"@keyframes rally-ring{0%,55%,100%{transform:rotate(0deg)}8%{transform:rotate(-14deg)}18%{transform:rotate(11deg)}28%{transform:rotate(-7deg)}38%{transform:rotate(4deg)}47%{transform:rotate(-2deg)}}"}</style>
      <g
        style={{
          transformBox: "fill-box",
          transformOrigin: "50% 8%",
          animation: ring ? "rally-ring 2.2s ease-in-out infinite" : "none",
        }}
      >
        <path
          d="M12 2.2 A1.7 1.7 0 0 1 13.7 3.9 V4.6 A6.4 6.4 0 0 1 18.4 10.8 V14.4 L20.1 17.2 A1 1 0 0 1 19.2 18.7 H4.8 A1 1 0 0 1 3.9 17.2 L5.6 14.4 V10.8 A6.4 6.4 0 0 1 10.3 4.6 V3.9 A1.7 1.7 0 0 1 12 2.2 Z"
          fill={color}
        />
        <path d="M9.4 20.0 H14.6 A2.6 2.6 0 0 1 9.4 20.0 Z" fill={color} />
      </g>
    </svg>
  );
}
