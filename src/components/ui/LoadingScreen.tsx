"use client";
import React from "react";
import { FEED_LIME, FEED_PAGE, FEED_TEXT_MID, body, display } from "@/lib/theme";

/**
 * The first thing anybody sees.
 *
 * It replaced the word "Loading…" in 14px grey, which is what the app had
 * been opening with. A blank green screen with a small grey word on it reads
 * as something having gone slightly wrong even when nothing has.
 *
 * The ball bounces because the wait is the reason — CLAUDE.md's rule is that
 * animation needs one, and "this is still happening" is the clearest one
 * there is. It stops existing the moment the league arrives, so nobody has
 * to watch it for long, and the shadow squashing under the ball is what
 * stops it reading as a floating dot.
 *
 * `prefers-reduced-motion` holds it still. Somebody who has asked their
 * phone for less movement has asked this screen too.
 */
const CSS = `
        @keyframes rally-bounce {
          0%, 100% { transform: translateY(-26px) scale(1, 1); animation-timing-function: cubic-bezier(.42,0,1,1); }
          45%      { transform: translateY(0) scale(1.06, .94); animation-timing-function: cubic-bezier(0,0,.58,1); }
          50%      { transform: translateY(1px) scale(1.14, .86); }
          55%      { transform: translateY(0) scale(1.06, .94); animation-timing-function: cubic-bezier(.42,0,1,1); }
        }
        @keyframes rally-shadow {
          0%, 100% { transform: scaleX(.55); opacity: .18; }
          50%      { transform: scaleX(1); opacity: .38; }
        }
        .rally-ball { animation: rally-bounce 1.1s infinite; transform-origin: 50% 100%; }
        .rally-shadow { animation: rally-shadow 1.1s infinite; transform-origin: 50% 50%; }
        @media (prefers-reduced-motion: reduce) {
          .rally-ball, .rally-shadow { animation: none; transform: none; }
        }
      `;

export function LoadingScreen({ label = "Loading your league" }: { label?: string }) {
  return (
    <div style={{ minHeight: "100vh", background: FEED_PAGE, display: "grid", placeItems: "center", padding: 24 }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div style={{ textAlign: "center" }}>
        <div style={{ height: 64, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
          <svg className="rally-ball" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={FEED_LIME} strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M4.2 6.6A9 9 0 0 1 9.3 20.6" />
            <path d="M19.8 6.6A9 9 0 0 0 14.7 20.6" />
          </svg>
          <div className="rally-shadow" style={{ width: 30, height: 5, borderRadius: "50%", background: "#000", marginTop: 5 }} />
        </div>

        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 30, letterSpacing: "0.02em", textTransform: "uppercase", color: FEED_LIME, marginTop: 22, lineHeight: 1 }}>
          Rally
        </div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_TEXT_MID, marginTop: 8 }}>
          {label}
        </div>
      </div>
    </div>
  );
}
