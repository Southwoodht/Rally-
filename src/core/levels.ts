import { LEVELS, SUBS } from "@/core/constants";

export function levelVal(lv) { if (!lv) return null; const ci = LEVELS.indexOf(lv.cat), si = SUBS.indexOf(lv.sub); if (ci < 0 || si < 0) return null; return ci * 3 + si; }

export function levelAt(player, ts) {
  if (player && player.levelHistory && player.levelHistory.length) {
    const y = new Date(ts).getFullYear();
    const per = player.levelHistory.find((p) => (p.from == null || y >= p.from) && (p.to == null || y <= p.to));
    return per ? { cat: per.cat, sub: per.sub } : null;
  }
  return player ? (player.level || null) : null;
}

export const isSetUp = (p) => !!(p && p.levelHistory && p.levelHistory.length);
