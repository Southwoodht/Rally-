"use client";
import React, { useMemo } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { FormDots, MovementIndicator, StatNumeral, type FormResult } from "@/components/ui/Surfaces";
import { assignRanks, buildH2H, type RankCandidate } from "@/core/tiebreak";
import { ratingColumn } from "@/core/rankDisplay";
import { shortNameOf } from "@/lib/format";
import {
  FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_LIME_INK_2, FEED_PAD, FEED_RADIUS,
  FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, tabular, tight,
} from "@/lib/theme";

// The standings, in the same language as the newsfeed.
//
// The leader gets the lime card and everybody else gets a row with a bar
// behind it. The bar is the point of the redesign: a column of numbers tells
// you the order and nothing about the distances, and a league where the top
// two are miles clear reads identically to one where fifteen people are
// level. The bar shows the shape.

export interface StandingsPlayer {
  player: any;
  /** The metric being ranked on, unrounded. */
  rating: number;
  w: number;
  d: number;
  l: number;
  /** Printed instead of the numeric rating — Record mode shows 28-6-10,
   *  which is not a rating and cannot be formatted as one. The numeric
   *  rating still drives the order and the bar. */
  displayOverride?: string;
  /** Recent results, oldest first. Leader card only. */
  form?: FormResult[];
  /** Places gained since the last weekly snapshot; null when unknown. */
  movement?: number | null;
}

export interface StandingsListProps {
  players: StandingsPlayer[];
  /** Every confirmed match, for the head-to-head step of the tiebreak. */
  matches: any[];
  meId?: string;
  onOpen?: (playerId: string) => void;
  /** What the number means — "rating", "points", "Elo". */
  unit?: string;
}

const recordOf = (p: StandingsPlayer) => `${p.w}–${p.d}–${p.l}`;
const winPctOf = (p: StandingsPlayer) => {
  const gp = p.w + p.d + p.l;
  return gp ? Math.round(((p.w + p.d * 0.5) / gp) * 100) : null;
};
const statLineOf = (p: StandingsPlayer) => {
  const pct = winPctOf(p);
  return [recordOf(p), pct === null ? null : pct + "%", p.player?.level?.cat ? String(p.player.level.cat).toLowerCase() : null]
    .filter(Boolean).join(" · ");
};

/**
 * How far the bar runs, 0 to 1.
 *
 * The brief said rating / maxRating, which works only while every rating is
 * positive. ELO goes below zero — Adrian is on -94.5 — and that yields a
 * negative width; Official points bottom out at exactly 0 for every winless
 * player, and ten of Seacourt's eighteen sit there, which yields a third of
 * the table drawn as nothing at all.
 *
 * So the scale runs from the lowest rating on screen to the highest rather
 * than from zero. That is what "the shape of the league" means: the bars
 * answer how far apart these people are, not how far each is from an origin
 * that nobody occupies. The last player is legitimately empty — they are the
 * bottom of the range being drawn — and no minimum width is invented for
 * them, because a bar that says "a little bit" where the data says "least"
 * is decoration.
 */
function barFraction(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function LeaderCard({ p, display, onOpen, unit }: { p: StandingsPlayer; display: string; onOpen?: (id: string) => void; unit: string }) {
  return (
    <div
      onClick={onOpen ? () => onOpen(p.player.id) : undefined}
      style={{ background: FEED_LIME, borderRadius: FEED_RADIUS, padding: FEED_PAD, cursor: onOpen ? "pointer" : "default" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar player={p.player} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_LIME_INK_2, textTransform: "uppercase", letterSpacing: 0.6 }}>Leader</div>
          <div style={{ ...tight(20), fontFamily: body, fontWeight: 500, fontSize: 20, color: FEED_LIME_INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {shortNameOf(p.player)}
          </div>
          <div style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_LIME_INK_2, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {statLineOf(p)}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <StatNumeral size={36} tone="ink" style={{ letterSpacing: "-0.04em" }}>{display}</StatNumeral>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_LIME_INK_2, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 }}>{unit}</div>
        </div>
      </div>
      {p.form && p.form.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <FormDots form={p.form} ink={FEED_LIME_INK} />
        </div>
      )}
    </div>
  );
}

function PlayerRow({ p, rank, tied, display, fraction, isMe, onOpen }: any) {
  return (
    <div
      onClick={onOpen ? () => onOpen(p.player.id) : undefined}
      style={{
        position: "relative", overflow: "hidden", background: FEED_CARD, borderRadius: 14,
        padding: "12px 14px", cursor: onOpen ? "pointer" : "default",
        border: isMe ? "1.5px solid " + FEED_LIME : "1.5px solid transparent",
      }}
    >
      {/* The bar sits behind everything, full height, and is never a border
          or a background colour — it has to be a measurable length. */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: (fraction * 100).toFixed(2) + "%", background: FEED_RAISED }}
      />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 16, color: FEED_TEXT_LOW, width: 26, flexShrink: 0, textAlign: "right" }}>
          {rank}{tied ? "=" : ""}
        </span>
        <Avatar player={p.player} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontFamily: body, fontWeight: 500, fontSize: 16, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {shortNameOf(p.player)}
            </span>
            {isMe && (
              <span style={{ fontFamily: body, fontWeight: 500, fontSize: 10, color: FEED_LIME_INK, background: FEED_LIME, borderRadius: 999, padding: "1px 7px", flexShrink: 0 }}>you</span>
            )}
          </div>
          <div style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {statLineOf(p)}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <StatNumeral size={24} tone="hi" style={{ letterSpacing: "-0.03em" }}>{display}</StatNumeral>
          {p.movement !== null && p.movement !== undefined && (
            <div style={{ marginTop: 2 }}><MovementIndicator delta={p.movement} size={11} /></div>
          )}
        </div>
      </div>
    </div>
  );
}

export function StandingsList({ players, matches, meId, onOpen, unit = "rating" }: StandingsListProps) {
  const rows = useMemo(() => {
    const candidates: RankCandidate[] = players.map((p) => ({
      id: p.player.id,
      name: shortNameOf(p.player),
      // Ranked on what the table prints, so two players showing the same
      // number are treated as level rather than separated by a difference
      // nobody can see.
      score: Math.round(p.rating),
      w: p.w, d: p.d, l: p.l,
    }));
    const ranked = assignRanks(candidates, buildH2H(matches || []));
    const byId = new Map(players.map((p) => [p.player.id, p]));
    const ordered = ranked.map((r) => ({ ...r, p: byId.get(r.id)! })).filter((r) => r.p);
    const display = ratingColumn(ordered.map((r) => r.p.rating));
    const values = ordered.map((r) => r.p.rating);
    const min = Math.min(...values), max = Math.max(...values);
    return ordered.map((r, i) => ({ ...r, display: r.p.displayOverride ?? display[i], fraction: barFraction(r.p.rating, min, max) }));
  }, [players, matches]);

  if (!rows.length) return null;

  // Only crown somebody when they are alone at the top. Two players sharing
  // first and one of them getting the leader card would be the screen picking
  // a winner the ranking deliberately refused to.
  const leaders = rows.filter((r) => r.rank === 1);
  const crowned = leaders.length === 1 ? leaders[0] : null;
  const rest = crowned ? rows.slice(1) : rows;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {crowned && <LeaderCard p={crowned.p} display={crowned.display} onOpen={onOpen} unit={unit} />}
      {rest.map((r) => (
        <PlayerRow
          key={r.id}
          p={r.p}
          rank={r.rank}
          tied={r.tied}
          display={r.display}
          fraction={r.fraction}
          isMe={!!meId && r.id === meId}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
