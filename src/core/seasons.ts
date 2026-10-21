/**
 * Seasons: a club's named stretch of time, and the dates hung off it.
 *
 * Winter pilot, 2026-10-21 (SOUTHWOOD_WINTER_BRIEF.md item 1). Before this a
 * season was a `{ name, start, end }` object inside the club's settings
 * blob: a date filter and nothing more, deleted outright when it ended, so a
 * finished season left no record at all. Now it is a row with a status, and
 * competitions and their deadlines hang off it.
 *
 * Every date here is a calendar DAY, "YYYY-MM-DD", read on the UK clock —
 * the same rule as formatMatchDateTime: a club plays where the club is. A
 * season "1 Nov – 31 Mar" means those days in Fareham, wherever the phone is.
 *
 * Pure: no React, no Supabase.
 */

export type SeasonStatus = "active" | "ended";

export interface Season {
  id: string;
  leagueId: string;
  name: string;
  /** "YYYY-MM-DD", inclusive. */
  startsOn: string;
  /** "YYYY-MM-DD", inclusive, or null for an open-ended season. */
  endsOn: string | null;
  status: SeasonStatus;
  /** When it was closed, ms — the moment its standings froze. */
  endedAt: number | null;
}

const DAY_MS = 86400000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's date in the UK, "YYYY-MM-DD". */
export function londonDay(ts: number = Date.now()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
}

/** A day as a whole number, for arithmetic between days. Timezone-free. */
export function dayNumber(day: string): number {
  const m = ISO_DAY.exec(day);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS;
}

/** The day `n` days after `day`. */
export function addDays(day: string, n: number): string {
  const d = new Date((dayNumber(day) + n) * DAY_MS);
  return d.toISOString().slice(0, 10);
}

/**
 * The first moment of a UK day, as a timestamp. Midnight in London is 00:00
 * UTC in winter and 23:00 UTC the day before in summer, so the offset is read
 * for that day rather than assumed.
 */
export function londonDayStart(day: string): number {
  const utcMidnight = dayNumber(day) * DAY_MS;
  // What London's clock reads at UTC midnight: 00 in GMT, 01 in BST.
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).format(new Date(utcMidnight)));
  return utcMidnight - hour * 3600000;
}

/** [start, end] of a season as timestamps; end is the last moment of endsOn. */
export function seasonWindow(s: Pick<Season, "startsOn" | "endsOn">): { start: number; end: number | null } {
  return {
    start: londonDayStart(s.startsOn),
    end: s.endsOn ? londonDayStart(addDays(s.endsOn, 1)) - 1 : null,
  };
}

/** Whether a match played at `ts` belongs to the season. */
export function inSeason(s: Pick<Season, "startsOn" | "endsOn">, ts: number): boolean {
  const w = seasonWindow(s);
  return ts >= w.start && (w.end == null || ts <= w.end);
}

/**
 * Whole days left after today: 0 means today is the last day, 1 means
 * tomorrow is. Null when the season has no end date; negative once it is over.
 */
export function daysLeft(s: Pick<Season, "endsOn">, now: number = Date.now()): number | null {
  if (!s.endsOn) return null;
  return dayNumber(s.endsOn) - dayNumber(londonDay(now));
}

/** "132 days left", "Last day", "Tomorrow is the last day", "Ended". */
export function daysLeftLabel(s: Pick<Season, "endsOn" | "status">, now: number = Date.now()): string {
  if (s.status === "ended") return "Ended";
  const d = daysLeft(s, now);
  if (d == null) return "No end date";
  if (d < 0) return "Ended";
  if (d === 0) return "Last day";
  if (d === 1) return "1 day left";
  return d + " days left";
}

/** Not started yet: the countdown counts to the start instead. */
export function daysToStart(s: Pick<Season, "startsOn">, now: number = Date.now()): number {
  return dayNumber(s.startsOn) - dayNumber(londonDay(now));
}

/** An active season whose last day has passed, and so should now close. */
export function isDueToClose(s: Season, now: number = Date.now()): boolean {
  return s.status === "active" && !!s.endsOn && dayNumber(londonDay(now)) > dayNumber(s.endsOn);
}

/** The club's running season, if any — at most one, the database says so. */
export function activeSeason(seasons: Season[]): Season | null {
  return seasons.find((s) => s.status === "active") ?? null;
}

/**
 * Play-by dates for `rounds` rounds, spread evenly from `from` to `endsOn`.
 *
 * Sam, 2026-10-21: spread evenly, with organisers able to move any one
 * round's date afterwards ("winter weather will need flexibility"). So this
 * is only the starting point; the dates are stored per fixture and edited
 * there.
 *
 * Round r of R gets from + round(r × span / R) days, so the last round's
 * deadline is the season's last day and no round gets less than its share.
 * `from` is the season start, or today if the competition is created after
 * the season began — a deadline in the past on the day a fixture is made is
 * an overdue flag nobody earned.
 */
export function roundDeadlines(from: string, endsOn: string, rounds: number): string[] {
  if (rounds <= 0) return [];
  const span = Math.max(0, dayNumber(endsOn) - dayNumber(from));
  const out: string[] = [];
  for (let r = 1; r <= rounds; r++) out.push(addDays(from, Math.round((r * span) / rounds)));
  return out;
}

/** Later of two days. */
export const laterDay = (a: string, b: string): string => (dayNumber(a) >= dayNumber(b) ? a : b);

// ------------------------------------------------------------- fixtures

/** What an organiser decided about a tie nobody played. */
export type TieOutcome = "walkover_p1" | "walkover_p2" | "void";

export type TieState = "played" | "walkover" | "void" | "overdue" | "open";

/**
 * Where a competition fixture stands. Played wins over everything (a result
 * is a result); an organiser's walkover or void comes next; otherwise it is
 * overdue once its play-by day has passed, on the UK clock.
 */
export function tieState(f: { done?: boolean; outcome?: string | null; playBy?: string | null }, now: number = Date.now()): TieState {
  if (f.done) return "played";
  if (f.outcome === "void") return "void";
  if (f.outcome === "walkover_p1" || f.outcome === "walkover_p2") return "walkover";
  if (f.playBy && dayNumber(londonDay(now)) > dayNumber(f.playBy)) return "overdue";
  return "open";
}

// --------------------------------------------------- the old settings blob

/**
 * The season as it lived before the seasons table: `group.season` in the
 * club's settings blob, `{ name, start: ms, end: ms | null }`. Read so a club
 * whose database has not had schema_seasons.sql still sees its season, and
 * so the migration's copy and the app agree on what the old one meant.
 */
export function seasonFromLegacy(leagueId: string, legacy: any): Season | null {
  if (!legacy || typeof legacy.start !== "number") return null;
  return {
    id: "legacy",
    leagueId,
    name: String(legacy.name || "Season"),
    startsOn: londonDay(legacy.start),
    endsOn: typeof legacy.end === "number" ? londonDay(legacy.end) : null,
    status: "active",
    endedAt: null,
  };
}
