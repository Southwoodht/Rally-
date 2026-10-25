"use client";
import React from "react";
import { CalendarDays } from "lucide-react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { dayNumber, daysLeft, daysLeftLabel, daysToStart, londonDay } from "@/core/seasons";
import { formatMatchDate } from "@/lib/format";
import { FEED_BAR, FEED_CARD, FEED_LIME, FEED_TEXT_HI, FEED_TEXT_MID, body, display, tabular, tight } from "@/lib/theme";

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
  // Sam: the old card (icon, name, two dates under a bar) "looks a bit
  // spreadsheet". The countdown is the one number worth seeing, so it is the
  // big one; the dates shrink to months either end of the bar, with today
  // marked on it.
  const big = notYet ? daysToStart(season) : season.endsOn ? daysLeft(season) : null;
  const bigLabel = notYet ? (big === 1 ? "day to go" : "days to go") : big === 1 ? "day left" : "days left";
  const showBig = big != null && big > 0 && season.status !== "ended";
  const month = (v: any) => {
    const t = formatMatchDate(v);
    const parts = t.split(" ");
    return parts.length >= 3 ? parts[parts.length - 2] : t;
  };
  return (
    <SurfaceCard radius={20} pad="14px 16px" style={{ marginBottom: 14, cursor: onOpen ? "pointer" : "default", ...style }} onClick={onOpen}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {showBig ? (
          <div style={{ textAlign: "center", flexShrink: 0, minWidth: 64 }}>
            <div style={{ ...tabular, ...tight(40), fontFamily: display, fontWeight: 700, fontSize: 40, lineHeight: 1, color: FEED_TEXT_HI }}>{big}</div>
            <div style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: FEED_TEXT_MID, marginTop: 4 }}>{bigLabel}</div>
          </div>
        ) : (
          <CalendarDays size={22} color={FEED_LIME} strokeWidth={2} style={{ flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 16, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {season.name}
          </div>
          {season.endsOn && !notYet ? (
            <>
              <div style={{ position: "relative", height: 6, background: FEED_BAR, borderRadius: 3, marginTop: 10 }}>
                <div style={{ width: pct + "%", height: "100%", background: FEED_LIME, borderRadius: 3 }} />
                <div style={{ position: "absolute", top: "50%", left: `calc(${pct}% - 6px)`, width: 12, height: 12, marginTop: -6, borderRadius: 999, background: FEED_LIME, boxShadow: "0 0 0 3px " + FEED_CARD }} />
              </div>
              <div style={{ ...tabular, display: "flex", justifyContent: "space-between", fontFamily: body, fontWeight: 600, fontSize: 12, color: FEED_TEXT_MID, marginTop: 7 }}>
                <span>{month(season.start)}</span>
                <span>{pct}% through</span>
                <span>{month(season.end)}</span>
              </div>
            </>
          ) : (
            <div style={{ ...tabular, fontFamily: body, fontWeight: 600, fontSize: 13, color: FEED_TEXT_MID, marginTop: 4 }}>
              {notYet ? "Starts " + formatMatchDate(season.start) : showBig ? "" : right}
            </div>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}
