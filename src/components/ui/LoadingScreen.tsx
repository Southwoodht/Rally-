"use client";
import React from "react";
import { FEED_DEEP, FEED_LIME, FEED_PAGE, FEED_TEXT_MID, body, display } from "@/lib/theme";

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
 *
 * ---
 *
 * Three animations, and they are deliberately separate rather than one
 * timeline.
 *
 * THE ENTRANCE runs once. The ball arrives already moving — it fades in
 * WHILE falling, reaching full opacity around 60% down, so the first frame
 * anybody sees is motion rather than a dot appearing and then deciding to
 * move. Sam's spec, and it is the difference between a loading screen that
 * starts and one that switches on.
 *
 * The wordmark starts rising at 560ms, which is BEFORE the ball lands at
 * 700ms. The overlap is the point: two things arriving on the same beat
 * reads as one screen assembling, where a strict sequence reads as a queue.
 *
 * THE BOUNCE takes over at exactly 700ms, and its first keyframe is the
 * contact pose the entrance ends on, so there is no seam between them. It is
 * a steady idle rather than a decay — a cold load can sit here a while, and
 * a bounce that dies out leaves a still ball on a screen that is still
 * working, which says the opposite of what it is for.
 *
 * THE SHADOW is driven by the ball's height rather than being a static
 * ellipse, and its keyframes are phase-locked to the bounce: both are
 * 1400ms, both put contact at 0%/100% and the apex across 45–55%. If either
 * cycle changes, the other has to change with it — they only look attached
 * because their numbers match.
 *
 * Its fill is FEED_DEEP and never black. A near-black ellipse on this green
 * does not read as a shadow, it reads as a hole in the screen.
 */

/** One bounce. Contact at the start and end, apex in the middle. */
const CYCLE = "1400ms";
/** How long the entrance fall takes, and therefore when the bounce starts. */
const DROP = "700ms";

const CSS = `
        @keyframes rally-drop {
          from { transform: translateY(-70px) scale(.9); }
          to   { transform: translateY(0) scale(1); }
        }
        /* Opacity is its own animation so the fall keeps ONE easing curve.
           Folded into rally-drop as a 60% keyframe it would split the
           transform into two eased segments and the fall would visibly
           hitch two thirds of the way down. 420ms is 60% of the drop. */
        @keyframes rally-fade-in { from { opacity: 0 } to { opacity: 1 } }

        @keyframes rally-shadow-in {
          from { transform: scaleX(1.2) scaleY(.75); opacity: 0; }
          to   { transform: scaleX(.75) scaleY(1.25); opacity: .55; }
        }

        @keyframes rally-bounce {
          /* 0% and 100% are BOTH the ball landed and un-squashed, and the
             squash is a 70ms event just after each landing rather than the
             pose the cycle starts in.
             
             The first version squashed AT 0%, which made both ends of the
             loop correct and the seam with the entrance wrong: the drop
             finishes at full scale and the bounce began at 1.08/.88, so at
             exactly 700ms the ball popped from scale .99 to squashed in a
             single frame. Caught by stepping the animation by hand, not by
             watching it — at 10ms it reads as a flicker you would blame on
             the phone. */
          0%     { transform: translateY(0) scale(1, 1); animation-timing-function: cubic-bezier(.3, 0, .7, 1); }
          2.5%   { transform: translateY(0) scale(1.08, .88); animation-timing-function: cubic-bezier(.3, 0, .7, 1); }
          5%     { transform: translateY(0) scale(1, 1); animation-timing-function: cubic-bezier(0, 0, .45, 1); }
          45%    { transform: translateY(-46px) scale(1, 1); animation-timing-function: linear; }
          55%    { transform: translateY(-46px) scale(1, 1); animation-timing-function: cubic-bezier(.55, 0, 1, 1); }
          100%   { transform: translateY(0) scale(1, 1); }
        }

        /* Phase-locked to rally-bounce: same duration, contact at 0/100,
           apex held across 45-55. An overhead light, so the shadow is wide
           and faint when the ball is high and tight and dark on contact. */
        @keyframes rally-shadow {
          0%     { transform: scaleX(.75) scaleY(1.25); opacity: .55; animation-timing-function: cubic-bezier(0, 0, .45, 1); }
          45%    { transform: scaleX(1.2) scaleY(.75); opacity: .22; animation-timing-function: linear; }
          55%    { transform: scaleX(1.2) scaleY(.75); opacity: .22; animation-timing-function: cubic-bezier(.55, 0, 1, 1); }
          100%   { transform: scaleX(.75) scaleY(1.25); opacity: .55; }
        }

        @keyframes rally-rise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .rally-ball {
          transform-origin: 50% 100%;
          opacity: 0;
          animation:
            rally-fade-in 420ms linear forwards,
            rally-drop ${DROP} cubic-bezier(.45, 0, .9, .45) forwards,
            rally-bounce ${CYCLE} ${DROP} infinite;
        }
        .rally-shadow {
          transform-origin: 50% 50%;
          opacity: 0;
          animation:
            rally-shadow-in ${DROP} cubic-bezier(.45, 0, .9, .45) forwards,
            rally-shadow ${CYCLE} ${DROP} infinite;
        }
        .rally-word {
          opacity: 0;
          animation: rally-rise 500ms cubic-bezier(.2, 0, 0, 1) 560ms forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          /* No drop, no bounce, no shadow. Not a gentler version of them —
             the ball and the words simply arrive. */
          .rally-ball, .rally-word {
            animation: rally-fade-in 200ms linear forwards;
            transform: none;
          }
          .rally-shadow { display: none; }
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
          <div className="rally-shadow" style={{ width: 30, height: 5, borderRadius: "50%", background: FEED_DEEP, marginTop: 5 }} />
        </div>

        <div className="rally-word">
          <div style={{ fontFamily: display, fontWeight: 700, fontSize: 30, letterSpacing: "0.02em", textTransform: "uppercase", color: FEED_LIME, marginTop: 22, lineHeight: 1 }}>
            Rally
          </div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_TEXT_MID, marginTop: 8 }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
