"use client";
import React from "react";
import { CalendarPlus } from "lucide-react";
import { Cycler } from "@/components/ui/Cycler";
import { StatNumeral } from "@/components/ui/Surfaces";
import { formatMatchDateTime } from "@/lib/format";
import { FEED_CARD, FEED_LIME, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

// Two tiles, side by side, never three. At phone width a third column turns
// readable numbers into cramped ones — and there is no arrangement of three
// that doesn't force the middle one to be the shortest.
//
// The pair turns together under one heading rather than carrying a heading
// each. Two tiles that each said "This week" would say it twice, and the
// first attempt — where the right-hand one just read "Opponents" while its
// dots moved — left the number with nothing saying which span it was for.
// One span, stated once, over both numbers: that is what they have in common
// and it is the thing that is changing.
//
// It sits directly under the standing card, which turns on the same beat, so
// the two read as one thing the screen does rather than two things twitching
// near each other. Next Up moved below them and went full width, which it
// wanted anyway — its line about your chances had been truncating in half a
// tile.

export interface NextUp {
  /** Their full name. A first name alone is ambiguous in a club with two
   *  Charlies, and this is the one line telling you who to turn up against. */
  opponent: string;
  /** The stored booking time. Formatted here, not by the caller, so every
   *  screen showing a booking says it the same way. */
  when: any;
  /** What the app reckons, in words. */
  line?: string | null;
  /** Your chance, rounded. Null when there is nothing to go on. */
  winChance?: number | null;
}

export interface PeriodStat {
  /** "This week", "This month", "This year" — the heading over the pair. */
  label: string;
  w: number;
  l: number;
  /** 0-100, already rounded. Null when nothing was played: 0/0 is not 0%. */
  winRate: number | null;
  /** How many different people, and how many matches, over the same span. */
  opponents: number;
  /**
   * Different people you beat, and different people who beat you.
   *
   * They overlap on purpose: split two matches with somebody and they count
   * in both, because you did beat them and you did lose to them. So these two
   * need not sum to the number faced, and making them would mean choosing
   * which of those true things to drop.
   */
  beaten: number;
  lostTo: number;
  played: number;
}

const tile: React.CSSProperties = { background: FEED_CARD, borderRadius: 16, padding: 14, minWidth: 0 };
const label: React.CSSProperties = { fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW };
const line = (color: string): React.CSSProperties => ({ fontFamily: body, fontWeight: 400, fontSize: 12.5, color, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });

export function HomeTiles({ nextUp, periods, onBook }: {
  nextUp?: NextUp | null;
  /**
   * The spans to show, widest last — empty ones included. An empty week is a
   * fact about the week, and a panel that leaves one out is one you cannot
   * read as complete.
   */
  periods?: PeriodStat[] | null;
  onBook?: () => void;
}) {
  const list = periods && periods.length ? periods : null;
  const labels = list ? list.map((p) => p.label) : ["This month"];

  // One card, two halves, the number and its line side by side (Sam,
  // 2026-10-24: "make the weekly record card more compact"). It was two
  // tiles of three stacked rows each; the same facts now take one row.
  const pair = (i: number) => {
    const p = list?.[i];
    const half = (heading: string, value: React.ReactNode, sub: string) => (
      <div style={{ minWidth: 0 }}>
        <div style={label}>{heading}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2, minWidth: 0 }}>
          <span style={{ flexShrink: 0 }}>{value}</span>
          <span style={{ ...line(FEED_TEXT_MID), marginTop: 0, minWidth: 0 }}>{sub}</span>
        </div>
      </div>
    );
    const none = <span style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_MID }}>None yet</span>;
    return (
      <div style={{ ...tile, padding: "10px 14px", marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {half(
          "Won / lost",
          p ? <StatNumeral size={20} tone={p.winRate === null ? "mid" : "hi"}>{p.w}–{p.l}</StatNumeral> : none,
          !p ? "" : p.winRate === null ? "Nothing played" : p.winRate + "%",
        )}
        {/* Different people, not matches played: six games against one
            person is a rivalry, six against six people is a season. */}
        {half(
          "Opponents",
          p ? <StatNumeral size={20} tone={p.opponents ? "hi" : "mid"}>{p.opponents}</StatNumeral> : none,
          !p || !p.played ? "" : p.beaten + " beat · " + p.lostTo + " lost to",
        )}
      </div>
    );
  };

  return (
    <>
      <div style={{ marginBottom: 10 }}>
        <Cycler
          labels={labels}
          render={pair}
          labelColor={FEED_TEXT_LOW}
          dotColor={FEED_LIME}
          labelStyle={{ paddingLeft: 2 }}
          ariaLabel="Your record and opponents, by period"
        />
      </div>

      {/* Nothing booked isn't an empty tile — an empty tile is a dead end.
          It becomes the way to fix the thing it's reporting. */}
      {nextUp ? (
        <div style={tile}>
          <div style={label}>Next up</div>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 16, color: FEED_TEXT_HI, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {nextUp.opponent}
          </div>
          <div style={{ ...line(FEED_TEXT_MID), ...tabular }}>{formatMatchDateTime(nextUp.when)}</div>
          {/* What the app reckons, said the way somebody would say it. The
              number is the app's; the sentence is for the person reading it
              ten minutes before they leave the house. */}
          {nextUp.line && (
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, marginTop: 6, lineHeight: 1.4 }}>
              {nextUp.line}
              {nextUp.winChance != null && (
                <span style={{ ...tabular, color: FEED_LIME, marginLeft: 6 }}>{nextUp.winChance}%</span>
              )}
            </div>
          )}
        </div>
      ) : (
        <button onClick={onBook} style={{ ...tile, textAlign: "left", border: "none", cursor: onBook ? "pointer" : "default", display: "block", width: "100%" }}>
          <div style={label}>Next up</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <CalendarPlus size={16} color={FEED_LIME} strokeWidth={2} />
            <span style={{ fontFamily: body, fontWeight: 500, fontSize: 16, color: FEED_LIME }}>Book a match</span>
          </div>
          <div style={line(FEED_TEXT_MID)}>Nothing in the diary</div>
        </button>
      )}
    </>
  );
}
