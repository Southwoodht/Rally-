"use client";
import React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Cycler } from "@/components/ui/Cycler";
import { StatNumeral } from "@/components/ui/Surfaces";
import { formatMatchDateTime } from "@/lib/format";
import {
  FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_RADIUS, FEED_RAISED, FEED_TEXT_HI,
  FEED_TEXT_LOW, FEED_TEXT_MID, FEED_THEY_LEAD, FEED_TILE_RADIUS, body, tabular,
} from "@/lib/theme";

// The middle of Home, which used to spend three cards saying nothing happened.
//
// Sam, 2026-09-22: "Won / lost 0–0 Nothing played", "Opponents 0 Nothing
// played", then "Your week 0–0" — three panels reporting the same absence in
// three ways, on the screen somebody opens to decide whether to play. An empty
// week is a fact worth stating once; stating it three times is the app
// shrugging at you.
//
// So this block is state-dependent rather than fixed. With nothing played it
// answers "how long has it been, and who do I call" — a number, the last match
// in words, and a way to book. With something played it becomes the record,
// which is the thing worth looking at when there is one.
//
// Presentational, like the rest of this folder. Every number and every phrase
// arrives finished; nothing here counts, ranks, sorts or fetches.

export interface LastMatch {
  /** Full name. A first name is ambiguous in a club with two Charlies. */
  opponent: string;
  outcome: "W" | "D" | "L";
  date: number;
}

export interface WeekRecord {
  /** Already formatted — "22–28 Sep". */
  range: string;
  w: number;
  l: number;
  opponents: number;
  /** One per match, oldest first. Drives the bar row. */
  results: Array<"W" | "D" | "L">;
}

export interface Suggestion {
  player: any;
  /** Why this person — "2 places above you", "Not played since May". */
  reason: string;
}

export interface NextUp {
  /** Their full name. */
  opponent: string;
  when: any;
  venue?: string | null;
  /** "You lead 4–0–2 · they won the last one". Null when you have never met. */
  h2h?: string | null;
}

export interface SummaryPeriod {
  /** "This week", "This month", "This year". */
  label: string;
  /** The record for that span, or null when nothing was played in it. */
  record: string | null;
  /** Constant across the periods: where you stand, and your career rate. */
  rank: number | null;
  of: number;
  winRate: number | null;
}

export interface HomeFocusProps {
  /** Whole days since the last match. Null when they have never played. */
  daysSince?: number | null;
  /** People in the league who are not you — the never-played hero number. */
  waiting?: number;
  lastMatch?: LastMatch | null;
  /** Null, or a week with nothing in it, gives the empty state. */
  week?: WeekRecord | null;
  /** One per period, widest last. The line cycles through them. */
  summary?: SummaryPeriod[] | null;
  /** Who to play next. Two at most — a list is a menu, not a suggestion. */
  suggestions?: Suggestion[] | null;
  nextUp?: NextUp | null;
  onBook?: () => void;
  /** Opens a player's profile from the rival card. */
  onOpenPlayer?: (id: string) => void;
}

const card: React.CSSProperties = {
  background: FEED_CARD, borderRadius: FEED_RADIUS, padding: 18, minWidth: 0,
};
const quiet: React.CSSProperties = {
  fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW,
};

/**
 * The spec asked for 800 and 700 weights throughout.
 *
 * §10 caps the whole app at 500 — "emphasis is size and colour, never weight" —
 * and Sam's own constraint list says to follow the app where the two disagree.
 * So the hierarchy he drew is kept and delivered the way this app delivers it:
 * the hero number is 72px against a 22px line against 13px, which is a far
 * wider spread than any weight could have carried anyway.
 */
const heroLine: React.CSSProperties = {
  fontFamily: body, fontWeight: 500, fontSize: 22, lineHeight: 1.15,
  letterSpacing: "-0.02em", color: FEED_TEXT_HI, marginTop: 8,
};

function BookPill({ onBook, label = "Book a match" }: { onBook?: () => void; label?: string }) {
  return (
    <button
      onClick={onBook}
      style={{
        display: "block", width: "100%", height: 42, borderRadius: 21, border: "none",
        background: FEED_LIME, color: FEED_LIME_INK, cursor: onBook ? "pointer" : "default",
        fontFamily: body, fontWeight: 500, fontSize: 15, marginTop: 16,
      }}
    >
      {label}
    </button>
  );
}

/** "Charlie Easey beat you, 17 Sep" — the last match, said out loud. */
function lastMatchLine(m: LastMatch, when: string): string {
  if (m.outcome === "W") return "You beat " + m.opponent + ", " + when;
  if (m.outcome === "D") return "You drew with " + m.opponent + ", " + when;
  return m.opponent + " beat you, " + when;
}

const dayMonth = (ts: number): string => {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London", day: "numeric", month: "short",
    }).format(new Date(ts));
  } catch { return ""; }
};

// ------------------------------------------------------------- empty state
function GapCard({ daysSince, waiting, lastMatch, onBook }: {
  daysSince?: number | null; waiting?: number; lastMatch?: LastMatch | null; onBook?: () => void;
}) {
  // Never played at all is a different question from "it has been a while",
  // and answering it with "0 days since you last played" would be a lie about
  // a match that does not exist.
  const never = daysSince == null;
  const n = never ? (waiting ?? 0) : daysSince;
  const line = never ? "players waiting for a game" : "days since you last played";

  return (
    <div style={card}>
      <StatNumeral size={72} tone="hi" style={{ letterSpacing: "-0.04em", display: "block" }}>{n}</StatNumeral>
      <div style={heroLine}>{line}</div>
      {!never && lastMatch && (
        <div style={{ ...quiet, fontSize: 13, marginTop: 8, lineHeight: 1.45 }}>
          {lastMatchLine(lastMatch, dayMonth(lastMatch.date))}
        </div>
      )}
      <BookPill onBook={onBook} />
    </div>
  );
}

// ------------------------------------------------------------ active state
function WeekCard({ week }: { week: WeekRecord }) {
  return (
    <div style={{ ...card, minHeight: 150 }}>
      <div style={{ ...quiet, ...tabular }}>{week.range}</div>

      {/* Won and lost as one figure with a rule between them, rather than two
          numbers side by side — the pair is the record, and the eye should
          read it as one thing. */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
        <StatNumeral size={60} tone="lime" style={{ letterSpacing: "-0.035em" }}>{week.w}</StatNumeral>
        <span aria-hidden="true" style={{ width: 18, height: 2, borderRadius: 1, background: FEED_RAISED, flexShrink: 0 }} />
        <StatNumeral size={60} tone="hi" style={{ letterSpacing: "-0.035em" }}>{week.l}</StatNumeral>
      </div>

      <div style={{ ...quiet, fontSize: 14, marginTop: 10 }}>
        won · lost · {week.opponents} opponent{week.opponents === 1 ? "" : "s"}
      </div>

      {/* One bar per match, oldest first. They shrink rather than wrap: a
          second row of these would read as a second week. */}
      {week.results.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
          {week.results.map((r, i) => (
            <span
              key={i}
              style={{
                flex: "1 1 auto", maxWidth: 26, height: 8, borderRadius: 4,
                background: r === "W" ? FEED_LIME : r === "L" ? FEED_THEY_LEAD : FEED_RAISED,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------- summary line
/**
 * Week, then month, then year, on the shared clock.
 *
 * The cycle was a casualty of the redesign and should not have been: Sam
 * asked for it, liked it, and then noticed it had gone — "wasn't that meant
 * to fade to your month and your year?" It was. Replacing the three dead
 * tiles was the brief; the turning was the part of them that worked.
 *
 * It rides the same module clock as the standing card above it, so the two
 * turn on the same beat and read as one thing the screen does rather than two
 * things twitching near each other.
 *
 * Only the record changes across the three. The place and the career rate are
 * the same whatever span you are looking at, and they stay put rather than
 * being recomputed per period — a number that holds still while its
 * neighbour turns is doing the job of context.
 */
function SummaryLine({ periods }: { periods: SummaryPeriod[] }) {
  const line = (i: number) => {
    const p = periods[i];
    const bits: string[] = [p.record ?? "Nothing played"];
    if (p.rank != null && p.of) bits.push(p.rank + " of " + p.of);
    if (p.winRate != null) bits.push(p.winRate + "% all time");
    return (
      <div style={{ ...quiet, ...tabular, fontSize: 14, color: FEED_TEXT_MID, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {bits.join(" · ")}
      </div>
    );
  };
  return (
    <div style={{ background: FEED_CARD, borderRadius: FEED_TILE_RADIUS, padding: "6px 14px", minHeight: 52, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <Cycler
        labels={periods.map((p) => p.label)}
        render={line}
        labelColor={FEED_TEXT_LOW}
        dotColor={FEED_LIME}
        ariaLabel="Your record, by period"
      />
    </div>
  );
}

// ------------------------------------------------------- suggested to play
/**
 * Who to get on court with next.
 *
 * Started as "the person immediately above you in the table" and Sam widened
 * it: "maybe we have suggested and it has Zaach or Charlie for example as
 * suggested to book against." Which is the better idea — one name reads as a
 * verdict about the table, and two read as what they are, an invitation.
 *
 * Two, and never more. A list of everybody is the Fixtures screen; the point
 * of a suggestion is that somebody has already done the choosing.
 *
 * NO METRIC ON IT ANY MORE, and that is the part worth keeping. The old
 * version printed an Official-points gap, which meant this card had to state
 * which maths it was using and stay pinned to it while the hero card above
 * cycled through others. A reason in words — how close they are, how long it
 * has been — says more to somebody deciding who to call, and cannot disagree
 * with the card above it.
 */
function SuggestionRow({ s, onOpenPlayer, onBook }: { s: Suggestion; onOpenPlayer?: (id: string) => void; onBook?: () => void }) {
  return (
    <div
      onClick={onOpenPlayer ? () => onOpenPlayer(s.player.id) : undefined}
      style={{ height: 62, display: "flex", alignItems: "center", gap: 12, cursor: onOpenPlayer ? "pointer" : "default" }}
    >
      <Avatar player={s.player} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...quiet, ...tabular, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.reason}</div>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 18, letterSpacing: "-0.02em", color: FEED_TEXT_HI, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {s.player.name}{s.player.last ? " " + s.player.last : ""}
        </div>
      </div>
      {/* stopPropagation, or booking also opens their profile — the whole
          card is a tap target and this button sits inside it. */}
      <button
        onClick={(e) => { e.stopPropagation(); onBook && onBook(); }}
        style={{
          flexShrink: 0, width: 58, height: 34, borderRadius: 17, border: "none",
          background: FEED_RAISED, color: FEED_TEXT_HI, cursor: onBook ? "pointer" : "default",
          fontFamily: body, fontWeight: 500, fontSize: 13,
        }}
      >
        Book
      </button>
    </div>
  );
}

function SuggestionCard({ suggestions, onOpenPlayer, onBook }: {
  suggestions: Suggestion[]; onOpenPlayer?: (id: string) => void; onBook?: () => void;
}) {
  return (
    <div style={{ ...card, paddingTop: 14, paddingBottom: 14 }}>
      <div style={{ ...quiet, marginBottom: 2 }}>Suggested</div>
      {suggestions.map((s) => (
        <SuggestionRow key={s.player.id} s={s} onOpenPlayer={onOpenPlayer} onBook={onBook} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------- next up card
function NextUpCard({ nextUp }: { nextUp: NextUp }) {
  const when = formatMatchDateTime(nextUp.when);
  return (
    <div style={{ ...card, display: "flex", gap: 14, padding: 0, overflow: "hidden" }}>
      {/* Neutral rail. A booked match has no result, so it takes neither the
          win nor the loss colour the played cards use. */}
      <span aria-hidden="true" style={{ width: 4, background: FEED_RAISED, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, padding: "16px 18px 16px 0" }}>
        <div style={{ ...quiet, ...tabular, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {when}{nextUp.venue ? " · " + nextUp.venue : ""}
        </div>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 22, letterSpacing: "-0.02em", color: FEED_TEXT_HI, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          vs {nextUp.opponent}
        </div>
        {nextUp.h2h && (
          <div style={{ ...quiet, ...tabular, fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>{nextUp.h2h}</div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- the block
export function HomeFocus({
  daysSince, waiting, lastMatch, week, summary, suggestions, nextUp, onBook, onOpenPlayer,
}: HomeFocusProps) {
  const active = !!week && week.results.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {active
        ? <WeekCard week={week!} />
        : <GapCard daysSince={daysSince} waiting={waiting} lastMatch={lastMatch} onBook={onBook} />}

      {!!summary?.length && <SummaryLine periods={summary} />}

      {/* Never both. A booked match is the more useful of the two — it is
          something already arranged rather than something to arrange — and two
          cards both saying "play somebody" is the clutter this block was
          rebuilt to remove. */}
      {nextUp
        ? <NextUpCard nextUp={nextUp} />
        : suggestions && suggestions.length
          ? <SuggestionCard suggestions={suggestions} onOpenPlayer={onOpenPlayer} onBook={onBook} />
          : null}

      {/* With nothing booked and nobody to chase, the way to fix that is still
          worth offering — but only in the active state, where the hero card
          has no CTA of its own. */}
      {active && !nextUp && !suggestions?.length && <BookPill onBook={onBook} />}
    </div>
  );
}
