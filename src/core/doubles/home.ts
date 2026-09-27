/**
 * Everything the DOUBLES Home shows, from one pass — the twin of homeData in
 * RallyApp, which does the same for singles.
 *
 * Sam, 27 Sep 2026: "can we have it have its own page ... exact same layout
 * and widgets that rotate to month year week etc. just a twin but doubles
 * version". So this returns the same things the singles Home is built from —
 * a standing, a last match, days since, this week, week/month/year periods,
 * two suggestions and the next booking — measured on doubles, and the screen
 * draws them with the very same components.
 *
 * Numbers only; no names and no formatting. The screen turns ids into names,
 * which is what lets a test pin this down exactly.
 *
 * CONFIRMED ONLY, the doubles rule (computeDoubles), so nothing on this page
 * can disagree with the doubles table.
 */
import { computeDoubles, isProvisional, predictDoubles, type DoublesMatch, type DoublesSlot } from "./elo";
import { doublesMovement, doublesPlace } from "./standings";

export type WDL = "W" | "D" | "L";

export interface DoublesFixtureRef {
  id: string; teamA: [string, string]; teamB: [string, string];
  booked: number | null; done: boolean;
}

const counts = (m: DoublesMatch) => m.status === undefined || m.status === "confirmed";
const DAY = 86400000;

export function doublesHome(
  matches: DoublesMatch[],
  players: Array<{ id: string; name?: string; inactive?: boolean }>,
  meId: string,
  fixtures: DoublesFixtureRef[] = [],
  now: number = Date.now(),
) {
  const stats = computeDoubles(matches);
  const mine = matches
    .filter((m) => counts(m) && [...m.teamA, ...m.teamB].includes(meId))
    .sort((a, b) => a.playedAt - b.playedAt);

  const side = (m: DoublesMatch) => (m.teamA.includes(meId) ? "A" : "B");
  const outcome = (m: DoublesMatch): WDL => (m.winner === "draw" ? "D" : m.winner === side(m) ? "W" : "L");
  const partnerOf = (m: DoublesMatch): DoublesSlot => {
    const t = side(m) === "A" ? m.teamA : m.teamB;
    return t[0] === meId ? t[1] : t[0];
  };
  const opponentsOf = (m: DoublesMatch): [DoublesSlot, DoublesSlot] => (side(m) === "A" ? m.teamB : m.teamA);

  // --- standing --------------------------------------------------------------
  const played = stats.played[meId] || 0;
  const standing = played ? {
    rank: isProvisional(stats, meId) ? null : doublesPlace(stats, players, meId),
    played,
    rating: Math.round(stats.elo[meId] ?? 0),
    movement: isProvisional(stats, meId) ? null : doublesMovement(matches, players, meId, now),
    form: mine.slice(-5).map(outcome),
  } : null;

  // --- the calendar, as the singles Home counts it ------------------------
  // Calendar spans, week starting Monday — the singles rule, so "this week"
  // means the same thing on both halves of the app.
  const d = new Date(now);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const weekFrom = midnight - ((new Date(midnight).getDay() + 6) % 7) * DAY;
  const spans = [
    { key: "week" as const, from: weekFrom },
    { key: "month" as const, from: new Date(d.getFullYear(), d.getMonth(), 1).getTime() },
    { key: "year" as const, from: new Date(d.getFullYear(), 0, 1).getTime() },
  ];
  const periods = spans.map(({ key, from }) => {
    const within = mine.filter((m) => m.playedAt >= from && m.playedAt <= now);
    const people = new Set<string>();
    within.forEach((m) => opponentsOf(m).forEach((id) => { if (id) people.add(id); }));
    return {
      key, from,
      w: within.filter((m) => outcome(m) === "W").length,
      d: within.filter((m) => outcome(m) === "D").length,
      l: within.filter((m) => outcome(m) === "L").length,
      opponents: people.size,
      /** Newest first. */
      matches: within.slice().reverse(),
      results: within.map(outcome),
    };
  });

  // --- last match -------------------------------------------------------------
  const last = mine.length ? mine[mine.length - 1] : null;
  const dayStart = (t: number) => { const x = new Date(t); return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
  const daysSince = last ? Math.max(0, Math.round((midnight - dayStart(last.playedAt)) / DAY)) : null;
  const lastMatch = last ? { opponents: opponentsOf(last), partner: partnerOf(last), outcome: outcome(last), date: last.playedAt } : null;

  // --- two people worth a game --------------------------------------------------
  // The singles rule, on doubles terms: nearness on the doubles rating, with
  // a nudge towards people you have not shared a court with lately (as
  // partner or opponent — either is a game together). Staleness capped at
  // 180 days so a stranger does not outrank the whole club on novelty alone.
  const lastWith: Record<string, number> = {};
  mine.forEach((m) => [...m.teamA, ...m.teamB].forEach((id) => {
    if (id && id !== meId && (!lastWith[id] || m.playedAt > lastWith[id])) lastWith[id] = m.playedAt;
  }));
  const myRating = stats.elo[meId];
  const suggestions = myRating === undefined ? [] : players
    .filter((p) => !p.inactive && p.id !== meId && (stats.played[p.id] || 0) > 0)
    .map((p) => {
      const gap = Math.abs((stats.elo[p.id] ?? 1500) - myRating);
      const since = lastWith[p.id] ? (now - lastWith[p.id]) / DAY : null;
      const stale = since === null ? 120 : Math.min(180, since);
      return { id: p.id, since, lastTs: lastWith[p.id] ?? null, score: gap / 10 - stale / 12 };
    })
    .sort((a, b) => a.score - b.score || (a.id < b.id ? -1 : 1))
    .slice(0, 2)
    .map(({ id, since, lastTs }) => ({
      id,
      reason: since === null ? ("never" as const) : since >= 60 ? ("since" as const) : ("close" as const),
      lastTs,
    }));

  // --- next booking -------------------------------------------------------------
  const next = fixtures
    .filter((f) => !f.done && f.booked != null && f.booked > now && [...f.teamA, ...f.teamB].includes(meId))
    .sort((a, b) => (a.booked as number) - (b.booked as number))[0];
  const nextUp = next ? (() => {
    const onA = next.teamA.includes(meId);
    const mineT = onA ? next.teamA : next.teamB;
    const theirs = onA ? next.teamB : next.teamA;
    return {
      fixtureId: next.id,
      partner: mineT[0] === meId ? mineT[1] : mineT[0],
      opponents: theirs,
      booked: next.booked as number,
      winChance: Math.round(predictDoubles(mineT, theirs, stats) * 100),
    };
  })() : null;

  return { stats, standing, periods, daysSince, lastMatch, suggestions, nextUp };
}
