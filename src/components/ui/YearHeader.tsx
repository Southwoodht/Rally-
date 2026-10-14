"use client";
import React from "react";
import { Trophy } from "lucide-react";
import type { YearRecord } from "@/core/yearRecord";
import { FEED_LIME, FEED_TEXT_HI, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

/**
 * "2026 · 14–3–6 · 67%" — the line that starts each year of a match history.
 *
 * Sam asked for the years "so I can see my patterns", so the year is not just
 * a divider: it carries that year's record and win rate, and read down the
 * page the headers are the pattern. The year is the loud part and the record
 * the quiet one, the scoreboard rule — size and colour, never weight.
 *
 * And the year's honours under it (2026-10-14): "a great year ... ended with
 * a title" is the record and the title read together, so they sit together.
 * Dated or not — the header is a claim about the year, which a season of
 * "2019" supports; only the timeline row needs the day.
 */
export function YearHeader({ year, rec, honours, style }: { year: number; rec?: YearRecord; honours?: string[]; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI }}>{year}</span>
        {rec && rec.played > 0 && (
          <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID }}>
            {rec.w}–{rec.d}–{rec.l} · {rec.pct}% won
          </span>
        )}
      </div>
      {honours && honours.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, minWidth: 0 }}>
          <Trophy size={13} color={FEED_LIME} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_LIME, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {honours.join(" · ")}
          </span>
        </div>
      )}
    </div>
  );
}
