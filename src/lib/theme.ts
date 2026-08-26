
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

export const body = "'Inter', system-ui, sans-serif";

// Numbers only — ratings, scores, dates, counters.
export const mono = "'JetBrains Mono', 'Courier New', monospace";

export const SOFT_SHADOW = "0 8px 24px rgba(0,0,0,0.22)";
export const RADIUS = 16;
export const RADIUS_SM = 12;

export const fxBtn: CSSProperties = { flex: 1, fontFamily: body, fontWeight: 600, fontSize: 13, padding: "10px 6px", borderRadius: RADIUS_SM, cursor: "pointer", border: "none", background: PANEL2, color: CHALK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

export const fontImport = "@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');";

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
