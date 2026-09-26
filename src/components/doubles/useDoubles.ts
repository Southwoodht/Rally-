"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteDoublesFixture, insertDoubles, insertDoublesFixture, loadDoublesFixturesSafe,
  loadDoublesSafe, updateDoublesFixture, type DoublesFixture, type DoublesRow,
} from "@/lib/doublesData";
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

  /** Bookings, played and unplayed. */
  fixtures: DoublesFixture[];
  /**
   * Its own flag, not `unavailable`: doubles_fixtures is a separate migration
   * from doubles_matches, so results can work on a day bookings cannot.
   */
  fixturesUnavailable: boolean;
  book: (f: { teamA: [string, string]; teamB: [string, string]; booked: number | null; createdBy: string | null }) => Promise<void>;
  reschedule: (id: string, booked: number | null) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  /** Save the result of a booking, then mark the booking played. */
  complete: (f: DoublesFixture, m: { sets: Array<{ a: number; b: number }>; winner: string; enteredBy: string }) => Promise<void>;
  /** Fixtures created elsewhere (a competition draw), shown without a reload. */
  addFixtures: (list: DoublesFixture[]) => void;
  /** A deleted competition's fixtures went with it (cascade). */
  dropCompetitionFixtures: (competitionId: string) => void;
}

const EMPTY: DoublesStats = {
  elo: {}, played: {}, won: {}, lost: {}, drawn: {},
  currentStreak: {}, bestStreak: {}, deltas: [],
};

export function useDoubles(leagueId: string, enabled: boolean): UseDoubles {
  const [matches, setMatches] = useState<DoublesRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [fixtures, setFixtures] = useState<DoublesFixture[]>([]);
  const [fixturesUnavailable, setFixturesUnavailable] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled || !leagueId) return;
    setLoading(true);
    const [rows, fx] = await Promise.all([loadDoublesSafe(leagueId), loadDoublesFixturesSafe(leagueId)]);
    if (rows === null) { setUnavailable(true); setMatches([]); }
    else { setUnavailable(false); setMatches(rows); }
    if (fx === null) { setFixturesUnavailable(true); setFixtures([]); }
    else { setFixturesUnavailable(false); setFixtures(fx); }
    setLoading(false);
  }, [leagueId, enabled]);

  useEffect(() => {
    if (!enabled) { setMatches([]); setUnavailable(false); setFixtures([]); setFixturesUnavailable(false); return; }
    void reload();
  }, [enabled, reload]);

  const add = useCallback(async (m: Parameters<typeof insertDoubles>[1]) => {
    const saved = await insertDoubles(leagueId, m);
    // Append rather than refetch: the row that comes back is what the
    // database stored, trigger and all, so the screen shows what is really
    // there. A refetch would be a second round trip to learn the same thing.
    setMatches((prev) => [...prev, saved]);
  }, [leagueId]);

  const book = useCallback(async (f: Parameters<UseDoubles["book"]>[0]) => {
    const saved = await insertDoublesFixture(leagueId, f);
    setFixtures((prev) => [...prev, saved]);
  }, [leagueId]);

  const reschedule = useCallback(async (id: string, booked: number | null) => {
    await updateDoublesFixture(id, { booked });
    setFixtures((prev) => prev.map((f) => (f.id === id ? { ...f, booked } : f)));
  }, []);

  const cancel = useCallback(async (id: string) => {
    await deleteDoublesFixture(id);
    setFixtures((prev) => prev.filter((f) => f.id !== id));
  }, []);

  /**
   * TWO WRITES, NOT ONE, and the order is chosen for how it fails.
   *
   * There is no transaction across them (CLAUDE.md §7 records the same gap
   * on singles). Match first, then the booking: if the second write fails,
   * the result is safely stored and the booking is still sitting open, which
   * is visible and fixable by cancelling it. The other order can leave a
   * booking marked played that points at a match nobody saved — the exact
   * shape §7 warns about — and nothing on screen would say so.
   *
   * fixture_id on doubles_matches is deliberately NOT written: it references
   * the singles fixtures table, so a doubles booking's id would break the
   * foreign key. doubles_fixtures.match_id is the link, as the migration says.
   */
  const complete = useCallback(async (f: DoublesFixture, m: { sets: Array<{ a: number; b: number }>; winner: string; enteredBy: string }) => {
    const saved = await insertDoubles(leagueId, {
      teamA: f.teamA, teamB: f.teamB, sets: m.sets, winner: m.winner, enteredBy: m.enteredBy,
      // A competition tie records which ENTRIES played, which is what the
      // competition's table counts. Null on an ordinary booking.
      competitionId: f.competitionId, teamAPairId: f.pairA, teamBPairId: f.pairB,
      // Dated from the booking, as singles does: Saturday's match entered on
      // Monday is still Saturday's, and the rating replays in date order.
      playedAt: f.booked ?? Date.now(),
    });
    setMatches((prev) => [...prev, saved]);
    try {
      await updateDoublesFixture(f.id, { done: true, matchId: saved.id });
    } catch {
      throw new Error("Result saved, but the booking is still showing as unplayed. Cancel it to tidy up.");
    }
    setFixtures((prev) => prev.map((x) => (x.id === f.id ? { ...x, done: true, matchId: saved.id } : x)));
  }, [leagueId]);

  const addFixtures = useCallback((list: DoublesFixture[]) => {
    setFixtures((prev) => [...prev, ...list.filter((f) => !prev.some((x) => x.id === f.id))]);
  }, []);
  const dropCompetitionFixtures = useCallback((competitionId: string) => {
    setFixtures((prev) => prev.filter((f) => f.competitionId !== competitionId));
  }, []);

  const stats = useMemo(() => (enabled ? computeDoubles(matches) : EMPTY), [enabled, matches]);

  return { matches, stats, loading, unavailable, reload, add, fixtures, fixturesUnavailable, book, reschedule, cancel, complete, addFixtures, dropCompetitionFixtures };
}
