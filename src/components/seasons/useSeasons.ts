"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { activeSeason, seasonFromLegacy, seasonWindow, type Season } from "@/core/seasons";
import { loadSeasons } from "@/lib/seasons";

/**
 * The club's seasons: the seasons table when it exists, otherwise the one
 * season the old settings blob holds (seasonFromLegacy), so a club whose
 * database has not had schema_seasons.sql still sees its season exactly as
 * before.
 *
 * `installed` says which: false means the old blob is the source, starting
 * and ending a season still go through it, and nothing new (deadlines,
 * frozen standings) is available.
 */
export function useSeasons(leagueId: string | null, legacy: any, enabled: boolean) {
  const [rows, setRows] = useState<Season[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled || !leagueId) { setRows(null); setLoaded(true); return; }
    try { setRows(await loadSeasons(leagueId)); }
    // A failed read keeps whatever was last known rather than pretending the
    // club has no seasons (§2: a failed read is never an empty result).
    catch { /* keep rows */ }
    setLoaded(true);
  }, [leagueId, enabled]);

  useEffect(() => { void reload(); }, [reload]);

  const installed = rows !== null;
  const seasons: Season[] = useMemo(() => {
    if (rows) return rows;
    // Not the old settings-blob season while the real list is still on its
    // way. Seacourt's blob still holds the deleted "Test League" season, so
    // Home showed your place in it ("2nd") for a moment and then the real
    // all-time one ("4th") — Sam, 2026-10-24. The blob is only the fallback
    // for a database without the seasons table, i.e. after a load came back
    // with nothing.
    if (enabled && !loaded) return [];
    const l = leagueId ? seasonFromLegacy(leagueId, legacy) : null;
    return l ? [l] : [];
  }, [rows, legacy, leagueId, enabled, loaded]);

  const current = useMemo(() => activeSeason(seasons), [seasons]);
  const lastEnded = useMemo(
    () => seasons.filter((s) => s.status === "ended").sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))[0] ?? null,
    [seasons],
  );

  return { seasons, current, lastEnded, installed, loaded, reload };
}

/**
 * A season in the shape the older screens read — `{ name, start, end }` in
 * ms — alongside everything the new ones need. One object, so the Table,
 * Match detail and the trophies all mean the same days by "the season".
 */
export function seasonForScreens(s: Season | null): any {
  if (!s) return undefined;
  const w = seasonWindow(s);
  return { ...s, start: w.start, end: w.end };
}
