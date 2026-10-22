/**
 * Which reminder emails are due (winter brief item 6). Pure: the daily job in
 * app/api/cron/reminders asks these questions of every open fixture and sends
 * what they say. The log in public.email_log makes each send happen once, so
 * these only have to say "due", never "not sent yet".
 *
 *  - Result reminder: a booked match whose end passed more than a day ago and
 *    nobody has entered (Sam's brief: "if nobody has logged within 24 hours").
 *    Stops after a week, the same week the Home prompt gives up after
 *    (AUTO_CANCEL_DAYS) — a reminder for a match a month old is noise.
 *  - Deadline: a competition tie still to play, 7 days and 2 days before its
 *    play-by date, counted in UK days.
 */
import { AUTO_CANCEL_DAYS, DEFAULT_DURATION_MINUTES } from "./booking";
import { dayNumber } from "./seasons";

export interface FixtureForEmail {
  id: string;
  done?: boolean;
  outcome?: string | null;
  booked?: string | null;
  durationMinutes?: number | null;
  competitionId?: string | null;
  playBy?: string | null;
}

const HOUR = 3600 * 1000;

export function resultReminderDue(f: FixtureForEmail, now: number): boolean {
  if (f.done || f.outcome || !f.booked) return false;
  const start = new Date(f.booked).getTime();
  if (isNaN(start)) return false;
  const ends = start + (f.durationMinutes || DEFAULT_DURATION_MINUTES) * 60000;
  return now > ends + 24 * HOUR && now < ends + AUTO_CANCEL_DAYS * 24 * HOUR;
}

/** 7 or 2 when a warning is due today (a UK "YYYY-MM-DD"), otherwise null. */
export function deadlineWarningDue(f: FixtureForEmail, today: string): 7 | 2 | null {
  if (!f.competitionId || f.done || f.outcome || !f.playBy) return null;
  const left = dayNumber(f.playBy) - dayNumber(today);
  return left === 7 ? 7 : left === 2 ? 2 : null;
}
