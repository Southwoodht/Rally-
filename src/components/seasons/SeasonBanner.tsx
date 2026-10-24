"use client";
import React from "react";
import { CalendarDays } from "lucide-react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { dayNumber, daysLeftLabel, daysToStart, londonDay } from "@/core/seasons";
import { formatMatchDate } from "@/lib/format";
import { FEED_BAR, FEED_LIME, FEED_TEXT_HI, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

/**
 * "Winter 2026/27 · 132 days left", at the top of Home and the Table.
 *
 * Brief item 1. The countdown already existed, but below the table and only
 * when the table's period filter happened to be on the season — so pinning
 * "2026" hid it for good, and Sam had never seen it. Here it is the first
 * thing on both screens while a season runs, whatever the table is showing.
 *
 * Before the season starts it counts to the start instead; with no end date
 * it says so rather than inventing a finish.
 */
export function SeasonBanner({ season, onOpen, style }: { season: any; onOpen?: () => void; style?: React.CSSProperties }) {
  if (!season) return null;
  const notYet = daysToStart(season) > 0;
  const right = notYet
    ? (daysToStart(season) === 1 ? "Starts tomorrow" : `Starts in ${daysToStart(season)} days`)
    : daysLeftLabel(season);
  const total = season.endsOn ? Math.max(1, dayNumber(season.endsOn) - dayNumber(season.startsOn) + 1) : 0;
  const done = season.endsOn && !notYet ? Math.min(total, dayNumber(londonDay()) - dayNumber(season.startsOn) + 1) : 0;
  const pct = total ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0;
  return (
    <SurfaceCard radius={18} pad="12px 14px" style={{ marginBottom: 14, cursor: onOpen ? "pointer" : "default", ...style }} onClick={onOpen}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <CalendarDays size={17} color={FEED_LIME} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {season.name}
        </span>
        <span style={{ ...tabular, fontFamily: body, fontSize: 13, color: FEED_LIME, flexShrink: 0 }}>{right}</span>
      </div>
      {season.endsOn && (
        <>
          <div style={{ height: 4, background: FEED_BAR, borderRadius: 2, overflow: "hidden", marginTop: 10 }}>
            <div style={{ width: pct + "%", height: "100%", background: FEED_LIME }} />
          </div>
          <div style={{ ...tabular, display: "flex", justifyContent: "space-between", fontFamily: body, fontSize: 11.5, color: FEED_TEXT_MID, marginTop: 5 }}>
            <span>{formatMatchDate(season.start)}</span>
            <span>{formatMatchDate(season.end)}</span>
          </div>
        </>
      )}
    </SurfaceCard>
  );
}
