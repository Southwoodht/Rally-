"use client";
import React, { useMemo, useState } from "react";
import { Calendar, Plus, Search } from "lucide-react";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { winnerFromSets } from "@/components/doubles/DoublesEntry";
import { predictDoubles, type DoublesStats } from "@/core/doubles/elo";
import type { DoublesFixture } from "@/lib/doublesData";
import { formatMatchDate, formatMatchDateTime, fullNameOf } from "@/lib/format";
import { londonDay, londonDayStart } from "@/core/seasons";
import {
  DOT_LOSS, FORM_LOSS, FORM_WIN, FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED,
  FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, miniInput, tabular,
} from "@/lib/theme";

/**
 * Booking a doubles match, and the list of doubles bookings — Part A, A5.
 *
 * THE SAME CARD AS SINGLES FIXTURES, deliberately: two names a side instead
 * of one, the odds bar where a score would be, the lime date chip that goes
 * quiet once the time has passed. A doubles booking and a singles one are the
 * same kind of thing and should not look like two features.
 *
 * WHO CAN DO WHAT follows the RLS in the two migrations, so the screen never
 * offers a button the database will refuse:
 *   - booking: any member, for any four people (organising is normal);
 *   - cancelling: one of the four, or league staff;
 *   - entering the result: one of the four ONLY. doubles_matches' insert
 *     policy requires the person saving to be on court, and staff are not
 *     exempt — the brief asked for the tighter rule on a new feature.
 *
 * THE WINNER IS DERIVED FROM THE SETS, as on the entry screen and for the
 * same reason: the trigger refuses a winner that contradicts the score.
 */

interface Props {
  players: any[];
  fixtures: DoublesFixture[];
  stats: DoublesStats;
  meId: string;
  canManage: boolean;
  unavailable: boolean;
  /** See DoublesEntry: the same addPlayer singles uses. */
  onCreatePlayer?: (p: any) => void;
  onBook: (f: { teamA: [string, string]; teamB: [string, string]; booked: number | null }) => Promise<void>;
  onReschedule: (id: string, booked: number | null) => Promise<void>;
  onCancel: (f: DoublesFixture) => Promise<void>;
  onComplete: (f: DoublesFixture, m: { sets: Array<{ a: number; b: number }>; winner: string }) => Promise<void>;
  /** Inside a competition: no "Book a doubles match", which is for casual games. */
  hideBooking?: boolean;
  /** "Winter Doubles · Semi-finals" on a competition tie; null on a casual booking. */
  labelFor?: (f: DoublesFixture) => string | null;
  /** A knockout tie needs a winner: no Draw button, and a drawn score will not save. */
  noDraw?: (f: DoublesFixture) => boolean;
  /** What to say when there is nothing to list, when the default is wrong. */
  emptyText?: string;
  /** "mine": the Fixtures tab, your own matches one line each; "rounds": a
   *  competition's page, every tie by round with filter chips. Left out, the
   *  original card list. */
  view?: "mine" | "rounds";
  /** The doubles matches, for a played tie's score in the rounds view. */
  matches?: any[];
  roundTitle?: (round: number) => string;
  onOpenMatch?: (matchId: string) => void;
}

const label: React.CSSProperties = {
  fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID,
  letterSpacing: 0,
};

const actionBtn = (fill: string, ink: string): React.CSSProperties => ({
  flex: 1, fontFamily: body, fontWeight: 600, fontSize: 13, padding: "10px 8px",
  borderRadius: 10, border: "none", cursor: "pointer", background: fill, color: ink,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
});

const field: React.CSSProperties = {
  ...miniInput, fontFamily: body, fontSize: 14, background: FEED_RAISED,
  color: FEED_TEXT_HI, padding: "10px 12px", boxSizing: "border-box" as const,
};

/** ms → the "YYYY-MM-DDTHH:mm" local string a datetime-local input wants. */
const toInputValue = (v: number | null): string => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const fromInputValue = (v: string): number | null => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return isNaN(t) ? null : t;
};

type SetScore = { a: string; b: string };
const parsed = (rows: SetScore[]) =>
  rows
    .filter((r) => r.a.trim() !== "" && r.b.trim() !== "")
    .map((r) => ({ a: parseInt(r.a, 10), b: parseInt(r.b, 10) }))
    .filter((r) => Number.isFinite(r.a) && Number.isFinite(r.b));

export function DoublesFixtures({ players, fixtures, stats, meId, canManage, unavailable, onCreatePlayer, onBook, onReschedule, onCancel, onComplete, hideBooking, labelFor, noDraw, emptyText, view, matches, roundTitle, onOpenMatch }: Props) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const nm = (id: string) => { const p = byId.get(id); return p ? fullNameOf(p) : "Unknown player"; };
  const pair = (t: [string, string]) => nm(t[0]) + " & " + nm(t[1]);

  // --- booking a new one -------------------------------------------------
  const [booking, setBooking] = useState(false);
  // You are in the first slot because that is who books a match nearly every
  // time, but it is a picker like the other three: arranging a game for four
  // other people is allowed, and the policy allows it.
  const [slots, setSlots] = useState<[string, string, string, string]>([meId, "", "", ""]);
  const [when, setWhen] = useState("");
  const [bookError, setBookError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setSlot = (i: number, id: string) => setSlots((s) => s.map((x, j) => (j === i ? id : x)) as any);
  const eligible = (i: number) => players.filter((p) => p.id === slots[i] || !slots.includes(p.id));
  const bookReady = slots.every(Boolean) && new Set(slots).size === 4;

  const resetBooking = () => { setBooking(false); setSlots([meId, "", "", ""]); setWhen(""); setBookError(null); };
  const bookIt = async () => {
    if (!bookReady || busy) return;
    setBusy(true); setBookError(null);
    try {
      await onBook({ teamA: [slots[0], slots[1]], teamB: [slots[2], slots[3]], booked: fromInputValue(when) });
      resetBooking();
    } catch (e: any) {
      // The form stays open with the four still chosen. A refused booking that
      // cleared itself would leave nothing to show it had been refused.
      setBookError(e?.message || "Couldn't book that. Try again.");
    }
    setBusy(false);
  };

  // --- an existing one ---------------------------------------------------
  const [open, setOpen] = useState<string | null>(null);
  const [whenText, setWhenText] = useState("");
  const [sets, setSets] = useState<SetScore[]>([{ a: "", b: "" }, { a: "", b: "" }]);
  // Can't remember the score: pick who won instead, as on the entry screen.
  const [noScore, setNoScore] = useState(false);
  const [pickedWinner, setPickedWinner] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [allMine, setAllMine] = useState(false);
  const [filter, setFilter] = useState<"all" | "todo" | "played" | "overdue">("all");

  // Opening a different booking clears the score; reopening the same one
  // keeps it. Same rule, and same reason, as the singles panel.
  const openRow = (f: DoublesFixture) => {
    if (open !== f.id) { setSets([{ a: "", b: "" }, { a: "", b: "" }]); setNoScore(false); setPickedWinner(null); }
    setRowError(null); setConfirmCancel(null);
    setWhenText(toInputValue(f.booked));
    setOpen(open === f.id ? null : f.id);
  };

  const act = async (fn: () => Promise<void>, after?: () => void) => {
    if (busy) return;
    setBusy(true); setRowError(null);
    try { await fn(); after?.(); }
    catch (e: any) { setRowError(e?.message || "Couldn't save. Try again."); }
    setBusy(false);
  };

  // Soonest first, then unscheduled. Played ones are results now and live in
  // the feed and on the table, not in the diary.
  const upcoming = useMemo(() => fixtures
    .filter((f) => !f.done && !(f as any).outcome)
    .sort((a, b) => {
      if ((a.booked == null) !== (b.booked == null)) return a.booked == null ? 1 : -1;
      return (a.booked ?? 0) - (b.booked ?? 0);
    }), [fixtures]);
  const played = fixtures.length - upcoming.length;

  if (unavailable) {
    // States what happened, not why — the same wording discipline as the
    // doubles table's failure card.
    return (
      <SurfaceCard radius={18}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
          Couldn&apos;t load doubles bookings for this league just now.
        </div>
      </SurfaceCard>
    );
  }

  const slotRow = (i: number, prompt: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
      <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontWeight: slots[i] ? 500 : 400, fontSize: 15, color: slots[i] ? FEED_TEXT_HI : FEED_TEXT_MID, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {slots[i] ? (slots[i] === meId ? nm(slots[i]) + " (you)" : nm(slots[i])) : prompt}
      </span>
      <PlayerPicker players={eligible(i)} value={slots[i]} onChange={(id: string) => setSlot(i, id)} onCreatePlayer={onCreatePlayer} triggerLabel={slots[i] ? "Change" : "Add"} />
    </div>
  );

  const bookPanel = (
    <div style={{ marginBottom: 14 }}>
      {!booking ? (
        <button
          onClick={() => setBooking(true)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 12, padding: "12px 14px", fontFamily: body, fontWeight: 600, fontSize: 14.5, cursor: "pointer" }}
        >
          <Plus size={17} strokeWidth={2.4} />Book a doubles match
        </button>
      ) : (
        <SurfaceCard radius={16} pad="14px">
          <div style={{ ...label, marginBottom: 4 }}>Team one</div>
          {slotRow(0, "Pick a player")}
          {slotRow(1, "Partner")}
          <div style={{ ...label, margin: "12px 0 4px" }}>Team two</div>
          {slotRow(2, "Opponent")}
          {slotRow(3, "Opponent")}

          <div style={{ ...label, margin: "12px 0 7px" }}>When</div>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            style={{ ...field, width: "100%", marginBottom: 12 }}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={bookIt} disabled={!bookReady || busy} style={{ ...actionBtn(bookReady ? FEED_LIME : FEED_RAISED, bookReady ? FEED_LIME_INK : FEED_TEXT_LOW), cursor: bookReady && !busy ? "pointer" : "default" }}>
              {busy ? "Booking…" : "Book it"}
            </button>
            <button onClick={resetBooking} style={actionBtn(FEED_RAISED, FEED_TEXT_MID)}>Cancel</button>
          </div>
          {bookError && <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: DOT_LOSS, marginTop: 10 }}>{bookError}</div>}
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_LOW, lineHeight: 1.5, marginTop: 10 }}>
            A booking is just an arrangement — nothing counts until one of the four enters the result.
          </div>
        </SurfaceCard>
      )}
    </div>
  );

  // The open row's controls: time, cancel, enter result. Shared by every view.
  const editor = (f: DoublesFixture) => {
    const four = [...f.teamA, ...f.teamB];
    const iAmIn = four.includes(meId);
    const mayCancel = iAmIn || canManage;
    const clean = parsed(sets);
    const winner = noScore ? pickedWinner : winnerFromSets(clean);
    const knockout = !!noDraw?.(f);
    // A knockout tie that came out level has nobody to send through.
    const drawBlocked = knockout && winner === "draw";
    const canSave = !!winner && !drawBlocked;
    return (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid " + FEED_HAIRLINE }}>
                    <div style={{ ...label, marginBottom: 7 }}>Set a time</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: f.booked ? 8 : 16 }}>
                      <input type="datetime-local" value={whenText} onChange={(e) => setWhenText(e.target.value)} style={{ ...field, flex: 1 }} />
                      <button disabled={busy} onClick={() => act(() => onReschedule(f.id, fromInputValue(whenText)))} style={{ ...actionBtn(FEED_LIME, FEED_LIME_INK), flex: "0 0 auto", padding: "10px 16px" }}>Book</button>
                    </div>
                    {f.booked != null && (
                      <button
                        disabled={busy}
                        onClick={() => act(() => onReschedule(f.id, null), () => setWhenText(""))}
                        style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_LOW, background: "transparent", border: "none", padding: "0 0 16px", cursor: "pointer", display: "block" }}
                      >
                        Clear time
                      </button>
                    )}

                    {mayCancel && (
                      <div style={{ paddingBottom: 16 }}>
                        {confirmCancel === f.id ? (
                          <div style={{ background: FEED_RAISED, borderRadius: 14, padding: 14 }}>
                            <div style={{ fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_HI, lineHeight: 1.45, marginBottom: 12 }}>
                              Cancel {pair(f.teamA)} v {pair(f.teamB)}? The other players with accounts will get a message.
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button disabled={busy} onClick={() => act(() => onCancel(f), () => { setConfirmCancel(null); setOpen(null); })} style={actionBtn(DOT_LOSS, FEED_LIME_INK)}>Cancel match</button>
                              <button onClick={() => setConfirmCancel(null)} style={actionBtn(FEED_CARD, FEED_TEXT_HI)}>Keep it</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmCancel(f.id)} style={{ ...actionBtn(FEED_RAISED, FEED_TEXT_MID), width: "100%", flex: "none" }}>Cancel match</button>
                        )}
                      </div>
                    )}

                    {iAmIn ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", ...label, marginBottom: 7 }}>
                          <span>Enter result</span>
                          {!noScore && <span style={{ textTransform: "none" }}>{nm(f.teamA[0]).split(" ")[0]}&apos;s team · other team</span>}
                        </div>
                        {noScore ? (
                          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                            {([["A", pair(f.teamA)], ["draw", "Draw"], ["B", pair(f.teamB)]] as const).filter(([w]) => !(knockout && w === "draw")).map(([w, text]) => (
                              <button
                                key={w}
                                onClick={() => setPickedWinner(w)}
                                style={{ ...actionBtn(pickedWinner === w ? FEED_LIME : FEED_RAISED, pickedWinner === w ? FEED_LIME_INK : FEED_TEXT_HI), flex: w === "draw" ? "0 0 auto" : 1, padding: "10px 12px", whiteSpace: "normal" }}
                              >
                                {w === "draw" ? text : text + " won"}
                              </button>
                            ))}
                          </div>
                        ) : (<>
                        {sets.map((s, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID }}>Set {i + 1}</span>
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {(["a", "b"] as const).map((side, k) => (
                                <React.Fragment key={side}>
                                  {k === 1 && <span style={{ color: FEED_TEXT_LOW }}>–</span>}
                                  <input
                                    inputMode="numeric"
                                    aria-label={`Set ${i + 1}, ${side === "a" ? "first" : "second"} team`}
                                    value={s[side]}
                                    onChange={(e) => {
                                      const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
                                      setSets(sets.map((x, j) => (j === i ? { ...x, [side]: v } : x)));
                                    }}
                                    style={{ ...field, ...tabular, width: 48, textAlign: "center", fontSize: 16 }}
                                  />
                                </React.Fragment>
                              ))}
                            </span>
                          </div>
                        ))}
                        <button onClick={() => setSets([...sets, { a: "", b: "" }])} style={{ background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 13, fontWeight: 600, padding: "2px 0 10px", cursor: "pointer" }}>
                          + Add set
                        </button>
                        </>)}
                        <button
                          onClick={() => { setNoScore(!noScore); setPickedWinner(null); }}
                          style={{ display: "block", background: "none", border: "none", color: FEED_TEXT_MID, fontFamily: body, fontSize: 12, fontWeight: 600, padding: "0 0 10px", cursor: "pointer" }}
                        >
                          {noScore ? "Enter the score instead" : "Don't know the score"}
                        </button>
                        {/* A readout of the score, not an input. */}
                        <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, marginBottom: 10, minHeight: 18 }}>
                          {drawBlocked ? "A knockout match needs a winner — that score is level." : winner === "A" ? pair(f.teamA) + " won" : winner === "B" ? pair(f.teamB) + " won" : winner === "draw" ? "Drawn" : ""}
                        </div>
                        <button
                          disabled={!canSave || busy}
                          onClick={() => canSave && act(() => onComplete(f, { sets: noScore ? [] : clean, winner: winner as string }), () => setOpen(null))}
                          style={{ ...actionBtn(canSave ? FEED_LIME : FEED_RAISED, canSave ? FEED_LIME_INK : FEED_TEXT_LOW), width: "100%", flex: "none", cursor: canSave && !busy ? "pointer" : "default" }}
                        >
                          {busy ? "Saving…" : "Save result"}
                        </button>
                      </>
                    ) : (
                      <div style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_LOW, lineHeight: 1.5 }}>
                        One of the four enters the result once it&apos;s played.
                      </div>
                    )}
                    {rowError && <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: DOT_LOSS, marginTop: 10 }}>{rowError}</div>}
                  </div>
    );
  };

  const today = londonDay();
  const isOverdue = (f: DoublesFixture) => !f.done && !f.outcome && !!f.playBy && f.playBy < today;
  const short = (id: string) => { const n = nm(id).trim().split(/\s+/); return n.length < 2 ? n[0] : `${n[0]} ${n[n.length - 1][0]}`; };
  const shortPair = (t: [string, string]) => short(t[0]) + " & " + short(t[1]);
  // Booked: the time it's booked for. Not booked: the day it must be played by.
  const whenNote = (f: DoublesFixture) => (f.booked != null ? formatMatchDateTime(f.booked) : f.playBy ? "play by " + formatMatchDate(londonDayStart(f.playBy)) : null);

  /** One line a match, the same as singles: the four short names, the
   *  competition and the time or play-by small underneath, your team's win
   *  chance, and Book / Booked / Result. Tap for the controls. */
  const compactRow = (f: DoublesFixture, first: boolean) => {
    const pA = Math.round(predictDoubles(f.teamA, f.teamB, stats) * 100);
    const chance = f.teamB.includes(meId) ? 100 - pA : pA;
    const sub = [labelFor?.(f), whenNote(f)].filter(Boolean).join(" · ");
    const action = f.booked == null ? "Book" : f.booked < Date.now() ? "Result" : "Booked";
    const overdue = isOverdue(f);
    return (
      <div key={f.id} style={{ borderTop: first ? "none" : "1px solid " + FEED_HAIRLINE }}>
        <div role="button" onClick={() => openRow(f)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Four names do not fit one line on a phone: a pair a line. */}
            <div style={{ fontFamily: body, fontWeight: 600, fontSize: 14.5, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortPair(f.teamA)}</div>
            <div style={{ fontFamily: body, fontWeight: 600, fontSize: 14.5, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ fontWeight: 500, color: FEED_TEXT_LOW, fontSize: 13 }}>v</span> {shortPair(f.teamB)}
            </div>
            {(sub || overdue) && (
              <div style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {overdue && <span style={{ color: DOT_LOSS, fontWeight: 600 }}>Overdue{sub ? " · " : ""}</span>}{sub}
              </div>
            )}
          </div>
          <span title="Win chance" style={{ ...tabular, fontFamily: body, fontWeight: 600, fontSize: 13, color: FEED_TEXT_MID, flexShrink: 0 }}>{chance}%</span>
          <button
            onClick={(e) => { e.stopPropagation(); if (open !== f.id) openRow(f); }}
            style={{ flexShrink: 0, fontFamily: body, fontWeight: 600, fontSize: 13, padding: "7px 13px", borderRadius: 999, border: "none", cursor: "pointer", background: action === "Book" ? FEED_LIME : FEED_RAISED, color: action === "Book" ? FEED_LIME_INK : FEED_TEXT_HI }}
          >
            {action}
          </button>
        </div>
        {open === f.id && <div style={{ padding: "0 14px 14px" }}>{editor(f)}</div>}
      </div>
    );
  };

  /** A played tie: the winning pair in bold, the sets, tap for the match. */
  const playedRow = (f: DoublesFixture, first: boolean) => {
    const m: any = f.matchId ? (matches || []).find((x: any) => x.id === f.matchId) : null;
    const w = f.outcome === "walkover_a" ? "A" : f.outcome === "walkover_b" ? "B" : m ? m.winner : null;
    const right = f.outcome === "void" ? "void" : String(f.outcome || "").startsWith("walkover") ? "walkover"
      : m?.sets?.length ? m.sets.map((x: any) => `${x.a}-${x.b}`).join(", ") : w === "draw" ? "draw" : "";
    const go = m && onOpenMatch ? () => onOpenMatch(m.id) : undefined;
    const st = (side: "A" | "B"): React.CSSProperties => ({ fontWeight: w === side ? 700 : 500, color: w && w !== side && w !== "draw" ? FEED_TEXT_MID : FEED_TEXT_HI });
    return (
      <div key={f.id} role={go ? "button" : undefined} onClick={go} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderTop: first ? "none" : "1px solid " + FEED_HAIRLINE, cursor: go ? "pointer" : "default" }}>
        <div style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 14.5 }}>
          <div style={{ ...st("A"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortPair(f.teamA)}</div>
          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><span style={{ fontWeight: 500, color: FEED_TEXT_LOW, fontSize: 13 }}>v</span> <span style={st("B")}>{shortPair(f.teamB)}</span></div>
        </div>
        <span style={{ ...tabular, fontFamily: body, fontWeight: 600, fontSize: 13, color: FEED_TEXT_MID, flexShrink: 0 }}>{right}</span>
      </div>
    );
  };

  const group = (rows: React.ReactNode) => <div style={{ background: FEED_CARD, borderRadius: 16, overflow: "hidden" }}>{rows}</div>;

  if (view === "rounds") {
    const matchesFilter = (f: DoublesFixture) => {
      const isPlayed = !!f.done || !!f.outcome;
      return filter === "todo" ? !isPlayed : filter === "played" ? isPlayed : filter === "overdue" ? isOverdue(f) : true;
    };
    const list = fixtures.filter(matchesFilter);
    const rounds = Array.from(new Set(list.map((f) => f.round ?? 0))).sort((x, y) => x - y);
    const nTodo = fixtures.filter((f) => !f.done && !f.outcome).length;
    const nPlayed = fixtures.length - nTodo;
    const nOver = fixtures.filter(isOverdue).length;
    const chip = (k: typeof filter, text: string, n: number) => (
      <button key={k} onClick={() => setFilter(k)} style={{ fontFamily: body, fontWeight: 600, fontSize: 13, padding: "7px 13px", borderRadius: 999, border: "none", cursor: "pointer", background: filter === k ? FEED_LIME : FEED_CARD, color: filter === k ? FEED_LIME_INK : FEED_TEXT_HI, whiteSpace: "nowrap" }}>
        {text}{n ? " · " + n : ""}
      </button>
    );
    return (
      <div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14 }}>
          {chip("all", "All", 0)}{chip("todo", "Still to play", nTodo)}{chip("played", "Played", nPlayed)}{chip("overdue", "Overdue", nOver)}
        </div>
        {!list.length && <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID, padding: "8px 2px" }}>{filter === "overdue" ? "Nothing overdue." : filter === "played" ? "No results yet." : emptyText || "Every match has a result."}</div>}
        {rounds.map((r) => {
          const fs = list.filter((f) => (f.round ?? 0) === r).sort((x, y) => Number(!!(x.done || x.outcome)) - Number(!!(y.done || y.outcome)));
          return (
            <div key={r} style={{ marginBottom: 16 }}>
              <div style={{ ...label, marginBottom: 7 }}>{r ? (roundTitle ? roundTitle(r) : "Round " + r) : "Matches"}</div>
              {group(fs.map((f, i) => (f.done || f.outcome ? playedRow(f, i === 0) : compactRow(f, i === 0))))}
            </div>
          );
        })}
      </div>
    );
  }

  if (view === "mine") {
    const due = (f: DoublesFixture) => Math.min(f.playBy ? new Date(f.playBy + "T23:59:59Z").getTime() : Infinity, f.booked ?? Infinity);
    const mine = upcoming.filter((f) => [...f.teamA, ...f.teamB].includes(meId)).sort((a, b) => due(a) - due(b));
    const q = search.trim().toLowerCase();
    const found = q ? upcoming.filter((f) => [...f.teamA, ...f.teamB].map(nm).join(" ").toLowerCase().includes(q)) : [];
    const shownMine = allMine ? mine : mine.slice(0, 5);
    return (
      <div>
        {!hideBooking && bookPanel}
        {upcoming.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: FEED_CARD, borderRadius: 12, padding: "0 12px", marginBottom: 14 }}>
            <Search size={15} color={FEED_TEXT_MID} strokeWidth={2} style={{ flexShrink: 0 }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a player or matchup"
              style={{ ...miniInput, fontFamily: body, fontSize: 14, background: "transparent", border: "none", outline: "none", boxShadow: "none", flex: 1, padding: "11px 0", color: FEED_TEXT_HI }} />
          </div>
        )}
        {q ? (
          <>
            <div style={{ ...label, marginBottom: 7 }}>{found.length} {found.length === 1 ? "match" : "matches"} found</div>
            {found.length ? group(found.map((f, i) => compactRow(f, i === 0))) : <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID }}>No matches to play with that name.</div>}
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI }}>Your matches</span>
              {mine.length > 0 && <span style={label}>{mine.length} to play</span>}
            </div>
            {mine.length ? (
              <>
                {group(shownMine.map((f, i) => compactRow(f, i === 0)))}
                {mine.length > 5 && (
                  <button onClick={() => setAllMine(!allMine)} style={{ background: "none", border: "none", padding: "10px 2px 0", cursor: "pointer", fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_LIME }}>
                    {allMine ? "Show fewer" : "See all " + mine.length}
                  </button>
                )}
              </>
            ) : (
              <SurfaceCard radius={16} pad="16px">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI }}>No matches to play. Book one?</div>
                  {!hideBooking && (
                    <button onClick={() => setBooking(true)} style={{ flexShrink: 0, fontFamily: body, fontWeight: 600, fontSize: 13.5, padding: "9px 16px", borderRadius: 999, border: "none", cursor: "pointer", background: FEED_LIME, color: FEED_LIME_INK }}>Book</button>
                  )}
                </div>
              </SurfaceCard>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {!hideBooking && bookPanel}

      {upcoming.length === 0 ? (
        <SurfaceCard radius={18}>
          {emptyText ? (
            <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 }}>{emptyText}</div>
          ) : (<>
          <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, marginBottom: 6 }}>No doubles booked.</div>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
            {played ? "Every doubles booking has a result." : "Book one above — pick the four and a time."}
          </div>
          </>)}
        </SurfaceCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {upcoming.map((f) => {
            const iAmIn = [...f.teamA, ...f.teamB].includes(meId);
            const pA = Math.round(predictDoubles(f.teamA, f.teamB, stats) * 100);
            const past = f.booked != null && f.booked < Date.now();
            const dateLabel = f.booked != null ? formatMatchDateTime(f.booked) : null;
            const tag = labelFor?.(f) || null;

            return (
              <SurfaceCard key={f.id} radius={16} pad="12px 14px">
                <button onClick={() => openRow(f)} style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                  {tag && (
                    <div style={{ fontFamily: body, fontWeight: 600, fontSize: 11.5, color: FEED_LIME, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tag}</div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {f.teamA.map((id) => (
                        <span key={id} style={{ display: "block", fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nm(id)}</span>
                      ))}
                    </span>
                    <span style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_LOW, flexShrink: 0 }}>v</span>
                    <span style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                      {f.teamB.map((id) => (
                        <span key={id} style={{ display: "block", fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nm(id)}</span>
                      ))}
                    </span>
                  </div>

                  {/* Rating only, no pair head-to-head — see predictDoubles
                      and the report's note on why that is right for pairs. */}
                  <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", background: FEED_RAISED }}>
                    <div style={{ width: pA + "%", background: FORM_WIN }} />
                    <div style={{ width: (100 - pA) + "%", background: FORM_LOSS }} />
                  </div>
                  <div style={{ ...tabular, display: "flex", justifyContent: "space-between", fontFamily: body, fontWeight: 500, fontSize: 11, color: FEED_TEXT_MID, marginTop: 5 }}>
                    <span>{pA}%</span>
                    <span style={{ color: FEED_TEXT_LOW }}>win chance</span>
                    <span>{100 - pA}%</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
                    {dateLabel && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: past ? FEED_RAISED : FEED_LIME, color: past ? FEED_TEXT_MID : FEED_LIME_INK, borderRadius: 999, padding: "2px 9px", fontFamily: body, fontWeight: 600, fontSize: 11.5 }}>
                        <Calendar size={11} strokeWidth={2.2} />{dateLabel}
                      </span>
                    )}
                    <span style={{ flex: 1 }} />
                    <span style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_LIME, flexShrink: 0 }}>
                      {open === f.id ? "Close" : past && iAmIn ? "Add the result" : "Details"}
                    </span>
                  </div>
                </button>

                {open === f.id && editor(f)}
              </SurfaceCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
