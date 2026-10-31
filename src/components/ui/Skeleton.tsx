"use client";
import React from "react";
import { FEED_CARD, FEED_RAISED } from "@/lib/theme";

/**
 * Skeleton placeholders (2026-10-31): grey shapes where the content will be,
 * in the layout it will have, instead of a spinner or the word "Loading…".
 * The page keeps its shape as it fills, so nothing jumps. A slow sheen runs
 * across them (globals.css .sw-skel); off under reduced motion.
 */

export function Skel({ w = "100%", h = 14, r = 7, style }: { w?: number | string; h?: number; r?: number; style?: React.CSSProperties }) {
  return <span aria-hidden="true" className="sw-skel" style={{ display: "block", width: w, height: h, borderRadius: r, background: FEED_RAISED, ...style }} />;
}

/** A list of rows: avatar, two lines, a number on the right. */
export function SkelRows({ n = 4, avatar = true, card = true }: { n?: number; avatar?: boolean; card?: boolean }) {
  const widths = ["58%", "44%", "66%", "50%", "62%", "40%"];
  const rows = Array.from({ length: n }, (_, i) => (
    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: i ? "1px solid " + FEED_RAISED : "none" }}>
      {avatar && <Skel w={40} h={40} r={20} style={{ flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Skel w={widths[i % widths.length]} h={14} />
        <Skel w="34%" h={10} style={{ marginTop: 8, opacity: 0.7 }} />
      </div>
      <Skel w={44} h={18} style={{ flexShrink: 0 }} />
    </div>
  ));
  return <div role="status" aria-label="Loading" style={card ? { background: FEED_CARD, borderRadius: 16, overflow: "hidden" } : undefined}>{rows}</div>;
}

/** A big card: a heading, a large number and a footer line — the hero cards. */
export function SkelCard({ height = 170 }: { height?: number }) {
  return (
    <div aria-hidden="true" style={{ background: FEED_CARD, borderRadius: 22, padding: "18px 18px", height, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      <Skel w={110} h={12} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16 }}>
        <Skel w={90} h={52} r={10} />
        <Skel w={80} h={34} r={8} />
      </div>
      <div style={{ flex: 1 }} />
      <Skel w="40%" h={10} style={{ opacity: 0.7 }} />
    </div>
  );
}

/** A club opening: the top row, a title, the hero card, then rows — Home's shape. */
export function AppSkeleton() {
  return (
    <div role="status" aria-label="Loading your club" style={{ minHeight: "100vh", background: "var(--bg-page)", padding: "calc(env(safe-area-inset-top) + 14px) 16px 24px", boxSizing: "border-box", maxWidth: 620, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Skel w={34} h={34} r={9} />
        <Skel w={120} h={34} r={17} />
        <div style={{ flex: 1 }} />
        <Skel w={40} h={40} r={20} /><Skel w={40} h={40} r={20} /><Skel w={40} h={40} r={20} />
      </div>
      <Skel w="62%" h={32} r={9} style={{ marginTop: 22 }} />
      <div style={{ marginTop: 18 }}><SkelCard /></div>
      <div style={{ marginTop: 16 }}><SkelRows n={4} /></div>
    </div>
  );
}
