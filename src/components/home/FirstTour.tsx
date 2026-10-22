"use client";
import React, { useEffect, useState } from "react";
import { FEED_HERO, FEED_LIME_INK_2, FEED_ON_HERO, body, tight } from "@/lib/theme";

/**
 * The first-time tour: five steps, one per tab in the bottom bar.
 *
 * Each step switches the app to the screen it is talking about, so the card
 * describes what is actually behind it rather than a picture of it, and a
 * small pointer under the card sits over that tab in the bar. It is shown
 * once (RallyApp keeps the flag in user_storage, like the level prompt) and
 * can be taken again from Help.
 *
 * Nothing here opens Log a result: step three points at the + and explains
 * it, because a sheet you did not ask for, opened by a tour, is a result form
 * somebody will half-fill and abandon.
 */

type Step = { tab: string | null; slot: number; title: string; text: string };

const STEPS: Step[] = [
  {
    tab: "home", slot: 0,
    title: "Welcome to Southwood",
    text: "Home is where you stand: your place in the club, results waiting for your OK, and what's coming up next.",
  },
  {
    tab: "ladder", slot: 1,
    title: "One table",
    text: "Everyone ranked on one rating. The ± says how sure it is. Provisional players sit underneath until they've played a little more.",
  },
  {
    tab: null, slot: 2,
    title: "Log a result",
    text: "Tap + after every match. Your opponent has 48 hours to agree it. If you two owe each other a competition game, it asks whether this was it.",
  },
  {
    tab: "fixtures", slot: 3,
    title: "Fixtures",
    text: "Book a match, challenge someone, and see your competition games with their play-by dates. You'll get an email when somebody challenges you.",
  },
  {
    tab: "profile", slot: 4,
    title: "Your profile",
    text: "Your record and every match, with the points each one earned. The menu has your club, messages and Help — where you can take this tour again.",
  },
];

export function FirstTour({ onTab, onDone }: { onTab: (tab: string) => void; onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  useEffect(() => { if (step.tab) onTab(step.tab); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => { onTab("home"); onDone(); };
  // The pointer sits over the tab: five equal slots across the bar.
  const pointerLeft = `${(step.slot + 0.5) * 20}%`;

  return (
    <>
      {/* Taps outside the card do nothing rather than closing it: Skip is
          there for that, and a tour lost to a stray tap is not offered again. */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, bottom: 84, background: "rgba(0,0,0,0.35)", zIndex: 70 }} />
      <div
        role="dialog"
        aria-label={`Tour, step ${i + 1} of ${STEPS.length}: ${step.title}`}
        style={{ position: "fixed", left: 0, right: 0, bottom: 96, zIndex: 71, display: "flex", justifyContent: "center", padding: "0 12px", pointerEvents: "none" }}
      >
        <div style={{ position: "relative", width: "100%", maxWidth: 596, pointerEvents: "auto" }}>
          <div style={{ background: FEED_HERO, color: FEED_ON_HERO, borderRadius: 22, padding: "18px 18px 14px", boxShadow: "0 12px 32px var(--shadow-strong)" }}>
            <div style={{ fontFamily: body, fontSize: 11.5, color: FEED_LIME_INK_2 }}>{i + 1} of {STEPS.length}</div>
            <div style={{ ...tight(21), fontFamily: body, fontWeight: 500, fontSize: 21, marginTop: 4 }}>{step.title}</div>
            <div style={{ fontFamily: body, fontSize: 15, lineHeight: 1.5, marginTop: 6 }}>{step.text}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
              <div style={{ display: "flex", gap: 6, flex: 1 }}>
                {STEPS.map((_, k) => (
                  <span key={k} style={{ width: 7, height: 7, borderRadius: 999, background: FEED_ON_HERO, opacity: k === i ? 1 : 0.25 }} />
                ))}
              </div>
              {!last && (
                <button onClick={finish} style={{ background: "none", border: "none", color: FEED_LIME_INK_2, fontFamily: body, fontSize: 15, padding: "10px 12px", cursor: "pointer" }}>Skip</button>
              )}
              {i > 0 && (
                <button onClick={() => setI(i - 1)} style={{ background: "none", border: "none", color: FEED_ON_HERO, fontFamily: body, fontSize: 15, padding: "10px 12px", cursor: "pointer" }}>Back</button>
              )}
              <button
                onClick={() => (last ? finish() : setI(i + 1))}
                style={{ background: FEED_ON_HERO, color: FEED_HERO, border: "none", borderRadius: 999, fontFamily: body, fontWeight: 500, fontSize: 15, padding: "10px 20px", cursor: "pointer" }}
              >
                {last ? "Done" : "Next"}
              </button>
            </div>
          </div>
          <div aria-hidden="true" style={{ position: "absolute", bottom: -8, left: pointerLeft, transform: "translateX(-50%) rotate(45deg)", width: 16, height: 16, background: FEED_HERO, borderRadius: 3 }} />
        </div>
      </div>
    </>
  );
}
