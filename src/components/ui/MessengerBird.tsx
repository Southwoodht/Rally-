"use client";
import React from "react";
import { BALL, COURT } from "@/lib/theme";

// A carrier pigeon, for messages — a messenger pigeon carries a message.
//
// Drawn rather than an emoji, because emoji render as whatever the device
// decides: Apple's glossy 3D one on an iPhone, something else on Android. It
// never matches the rest of the app and always looks borrowed. This is a flat
// silhouette in the app's own colours at whatever size it's asked for.
//
// Body and tail are one continuous sweep, and the wing is a separate path
// that rises up and *back* — a wing pointing the same way as the head reads
// as a dart, not a bird. `flap` beats it; without it the wing holds a raised
// glide, which is what you want on a screen someone is trying to read.
export function MessengerBird({
  size = 18,
  color = BALL,
  eye = COURT,
  flap = false,
}: { size?: number; color?: string; eye?: string; flap?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ display: "block" }}>
      <style>{"@keyframes rally-flap{0%,100%{transform:rotate(0deg)}45%{transform:rotate(46deg)}}"}</style>
      <path
        d="M1.6 19.2 C4.4 15.2 8.6 12.4 13.5 11.5 C15.0 11.2 16.4 11.3 17.5 11.8 L21.9 10.5 C22.7 10.3 23.3 11.3 22.6 11.8 L20.3 13.5 C20.0 16.5 17.2 18.8 13.4 19.2 C9.4 19.6 5.2 19.6 1.6 19.2 Z"
        fill={color}
      />
      <path
        d="M12.6 13.4 C10.6 10.2 9.3 6.6 8.9 2.8 C12.1 5.2 14.3 8.5 15.3 12.3 Z"
        fill={color}
        opacity={0.9}
        style={{
          transformBox: "fill-box",
          transformOrigin: "92% 92%",
          animation: flap ? "rally-flap 0.6s ease-in-out infinite" : "none",
          transform: flap ? undefined : "rotate(14deg)",
        }}
      />
      <circle cx="18.7" cy="12.4" r="0.85" fill={eye} />
    </svg>
  );
}
