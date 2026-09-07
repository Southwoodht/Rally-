"use client";
import React from "react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { FEED_LIME, FEED_LOSS, FEED_TEXT_DIM, FEED_TEXT_HI, FEED_TEXT_MID, OUTCOME_RAIL, body, tabular } from "@/lib/theme";

// Recent matches, as a list you can read down.
//
// Two states, not five. The old rows carried a coloured bar in red, blue or
// orange whose meaning nobody could recover from looking at it, and a W/L
// chip beside a sentence that already began "Beat" or "Lost to". The verb
// does that job; the bar now only says won or lost.
//
// A draw is the one thing the brief's two states cannot express, and Rally
// has plenty of them — Sam alone has six. It gets the draw colour rather
// than being forced into one of the other two, because calling a draw a loss
// on the profile of somebody who drew is simply wrong.

export interface MatchHistoryItem {
  matchId: string;
  outcome: "W" | "D" | "L";
  /** The opponent's name, as displayed. */
  opponent: string;
  /** So the name can be tapped through to them. */
  opponentId?: string;
  onOpenPlayer?: (playerId: string) => void;
  /** Already formatted — "22 Aug". */
  date: string;
  /** "6-2, 6-4", or null. */
  score?: string | null;
  /** Rating change, already rounded to one place. Absent for pending. */
  delta?: number | null;
  /** Nobody has agreed to it yet, so it counts for nothing. */
  pending?: boolean;
  onEdit?: () => void;
  onOpen?: () => void;
}

const BORDER = OUTCOME_RAIL;

// Nobody has agreed to it, so it is not a win yet. Painting the win colour
// on a row that also says "not counted" is the row disagreeing with itself,
// and the border is the louder of the two.
const PENDING_BORDER = FEED_TEXT_DIM;
const VERB = { W: "Beat", D: "Drew with", L: "Lost to" };

export function MatchHistoryList({ items }: { items: MatchHistoryItem[] }) {
  if (!items || !items.length) return null;
  return (
    <SurfaceCard radius={18} pad={0} clip>
      {items.map((m, i) => (
        <div
          key={m.matchId}
          onClick={m.onOpen}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            borderLeft: "3px solid " + (m.pending ? PENDING_BORDER : BORDER[m.outcome]),
            // Square, so the marker reads as the edge of the row rather than
            // a detached tick.
            borderRadius: 0,
            padding: "12px 16px",
            cursor: m.onOpen ? "pointer" : "default",
            boxShadow: i === items.length - 1 ? undefined : "inset 0 -0.5px 0 " + FEED_LOSS,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: body, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ fontWeight: 500 }}>{VERB[m.outcome]}</span>{" "}
              {m.opponentId && m.onOpenPlayer ? (
                <button
                  onClick={(e) => { e.stopPropagation(); m.onOpenPlayer!(m.opponentId!); }}
                  style={{ background: "transparent", border: "none", padding: 0, margin: 0, cursor: "pointer", color: FEED_LIME, font: "inherit" }}
                >
                  {m.opponent}
                </button>
              ) : m.opponent}
            </div>
            {m.pending && (
              <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>
                Awaiting their ok · not counted
              </div>
            )}
            <div style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>
              {m.date}{m.score ? " · " + m.score : ""}
            </div>
          </div>
          {m.pending ? (
            m.onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); m.onEdit!(); }}
                style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: FEED_LIME, fontFamily: body, fontWeight: 400, fontSize: 14, flexShrink: 0 }}
              >
                Edit
              </button>
            )
          ) : (
            m.delta !== null && m.delta !== undefined && (
              <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 15, color: m.delta >= 0 ? FEED_LIME : FEED_TEXT_MID, flexShrink: 0 }}>
                {m.delta >= 0 ? "+" : "−"}{Math.abs(m.delta).toFixed(1)}
              </span>
            )
          )}
        </div>
      ))}
    </SurfaceCard>
  );
}
