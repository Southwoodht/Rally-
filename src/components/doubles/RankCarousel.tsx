"use client";
import React, { useEffect, useRef, useState } from "react";
import { FEED_TEXT_DIM, FEED_TEXT_HI, FEED_TEXT_MID, body } from "@/lib/theme";

/**
 * The Home rank card as two swipeable pages — Appendix A.
 *
 * Page 1 is the singles card, passed in as a child and rendered exactly as it
 * is today. This component adds no styling to it and does not know what it
 * contains. That is the whole design: singles must not change, so the
 * carousel wraps rather than rewrites.
 *
 * IT IS A REAL SCROLLER, NOT A TRANSFORM. Native scroll-snap gives momentum,
 * rubber-banding and the flick feel the platform already has, which a
 * touch-handler reimplementation gets subtly wrong on both iOS and Android.
 * It also means the page keeps working if JavaScript is busy.
 *
 * THE PAGE IS REMEMBERED PER DEVICE, in localStorage rather than in
 * user_storage. Which card you last looked at is a convenience about this
 * phone, not a fact about you — and CLAUDE.md's rule for browser storage
 * applies: every read and write is wrapped, because a private window or
 * cleared site data makes it throw, and the card has to render correctly
 * when it comes back empty.
 */

const KEY = "rally-rank-page";

const readPage = (): number => {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "1" ? 1 : 0;
  } catch { return 0; }
};

const writePage = (i: number) => {
  try { window.localStorage.setItem(KEY, String(i)); } catch { /* a preference, not a requirement */ }
};

interface Props {
  /** [singles, doubles] — exactly two. */
  children: [React.ReactNode, React.ReactNode];
  /** When false the singles card renders alone, with no carousel at all. */
  enabled?: boolean;
}

export function RankCarousel({ children, enabled = true }: Props) {
  const [page, setPage] = useState(0);
  const strip = useRef<HTMLDivElement | null>(null);
  const restored = useRef(false);

  // Restore after mount, never during render: the boot value comes from
  // localStorage, which does not exist on the server, and reading it in
  // render would mean the markup and the first paint disagree.
  useEffect(() => {
    if (!enabled) return;
    const saved = readPage();
    setPage(saved);
    if (saved && strip.current) {
      // No smooth behaviour on the restore — animating to where you already
      // were reads as the card sliding away from you as the screen opens.
      strip.current.scrollTo({ left: strip.current.clientWidth, behavior: "auto" });
    }
    restored.current = true;
  }, [enabled]);

  if (!enabled) return <>{children[0]}</>;

  const onScroll = () => {
    const el = strip.current;
    if (!el || !restored.current) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== page) { setPage(i); writePage(i); }
  };

  const go = (i: number) => {
    strip.current?.scrollTo({ left: i * (strip.current?.clientWidth || 0), behavior: "smooth" });
  };

  return (
    <>
      <div
        ref={strip}
        onScroll={onScroll}
        style={{
          display: "flex", overflowX: "auto", overflowY: "hidden",
          scrollSnapType: "x mandatory", scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {[0, 1].map((i) => (
          <div key={i} style={{ flex: "0 0 100%", minWidth: "100%", scrollSnapAlign: "start" }}>
            {children[i]}
          </div>
        ))}
      </div>

      {/* The indicator sits under the card rather than on it. Appendix A
          draws it inside the cream card, but it has to serve BOTH pages and
          the singles card is not ours to add anything to — putting it here
          is the one place it can live without either card owning it.

          ITS COLOURS ARE PAGE COLOURS, NOT CARD COLOURS, and that took
          rendering it to notice. The first version used --on-hero, which is
          correct for ink ON the cream card and is the page's own background
          colour everywhere else: on rally both are #16271F, so the dots were
          invisible — dark green on dark green, with the hint text below them
          reading as the only thing there. A token named for what it sits on
          is wrong the moment the thing moves off it. */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 5, marginTop: 10 }}>
        {[0, 1].map((i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={i === 0 ? "Singles" : "Doubles"}
            aria-current={page === i}
            style={{
              width: page === i ? 18 : 7, height: 7, borderRadius: 4, border: "none", padding: 0,
              background: page === i ? FEED_TEXT_HI : FEED_TEXT_DIM,
              cursor: "pointer", transition: "width 160ms ease",
            }}
          />
        ))}
      </div>

      <div style={{ textAlign: "center", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 8 }}>
        {page === 0 ? "Swipe for doubles" : "Swipe for singles"}
      </div>
    </>
  );
}
