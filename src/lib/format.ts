import { AV_COLORS } from "@/lib/theme";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const fmtDate = (ts) => new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// How a player is named on a card or a table row: their first name.
// Not the full name, which cannot wrap into the space these give it, and
// not the `nick` field, which is the joke one — a dice button fills it from
// a list containing "The Destroyer", and in Seacourt it holds "Cheese" for
// a player who is not the one everybody calls Cheese. One definition, so
// every screen names people the same way.
// "Evening, Sam". Boundaries at 12 and 18 because that is what people
// actually mean by them — not 17, which reads as evening to a clock and as
// mid-afternoon to anybody outside.
export const greetingFor = (name: string, at: Date = new Date()): string => {
  const h = at.getHours();
  const part = h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
  return name ? part + ", " + name : part;
};

// The full name, for the few places with room for it and a reason to be
// precise — a best win is a thing you tell people about, and "Charlie" is
// two different players in this league.
export const fullNameOf = (p: any): string => (p ? p.name + (p.last ? " " + p.last : "") : "Someone");

export const shortNameOf = (p: any): string => (p?.name || p?.nick || "Someone");

export const shortTier = (l) => (l ? l.cat.slice(0, 3) + " · " + l.sub : null);

export const winPct = (r) => (r && r.gp ? (r.w + r.d * 0.5) / r.gp : 0);

export const colorFor = (id) => { let s = 0; for (let i = 0; i < id.length; i++) s += id.charCodeAt(i); return AV_COLORS[s % AV_COLORS.length]; };

export const D = (s) => new Date(s).getTime();

export const recordStr = (r) => (r.d > 0 ? r.w + "-" + r.d + "-" + r.l : r.w + "-" + r.l);

export const winnerLabel = (m, nameOf) => m.winner === "draw" ? nameOf(m.p1) + " drew " + nameOf(m.p2) : nameOf(m.winner === "p1" ? m.p1 : m.p2) + " beat " + nameOf(m.winner === "p1" ? m.p2 : m.p1);

// "auto-confirms in ~6h" / "auto-confirms in ~1 day" — makes the 24h rule
// concrete wherever a pending match or edit is shown, instead of just
// implying it. loggedAt is sourced from the match row's own created_at.
export const autoConfirmNote = (loggedAt: number | undefined | null) => {
  if (!loggedAt) return null;
  const remaining = loggedAt + 24 * 3600 * 1000 - Date.now();
  if (remaining <= 0) return "confirming automatically now…";
  const hrs = Math.ceil(remaining / 3600000);
  return hrs <= 1 ? "auto-confirms within the hour" : hrs < 24 ? `auto-confirms in ~${hrs}h` : "auto-confirms in ~1 day";
};

// Same shape as autoConfirmNote, for a pending delete request instead of a
// pending new result — "deletes automatically" rather than "confirms".
export const deleteTimeoutNote = (requestedAt: number | undefined | null) => {
  if (!requestedAt) return null;
  const remaining = requestedAt + 24 * 3600 * 1000 - Date.now();
  if (remaining <= 0) return "deleting automatically now…";
  const hrs = Math.ceil(remaining / 3600000);
  return hrs <= 1 ? "deletes automatically within the hour" : hrs < 24 ? `deletes automatically in ~${hrs}h` : "deletes automatically in ~1 day";
};

/**
 * The one way an upcoming match says when it is.
 *
 * "Sat 12 Sep 2026 · 2:00pm", always Europe/London. Every screen that shows a
 * booking uses this, because the alternative — and what was there before — is
 * each screen inventing its own, and one of them printing the raw timestamp.
 *
 * London rather than the device's zone on purpose: a club plays where the
 * club is. Somebody checking their fixtures from a hotel in Spain should read
 * the time they will actually turn up at, not that time shifted an hour.
 */
export function formatMatchDateTime(value: any): string {
  const d = new Date(value);
  if (!value || isNaN(d.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d).replace(/\s?([ap])\.?m\.?/i, (_m, p) => p.toLowerCase() + "m");
  // en-GB renders "Sat, 12 Sept 2026"; the comma and the four-letter Sept are
  // both noise at this size.
  return day.replace(/,/g, "").replace(/\bSept\b/, "Sep") + " · " + time;
}

/** A past match's date. Same vocabulary, without a time nobody recorded. */
export function formatMatchDate(value: any): string {
  const d = new Date(value);
  if (!value || isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric",
  }).format(d).replace(/,/g, "").replace(/\bSept\b/, "Sep");
}
