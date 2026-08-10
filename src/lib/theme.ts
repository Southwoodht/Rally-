
import type { CSSProperties } from "react";

export const COURT = "#15352a", PANEL = "#1d4636", PANEL2 = "#234f3d", CHALK = "#f5f2e9";

export const BALL = "#d9e84b", CLAY = "#cb6d47", MUTED = "#8aa79a", LINE = "rgba(245,242,233,0.12)";

export const NICKS = ["The Destroyer", "The Wall", "Silky", "The Machine", "Hurricane", "The Surgeon", "Baseline Bandit", "The Postman", "Iceman", "The Analyst", "Topspin", "The Bulldozer", "Smash Hit", "The Professor", "Nightmare", "The Cannon", "Slice King", "The Freight Train", "Deadeye", "The Magician"];

export const AVATARS = ["🎾", "🏆", "🔥", "⚡", "🐐", "🦊", "🐢", "🎯", "💪", "🧱", "👑", "🏓", "🥊", "😎", "🍕", "🤖"];

export const AV_COLORS = ["#cb6d47", "#d9e84b", "#6fa8dc", "#e0a3c3", "#8fd19e", "#e8c34a", "#b39ddb", "#f0946b"];

export const avCell = (on: boolean): CSSProperties => ({ width: 38, height: 38, borderRadius: 8, display: "grid", placeItems: "center", cursor: "pointer", background: on ? BALL : PANEL2, border: "1px solid " + (on ? BALL : LINE) });

// ---- style tokens ----

export const display = "'Barlow Condensed', 'Arial Narrow', sans-serif";

export const body = "'Inter', system-ui, sans-serif";

export const mono = "'JetBrains Mono', 'Courier New', monospace";

export const fxBtn: CSSProperties = { flex: 1, fontFamily: mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, padding: "8px 6px", borderRadius: 7, cursor: "pointer", border: "1px solid " + LINE, background: PANEL2, color: CHALK, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

export const fontImport = "@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap');";

export const wrap: CSSProperties = { background: COURT, minHeight: "100vh", width: "100%" };

export const card: CSSProperties = { background: PANEL, borderRadius: 12, padding: 18, border: "1px solid " + LINE };

export const input: CSSProperties = { width: "100%", boxSizing: "border-box", background: PANEL2, color: CHALK, border: "1px solid " + LINE, borderRadius: 8, padding: "11px 12px", fontFamily: body, fontSize: 15, marginBottom: 0, outline: "none" };

export const miniInput: CSSProperties = { boxSizing: "border-box", background: PANEL2, color: CHALK, border: "1px solid " + LINE, borderRadius: 6, padding: "7px 8px", fontFamily: mono, fontSize: 12, outline: "none" };

export const menuRow: CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", background: PANEL, border: "1px solid " + LINE, borderRadius: 12, padding: "16px 16px", marginBottom: 10, cursor: "pointer" };
