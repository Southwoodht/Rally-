// UTR (Universal Tennis Rating, 1 to 16.5) turned into Southwood's level, and
// so into its stars. Sam, 2026-10-24: "my stars are better but can't beat
// them, join them" — the stars stay the thing everyone reads, and a player
// who has a UTR gets their stars from it instead of from a guess.
//
// The rule is a band of UTR per tier, the bands Sam was shown:
//   Beginner 1-3 · Amateur 3-5 · Intermediate 5-7 · Advanced 7-9 ·
//   Semi-pro 9-12 · Pro 12+
// and Low / Medium / High by thirds inside each band. A straight "half a
// star per UTR point" was tried first and is wrong at the top: it made a UTR
// 10.5 (a college player) a Pro. UTR 3.2 is Amateur / Low.
//
// UTR only sets where somebody starts, exactly as a level does. Results move
// the rating, never this.

import { LEVELS, SUBS } from "./constants";

export const UTR_MIN = 1;
export const UTR_MAX = 16.5;

/** A typed UTR as a number, or null when it isn't one. "3,2" is read as 3.2. */
export function parseUtr(text: string | number | null | undefined): number | null {
  if (text == null || text === "") return null;
  const n = typeof text === "number" ? text : Number(String(text).trim().replace(",", "."));
  if (!Number.isFinite(n) || n < UTR_MIN || n > UTR_MAX) return null;
  return Math.round(n * 100) / 100;
}

/** Where each tier starts on the UTR scale, Beginner first. */
export const UTR_BANDS = [1, 3, 5, 7, 9, 12];

/** The level a UTR stands for. */
export function levelForUtr(utr: number): { cat: string; sub: string } {
  const u = Math.max(UTR_MIN, Math.min(UTR_MAX, utr));
  let t = 0;
  while (t + 1 < UTR_BANDS.length && u >= UTR_BANDS[t + 1]) t++;
  const lo = UTR_BANDS[t], hi = t + 1 < UTR_BANDS.length ? UTR_BANDS[t + 1] : UTR_MAX;
  const sub = Math.min(SUBS.length - 1, Math.floor(((u - lo) / (hi - lo)) * SUBS.length));
  return { cat: LEVELS[t], sub: SUBS[sub] };
}

/** "UTR 3.2" — one decimal unless the second one was given. */
export function utrLabel(utr: number): string {
  const s = Math.round(utr * 100) % 10 === 0 ? utr.toFixed(1) : utr.toFixed(2);
  return "UTR " + s;
}
