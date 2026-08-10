import { AV_COLORS } from "@/lib/theme";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const fmtDate = (ts) => new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const shortTier = (l) => (l ? l.cat.slice(0, 3) + " · " + l.sub : null);

export const winPct = (r) => (r && r.gp ? (r.w + r.d * 0.5) / r.gp : 0);

export const colorFor = (id) => { let s = 0; for (let i = 0; i < id.length; i++) s += id.charCodeAt(i); return AV_COLORS[s % AV_COLORS.length]; };

export const D = (s) => new Date(s).getTime();

export const recordStr = (r) => (r.d > 0 ? r.w + "-" + r.d + "-" + r.l : r.w + "-" + r.l);

export const winnerLabel = (m, nameOf) => m.winner === "draw" ? nameOf(m.p1) + " drew " + nameOf(m.p2) : nameOf(m.winner === "p1" ? m.p1 : m.p2) + " beat " + nameOf(m.winner === "p1" ? m.p2 : m.p1);
