
import type { CSSProperties } from "react";

export const COURT = "#15352a", PANEL = "#1d4636", PANEL2 = "#234f3d", CHALK = "#f5f2e9";

export const BALL = "#d9e84b", CLAY = "#cb6d47", MUTED = "#8aa79a", LINE = "rgba(245,242,233,0.12)";

export const NICKS = ["The Destroyer", "The Wall", "Silky", "The Machine", "Hurricane", "The Surgeon", "Baseline Bandit", "The Postman", "Iceman", "The Analyst", "Topspin", "The Bulldozer", "Smash Hit", "The Professor", "Nightmare", "The Cannon", "Slice King", "The Freight Train", "Deadeye", "The Magician"];

export const AVATARS = ["🎾", "🏆", "🔥", "⚡", "🐐", "🦊", "🐢", "🎯", "💪", "🧱", "👑", "🏓", "🥊", "😎", "🍕", "🤖"];

export const AV_COLORS = ["#cb6d47", "#d9e84b", "#6fa8dc", "#e0a3c3", "#8fd19e", "#e8c34a", "#b39ddb", "#f0946b"];

export const avCell = (on: boolean): CSSProperties => ({ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", cursor: "pointer", background: on ? BALL : PANEL2, border: on ? "none" : "1px solid " + LINE });

// ---- style tokens ----

// Condensed display font — reserved for big page-level headings (TABLE,
// PROFILE, COMPARE…) only. Everything else, including player names, reads
// as normal sentence-case body text now.
export const display = "'Barlow Condensed', 'Arial Narrow', sans-serif";

export const body = "-apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif";

// Numbers only — ratings, scores, dates, counters.
export const mono = "'JetBrains Mono', 'Courier New', monospace";

export const SOFT_SHADOW = "0 8px 24px rgba(0,0,0,0.22)";
export const RADIUS = 16;
export const RADIUS_SM = 12;

export const fxBtn: CSSProperties = { flex: 1, fontFamily: body, fontWeight: 600, fontSize: 13, padding: "10px 6px", borderRadius: RADIUS_SM, cursor: "pointer", border: "none", background: PANEL2, color: CHALK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

export const fontImport = "@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');";

export const wrap: CSSProperties = { background: COURT, minHeight: "100vh", width: "100%" };

export const card: CSSProperties = { background: PANEL, borderRadius: RADIUS, padding: 20, boxShadow: SOFT_SHADOW };

export const input: CSSProperties = { width: "100%", boxSizing: "border-box", background: PANEL2, color: CHALK, border: "none", borderRadius: RADIUS_SM, padding: "13px 14px", fontFamily: body, fontSize: 15, marginBottom: 0, outline: "none" };

export const miniInput: CSSProperties = { boxSizing: "border-box", background: PANEL2, color: CHALK, border: "none", borderRadius: 14, padding: "8px 10px", fontFamily: mono, fontSize: 12, outline: "none" };

export const menuRow: CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", background: PANEL, border: "none", borderRadius: RADIUS_SM, padding: "16px 16px", marginBottom: 10, cursor: "pointer" };

// One soft, shadowed card wrapping a whole list — rows separate by padding,
// not by hairline borders.
export const listCard: CSSProperties = { background: PANEL, borderRadius: RADIUS, boxShadow: SOFT_SHADOW, overflow: "hidden" };

export const listRow: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "transparent", border: "none", width: "100%", textAlign: "left", cursor: "pointer" };

// A soft filled pill — level badges, tags, status chips.
export const pill = (bg: string, fg: string): CSSProperties => ({ fontFamily: body, fontWeight: 600, fontSize: 11, color: fg, background: bg, borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap", display: "inline-block" });

// iOS-style segmented control: a recessed track holding equal-width options.
export const segmentTrack: CSSProperties = { display: "flex", gap: 2, background: "rgba(0,0,0,0.22)", borderRadius: 12, padding: 3 };

export const segmentOption = (on: boolean): CSSProperties => ({
  flex: 1, textAlign: "center", padding: "8px 10px", borderRadius: 9, border: "none", cursor: "pointer",
  fontFamily: body, fontWeight: 600, fontSize: 13,
  background: on ? PANEL2 : "transparent", color: on ? CHALK : MUTED,
  boxShadow: on ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
  transition: "background 0.15s ease, color 0.15s ease",
});

// ---- feed / scoreboard tokens ----
//
// These are the app's own colours, named for the job they do on a card.
// Almost every one of them IS a brand token above: FEED_CARD is PANEL,
// FEED_PAGE is COURT, FEED_LIME is BALL. They're aliased rather than copied
// so there is exactly one definition of each colour — the first version of
// this block sampled them by eye and every value was a shade off, which is
// what a second copy of a palette always eventually becomes.
export const FEED_PAGE = COURT;          // #15352A
export const FEED_CARD = PANEL;          // #1D4636
export const FEED_RAISED = PANEL2;       // #234F3D
export const FEED_LIME = BALL;           // #D9E84B
export const FEED_TEXT_HI = CHALK;       // #F5F2E9

// The one genuinely new colour: a step below COURT, for tiles inset into a
// card that need to read as recessed rather than raised.
export const FEED_DEEP = "#102921";

// Text on lime, and the same value as FEED_DEEP — a coincidence in the
// palette rather than a relationship, so it's named separately: changing the
// inset tile background should not silently restyle every winner bar.
export const FEED_LIME_INK = "#102921";

// Secondary text on lime. The one value here not sampled from the app,
// because nothing in the app had text on lime before this.
export const FEED_LIME_INK_2 = "#3B6D11";

// The two quiet text tiers, both measured rather than eyeballed, and both
// chosen against PANEL2 rather than PANEL. PANEL2 is the lightest surface
// either of them can land on, so it's the one that decides: a value that
// passes on the card and fails on a raised tile is a value that will fail
// the first time somebody nests one, which the Table screen is about to do.
//
// Measured contrast (PANEL2 / PANEL / DEEP):
//   FEED_TEXT_MID  5.13 / 5.85 / 8.51
//   FEED_TEXT_LOW  4.56 / 5.20 / 7.57
//
// For reference, the values these replaced: MUTED is 3.99 on PANEL2 and
// 4.07 on PANEL, and the first draft's low was #6E9782 at 3.24 — genuinely
// hard to read at 12px. MUTED itself is left alone, because it is correct
// everywhere else in the app, where it is rarely set this small.
//
// Kept a clear step apart so the hierarchy survives: low has to be quieter
// than mid AND still pass, which is only possible if mid moves up too.
export const FEED_TEXT_MID = "#A6C8B9";
export const FEED_TEXT_LOW = "#9CBDAE";

// Row dividers use the app's existing hairline rather than a green of their
// own, so a card's internal rules match every other divider in the product.
export const FEED_HAIRLINE = LINE;

// Rank movement. Not in the palette because nothing in the app moved up or
// down before; picked to sit beside the greens rather than reusing CLAY,
// which means "clay court" elsewhere and would read as a surface, not a fall.
export const FEED_UP = "#7BD88F";
export const FEED_DOWN = "#E2705F";

export const FEED_RADIUS = 20;
export const FEED_TILE_RADIUS = 14;
export const FEED_PAD = 18;

// Anything with digits lines up column-wise; anything big enough to show
// loose tracking gets pulled in.
export const tabular: CSSProperties = { fontVariantNumeric: "tabular-nums" };
export const tight = (px: number): CSSProperties => (px > 18 ? { letterSpacing: px >= 26 ? "-0.03em" : "-0.02em" } : {});
