// Weekly rank snapshots.
//
// Rally's standings are a full recompute over all history — computeStats and
// rankMaps replay every match every time. That is deliberate and it is why
// the table can never drift, but it means the past is not recoverable from
// the present: today's numbers cannot tell you where somebody stood a week
// ago, because a match logged yesterday for a game played in 2019 rewrites
// last week too. There is no incremental rating to diff against.
//
// So movement has to be remembered rather than derived. Once a week we write
// down where everybody stood, and movement is this week's rank against that
// written-down one. Nothing here reads or writes storage — see
// lib/rankSnapshots.ts for that — and nothing here decides which of the
// league's three rankings is the one being snapshotted; the caller passes
// the ranks it wants remembered.

export interface RankSnapshot {
  playerId: string;
  rank: number;
  /** Whatever the caller ranked on — ELO, Official points — so a snapshot
   *  can be read back and sanity-checked against the rank it recorded. */
  rating: number;
  /** The Sunday the week ended, as "YYYY-MM-DD". A date rather than a
   *  timestamp: two devices in different time zones writing "the week
   *  ending 6 September" should agree, and a millisecond can't do that. */
  weekEnding: string;
}

export interface RankMovement {
  previousRank: number;
  currentRank: number;
  /** Positive means they climbed. The brief defines movement as current
   *  minus previous, which is the same number with the sign flipped — this
   *  way round "up one place" is +1, so nothing downstream has to remember
   *  which direction the sign points. */
  placesGained: number;
}

const iso = (d: Date): string => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

/** The Sunday that ends the week containing `ts` — today, if today is Sunday. */
export function weekEndingFor(ts: number = Date.now()): string {
  const d = new Date(ts);
  d.setHours(12, 0, 0, 0); // midday, so a DST shift can't move the date
  d.setDate(d.getDate() - d.getDay());
  return iso(d);
}

/** The Monday six days before a week-ending Sunday. */
export function weekStartFor(weekEnding: string): string {
  const d = new Date(weekEnding + "T12:00:00");
  d.setDate(d.getDate() - 6);
  return iso(d);
}

/** One row per player, ready to store. */
export function buildSnapshots(
  ranks: Record<string, number>,
  ratings: Record<string, number>,
  weekEnding: string = weekEndingFor(),
): RankSnapshot[] {
  return Object.keys(ranks)
    .filter((playerId) => typeof ranks[playerId] === "number")
    .map((playerId) => ({
      playerId,
      rank: ranks[playerId],
      rating: typeof ratings[playerId] === "number" ? ratings[playerId] : 0,
      weekEnding,
    }));
}

/** The most recent week we have on record, or null if we have none. */
export function latestWeek(snapshots: RankSnapshot[]): string | null {
  let best: string | null = null;
  for (const s of snapshots) if (!best || s.weekEnding > best) best = s.weekEnding;
  return best;
}

/**
 * Where somebody has moved since the last week on record.
 *
 * Null when there's nothing to compare against — a first week, or a player
 * who wasn't ranked then. Null is not "no movement": a player who has never
 * been measured hasn't held still, and showing them as unchanged would be
 * inventing a fact. The card renders nothing at all in that case.
 */
export function movementFor(
  playerId: string,
  currentRank: number | null | undefined,
  snapshots: RankSnapshot[],
  before?: string,
): RankMovement | null {
  if (typeof currentRank !== "number") return null;
  const weeks = snapshots.map((s) => s.weekEnding).filter((w) => (before ? w < before : true));
  if (!weeks.length) return null;
  const week = weeks.reduce((a, b) => (b > a ? b : a));
  const prev = snapshots.find((s) => s.weekEnding === week && s.playerId === playerId);
  if (!prev) return null;
  return { previousRank: prev.rank, currentRank, placesGained: prev.rank - currentRank };
}

/**
 * The biggest movers in the league, largest climb first.
 *
 * `limit` is a cap the caller states rather than a default worth guessing
 * at: the roundup shows two, because a week's worth of a mates' league has
 * about two things worth saying and a list of eight is a standings table
 * wearing a disguise.
 */
export function topSwings(
  currentRanks: Record<string, number>,
  snapshots: RankSnapshot[],
  limit: number,
  exclude?: string,
): Array<{ playerId: string } & RankMovement> {
  const out: Array<{ playerId: string } & RankMovement> = [];
  for (const playerId of Object.keys(currentRanks)) {
    if (exclude && playerId === exclude) continue;
    const mv = movementFor(playerId, currentRanks[playerId], snapshots);
    if (mv && mv.placesGained !== 0) out.push({ playerId, ...mv });
  }
  return out
    .sort((a, b) => Math.abs(b.placesGained) - Math.abs(a.placesGained) || b.placesGained - a.placesGained)
    .slice(0, limit);
}
