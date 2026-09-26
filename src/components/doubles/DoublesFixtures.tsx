"use client";
import React, { useMemo, useState } from "react";
import { Calendar, Plus } from "lucide-react";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { winnerFromSets } from "@/components/doubles/DoublesEntry";
import { predictDoubles, type DoublesStats } from "@/core/doubles/elo";
import type { DoublesFixture } from "@/lib/doublesData";
import { formatMatchDateTime, fullNameOf } from "@/lib/format";
import {
  DOT_LOSS, FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED,
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
  onBook: (f: { teamA: [string, string]; teamB: [string, string]; booked: number | null }) => Promise<void>;
  onReschedule: (id: string, booked: number | null) => Promise<void>;
  onCancel: (f: DoublesFixture) => Promise<void>;
  onComplete: (f: DoublesFixture, m: { sets: Array<{ a: number; b: number }>; winner: string }) => Promise<void>;
}

const label: React.CSSProperties = {
  fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID,
  textTransform: "uppercase", letterSpacing: 0.8,
};

const actionBtn = (fill: string, ink: string): React.CSSProperties => ({
  flex: 1, fontFamily: body, fontWeight: 500, fontSize: 13, padding: "10px 8px",
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

export function DoublesFixtures({ players, fixtures, stats, meId, canManage, unavailable, onBook, onReschedule, onCancel, onComplete }: Props) {
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
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  // Opening a different booking clears the score; reopening the same one
  // keeps it. Same rule, and same reason, as the singles panel.
  const openRow = (f: DoublesFixture) => {
    if (open !== f.id) setSets([{ a: "", b: "" }, { a: "", b: "" }]);
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
    .filter((f) => !f.done)
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
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
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
      <PlayerPicker players={eligible(i)} value={slots[i]} onChange={(id: string) => setSlot(i, id)} triggerLabel={slots[i] ? "Change" : "Add"} />
    </div>
  );

  const bookPanel = (
    <div style={{ marginBottom: 14 }}>
      {!booking ? (
        <button
          onClick={() => setBooking(true)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 12, padding: "12px 14px", fontFamily: body, fontWeight: 500, fontSize: 14.5, cursor: "pointer" }}
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
          {bookError && <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: DOT_LOSS, marginTop: 10 }}>{bookError}</div>}
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, lineHeight: 1.5, marginTop: 10 }}>
            A booking is just an arrangement — nothing counts until one of the four enters the result.
          </div>
        </SurfaceCard>
      )}
    </div>
  );

  return (
    <div>
      {bookPanel}

      {upcoming.length === 0 ? (
        <SurfaceCard radius={18}>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, marginBottom: 6 }}>No doubles booked.</div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
            {played ? "Every doubles booking has a result." : "Book one above — pick the four and a time."}
          </div>
        </SurfaceCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {upcoming.map((f) => {
            const four = [...f.teamA, ...f.teamB];
            const iAmIn = four.includes(meId);
            const mayCancel = iAmIn || canManage;
            const pA = Math.round(predictDoubles(f.teamA, f.teamB, stats) * 100);
            const past = f.booked != null && f.booked < Date.now();
            const dateLabel = f.booked != null ? formatMatchDateTime(f.booked) : null;
            const clean = parsed(sets);
            const winner = winnerFromSets(clean);

            return (
              <SurfaceCard key={f.id} radius={16} pad="12px 14px">
                <button onClick={() => openRow(f)} style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {f.teamA.map((id) => (
                        <span key={id} style={{ display: "block", fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nm(id)}</span>
                      ))}
                    </span>
                    <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, flexShrink: 0 }}>v</span>
                    <span style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                      {f.teamB.map((id) => (
                        <span key={id} style={{ display: "block", fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nm(id)}</span>
                      ))}
                    </span>
                  </div>

                  {/* Rating only, no pair head-to-head — see predictDoubles
                      and the report's note on why that is right for pairs. */}
                  <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", background: FEED_RAISED }}>
                    <div style={{ width: pA + "%", background: FEED_LIME }} />
                    <div style={{ width: (100 - pA) + "%", background: DOT_LOSS }} />
                  </div>
                  <div style={{ ...tabular, display: "flex", justifyContent: "space-between", fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID, marginTop: 5 }}>
                    <span>{pA}%</span>
                    <span style={{ color: FEED_TEXT_LOW }}>win chance</span>
                    <span>{100 - pA}%</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
                    {dateLabel && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: past ? FEED_RAISED : FEED_LIME, color: past ? FEED_TEXT_MID : FEED_LIME_INK, borderRadius: 999, padding: "2px 9px", fontFamily: body, fontWeight: 500, fontSize: 11.5 }}>
                        <Calendar size={11} strokeWidth={2.2} />{dateLabel}
                      </span>
                    )}
                    <span style={{ flex: 1 }} />
                    <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_LIME, flexShrink: 0 }}>
                      {open === f.id ? "Close" : past && iAmIn ? "Add the result" : "Details"}
                    </span>
                  </div>
                </button>

                {open === f.id && (
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
                        style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, background: "transparent", border: "none", padding: "0 0 16px", cursor: "pointer", display: "block" }}
                      >
                        Clear time
                      </button>
                    )}

                    {mayCancel && (
                      <div style={{ paddingBottom: 16 }}>
                        {confirmCancel === f.id ? (
                          <div style={{ background: FEED_RAISED, borderRadius: 14, padding: 14 }}>
                            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_HI, lineHeight: 1.45, marginBottom: 12 }}>
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
                          <span style={{ textTransform: "none" }}>{nm(f.teamA[0]).split(" ")[0]}&apos;s team · other team</span>
                        </div>
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
                        <button onClick={() => setSets([...sets, { a: "", b: "" }])} style={{ background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 13, fontWeight: 500, padding: "2px 0 10px", cursor: "pointer" }}>
                          + Add set
                        </button>
                        {/* A readout of the score, not an input. */}
                        <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, marginBottom: 10, minHeight: 18 }}>
                          {winner === "A" ? pair(f.teamA) + " won" : winner === "B" ? pair(f.teamB) + " won" : winner === "draw" ? "Drawn" : ""}
                        </div>
                        <button
                          disabled={!winner || busy}
                          onClick={() => winner && act(() => onComplete(f, { sets: clean, winner }), () => setOpen(null))}
                          style={{ ...actionBtn(winner ? FEED_LIME : FEED_RAISED, winner ? FEED_LIME_INK : FEED_TEXT_LOW), width: "100%", flex: "none", cursor: winner && !busy ? "pointer" : "default" }}
                        >
                          {busy ? "Saving…" : "Save result"}
                        </button>
                      </>
                    ) : (
                      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, lineHeight: 1.5 }}>
                        One of the four enters the result once it&apos;s played.
                      </div>
                    )}
                    {rowError && <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: DOT_LOSS, marginTop: 10 }}>{rowError}</div>}
                  </div>
                )}
              </SurfaceCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
