"use client";
import React from "react";
import { BALL, COURT } from "@/lib/theme";

// A carrier pigeon, drawn rather than an emoji.
//
// Emoji render as whatever the device decides — Apple's glossy 3D bell on an
// iPhone, something else entirely on Android — so they never match the rest
// of the app and always look borrowed. This is a flat silhouette in the
// app's own colours at whatever size it's asked for, and it says what the
// thing actually does: something has been sent to you.
export function MessengerBird({ size = 18, color = BALL, eye = COURT }: { size?: number; color?: string; eye?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ display: "block" }}>
      <path
        d="M2.4 16.3c4-.2 6.9-1.4 8.9-3.6l.2 6.1c0 .6.7.9 1.2.5l2-1.7c.2-.2.3-.4.3-.7l.2-5c2.2-1.5 3.6-3.6 4.1-6.3l2.2-1.6c.5-.4.3-1.2-.3-1.3l-2.2-.4C18.3 1.5 17.3 1 16.2 1c-2 0-3.6 1.6-3.6 3.6v.4C7.9 6 4.4 9.1 1.7 14.9c-.3.7.1 1.4.7 1.4z"
        fill={color}
      />
      <circle cx="16.4" cy="4.2" r="0.95" fill={eye} />
    </svg>
  );
}
