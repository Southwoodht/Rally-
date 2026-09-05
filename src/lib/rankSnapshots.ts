import { RankSnapshot, latestWeek, weekEndingFor } from "@/core/snapshots";
import storage from "@/lib/storage";

// Reading and writing the weekly rank snapshots. All the arithmetic lives in
// core/snapshots.ts; this file only knows where they're kept.
//
// Snapshots are shared, not per-user: everybody in a league has to see the
// same movement, and a per-device copy would give two people different
// answers about whether Zaach went up.

const keyFor = (leagueId: string) => `league:${leagueId}:rankSnapshots`;

/** Weeks kept. Six months is plenty for "up 1 place" and stops one league's
 *  row growing without limit; nothing reads further back than last week. */
const KEEP_WEEKS = 26;

/**
 * Every snapshot we hold for a league.
 *
 * Throws when the read fails, and that is the whole point of this function.
 * storage.get already distinguishes "no row" from "couldn't reach Supabase",
 * and the one thing that must never happen here is a failed read arriving at
 * recordWeek() as an empty list — it would append this week to nothing and
 * write that back, erasing every week we had. Same discipline as
 * leagueData.ts. Callers that just want to render should catch and hide the
 * movement line; callers that intend to write must let it throw.
 */
export async function loadSnapshots(leagueId: string): Promise<RankSnapshot[]> {
  const row = await storage.get(keyFor(leagueId), true);
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? (parsed as RankSnapshot[]) : [];
  } catch {
    // Unparseable is not empty either: something is in there and we can't
    // read it, so refuse rather than overwrite it on the next write.
    throw new Error("Rank snapshots for this league are stored in a form this app can't read.");
  }
}

/**
 * Write this week's standings down, once.
 *
 * Idempotent by week: calling it twice on the same Sunday replaces that
 * week's rows rather than doubling them, so it doesn't matter how many
 * devices run it or how often. It reads before it writes, and a failed read
 * throws out of here without touching anything.
 */
export async function recordWeek(
  leagueId: string,
  snapshots: RankSnapshot[],
  weekEnding: string = weekEndingFor(),
): Promise<RankSnapshot[]> {
  if (!leagueId || !snapshots.length) return [];
  const existing = await loadSnapshots(leagueId);
  const kept = existing.filter((s) => s.weekEnding !== weekEnding);
  const merged = [...kept, ...snapshots.map((s) => ({ ...s, weekEnding }))];

  const weeks = Array.from(new Set(merged.map((s) => s.weekEnding))).sort();
  const cutoff = weeks.slice(-KEEP_WEEKS)[0];
  const pruned = cutoff ? merged.filter((s) => s.weekEnding >= cutoff) : merged;

  await storage.set(keyFor(leagueId), JSON.stringify(pruned), true);
  return pruned;
}

/**
 * Whether this week has already been written down.
 *
 * The caller decides when to run — this only answers what's on record, so a
 * "write it on Sunday night" trigger doesn't need to remember whether it
 * already fired.
 */
export function alreadyRecorded(snapshots: RankSnapshot[], weekEnding: string = weekEndingFor()): boolean {
  return snapshots.some((s) => s.weekEnding === weekEnding);
}

export { latestWeek };
