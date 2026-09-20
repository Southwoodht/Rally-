"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { SurfaceCard, StatNumeral } from "@/components/ui/Surfaces";
import { ratingTimeline, timelinePath, type RatingTimeline } from "@/core/ratingTimeline";
import { formatMatchDate } from "@/lib/format";
import {
  DOT_DRAW, DOT_LOSS, DOT_WIN, FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_TEXT_HI,
  FEED_TEXT_LOW, FEED_TEXT_MID, body, tabular,
} from "@/lib/theme";

// Your rating, as the line it has always been.
//
// The app has computed this the whole time and thrown it away: computeStats
// walks every match in date order and records what both players were rated
// walking on court, because ranking a best win needs it. Add each match's
// delta and that is a career.
//
// Every point is a match, so tapping one opens it. That is the reason to draw
// it at all — a chart nobody can interrogate is decoration, and this one
// answers "what happened in that dip" with the actual match.

const HEIGHT = 132;
/** Below this many matches a line is a couple of segments and says nothing. */
const MIN_POINTS = 3;

export function RatingLine({
  playerId, matches, ratingBefore, deltas, startRating, nameOf, onOpenMatch,
}: {
  playerId: string;
  matches: any[];
  ratingBefore: Record<string, Record<string, number>>;
  deltas: Record<string, Record<string, number>>;
  startRating?: number;
  nameOf: (id: string) => string;
  onOpenMatch?: (matchId: string) => void;
}) {
  // Width is measured rather than assumed. A viewBox that stretches would
  // turn the dots into ellipses, and a fixed one would letterbox on a wide
  // phone — neither is worth the trouble it saves.
  const box = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const t: RatingTimeline = useMemo(
    () => ratingTimeline(playerId, matches, ratingBefore, deltas, startRating),
    [playerId, matches, ratingBefore, deltas, startRating],
  );

  const geom = useMemo(
    () => (width > 0 ? timelinePath(t, width, HEIGHT) : { d: "", area: "", xy: [] }),
    [t, width],
  );

  // Hooks are all above this. A return before them is the crash §8 records,
  // and scripts/check-hook-order.js is what now catches it.
  if (t.points.length < MIN_POINTS) return null;

  const now = t.points[t.points.length - 1].rating;
  // xy[0] is the starting rating, so a point's index in xy is its index in
  // points plus one. Getting this wrong puts every readout one match early.
  const sel = picked === null ? null : t.points[picked];
  const selXY = picked === null ? null : geom.xy[picked + 1];
  const peakIdx = t.peak ? t.points.findIndex((p) => p.matchId === t.peak!.matchId) : -1;
  const peakXY = peakIdx >= 0 ? geom.xy[peakIdx + 1] : null;

  const dotColour = (o: "W" | "D" | "L") => (o === "W" ? DOT_WIN : o === "D" ? DOT_DRAW : DOT_LOSS);

  /** Nearest point to a tap, so you never have to hit a 4px dot on a phone. */
  const pickNearest = (clientX: number) => {
    const el = box.current;
    if (!el || !geom.xy.length) return;
    const x = clientX - el.getBoundingClientRect().left;
    let best = 0, bestD = Infinity;
    geom.xy.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < bestD) { bestD = d; best = i; } });
    // xy[0] is the start, which is not a match and has nothing to open.
    setPicked(best === 0 ? null : best - 1);
  };

  return (
    <SurfaceCard radius={18} pad="14px" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 2 }}>
        <div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW }}>Rating, all time</div>
          <StatNumeral size={26} tone="hi">{Math.round(now)}</StatNumeral>
        </div>
        {t.peak && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW }}>Best ever</div>
            <div style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID }}>
              {Math.round(t.peak.rating)} · {formatMatchDate(t.peak.date)}
            </div>
          </div>
        )}
      </div>

      <div
        ref={box}
        style={{ position: "relative", height: HEIGHT, marginTop: 8, cursor: "pointer", touchAction: "pan-y" }}
        onClick={(e) => pickNearest(e.clientX)}
        onPointerMove={(e) => { if (e.pressure > 0 || e.buttons) pickNearest(e.clientX); }}
      >
        {width > 0 && (
          <svg width={width} height={HEIGHT} style={{ display: "block", overflow: "visible" }}>
            <defs>
              <linearGradient id="rally-rating-fade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={FEED_LIME} stopOpacity={0.22} />
                <stop offset="1" stopColor={FEED_LIME} stopOpacity={0} />
              </linearGradient>
            </defs>

            <path d={geom.area} fill="url(#rally-rating-fade)" />
            <path
              d={geom.d}
              fill="none"
              stroke={FEED_LIME}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />

            {/* A dot per match, coloured by what it was. Small enough that
                forty of them read as texture on the line rather than as beads
                on a string. */}
            {t.points.map((p, i) => (
              <circle key={p.matchId} cx={geom.xy[i + 1].x} cy={geom.xy[i + 1].y} r={2} fill={dotColour(p.outcome)} opacity={0.9} />
            ))}

            {peakXY && picked === null && (
              <circle cx={peakXY.x} cy={peakXY.y} r={3.4} fill="none" stroke={FEED_LIME} strokeWidth={1.4} />
            )}

            {selXY && (
              <>
                <line x1={selXY.x} y1={0} x2={selXY.x} y2={HEIGHT} stroke={FEED_HAIRLINE} strokeWidth={1} />
                <circle cx={selXY.x} cy={selXY.y} r={5} fill={FEED_CARD} stroke={FEED_LIME} strokeWidth={2} />
              </>
            )}
          </svg>
        )}
      </div>

      {/* The readout, which is the whole point: a dip you can tap is a match
          you can open. It holds its height whether or not anything is picked,
          so selecting does not shove the rest of the profile down. */}
      <div style={{ minHeight: 40, marginTop: 6 }}>
        {sel ? (
          <button
            onClick={() => onOpenMatch && onOpenMatch(sel.matchId)}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
              background: "transparent", border: "none", padding: 0, cursor: onOpenMatch ? "pointer" : "default",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 4, background: dotColour(sel.outcome), flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {sel.outcome === "W" ? "Beat " : sel.outcome === "L" ? "Lost to " : "Drew with "}{nameOf(sel.opponentId)}
            </span>
            <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, flexShrink: 0 }}>
              {formatMatchDate(sel.date)}
            </span>
            <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 14, color: sel.delta >= 0 ? FEED_LIME : FEED_TEXT_MID, flexShrink: 0, width: 52, textAlign: "right" }}>
              {sel.delta >= 0 ? "+" : "−"}{Math.abs(sel.delta).toFixed(1)}
            </span>
          </button>
        ) : (
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_LOW, lineHeight: 1.5 }}>
            {t.points.length} matches. Tap the line to see any one of them.
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}
