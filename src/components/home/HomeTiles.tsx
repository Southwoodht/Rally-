"use client";
import React, { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { StatNumeral } from "@/components/ui/Surfaces";
import { formatMatchDateTime } from "@/lib/format";
import { FEED_CARD, FEED_LIME, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

// Two tiles, side by side, never three. At phone width a third column turns
// readable numbers into cramped ones — and there is no arrangement of three
// that doesn't force the middle one to be the shortest.

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
  /** "This week", "This month", "This year" — the words on the tile. */
  label: string;
  w: number;
  l: number;
  /** 0-100, already rounded. */
  winRate: number;
}

/** How long each one is up. Long enough to read twice without trying. */
const DWELL_MS = 4200;

const tile: React.CSSProperties = { background: FEED_CARD, borderRadius: 16, padding: 14, minWidth: 0 };
const label: React.CSSProperties = { fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW };
const line = (color: string): React.CSSProperties => ({ fontFamily: body, fontWeight: 400, fontSize: 12.5, color, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });

export function HomeTiles({ nextUp, periods, onBook }: {
  nextUp?: NextUp | null;
  /**
   * The spans worth showing, widest last. The caller drops any with no
   * matches in them: a loop that stops on "This week — nothing" twice out of
   * three is a broken-looking tile rather than an informative one, and week
   * sits inside month sits inside year, so an empty one earlier in the list
   * never means the later ones are empty too.
   */
  periods?: PeriodStat[] | null;
  onBook?: () => void;
}) {
  const list = periods && periods.length ? periods : null;
  const n = list ? list.length : 0;
  const [i, setI] = useState(0);

  // Somebody who has asked their phone to stop moving things has asked for
  // this too — a tile that rewrites itself every four seconds is exactly the
  // motion that setting is about. It still cycles on a tap, so nothing is
  // unreachable; it just never moves on its own.
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    if (n < 2 || still) return;
    const id = setInterval(() => setI((x) => (x + 1) % n), DWELL_MS);
    return () => clearInterval(id);
  }, [n, still]);

  const cur = list ? list[i % n] : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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

      {/* One tile, three spans, on a loop — because week, month and year are
          the same two numbers over different windows, and three tiles of that
          would be two tiles too many at phone width. Tap moves it on, so it
          is never a matter of waiting for the one you wanted. */}
      <button
        onClick={n > 1 ? () => setI((x) => (x + 1) % n) : undefined}
        aria-live="polite"
        aria-label={cur ? cur.label + ": " + cur.w + " won, " + cur.l + " lost, " + cur.winRate + "% win rate" : "No matches yet"}
        style={{ ...tile, textAlign: "left", border: "none", cursor: n > 1 ? "pointer" : "default", display: "block", width: "100%", font: "inherit" }}
      >
        <style>{"@keyframes rally-tile-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.rally-tile-span{animation:none!important}}"}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ ...label, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {cur ? cur.label : "This month"}
          </span>
          {/* Which of the three you are on. Three dots read as a position in
              a set; a "1/3" reads as a number you are meant to do something
              with. */}
          {n > 1 && (
            <span style={{ display: "flex", gap: 3, flexShrink: 0 }} aria-hidden="true">
              {list!.map((p2, x) => (
                <span key={p2.label} style={{ width: 4, height: 4, borderRadius: 2, background: x === i % n ? FEED_LIME : FEED_TEXT_LOW, opacity: x === i % n ? 1 : 0.45, transition: "opacity .3s ease, background .3s ease" }} />
              ))}
            </span>
          )}
        </div>
        {/* Keyed on the label so React remounts it and the fade actually
            plays. Without the key it is the same node with new text, which
            changes silently and reads as a glitch rather than a turn. */}
        <div key={cur ? cur.label : "empty"} className="rally-tile-span" style={{ animation: "rally-tile-in .32s ease both" }}>
          <div style={{ marginTop: 4 }}>
            {cur
              ? <StatNumeral size={22} tone="hi">{cur.w}–{cur.l}</StatNumeral>
              : <span style={{ fontFamily: body, fontWeight: 500, fontSize: 16, color: FEED_TEXT_MID }}>No matches yet</span>}
          </div>
          <div style={line(FEED_TEXT_MID)}>
            {cur ? cur.winRate + "% win rate" : "Log one and this fills in"}
          </div>
        </div>
      </button>
    </div>
  );
}
