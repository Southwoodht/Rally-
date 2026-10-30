"use client";
import React, { useState } from "react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { TrophyMoment } from "@/components/ui/TrophyMoment";
import { YearHeader } from "@/components/ui/YearHeader";
import { honoursByYear, trophyDateLabel, trophyTitle, trophyTs, type TrophyLike } from "@/core/trophyTimeline";
import { recordsByYear, yearOf, type YearRecord } from "@/core/yearRecord";
import { FEED_LIME, FEED_LOSS, FEED_RAISED, FEED_TEXT_DIM, FEED_TEXT_HI, FEED_TEXT_MID, OUTCOME_RAIL, body, tabular } from "@/lib/theme";

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
  /** When it was played. Present, and the list is split into years with a
   *  record over each; absent, and it is one plain list as before. */
  ts?: number;
  /** "6-2, 6-4", or null. */
  score?: string | null;
  /** What this result did to your Official points, as the table counts them
   *  (core/officialTimeline.ts). Absent for a result that counts for nothing. */
  points?: number | null;
  /** Nobody has agreed to it yet, so it counts for nothing. */
  pending?: boolean;
  /** A legacy result (core/matchStatus.ts): shown, badged, counted in
   *  nothing. Its `date` is already just the year when that is all anyone
   *  knows. */
  legacy?: boolean;
  /** A legacy result the other side has not agreed yet. */
  claimed?: boolean;
  onEdit?: () => void;
  onOpen?: () => void;
}

const BORDER = OUTCOME_RAIL;

// Nobody has agreed to it, so it is not a win yet. Painting the win colour
// on a row that also says "not counted" is the row disagreeing with itself,
// and the border is the louder of the two.
const PENDING_BORDER = FEED_TEXT_DIM;
const VERB = { W: "Beat", D: "Drew with", L: "Lost to" };

export type HistoryTrophy = TrophyLike & { clubName?: string | null; onOpen?: () => void };

type Entry = { kind: "match"; ts: number | null; m: MatchHistoryItem } | { kind: "trophy"; ts: number; t: HistoryTrophy };

/** "+2.0", "−1.3", "0.0" — one decimal, a real minus sign. */
const signed = (n: number) => (Math.abs(n) < 0.05 ? "0.0" : (n > 0 ? "+" : "−") + Math.abs(n).toFixed(1));

/**
 * The line that makes the numbers add up: your results, plus what other
 * people's results did to you, equals your Official on the table. With a
 * "Why?" that says how a result is weighed — opened in place, not a sheet,
 * because it is two sentences.
 */
export function PointsSummary({ own, others, total }: { own: number; others: number; total: number }) {
  const [why, setWhy] = useState(false);
  return (
    <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.5, padding: "10px 4px 0" }}>
      <span style={tabular}>Your results {signed(own)} · other people&apos;s results {signed(others)} = {total.toFixed(1)} Official points (all time).</span>{" "}
      <button onClick={() => setWhy(!why)} style={{ background: "none", border: "none", padding: 0, color: FEED_LIME, font: "inherit", cursor: "pointer" }}>{why ? "Hide" : "Why?"}</button>
      {why && (
        <div style={{ marginTop: 6 }}>
          Each number is what that result did to your Official points on the day. Every result counts, judged by how strong the opponent has proved to be: beating someone the table rates low adds little, and losing to someone strong costs little — a loss never adds points. Your number also moves a little when people you have played win or lose, because that changes how strong they look; that is the &ldquo;other people&apos;s results&rdquo; part.
        </div>
      )}
    </div>
  );
}

export function MatchHistoryList({ items, years, trophies }: {
  items: MatchHistoryItem[];
  /** Each year's record. Pass the WHOLE history's, so a header over the
   *  five rows a preview shows still says how the whole year went; left out,
   *  it is counted from the rows given. */
  years?: Record<number, YearRecord>;
  /** This player's trophies. Dated ones are placed among the matches, but
   *  only those won since the oldest row shown: under a five-row preview, or
   *  a season-only view, a 2019 title would otherwise sit at the foot of
   *  this autumn's matches as if it came straight after them. Every one with
   *  a year still goes under its year's header (core/trophyTimeline.ts). */
  trophies?: HistoryTrophy[];
}) {
  if (!items || !items.length) return null;
  const grouped = items.every((m) => typeof m.ts === "number");
  const recs = years || (grouped ? recordsByYear(items.map((m) => ({ date: m.ts as number, outcome: m.outcome, pending: m.pending, legacy: m.legacy }))) : {});
  const honours = honoursByYear(trophies || []);

  // Newest first, like the rows. A trophy on the same day as a match sorts
  // after it in time (trophyTs is late on the day), so above it in the list.
  let entries: Entry[] = items.map((m) => ({ kind: "match", ts: grouped ? (m.ts as number) : null, m }));
  if (grouped && trophies?.length) {
    const oldest = Math.min(...items.map((m) => m.ts as number));
    const placed = trophies
      .map((t) => ({ t, ts: trophyTs(t) }))
      .filter((x): x is { t: HistoryTrophy; ts: number } => x.ts != null && x.ts >= oldest)
      .map((x): Entry => ({ kind: "trophy", ts: x.ts, t: x.t }));
    entries = [...entries, ...placed].sort((a, b) => (b.ts as number) - (a.ts as number));
  }

  return (
    <SurfaceCard radius={18} pad={0} clip>
      {entries.map((e, i) => {
        const y = grouped ? yearOf(e.ts as number) : null;
        const newYear = y != null && (i === 0 || yearOf(entries[i - 1].ts as number) !== y);
        const last = i === entries.length - 1;
        const header = newYear && (
          <YearHeader
            year={y!}
            rec={recs[y!]}
            honours={honours[y!]}
            style={{ padding: i === 0 ? "12px 16px 8px" : "16px 16px 8px", boxShadow: "inset 0 -0.5px 0 " + FEED_LOSS }}
          />
        );
        if (e.kind === "trophy") return (
          <React.Fragment key={"t-" + e.t.id}>
            {header}
            <TrophyMoment
              title={trophyTitle(e.t)}
              date={trophyDateLabel(e.t)}
              club={e.t.clubName}
              onOpen={e.t.onOpen}
              style={{ boxShadow: last ? undefined : "inset 0 -0.5px 0 " + FEED_LOSS }}
            />
          </React.Fragment>
        );
        const m = e.m;
        return (
        <React.Fragment key={m.matchId}>
        {header}
        <div
          onClick={m.onOpen}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            borderLeft: "3px solid " + (m.pending || m.legacy ? PENDING_BORDER : BORDER[m.outcome]),
            // Square, so the marker reads as the edge of the row rather than
            // a detached tick.
            borderRadius: 0,
            padding: "12px 16px",
            cursor: m.onOpen ? "pointer" : "default",
            boxShadow: last ? undefined : "inset 0 -0.5px 0 " + FEED_LOSS,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: body, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ fontWeight: 600 }}>{VERB[m.outcome]}</span>{" "}
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
              <div style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>
                {/* It IS counted — unconfirmed results count from the moment
                    they're logged (core/matchStatus.ts, since 2026-09-10) —
                    so the line says what it did rather than "not counted". */}
                Awaiting their ok{m.points != null ? <span style={tabular}> · {signed(m.points)} points</span> : null}
              </div>
            )}
            <div style={{ ...tabular, display: "flex", alignItems: "center", gap: 6, fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>
              {m.legacy && (
                <span style={{ fontFamily: body, fontWeight: 600, fontSize: 11, color: FEED_TEXT_HI, background: FEED_RAISED, borderRadius: 999, padding: "1px 8px" }}>Legacy</span>
              )}
              <span>{m.date}{m.score ? " · " + m.score : ""}{m.legacy ? (m.claimed ? " · claimed" : " · not rated") : ""}</span>
            </div>
          </div>
          {m.pending ? (
            m.onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); m.onEdit!(); }}
                style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: FEED_LIME, fontFamily: body, fontWeight: 500, fontSize: 14, flexShrink: 0 }}
              >
                Edit
              </button>
            )
          ) : (
            m.points !== null && m.points !== undefined && (
              <span style={{ ...tabular, fontFamily: body, fontWeight: 600, fontSize: 15, color: m.points > 0.05 ? FEED_LIME : FEED_TEXT_MID, flexShrink: 0 }}>
                {signed(m.points)}
              </span>
            )
          )}
        </div>
        </React.Fragment>
        );
      })}
    </SurfaceCard>
  );
}
