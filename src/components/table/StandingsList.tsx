"use client";
import React, { useMemo } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { FormDots, MovementIndicator, StatNumeral, type FormResult } from "@/components/ui/Surfaces";
import { assignRanks, buildH2H, type RankCandidate } from "@/core/tiebreak";
import { ratingColumn } from "@/core/rankDisplay";
import { countsAsPlayed } from "@/core/matchStatus";
import { peopleCounts, type PeopleCount } from "@/core/rivals";
import { fullNameOf } from "@/lib/format";
import { FEED_BAR, FEED_CARD, FEED_HERO, FEED_LIME, FEED_LIME_INK, FEED_LIME_INK_2, FEED_ON_HERO, FEED_PAD, FEED_RADIUS, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, tabular, tight, FEED_RAISED, FORM_CHIP, display as displayFont } from "@/lib/theme";

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
  /** Glicko's ± — printed under the number. Absent in every other mode. */
  uncertainty?: number;
  /** A ± too wide to stand behind: said in words on the row, number quiet. */
  provisional?: boolean;
}

const plusMinus = (p: StandingsPlayer) => (p.uncertainty == null ? null : "± " + Math.round(p.uncertainty));

export interface StandingsListProps {
  players: StandingsPlayer[];
  /** Every confirmed match, for the head-to-head step of the tiebreak. */
  matches: any[];
  meId?: string;
  onOpen?: (playerId: string) => void;
  /** What the number means — "rating", "points", "Elo". */
  unit?: string;
  /** Listed in order but given no place: a dash where the rank goes and no
   *  leader card. The provisional group under the table. */
  placeless?: boolean;
}

const gamesOf = (p: StandingsPlayer) => p.w + p.d + p.l;

// Somebody who has never played is not somebody on nought. Printing them as
// "0–0–0 · 0%" with an empty bar makes them look identical to a player who
// has turned out eight times and lost, and those are opposite facts: one is
// no evidence, the other is a lot of it. They keep their place in the list —
// a separate section under the table was worse, because "below everybody" is
// a stronger claim than "unknown" — and simply say so instead.
//
// Under the name, the head-to-head in people (Sam, 2026-10-30: "under
// people it says their head to head not their records") — the profile
// hero's three numbers, over the same matches the table is counting. The
// record and the level word went to make room; both are on the profile.
const statLineOf = (p: StandingsPlayer, c?: PeopleCount) => {
  if (!gamesOf(p)) return "no games yet";
  if (!c) return "";
  return ["Ahead of " + c.ahead, c.level ? "level " + c.level : null, "behind " + c.behind].filter(Boolean).join(" · ");
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

function LeaderCard({ p, counts, display, onOpen, unit }: { p: StandingsPlayer; counts?: PeopleCount; display: string; onOpen?: (id: string) => void; unit: string }) {
  return (
    <div
      onClick={onOpen ? () => onOpen(p.player.id) : undefined}
      style={{ background: FEED_HERO, color: FEED_ON_HERO, borderRadius: FEED_RADIUS, padding: FEED_PAD, cursor: onOpen ? "pointer" : "default" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar player={p.player} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_LIME_INK_2, letterSpacing: 0 }}>Leader</div>
          {/* Full names. Sam, 2026-09-22: the Table is not a versus card and
              not a rivalry card, which are the only two places a first name
              is the right length. It truncates with an ellipsis when a row
              runs out of width rather than falling back to the first name —
              a shortened "Charlie Hen…" still says which Charlie, where
              "Charlie" alone does not. */}
          <div style={{ ...tight(20), fontFamily: body, fontWeight: 600, fontSize: 20, color: FEED_LIME_INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {fullNameOf(p.player)}
          </div>
          <div style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 12.5, color: FEED_LIME_INK_2, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {statLineOf(p, counts)}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <StatNumeral size={36} tone="ink" style={{ letterSpacing: "-0.04em" }}>{display}</StatNumeral>
          {plusMinus(p) && <div style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 12.5, color: FEED_LIME_INK_2, marginTop: 1 }}>{plusMinus(p)}</div>}
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_LIME_INK_2, letterSpacing: 0, marginTop: 2 }}>{unit}</div>
        </div>
      </div>
      {p.form && p.form.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {/* The dots sit on their own cream chip, the same on every theme,
              because they are the same deep green, grey and red everywhere
              (FORM_* in lib/theme.ts) and those vanish on a dark or green
              leader card. */}
          <span style={{ display: "inline-flex", background: FORM_CHIP, borderRadius: 999, padding: "5px 9px" }}>
            <FormDots form={p.form} size={8} bare />
          </span>
        </div>
      )}
    </div>
  );
}

function PlayerRow({ p, counts, rank, tied, display, fraction, isMe, onOpen }: any) {
  // No bar at all for somebody with no games — a zero-width bar and a
  // no-bar-drawn are the same pixels, but only one of them is a measurement.
  const played = gamesOf(p) > 0;
  return (
    <div
      onClick={onOpen ? () => onOpen(p.player.id) : undefined}
      style={{
        // §5: the viewer's own row takes --bg-raised rather than a ring. A
        // 1.5px border on a row this size shifts the text inside it by a
        // pixel and a half, which is visible as a wobble when you scroll past
        // your own name; a background change is not.
        position: "relative", overflow: "hidden", background: isMe ? FEED_RAISED : FEED_CARD, borderRadius: 14,
        padding: "12px 14px", cursor: onOpen ? "pointer" : "default",
        border: "none",
      }}
    >
      {/* The bar sits behind everything, full height, and is never a border
          or a background colour — it has to be a measurable length. */}
      {played && (
        <div
          aria-hidden="true"
          style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: (fraction * 100).toFixed(2) + "%", background: FEED_BAR }}
        />
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ ...tabular, fontFamily: displayFont, fontWeight: 700, fontSize: 16, color: isMe ? FEED_LIME : FEED_TEXT_MID, width: 26, flexShrink: 0, textAlign: "right" }}>
          {rank}{tied ? "=" : ""}
        </span>
        <Avatar player={p.player} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontFamily: body, fontWeight: 600, fontSize: 17, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {fullNameOf(p.player)}
            </span>
            {isMe && (
              <span style={{ fontFamily: body, fontWeight: 600, fontSize: 10, color: FEED_LIME_INK, background: FEED_LIME, borderRadius: 999, padding: "1px 7px", flexShrink: 0 }}>you</span>
            )}
          </div>
          <div style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {statLineOf(p, counts)}
          </div>
          {p.form && p.form.length > 0 && (
            <div style={{ marginTop: 5 }}>
              <FormDots form={p.form} size={7} />
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <span style={{ ...tabular, fontFamily: displayFont, fontWeight: 700, fontSize: 24, letterSpacing: "-0.03em", color: !played || p.provisional ? FEED_TEXT_MID : isMe ? FEED_LIME : FEED_TEXT_HI }}>{played ? display : "–"}</span>
          {played && plusMinus(p) && (
            <div style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 11.5, color: FEED_TEXT_MID, marginTop: 1 }}>{plusMinus(p)}</div>
          )}
          {p.movement !== null && p.movement !== undefined && (
            <div style={{ marginTop: 2 }}><MovementIndicator delta={p.movement} size={11} /></div>
          )}
        </div>
      </div>
    </div>
  );
}

export function StandingsList({ players, matches, meId, onOpen, unit = "rating", placeless = false }: StandingsListProps) {
  const rows = useMemo(() => {
    const candidates: RankCandidate[] = players.map((p) => ({
      id: p.player.id,
      // The same name the row prints, so the alphabetical tiebreak orders by
      // what is on screen rather than by a string nothing shows.
      name: fullNameOf(p.player),
      // Ranked on what the table prints, so two players showing the same
      // number are treated as level rather than separated by a difference
      // nobody can see.
      // Somebody with no games sorts below everybody, whatever the metric
      // says about them. computeOfficial hands back -1,000,000 for them and
      // Elo hands back 0, and neither is a rating — one is a sentinel and
      // the other is the middle of the table. Both would be read as a score.
      score: p.w + p.d + p.l > 0 ? Math.round(p.rating) : Number.NEGATIVE_INFINITY,
      w: p.w, d: p.d, l: p.l,
    }));
    const ranked = assignRanks(candidates, buildH2H(matches || []));
    const byId = new Map(players.map((p) => [p.player.id, p]));
    const ordered = ranked.map((r) => ({ ...r, p: byId.get(r.id)! })).filter((r) => r.p);
    const display = ratingColumn(ordered.map((r) => r.p.rating));
    // The scale is drawn from players who have actually played. Including
    // the unplayed would drag min down to computeOfficial's -1,000,000
    // sentinel and stretch every real bar to the full width — which is
    // exactly what it did, and what looking at the screen caught.
    const scaleValues = ordered.filter((r) => r.p.w + r.p.d + r.p.l > 0).map((r) => r.p.rating).filter((v) => Number.isFinite(v));
    const min = scaleValues.length ? Math.min(...scaleValues) : 0;
    const max = scaleValues.length ? Math.max(...scaleValues) : 0;
    return ordered.map((r, i) => ({ ...r, display: r.p.displayOverride ?? display[i], fraction: barFraction(r.p.rating, min, max) }));
  }, [players, matches]);

  const counts = useMemo(() => peopleCounts((matches || []).filter(countsAsPlayed)), [matches]);

  if (!rows.length) return null;

  // Only crown somebody when they are alone at the top. Two players sharing
  // first and one of them getting the leader card would be the screen picking
  // a winner the ranking deliberately refused to.
  //
  // And never somebody provisional (Sam, 2026-10-22): a newcomer who wins
  // two matches against weak players should not be the big name at the top
  // of the club's table. They keep first place in the list, marked
  // provisional; only the card is withheld.
  const leaders = rows.filter((r) => r.rank === 1);
  const crowned = !placeless && leaders.length === 1 && !leaders[0].p.provisional ? leaders[0] : null;
  const rest = crowned ? rows.slice(1) : rows;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {crowned && <LeaderCard p={crowned.p} counts={counts[crowned.id]} display={crowned.display} onOpen={onOpen} unit={unit} />}

      {/* Every row below the leader printed a bare numeral, and the leader
          card was the only thing on the screen naming it. Switch to Strength
          and all of them silently change scale — 52 becomes 778 — with
          nothing to read that off. Named once here, over the column it
          belongs to, rather than repeated on thirteen rows: the word is the
          same on every one of them, and thirteen copies of it is a pattern,
          not a label. */}
      {rest.length > 0 && !placeless && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "2px 14px 0" }}>
          <span style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_LOW, letterSpacing: 0 }}>
            {unit}
          </span>
        </div>
      )}

      {rest.map((r) => (
        <PlayerRow
          key={r.id}
          p={r.p}
          counts={counts[r.id]}
          rank={placeless ? "–" : r.rank}
          tied={placeless ? false : r.tied}
          display={r.display}
          fraction={r.fraction}
          isMe={!!meId && r.id === meId}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
