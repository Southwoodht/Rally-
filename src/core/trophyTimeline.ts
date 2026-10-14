/**
 * Where a trophy sits in somebody's history.
 *
 * Sam, 2026-10-14: a trophy should "come up in match history" so anyone can
 * see "they were having a great year and ended it with a title". Two places
 * it can sit, with two different standards of evidence:
 *
 *  - IN THE TIMELINE, among the matches, only with a real date (`won_on`).
 *    An honour recorded as "2019" is not put on 31 December 2019: that would
 *    be a date nobody gave, and it would sit after matches it may well have
 *    come before. The same no-guessing rule as levels (CLAUDE.md §2).
 *  - UNDER ITS YEAR, beside that year's record, with a date or with a season
 *    that names exactly one year. "2025/26" names two and is left out rather
 *    than assigned to either.
 *
 * Pure: no React, no Supabase. The field names are the database's, because
 * that is the shape every caller already holds.
 */

export interface TrophyLike {
  id: string;
  competition?: string | null;
  result?: string | null;
  season?: string | null;
  /** "YYYY-MM-DD", or null. */
  won_on?: string | null;
  /** "singles" | "doubles", or null for not said (schema_trophy_format.sql). */
  format?: string | null;
}

export type TrophySide = "singles" | "doubles";

/**
 * Which side of the app an honour belongs on. Only an explicit "doubles"
 * goes to the doubles side; anything else — including every trophy recorded
 * before the column existed — stays on the singles side, where all of them
 * always showed. A trophy is never counted in a rating either way (Sam,
 * 2026-10-14): the matches that won it do that when they are logged.
 */
export const onSide = (t: TrophyLike, side: TrophySide): boolean =>
  side === "doubles" ? t.format === "doubles" : t.format !== "doubles";

/** The form's first guess from the competition's name, until somebody picks. */
export const guessFormat = (competition: string): TrophySide =>
  /\b(doubles|pairs|mixed)\b/i.test(competition) ? "doubles" : "singles";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The moment to sort a dated trophy at: late on the day it was won, so it
 * lands after that day's matches — the final comes before the presentation.
 * 22:00 UTC is 22:00 or 23:00 in London, so it never crosses into the next
 * London day, and on 31 December (GMT) never into the next year.
 */
export function trophyTs(t: TrophyLike): number | null {
  const m = ISO_DAY.exec((t.won_on || "").slice(0, 10));
  if (!m) return null;
  const ts = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 22, 0);
  return Number.isFinite(ts) ? ts : null;
}

/** The year it belongs under, or null when nothing says so unambiguously. */
export function trophyYear(t: TrophyLike): number | null {
  const m = ISO_DAY.exec((t.won_on || "").slice(0, 10));
  if (m) return Number(m[1]);
  // "2025/26", "2025-26": a season spanning two years names neither.
  if (/\b(19|20)\d{2}\s*[\/–-]\s*\d{2}(\d{2})?\b/.test(t.season || "")) return null;
  const years = (t.season || "").match(/\b(19|20)\d{2}\b/g) || [];
  const distinct = Array.from(new Set(years));
  return distinct.length === 1 ? Number(distinct[0]) : null;
}

/** "Champion — Men's Singles", or the competition alone. */
export function trophyTitle(t: TrophyLike): string {
  const comp = (t.competition || "").trim() || "Trophy";
  const res = (t.result || "").trim();
  return res ? res + " — " + comp : comp;
}

/** "12 Oct 2026", from the stored day — no clock involved, so no timezone. */
export function trophyDateLabel(t: TrophyLike): string | null {
  const m = ISO_DAY.exec((t.won_on || "").slice(0, 10));
  if (!m) return null;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return Number(m[3]) + " " + MONTHS[Number(m[2]) - 1] + " " + m[1];
}

/** Each year's honours, for the year headers, oldest-won first. */
export function honoursByYear(trophies: TrophyLike[]): Record<number, string[]> {
  const out: Record<number, { ts: number; title: string }[]> = {};
  for (const t of trophies) {
    const y = trophyYear(t);
    if (y == null) continue;
    (out[y] = out[y] || []).push({ ts: trophyTs(t) ?? 0, title: trophyTitle(t) });
  }
  const res: Record<number, string[]> = {};
  for (const y of Object.keys(out)) res[Number(y)] = out[Number(y)].sort((a, b) => a.ts - b.ts).map((x) => x.title);
  return res;
}
