"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { insertDoubles, loadDoublesSafe, type DoublesRow } from "@/lib/doublesData";
import { computeDoubles, type DoublesStats } from "@/core/doubles/elo";

/**
 * Every screen's doubles data, in one place.
 *
 * ONE LOAD PER LEAGUE, not one per screen. Home, Table and Profile all want
 * the same matches and the same derived ratings, and three components each
 * fetching and each running computeDoubles would be three chances for them to
 * disagree about what a player's rating is. Singles has exactly this shape
 * already: RallyApp holds the matches and passes them down.
 *
 * IT DOES NOTHING AT ALL WHEN THE FLAG IS OFF. No fetch, no state, no work —
 * `enabled` is checked before anything else, so a league that has not turned
 * doubles on pays nothing for the feature existing and cannot see it.
 */

export interface UseDoubles {
  /** Confirmed and pending, as stored. The engine filters pending itself. */
  matches: DoublesRow[];
  stats: DoublesStats;
  loading: boolean;
  /**
   * True when the read failed rather than returning nothing — most likely
   * schema_doubles.sql not run. Kept separate from an empty list on purpose:
   * "nobody has played doubles" and "could not ask" are different answers and
   * a screen that shows the first when it means the second is lying.
   */
  unavailable: boolean;
  reload: () => Promise<void>;
  add: (m: Parameters<typeof insertDoubles>[1]) => Promise<void>;
}

const EMPTY: DoublesStats = {
  elo: {}, played: {}, won: {}, lost: {}, drawn: {},
  currentStreak: {}, bestStreak: {}, deltas: [],
};

export function useDoubles(leagueId: string, enabled: boolean): UseDoubles {
  const [matches, setMatches] = useState<DoublesRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled || !leagueId) return;
    setLoading(true);
    const rows = await loadDoublesSafe(leagueId);
    if (rows === null) { setUnavailable(true); setMatches([]); }
    else { setUnavailable(false); setMatches(rows); }
    setLoading(false);
  }, [leagueId, enabled]);

  useEffect(() => {
    if (!enabled) { setMatches([]); setUnavailable(false); return; }
    void reload();
  }, [enabled, reload]);

  const add = useCallback(async (m: Parameters<typeof insertDoubles>[1]) => {
    const saved = await insertDoubles(leagueId, m);
    // Append rather than refetch: the row that comes back is what the
    // database stored, trigger and all, so the screen shows what is really
    // there. A refetch would be a second round trip to learn the same thing.
    setMatches((prev) => [...prev, saved]);
  }, [leagueId]);

  const stats = useMemo(() => (enabled ? computeDoubles(matches) : EMPTY), [enabled, matches]);

  return { matches, stats, loading, unavailable, reload, add };
}
