"use client";
import React, { useMemo, useState } from "react";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { Avatar } from "@/components/ui/Avatar";
import { fullNameOf } from "@/lib/format";
import { computeDoubles, previewDoubles, showDelta, type DoublesMatch } from "@/core/doubles/elo";
import {
  FEED_CARD, FEED_HERO, FEED_LIME, FEED_LIME_INK, FEED_ON_HERO, FEED_RADIUS,
  FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, LINE, body, display, tabular,
} from "@/lib/theme";

/**
 * Entering a doubles result — Appendix D.
 *
 * THE WINNER IS NEVER ASKED FOR. It is derived from the sets, because the
 * database derives it the same way and raises if the two disagree: the
 * trigger in schema_doubles.sql counts the sets and refuses a winner that
 * contradicts them. Offering a winner button here would let somebody enter a
 * contradiction the server then rejects with a message about a trigger, which
 * is the worst of both. The "Won" badge on a team is a readout of the score,
 * not an input.
 *
 * That is a real difference from singles, where the winner IS the input and
 * the score is optional free text.
 *
 * THE RATING STRIP IS THE SAME FUNCTION THAT WILL DO THE SAVING. previewDoubles
 * replays the real history and appends the hypothetical, so what the strip
 * shows and what saving produces cannot drift — it is one more row through the
 * same code, not a second implementation that agrees today.
 */

interface Props {
  players: any[];
  /** Every confirmed doubles match in the league, for the rating preview. */
  history: DoublesMatch[];
  meId: string;
  /** Adding somebody who isn't in the league yet, from inside a picker. The
   *  same addPlayer singles uses — without it the picker's "Create" did
   *  nothing, because it called a function nobody had passed. */
  onCreatePlayer?: (p: any) => void;
  onSave: (m: { teamA: [string, string | null]; teamB: [string, string | null]; sets: Array<{ a: number; b: number }>; winner: string }) => void;
  saving?: boolean;
}

type SetScore = { a: string; b: string };

const parsed = (rows: SetScore[]): Array<{ a: number; b: number }> =>
  rows
    .filter((r) => r.a.trim() !== "" && r.b.trim() !== "")
    .map((r) => ({ a: parseInt(r.a, 10), b: parseInt(r.b, 10) }))
    .filter((r) => Number.isFinite(r.a) && Number.isFinite(r.b));

/** The same rule the trigger applies, so the screen and the database agree. */
export const winnerFromSets = (sets: Array<{ a: number; b: number }>): string | null => {
  if (!sets.length) return null;
  let a = 0, b = 0;
  for (const s of sets) { if (s.a > s.b) a++; else if (s.b > s.a) b++; }
  return a > b ? "A" : b > a ? "B" : "draw";
};

/**
 * "Don't know" in a player slot. A sentinel in the form's own state only --
 * it becomes null on the way out, which is what the engine and the database
 * mean by a seat nobody could name. Only your partner's seat and the second
 * opponent's can hold it: the first opponent is the person you did know, so
 * every match has at least one real player a side.
 */
const UNKNOWN = "__unknown__";
const seat = (id: string): string | null => (id === UNKNOWN ? null : id);

export function DoublesEntry({ players, history, meId, onCreatePlayer, onSave, saving }: Props) {
  const [partner, setPartner] = useState<string>("");
  const [opp1, setOpp1] = useState<string>("");
  const [opp2, setOpp2] = useState<string>("");
  const [sets, setSets] = useState<SetScore[]>([{ a: "", b: "" }, { a: "", b: "" }]);
  // Nobody can remember the score: then, and only then, the winner is the
  // input -- the same as singles, where the score has always been optional.
  // The database accepts a winner as entered when there are no sets and still
  // checks it against them when there are.
  const [noScore, setNoScore] = useState(false);
  const [pickedWinner, setPickedWinner] = useState<string | null>(null);

  const chosen = [meId, partner, opp1, opp2].filter(Boolean);
  const eligible = (self: string) => players.filter((p) => p.id === self || !chosen.includes(p.id));
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const clean = parsed(sets);
  const winner = noScore ? pickedWinner : winnerFromSets(clean);
  const complete = !!(partner && opp1 && opp2 && (noScore || clean.length) && winner);

  const stats = useMemo(() => computeDoubles(history), [history]);
  const eloOf = (id: string) => (id && stats.elo[id] !== undefined ? Math.round(stats.elo[id]) : 1500);

  const preview = useMemo(() => {
    if (!complete) return null;
    return previewDoubles(history, {
      teamA: [meId, seat(partner)],
      teamB: [opp1, seat(opp2)],
      winner: winner as string,
    });
  }, [complete, history, meId, partner, opp1, opp2, winner]);

  const mine = preview?.find((d) => d.playerId === meId);
  const theirs = preview?.find((d) => d.playerId === opp1);

  const label = { fontFamily: body, fontSize: 13, fontWeight: 600, color: FEED_TEXT_MID, letterSpacing: 1 } as const;
  const card = { margin: "12px 16px 0", padding: "16px 18px", borderRadius: FEED_RADIUS, background: FEED_CARD } as const;

  const personRow = (id: string, slot: React.ReactNode, isMe = false) => {
    const p = byId.get(id);
    if (id === UNKNOWN) return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
        <span style={{ width: 40, height: 40, borderRadius: 20, background: FEED_RAISED, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: body, fontWeight: 600, fontSize: 16, color: FEED_TEXT_MID }}>?</span>
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div style={{ fontFamily: body, fontWeight: 600, fontSize: 16, color: FEED_TEXT_HI }}>Don&apos;t know</div>
          {/* Say what it costs, next to it: an unknown counts as a new player
              in the maths, and is never rated or listed themselves. */}
          <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID }}>Counts as a new player · not rated</div>
        </div>
        <div style={{ flexShrink: 0 }}>{slot}</div>
      </div>
    );
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
        {p
          ? <span style={{ borderRadius: 20, boxShadow: isMe ? `0 0 0 2px ${FEED_LIME}` : undefined, display: "inline-flex", flexShrink: 0 }}><Avatar player={p} size={40} /></span>
          : <span style={{ width: 40, height: 40, borderRadius: 20, background: FEED_RAISED, flexShrink: 0 }} />}
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          {p ? (
            <>
              <div style={{ fontFamily: body, fontWeight: 600, fontSize: 16, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullNameOf(p)}</div>
              <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, ...tabular }}>Doubles {eloOf(id).toLocaleString()}</div>
            </>
          ) : <div style={{ fontFamily: body, fontSize: 15, color: FEED_TEXT_MID }}>Pick a player</div>}
        </div>
        <div style={{ flexShrink: 0 }}>{slot}</div>
      </div>
    );
  };

  const scoreBox = (v: string, onChange: (s: string) => void, lead: boolean) => (
    <input
      inputMode="numeric"
      value={v}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
      style={{
        width: 52, height: 52, borderRadius: 14, background: FEED_RAISED,
        border: `1px solid ${lead ? FEED_LIME : LINE}`,
        textAlign: "center", fontFamily: display, fontWeight: 700, fontSize: 24,
        color: lead ? FEED_LIME : FEED_TEXT_HI, boxSizing: "border-box", ...tabular,
      }}
    />
  );

  // A picker, plus "Don't know" while the seat is empty. Picking somebody
  // from an unknown seat replaces it, so there is no separate undo.
  const unknownable = (id: string, set: (v: string) => void, emptyLabel: string) => (
    <div style={{ display: "flex", gap: 6 }}>
      {!id && (
        <button
          onClick={() => set(UNKNOWN)}
          style={{ height: 36, padding: "0 12px", borderRadius: 18, border: "none", background: "transparent", color: FEED_TEXT_MID, cursor: "pointer", fontFamily: body, fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}
        >
          Don&apos;t know
        </button>
      )}
      <PlayerPicker players={eligible(id)} value={id === UNKNOWN ? "" : id} onChange={set} onCreatePlayer={onCreatePlayer} triggerLabel={id ? "Change" : emptyLabel} />
    </div>
  );

  const outcomeBtn = (w: string, text: string) => {
    const on = pickedWinner === w;
    return (
      <button
        onClick={() => setPickedWinner(w)}
        style={{ flex: w === "draw" ? "0 0 auto" : 1, height: 44, padding: "0 14px", borderRadius: 14, border: "none", cursor: "pointer", background: on ? FEED_LIME : FEED_RAISED, color: on ? FEED_LIME_INK : FEED_TEXT_HI, fontFamily: body, fontSize: 14, fontWeight: 600 }}
      >
        {text}
      </button>
    );
  };

  return (
    <>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={label}>YOUR TEAM</span>
          {/* A readout of the score, not a button. See the header. */}
          {winner === "A" && <span style={{ fontFamily: body, fontSize: 11, fontWeight: 700, color: FEED_LIME_INK, background: FEED_LIME, borderRadius: 8, padding: "3px 8px" }}>Won</span>}
          {winner === "draw" && <span style={{ fontFamily: body, fontSize: 11, fontWeight: 700, color: FEED_TEXT_MID }}>Drawn</span>}
        </div>
        {personRow(meId, <span style={{ fontFamily: body, fontSize: 13, fontWeight: 600, color: FEED_TEXT_MID, padding: "0 4px" }}>You</span>, true)}
        {personRow(partner, unknownable(partner, setPartner, "Partner"))}
      </div>

      <div style={{ textAlign: "center", fontFamily: display, fontWeight: 700, fontSize: 16, color: FEED_TEXT_MID, marginTop: 12 }}>vs</div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={label}>OPPONENTS</span>
          {winner === "B" && <span style={{ fontFamily: body, fontSize: 11, fontWeight: 700, color: FEED_LIME_INK, background: FEED_LIME, borderRadius: 8, padding: "3px 8px" }}>Won</span>}
        </div>
        {personRow(opp1, <PlayerPicker players={eligible(opp1)} value={opp1} onChange={setOpp1} onCreatePlayer={onCreatePlayer} triggerLabel={opp1 ? "Change" : "Add"} />)}
        {personRow(opp2, unknownable(opp2, setOpp2, "Add"))}
      </div>

      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", ...label }}>
          <span>SCORE</span>{!noScore && <span>You · Them</span>}
        </div>
        {noScore ? (
          <>
            <div style={{ fontFamily: body, fontSize: 14, color: FEED_TEXT_MID }}>Who won?</div>
            <div style={{ display: "flex", gap: 8 }}>
              {outcomeBtn("A", "We won")}
              {outcomeBtn("draw", "Draw")}
              {outcomeBtn("B", "They won")}
            </div>
          </>
        ) : (
          <>
        {sets.map((s, i) => {
          const a = parseInt(s.a, 10), b = parseInt(s.b, 10);
          const known = Number.isFinite(a) && Number.isFinite(b);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: body, fontSize: 14, color: FEED_TEXT_MID }}>Set {i + 1}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {scoreBox(s.a, (v) => setSets(sets.map((x, j) => j === i ? { ...x, a: v } : x)), known && a > b)}
                <span style={{ color: FEED_TEXT_MID }}>–</span>
                {scoreBox(s.b, (v) => setSets(sets.map((x, j) => j === i ? { ...x, b: v } : x)), known && b > a)}
              </div>
            </div>
          );
        })}
        <button
          onClick={() => setSets([...sets, { a: "", b: "" }])}
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 14, fontWeight: 600, padding: "4px 0", cursor: "pointer" }}
        >
          + Add set
        </button>
          </>
        )}
        <button
          onClick={() => { setNoScore(!noScore); setPickedWinner(null); }}
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: FEED_TEXT_MID, fontFamily: body, fontSize: 13, fontWeight: 600, padding: "2px 0", cursor: "pointer" }}
        >
          {noScore ? "Enter the score instead" : "Don't know the score"}
        </button>
      </div>

      {/* Only once there is something to say. A strip reading "+0 · −0" while
          you are still picking people is noise pretending to be information. */}
      {preview && mine && theirs && (
        <div style={{ margin: "12px 16px 0", padding: "14px 18px", borderRadius: 20, background: FEED_HERO, color: FEED_ON_HERO, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: body, fontSize: 14, fontWeight: 600 }}>Rating</span>
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: 16, ...tabular }}>
            You &amp; {(byId.get(partner)?.name) || "partner"} {showDelta(mine.delta)} · them {showDelta(theirs.delta)}
          </span>
        </div>
      )}

      <div style={{ padding: 16 }}>
        <button
          disabled={!complete || saving}
          onClick={() => complete && onSave({
            teamA: [meId, seat(partner)],
            teamB: [opp1, seat(opp2)],
            sets: noScore ? [] : clean,
            winner: winner as string,
          })}
          style={{
            width: "100%", height: 50, borderRadius: 25, border: "none",
            background: FEED_LIME, color: FEED_LIME_INK,
            fontFamily: body, fontSize: 17, fontWeight: 700,
            opacity: complete && !saving ? 1 : 0.5,
            cursor: complete && !saving ? "pointer" : "default",
          }}
        >
          {saving ? "Saving…" : "Save result"}
        </button>
      </div>
    </>
  );
}
