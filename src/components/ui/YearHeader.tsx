"use client";
import React from "react";
import type { YearRecord } from "@/core/yearRecord";
import { FEED_TEXT_HI, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

/**
 * "2026 · 14–3–6 · 67%" — the line that starts each year of a match history.
 *
 * Sam asked for the years "so I can see my patterns", so the year is not just
 * a divider: it carries that year's record and win rate, and read down the
 * page the headers are the pattern. The year is the loud part and the record
 * the quiet one, the scoreboard rule — size and colour, never weight.
 */
export function YearHeader({ year, rec, style }: { year: number; rec?: YearRecord; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, ...style }}>
      <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI }}>{year}</span>
      {rec && rec.played > 0 && (
        <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID }}>
          {rec.w}–{rec.d}–{rec.l} · {rec.pct}% won
        </span>
      )}
    </div>
  );
}
