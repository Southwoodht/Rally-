"use client";
import { useCallback, useEffect, useState } from "react";
import { loadCompetitionsSafe } from "@/lib/doublesData";
import type { Competition, CompetitionPair } from "@/core/doubles/competition";

/**
 * The league's doubles competitions and their pairs. One load, like
 * useDoubles, and it does nothing at all when the league has competitions
 * switched off — the flag is leagues.competitions_enabled, added by
 * schema_doubles.sql and off everywhere.
 */
export function useCompetitions(leagueId: string, enabled: boolean) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [pairs, setPairs] = useState<CompetitionPair[]>([]);
  /** The read failed — most likely schema_doubles_competitions.sql not run. */
  const [unavailable, setUnavailable] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled || !leagueId) return;
    const r = await loadCompetitionsSafe(leagueId);
    if (r === null) { setUnavailable(true); setCompetitions([]); setPairs([]); return; }
    setUnavailable(false); setCompetitions(r.competitions); setPairs(r.pairs);
  }, [leagueId, enabled]);

  useEffect(() => {
    if (!enabled) { setCompetitions([]); setPairs([]); setUnavailable(false); return; }
    void reload();
  }, [enabled, reload]);

  const added = useCallback((c: Competition, ps: CompetitionPair[]) => {
    setCompetitions((prev) => [...prev, c]);
    setPairs((prev) => [...prev, ...ps]);
  }, []);
  const removed = useCallback((id: string) => {
    setCompetitions((prev) => prev.filter((c) => c.id !== id));
    setPairs((prev) => prev.filter((p) => p.competitionId !== id));
  }, []);
  const statusChanged = useCallback((id: string, status: Competition["status"]) => {
    setCompetitions((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  }, []);

  return { competitions, pairs, unavailable, reload, added, removed, statusChanged };
}
