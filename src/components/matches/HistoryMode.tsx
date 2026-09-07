"use client";
import React from "react";
import { AlertCircle, ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { GRADE_LABEL, TESTING_GRADES, UNGRADED_LABEL, type Grade } from "@/core/matchGrade";
import { type GradedRow, type MatchQuality } from "@/core/matchQuality";
import { fullNameOf } from "@/lib/format";
import {
  FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_THEY_LEAD,
  FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, tabular,
} from "@/lib/theme";

// Every match, graded, newest first.
//
// Losses are graded too. A history that only grades wins is half honest, and
// "No shame in it" against somebody a category above is the most useful thing
// this screen says to most people.

const VERB = { W: "Beat", D: "Drew with", L: "Lost to" };

// The rail says the outcome and nothing else. A "Not graded" win still gets
// the lime rail — the chip carries the grading, and one element saying two
// things is one element saying neither clearly.
//
// The loss rail is the same colour the app uses when somebody is ahead of
// you, at full opacity. It replaces FEED_LOSS, which measured 1.37:1 against
// the card and was invisible: a 4px signal you cannot see is not a signal.
// A draw gets the raised colour — present, so the rail never disappears and
// change the card's shape, but neutral, because a draw is neither.
const RAIL = { W: FEED_LIME, D: FEED_RAISED, L: FEED_THEY_LEAD };

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });

/**
 * A grade, as a chip.
 *
 * Lime only for the grades that mean the opponent was worth playing.
 * Everything else is the quiet chip: "Routine" in the accent colour would
 * shout the same volume as "Statement win", and then neither says anything.
 * `faded` is the second chip of an ageing pair, which is a comparison rather
 * than the fact.
 */
function Chip({ grade, faded }: { grade: Grade | null; faded?: boolean }) {
  if (!grade) {
    return (
      <span style={{ display: "inline-block", fontFamily: body, fontWeight: 400, fontSize: 11.5, color: FEED_TEXT_LOW, border: "1px solid " + FEED_RAISED, borderRadius: 999, padding: "2px 9px" }}>
        {UNGRADED_LABEL}
      </span>
    );
  }
  const testing = TESTING_GRADES.indexOf(grade) >= 0;
  const lime = testing && !faded;
  return (
    <span
      style={{
        display: "inline-block", fontFamily: body, fontWeight: 500, fontSize: 11.5,
        color: lime ? FEED_LIME_INK : testing ? FEED_LIME : FEED_TEXT_MID,
        background: lime ? FEED_LIME : FEED_RAISED,
        borderRadius: 999, padding: "2px 9px",
      }}
    >
      {GRADE_LABEL[grade]}
    </span>
  );
}

/**
 * The ageing line, and only when the grade actually moved.
 *
 * `grade.now` is already null unless it differs from `grade.then` — the core
 * enforces that rather than this file remembering to, so a pair of identical
 * chips cannot be rendered by mistake.
 */
function Ageing({ row }: { row: GradedRow }) {
  const g = row.grade;
  if (!g.then || !g.now || !g.opponentCategoryNow || !g.opponentCategory) return null;
  const better = (g.now === "statement" || g.now === "noShame") && !(g.then === "statement" || g.then === "noShame");
  const Icon = better ? TrendingUp : TrendingDown;
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
      <Icon size={13} color={better ? FEED_LIME : FEED_TEXT_LOW} strokeWidth={2} style={{ flexShrink: 0 }} />
      <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID }}>
        {g.opponentCategory} then, {lower(g.opponentCategoryNow)} now — {better ? "aged well" : "aged badly"}
      </span>
    </div>
  );
}

function Row({ row, onOpenMatch, onOpenPlayer }: {
  row: GradedRow;
  onOpenMatch?: (matchId: string) => void;
  onOpenPlayer?: (playerId: string) => void;
}) {
  const g = row.grade;
  const name = fullNameOf(row.opponent);
  return (
    <div
      onClick={onOpenMatch ? () => onOpenMatch(row.matchId) : undefined}
      style={{ position: "relative", overflow: "hidden", background: FEED_CARD, borderRadius: 14, padding: "12px 14px", cursor: onOpenMatch ? "pointer" : undefined }}
    >
      {/* Absolutely positioned rather than a border-left, which would shift
          the content box and leave the padding measured from the rail instead
          of from the card edge. */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
          background: RAIL[row.outcome], borderRadius: "14px 0 0 14px",
        }}
      />
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 14.5, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span style={{ fontWeight: 500 }}>{VERB[row.outcome]}</span>{" "}
          {onOpenPlayer && row.opponent?.id ? (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenPlayer(row.opponent.id); }}
              style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: body, fontSize: 14.5, color: FEED_TEXT_HI }}
            >
              {name}
            </button>
          ) : name}
        </span>
        <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, flexShrink: 0 }}>
          {fmtDate(row.date)}
        </span>
      </div>

      {/* The score gets its own line. Inline it was pushing the name into an
          ellipsis on any match that went to three sets, which loses the one
          thing the row is actually about. */}
      {row.score && (
        <div style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, marginTop: 3 }}>
          {row.score}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <Chip grade={g.then} />
        {g.then && g.now && (
          <>
            <ArrowRight size={13} color={FEED_TEXT_LOW} strokeWidth={2} style={{ flexShrink: 0 }} />
            <Chip grade={g.now} faded />
          </>
        )}
      </div>

      {!g.then && (
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, marginTop: 6 }}>
          No level recorded at the time
        </div>
      )}

      <Ageing row={row} />
    </div>
  );
}

/** The banner. Only when something is ungraded, and it goes somewhere. */
export function UngradedBanner({ ungraded, total, onFix }: { ungraded: number; total: number; onFix?: () => void }) {
  if (!ungraded) return null;
  return (
    <SurfaceCard radius={16} style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <AlertCircle size={16} color={FEED_LIME} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_HI }}>
            {ungraded} of {total} can&apos;t be graded
          </div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.45, marginTop: 2 }}>
            Those opponents have no level history
          </div>
        </div>
        {onFix && (
          <button
            onClick={onFix}
            style={{ background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontFamily: body, fontWeight: 500, fontSize: 13, flexShrink: 0 }}
          >
            Fix
          </button>
        )}
      </div>
    </SurfaceCard>
  );
}

export function HistoryMode({ q, onOpenMatch, onOpenPlayer, onFixLevels }: {
  q: MatchQuality;
  onOpenMatch?: (matchId: string) => void;
  onOpenPlayer?: (playerId: string) => void;
  onFixLevels?: () => void;
}) {
  if (!q.total) {
    return (
      <SurfaceCard radius={18}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, marginBottom: 6 }}>No matches yet.</div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
          Log a result and it appears here, graded against whoever you played.
        </div>
      </SurfaceCard>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {q.rows.map((row) => (
          <Row key={row.matchId} row={row} onOpenMatch={onOpenMatch} onOpenPlayer={onOpenPlayer} />
        ))}
      </div>
      <UngradedBanner ungraded={q.ungraded} total={q.total} onFix={onFixLevels} />
    </div>
  );
}
