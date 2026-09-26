"use client";
import React, { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { formatMatchDate, fullNameOf } from "@/lib/format";
import { showDelta, type DoublesSlot } from "@/core/doubles/elo";
import type { DoublesHistoryRow, OpponentRecord } from "@/core/doubles/profile";
import {
  FEED_BAR, FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RADIUS, FEED_RAISED,
  FEED_TEXT_HI, FEED_TEXT_MID, body, display, tabular,
} from "@/lib/theme";

/**
 * The doubles profile's lists — Best wins, Record against, Match history.
 *
 * The singles profile's sections, in the doubles profile's own card style
 * (the Partners card's), so the doubles half reads as one set of cards rather
 * than two designs stitched together. The counting is all in
 * core/doubles/profile.ts; these only draw it.
 */

const Card = ({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) => (
  <div style={{ margin: "12px 16px 0", padding: "20px 18px 10px", borderRadius: FEED_RADIUS, background: FEED_CARD }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
      <div style={{ fontFamily: display, fontWeight: 700, fontSize: 20, color: FEED_TEXT_HI }}>{title}</div>
      {right}
    </div>
    {children}
  </div>
);

type ById = Map<string, any>;

/** "Zaach Rodriguez & partner" — an empty seat is somebody nobody named. */
const pairName = (ids: DoublesSlot[], byId: ById, first = false): string =>
  ids.map((id) => {
    if (id == null) return "partner";
    const p = byId.get(id);
    if (!p) return "Unknown player";
    return first ? (p.name || "").trim() || fullNameOf(p) : fullNameOf(p);
  }).join(" & ");

/** The score oriented to YOU — your games first, whichever side you were on. */
const scoreText = (r: DoublesHistoryRow): string => {
  const sets = (r.match as { sets?: Array<{ a: number; b: number }> }).sets;
  if (!sets || !sets.length) return "";
  return sets.map((s) => (r.onA ? `${s.a}–${s.b}` : `${s.b}–${s.a}`)).join(" ");
};

const OutcomeChip = ({ o }: { o: "w" | "d" | "l" }) => (
  <span style={{
    fontFamily: body, fontSize: 11, fontWeight: 700, borderRadius: 8, padding: "3px 8px", flexShrink: 0,
    background: o === "w" ? FEED_LIME : FEED_RAISED,
    color: o === "w" ? FEED_LIME_INK : o === "l" ? "var(--lost)" : FEED_TEXT_MID,
  }}>
    {o === "w" ? "Won" : o === "l" ? "Lost" : "Drew"}
  </span>
);

// ---------------------------------------------------------------- Best wins

export function DoublesBestWins({ wins, byId }: { wins: DoublesHistoryRow[]; byId: ById }) {
  if (!wins.length) return null;
  return (
    <Card title="Best wins" right={<span style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID }}>their rating then</span>}>
      {wins.map((r) => (
        <div key={r.match.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
          <div style={{ flexGrow: 1, minWidth: 0 }}>
            <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {pairName(r.opponents, byId)}
            </div>
            <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              with {pairName([r.partner], byId)} · {formatMatchDate(r.match.playedAt)}
            </div>
          </div>
          {/* The pair's rating walking on court, which is what "best" means
              here: measured, not claimed, and judged at the time. */}
          <div style={{ fontFamily: display, fontWeight: 700, fontSize: 18, color: FEED_TEXT_HI, ...tabular }}>
            {Math.round(r.oppRating).toLocaleString()}
          </div>
        </div>
      ))}
    </Card>
  );
}

// ----------------------------------------------------------- Record against

const RECORD_PREVIEW = 5;

export function DoublesRecordAgainst({ records, byId }: { records: OpponentRecord[]; byId: ById }) {
  const [all, setAll] = useState(false);
  if (!records.length) return null;
  const shown = all ? records : records.slice(0, RECORD_PREVIEW);
  return (
    <Card
      title="Record against"
      right={records.length > RECORD_PREVIEW
        ? <button onClick={() => setAll(!all)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: FEED_LIME, fontFamily: body, fontSize: 13 }}>{all ? "Fewer" : `All ${records.length} ›`}</button>
        : undefined}
    >
      {shown.map((r) => {
        const p = byId.get(r.opponentId);
        const pct = Math.round(((r.won + r.drawn * 0.5) / r.played) * 100);
        return (
          <div key={r.opponentId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0" }}>
            <Avatar player={p} size={34} />
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p ? fullNameOf(p) : "Unknown player"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                <div style={{ flexGrow: 1, height: 5, borderRadius: 3, background: FEED_BAR, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: 5, borderRadius: 3, background: FEED_LIME }} />
                </div>
                <span style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, whiteSpace: "nowrap", ...tabular }}>
                  {r.won}–{r.lost}{r.drawn ? `–${r.drawn}` : ""}
                </span>
              </div>
            </div>
            <div style={{ fontFamily: display, fontWeight: 700, fontSize: 17, width: 46, textAlign: "right", color: FEED_TEXT_HI, ...tabular }}>{pct}%</div>
          </div>
        );
      })}
    </Card>
  );
}

// ------------------------------------------------------------ Match history

const HISTORY_PREVIEW = 5;

export function DoublesHistory({ rows, byId }: { rows: DoublesHistoryRow[]; byId: ById }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return null;
  const shown = all ? rows : rows.slice(0, HISTORY_PREVIEW);
  return (
    <Card
      title="Match history"
      right={rows.length > HISTORY_PREVIEW
        ? <button onClick={() => setAll(!all)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: FEED_LIME, fontFamily: body, fontSize: 13 }}>{all ? "Fewer" : `All ${rows.length} ›`}</button>
        : undefined}
    >
      {shown.map((r, i) => {
        const score = scoreText(r);
        return (
          <div key={r.match.id} style={{ padding: "11px 0", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <OutcomeChip o={r.outcome} />
              <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                v {pairName(r.opponents, byId, true)}
              </span>
              {r.delta !== null && (
                <span style={{ fontFamily: display, fontWeight: 700, fontSize: 16, color: r.delta >= 0 ? FEED_LIME : FEED_TEXT_MID, flexShrink: 0, ...tabular }}>
                  {showDelta(r.delta)}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 4 }}>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                with {pairName([r.partner], byId, true)} · {formatMatchDate(r.match.playedAt)}
              </span>
              {score && <span style={{ flexShrink: 0, ...tabular }}>{score}</span>}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
