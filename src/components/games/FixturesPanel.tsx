"use client";
import React, { useEffect, useMemo, useState } from "react";
import { scoreProblem } from "@/core/sets";
import { DEFAULT_DURATION_MINUTES, DURATION_CHOICES } from "@/core/booking";
import { Calendar, ExternalLink, MapPin, MessageCircle, Plus, Search } from "lucide-react";
import { VenuePicker } from "@/components/games/VenuePicker";
import { mapsUrl, venueLabel, type Venue } from "@/lib/venues";
import { useColumnReady } from "@/lib/utrReady";
import { Empty } from "@/components/ui/atoms";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { predictProb } from "@/core/predict";
import { formatMatchDateTime, fullNameOf } from "@/lib/format";
import { londonDay } from "@/core/seasons";
import {
  DOT_LOSS, FORM_LOSS, FORM_WIN, FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED,
  FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, miniInput, tabular,
} from "@/lib/theme";

// The fixture list, in the scoreboard language.
//
// A fixture is a match that hasn't happened, so it gets the same card shape
// as one that has, with the prediction bar where the score would be. That
// symmetry is the point: the list is a season, and a played fixture and an
// unplayed one are two states of the same row rather than two designs.
//
// A booking is a real moment in time. `fixtures.booked` has always been a
// timestamptz in the database, but this screen used to collect it as free
// text with the placeholder "e.g. Saturday 2pm" — and
// `new Date("Saturday 2pm")` is an Invalid Date, whose .toISOString() throws.
// The placeholder was telling you to type the one thing that broke the save,
// and because saveData re-reads the league when a write fails, the booking
// just quietly vanished. It is a datetime picker now, which is what the
// column always wanted.

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
const toInputValue = (v: any): string => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** "Charlie Henry" → "Charlie H": the one-line rows' names. */
const shortName = (full: string): string => {
  const w = full.trim().split(/\s+/);
  return w.length < 2 ? full.trim() : `${w[0]} ${w[w.length - 1][0]}`;
};

/** Rows on the Fixtures tab before "See all". */
const MINE_PREVIEW = 5;

const timeOf = (v: any): number | null => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return isNaN(t) ? null : t;
};

// labelFor / noDraw / hideBooking / emptyText are what a competition needs,
// the same four the doubles panel takes: "Club Champs · Semi-finals" on a
// tie, no Draw button in a knockout, and no "Book a match" inside a
// competition, which is for casual games.
// view: "mine" is the Fixtures tab (your own matches, one line each);
// "rounds" is a competition's page (every tie by round, filter chips); left
// out, the original card list.
export function FixturesPanel({ fixtures, players, elo, matches, nameOf, meId, canManage, challengeWith, onResolve, onBook, onAddFixture, onRemoveFixture, onCreatePlayer, labelFor, noDraw, hideBooking, emptyText, onMessage, homeVenue, view, roundTitle, onOpenMatch }: any) {
  const who = (id: string) => players.find((x: any) => x.id === id) || null;
  const nm = (id: string) => { const p = who(id); return p ? fullNameOf(p) : nameOf(id); };
  const prob = (a: string, b: string) => Math.round(predictProb(a, b, matches, elo, players) * 100);
  const [open, setOpen] = useState<string | null>(null);
  const [whenText, setWhenText] = useState("");
  // Where (lib/venues.ts). Offered only once fixtures.venue exists, because a
  // save naming a missing column fails the whole save (lib/utrReady.ts).
  const venueReady = useColumnReady("fixtures", "venue");
  const [newVenue, setNewVenue] = useState<Venue | null>(homeVenue || null);
  const [rowVenue, setRowVenue] = useState<Venue | null>(null);
  // How long the booking is for. "How did it go?" is asked after it ends.
  // Saved only when it isn't the default (or the booking already had one),
  // so the default keeps working on a database without
  // schema_fixture_duration.sql.
  const [mins, setMins] = useState(DEFAULT_DURATION_MINUTES);
  const lengthPicker = (
    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
      {DURATION_CHOICES.map((m) => (
        <button key={m} onClick={() => setMins(m)} style={{ ...actionBtn(mins === m ? FEED_LIME : FEED_RAISED, mins === m ? FEED_LIME_INK : FEED_TEXT_MID), flex: 1, padding: "8px 6px" }}>
          {m === 60 ? "1 hour" : m === 90 ? "1½ hours" : m / 60 + " hours"}
        </button>
      ))}
    </div>
  );
  const [scoreText, setScoreText] = useState("");
  const [search, setSearch] = useState("");
  const [booking, setBooking] = useState(false);
  // Removing is two taps. It is not destructive enough for a dialog, and it
  // is too destructive for one.
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  // A refused save used to close the row and clear the score, so the only
  // evidence left was that nothing had happened. The form stays open with
  // what you typed still in it.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [allMine, setAllMine] = useState(false);
  const [filter, setFilter] = useState<"all" | "todo" | "played" | "overdue">("all");

  const submit = async (f: any, winner: "p1" | "p2" | "draw") => {
    // Free text has no "who first" rule, so only what's wrong either way
    // round is refused (core/sets.ts scoreProblem).
    const problem = scoreProblem(scoreText, winner, false);
    if (problem) { setSaveError(problem); return; }
    setSaving(true); setSaveError(null);
    let ok = false;
    try {
      ok = (await onResolve(f, winner, scoreText.trim())) !== false;
    } catch (e) {
      console.error("Saving a fixture result failed", e);
      ok = false;
    }
    setSaving(false);
    if (ok) { setOpen(null); setScoreText(""); }
    else setSaveError("Couldn't save. Try again.");
  };
  const [newOpp, setNewOpp] = useState(challengeWith || "");
  // Arriving from somebody's profile with Challenge tapped: open the form
  // with them already chosen, so the tap lands where it promised rather than
  // on a picker you have to fill in again.
  useEffect(() => {
    if (!challengeWith) return;
    setNewOpp(challengeWith);
    setBooking(true);
  }, [challengeWith]);
  const [newWhen, setNewWhen] = useState("");

  const done = fixtures.filter((f: any) => f.done).length;
  const total = fixtures.length;

  // Opening a DIFFERENT row clears the score; closing and reopening the same
  // one keeps it. Both halves matter: a score typed against Zaach must not
  // reappear under Hugh, and closing a row by accident should not throw away
  // what you had just typed into it.
  const openRow = (f: any) => { setRowVenue(f.venue || homeVenue || null); if (open !== f.id) setScoreText(""); setSaveError(null); setOpen(open === f.id ? null : f.id); setWhenText(toInputValue(f.booked)); setMins(f.durationMinutes || DEFAULT_DURATION_MINUTES); setScoreText(""); };

  // Soonest booking first, then everything unbooked, then what's been played.
  // A list of arranged games is a diary, and a diary that isn't in order is
  // a list you have to read all of to use.
  const ordered = useMemo(() => {
    const rank = (f: any) => (timeOf(f.booked) != null ? 0 : 1);
    return fixtures
      .filter((f: any) => !f.done && !f.outcome)
      .sort((a: any, b: any) => {
        const ra = rank(a), rb = rank(b);
        if (ra !== rb) return ra - rb;
        if (ra === 0) return (timeOf(a.booked) as number) - (timeOf(b.booked) as number);
        return 0;
      });
  }, [fixtures]);

  const q = search.trim().toLowerCase();
  const shown = q ? ordered.filter((f: any) => (nm(f.p1) + " " + nm(f.p2)).toLowerCase().includes(q)) : ordered;

  const canBookNew = !hideBooking && !!(onAddFixture && meId && onCreatePlayer);
  const opponents = useMemo(
    () => players.filter((p: any) => p.id !== meId).sort((a: any, b: any) => fullNameOf(a).localeCompare(fullNameOf(b))),
    [players, meId],
  );

  const bookNew = () => {
    if (!newOpp) return;
    onAddFixture(meId, newOpp, newWhen ? new Date(newWhen).toISOString() : null, newWhen && mins !== DEFAULT_DURATION_MINUTES ? mins : undefined, venueReady && newVenue ? newVenue : undefined);
    setNewOpp(""); setNewWhen(""); setBooking(false); setMins(DEFAULT_DURATION_MINUTES); setNewVenue(homeVenue || null);
  };

  const bookPanel = canBookNew && (
    <div style={{ marginBottom: 14 }}>
      {!booking ? (
        <button
          onClick={() => { setBooking(true); setNewVenue(homeVenue || null); }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 12, padding: "12px 14px", fontFamily: body, fontWeight: 600, fontSize: 14.5, cursor: "pointer" }}
        >
          <Plus size={17} strokeWidth={2.4} />Book a match
        </button>
      ) : (
        <SurfaceCard radius={16} pad="14px">
          <div style={{ ...label, marginBottom: 7 }}>Who against</div>
          <div style={{ marginBottom: 12 }}>
            <PlayerPicker
              players={opponents}
              value={newOpp}
              onChange={setNewOpp}
              onCreatePlayer={onCreatePlayer}
              exclude={meId}
              placeholder="Pick or add a player…"
            />
          </div>

          <div style={{ ...label, marginBottom: 7 }}>When</div>
          <input
            type="datetime-local"
            value={newWhen}
            onChange={(e) => setNewWhen(e.target.value)}
            style={{ ...field, width: "100%", marginBottom: 12 }}
          />
          {newWhen && <><div style={{ ...label, marginBottom: 7 }}>How long</div>{lengthPicker}</>}
          {venueReady && <><div style={{ ...label, marginBottom: 7 }}>Where</div><div style={{ marginBottom: 12 }}><VenuePicker value={newVenue} onChange={setNewVenue} home={homeVenue} /></div></>}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={bookNew} disabled={!newOpp} style={{ ...actionBtn(newOpp ? FEED_LIME : FEED_RAISED, newOpp ? FEED_LIME_INK : FEED_TEXT_LOW), cursor: newOpp ? "pointer" : "default" }}>Book it</button>
            <button onClick={() => { setBooking(false); setNewOpp(""); setNewWhen(""); }} style={actionBtn(FEED_RAISED, FEED_TEXT_MID)}>Cancel</button>
          </div>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_LOW, lineHeight: 1.5, marginTop: 10 }}>
            A booking is just an arrangement — nothing counts until somebody enters the result.
          </div>
        </SurfaceCard>
      )}
    </div>
  );

  // The open row's controls: message, book, cancel, enter result.
  const editor = (f: any) => (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid " + FEED_HAIRLINE }}>
                  {/* Arrange it where the match is (Rallio opens a chat per
                      challenge): straight into a message thread with the
                      other player, when they have an account to read it. */}
                  {(() => {
                    if (!onMessage || (f.p1 !== meId && f.p2 !== meId)) return null;
                    const them = (players || []).find((p: any) => p.id === (f.p1 === meId ? f.p2 : f.p1));
                    if (!them?.auth_id) return null;
                    return (
                      <button onClick={() => onMessage(them.auth_id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 999, padding: "8px 14px", fontFamily: body, fontSize: 14, cursor: "pointer", marginBottom: 12 }}>
                        <MessageCircle size={15} /> Message {(them.name || "them").trim()} to arrange it
                      </button>
                    );
                  })()}
                  <div style={{ ...label, marginBottom: 7 }}>Set a game</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: f.booked ? 8 : 16 }}>
                    <input
                      type="datetime-local"
                      value={whenText}
                      onChange={(e) => setWhenText(e.target.value)}
                      style={{ ...field, flex: 1 }}
                    />
                    <button
                      onClick={() => onBook(f.id, whenText ? new Date(whenText).toISOString() : null, whenText && (mins !== DEFAULT_DURATION_MINUTES || f.durationMinutes) ? mins : undefined, venueReady ? rowVenue : undefined)}
                      style={{ ...actionBtn(FEED_LIME, FEED_LIME_INK), flex: "0 0 auto", padding: "10px 16px" }}
                    >
                      Book
                    </button>
                  </div>
                  {whenText && lengthPicker}
                  {venueReady && <div style={{ marginBottom: 12 }}><VenuePicker value={rowVenue} onChange={setRowVenue} home={homeVenue} /></div>}
                  {f.venue?.name && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                      <a href={mapsUrl(f.venue)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: FEED_RAISED, color: FEED_TEXT_HI, borderRadius: 999, padding: "7px 13px", fontFamily: body, fontSize: 13.5, textDecoration: "none" }}>
                        <MapPin size={14} /> Open in Maps
                      </a>
                      {f.venue.url && (
                        <a href={f.venue.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: FEED_RAISED, color: FEED_TEXT_HI, borderRadius: 999, padding: "7px 13px", fontFamily: body, fontSize: 13.5, textDecoration: "none" }}>
                          <ExternalLink size={14} /> Venue website
                        </a>
                      )}
                    </div>
                  )}
                  {f.booked && (
                    <button
                      onClick={() => onBook(f.id, null)}
                      style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_LOW, background: "transparent", border: "none", padding: "0 0 16px", cursor: "pointer", display: "block" }}
                    >
                      Clear booking
                    </button>
                  )}

                  {/* Either of the two people in it can call it off, and so
                      can whoever runs the league. Booking something with no
                      way to un-book it is how a fixture list stops being
                      believed. */}
                  {onRemoveFixture && (canManage || f.p1 === meId || f.p2 === meId) && (
                    <div style={{ paddingBottom: 16 }}>
                      {confirmRemove === f.id ? (
                        <div style={{ background: FEED_RAISED, borderRadius: 14, padding: 14 }}>
                          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_HI, lineHeight: 1.45, marginBottom: 12 }}>
                            Cancel your match with {nm(f.p1 === meId ? f.p2 : f.p1)}?
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => { onRemoveFixture(f.id); setConfirmRemove(null); setOpen(null); }}
                              style={actionBtn(DOT_LOSS, FEED_LIME_INK)}
                            >
                              Cancel match
                            </button>
                            <button onClick={() => setConfirmRemove(null)} style={actionBtn(FEED_CARD, FEED_TEXT_HI)}>Keep it</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemove(f.id)}
                          style={{ ...actionBtn(FEED_RAISED, FEED_TEXT_MID), width: "100%", flex: "none" }}
                        >
                          Cancel match
                        </button>
                      )}
                    </div>
                  )}

                  <div style={{ ...label, marginBottom: 7 }}>Enter result</div>
                  <input
                    value={scoreText}
                    onChange={(e) => setScoreText(e.target.value)}
                    placeholder="Score, e.g. 6-3 (optional)"
                    style={{ ...field, width: "100%", marginBottom: 10 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button disabled={saving} onClick={() => submit(f, "p1")} style={actionBtn(FEED_RAISED, FEED_TEXT_HI)}>{nm(f.p1)} won</button>
                    {/* A knockout tie needs somebody to send through. */}
                    {!noDraw?.(f) && <button disabled={saving} onClick={() => submit(f, "draw")} style={{ ...actionBtn(FEED_RAISED, FEED_TEXT_MID), flex: "0 0 auto", padding: "10px 14px" }}>Draw</button>}
                    <button disabled={saving} onClick={() => submit(f, "p2")} style={actionBtn(FEED_RAISED, FEED_TEXT_HI)}>{nm(f.p2)} won</button>
                  </div>
                  {saveError && (
                    <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: DOT_LOSS, marginTop: 10 }}>
                      {saveError}
                    </div>
                  )}
                </div>
  );

  // Today, as a London day: a tie whose play-by is before it is overdue.
  const today = londonDay();
  const isOverdue = (f: any) => !f.done && !f.outcome && !!f.playBy && f.playBy < today;
  const short = (id: string) => shortName(nm(id));

  /**
   * One line a match (Sam, 2026-10-31): "Sam H v Adrian B", the competition
   * small and muted underneath, the win chance as a number and a Book button.
   * Tap anywhere for the booking / result controls.
   */
  const compactRow = (f: any, first: boolean) => {
    const mine = f.p1 === meId || f.p2 === meId;
    const p1 = prob(f.p1, f.p2);
    const chance = mine && f.p2 === meId ? 100 - p1 : p1;
    const bookedAt = timeOf(f.booked);
    const sub = [labelFor?.(f), bookedAt != null ? formatMatchDateTime(f.booked) : null, f.venue?.name ? venueLabel(f.venue) : null].filter(Boolean).join(" · ");
    const action = bookedAt == null ? "Book" : bookedAt < Date.now() ? "Result" : "Booked";
    const overdue = isOverdue(f);
    return (
      <div key={f.id} style={{ borderTop: first ? "none" : "1px solid " + FEED_HAIRLINE }}>
        <div role="button" onClick={() => openRow(f)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {short(f.p1)} <span style={{ fontWeight: 500, color: FEED_TEXT_LOW, fontSize: 13 }}>v</span> {short(f.p2)}
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

  /** A played tie: winner in bold, the score, tap for the match. */
  const playedRow = (f: any, first: boolean) => {
    const m = f.matchId ? (matches || []).find((x: any) => x.id === f.matchId) : null;
    const winSide = f.outcome === "walkover_p1" ? "p1" : f.outcome === "walkover_p2" ? "p2" : m ? (m.winner === "draw" ? "draw" : (m.winner === "p1" ? m.p1 : m.p2) === f.p1 ? "p1" : "p2") : null;
    const right = f.outcome === "void" ? "void" : String(f.outcome || "").startsWith("walkover") ? "walkover" : m?.score || (winSide === "draw" ? "draw" : "");
    const go = m && onOpenMatch ? () => onOpenMatch(m.id) : undefined;
    const nameStyle = (side: "p1" | "p2"): React.CSSProperties => ({ fontWeight: winSide === side ? 700 : 500, color: winSide && winSide !== side && winSide !== "draw" ? FEED_TEXT_MID : FEED_TEXT_HI });
    return (
      <div key={f.id} role={go ? "button" : undefined} onClick={go} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderTop: first ? "none" : "1px solid " + FEED_HAIRLINE, cursor: go ? "pointer" : "default" }}>
        <div style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span style={nameStyle("p1")}>{short(f.p1)}</span> <span style={{ fontWeight: 500, color: FEED_TEXT_LOW, fontSize: 13 }}>v</span> <span style={nameStyle("p2")}>{short(f.p2)}</span>
        </div>
        <span style={{ ...tabular, fontFamily: body, fontWeight: 600, fontSize: 13, color: FEED_TEXT_MID, flexShrink: 0 }}>{right}</span>
      </div>
    );
  };

  const group = (rows: React.ReactNode) => (
    <div style={{ background: FEED_CARD, borderRadius: 16, overflow: "hidden" }}>{rows}</div>
  );

  const searchBox = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: FEED_CARD, borderRadius: 12, padding: "0 12px", marginBottom: 14 }}>
      <Search size={15} color={FEED_TEXT_MID} strokeWidth={2} style={{ flexShrink: 0 }} />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search a player or matchup"
        // No border: miniInput's own outline drew a second box inside the
        // card's, which is the "search bar looks off" Sam saw.
        style={{ ...miniInput, fontFamily: body, fontSize: 14, background: "transparent", border: "none", outline: "none", boxShadow: "none", flex: 1, padding: "11px 0", color: FEED_TEXT_HI }}
      />
    </div>
  );

  // ---- A competition's own page: every tie, by round, with filter chips.
  if (view === "rounds") {
    const matchesFilter = (f: any) => {
      const played = !!f.done || !!f.outcome;
      if (filter === "todo") return !played;
      if (filter === "played") return played;
      if (filter === "overdue") return isOverdue(f);
      return true;
    };
    const list = fixtures.filter(matchesFilter);
    const rounds = Array.from(new Set(list.map((f: any) => f.round ?? 0))).sort((x: any, y: any) => x - y);
    const chip = (k: typeof filter, text: string, n: number) => (
      <button key={k} onClick={() => setFilter(k)} style={{ fontFamily: body, fontWeight: 600, fontSize: 13, padding: "7px 13px", borderRadius: 999, border: "none", cursor: "pointer", background: filter === k ? FEED_LIME : FEED_CARD, color: filter === k ? FEED_LIME_INK : FEED_TEXT_HI, whiteSpace: "nowrap" }}>
        {text}{n ? " · " + n : ""}
      </button>
    );
    const nTodo = fixtures.filter((f: any) => !f.done && !f.outcome).length;
    const nOver = fixtures.filter(isOverdue).length;
    return (
      <div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14 }}>
          {chip("all", "All", 0)}{chip("todo", "Still to play", nTodo)}{chip("played", "Played", done)}{chip("overdue", "Overdue", nOver)}
        </div>
        {!list.length && <Empty msg={filter === "overdue" ? "Nothing overdue." : filter === "played" ? "No results yet." : emptyText || "Every match has a result."} />}
        {rounds.map((r: any) => {
          const fs = list.filter((f: any) => (f.round ?? 0) === r)
            .sort((x: any, y: any) => Number(!!(x.done || x.outcome)) - Number(!!(y.done || y.outcome)));
          return (
            <div key={r} style={{ marginBottom: 16 }}>
              <div style={{ ...label, marginBottom: 7 }}>{r ? (roundTitle ? roundTitle(r) : "Round " + r) : "Matches"}</div>
              {group(fs.map((f: any, i: number) => (f.done || f.outcome ? playedRow(f, i === 0) : compactRow(f, i === 0))))}
            </div>
          );
        })}
      </div>
    );
  }

  // ---- The Fixtures tab: your own unplayed matches, soonest first.
  if (view === "mine") {
    const due = (f: any) => Math.min(
      f.playBy ? new Date(f.playBy + "T23:59:59Z").getTime() : Infinity,
      timeOf(f.booked) ?? Infinity,
    );
    const mine = fixtures
      .filter((f: any) => !f.done && !f.outcome && (f.p1 === meId || f.p2 === meId))
      // Soonest first, by whichever comes first: the day it is booked for
      // or the day it must be played by. A casual game booked for Saturday
      // has no play-by, and must not sink below a tie due in a month.
      .sort((a: any, b: any) => due(a) - due(b));
    const found = q ? ordered.filter((f: any) => (nm(f.p1) + " " + nm(f.p2)).toLowerCase().includes(q)) : [];
    const shownMine = allMine ? mine : mine.slice(0, MINE_PREVIEW);
    return (
      <div>
        {bookPanel}
        {ordered.length > 0 && searchBox}
        {q ? (
          <>
            <div style={{ ...label, marginBottom: 7 }}>{found.length} {found.length === 1 ? "match" : "matches"} found</div>
            {found.length ? group(found.map((f: any, i: number) => compactRow(f, i === 0))) : <Empty msg="No matches to play with that name." />}
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI }}>Your matches</span>
              {mine.length > 0 && <span style={label}>{mine.length} to play</span>}
            </div>
            {mine.length ? (
              <>
                {group(shownMine.map((f: any, i: number) => compactRow(f, i === 0)))}
                {mine.length > MINE_PREVIEW && (
                  <button onClick={() => setAllMine(!allMine)} style={{ background: "none", border: "none", padding: "10px 2px 0", cursor: "pointer", fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_LIME }}>
                    {allMine ? "Show fewer" : "See all " + mine.length}
                  </button>
                )}
              </>
            ) : (
              <SurfaceCard radius={16} pad="16px">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI }}>No matches to play. Book one?</div>
                  {canBookNew && (
                    <button onClick={() => { setBooking(true); setNewVenue(homeVenue || null); }} style={{ flexShrink: 0, fontFamily: body, fontWeight: 600, fontSize: 13.5, padding: "9px 16px", borderRadius: 999, border: "none", cursor: "pointer", background: FEED_LIME, color: FEED_LIME_INK }}>
                      Book
                    </button>
                  )}
                </div>
              </SurfaceCard>
            )}
          </>
        )}
      </div>
    );
  }

  if (!total) {
    return (
      <div>
        {bookPanel}
        <SurfaceCard radius={18}>
          {emptyText ? <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 }}>{emptyText}</div> : <>
          <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, marginBottom: 6 }}>Nothing booked yet.</div>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
            {canBookNew
              ? <>Book a match with anyone in the club above. A club owner can also set up a whole season at once in <span style={{ color: FEED_TEXT_HI }}>Menu → Run your club → Singles fixtures</span>.</>
              : <>A club owner can set these up in <span style={{ color: FEED_TEXT_HI }}>Menu → Run your club → Singles fixtures</span> — either an automatic round-robin or hand-picked matchups.</>}
          </div>
          </>}
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div>
      {bookPanel}

      {/* Only worth a search box once there are enough to search; a box over
          one challenge or three played fixtures was most of what showed. */}
      {fixtures.length > 5 && <div style={{ display: "flex", alignItems: "center", gap: 8, background: FEED_CARD, borderRadius: 12, padding: "0 12px", marginBottom: 14 }}>
        <Search size={15} color={FEED_TEXT_MID} strokeWidth={2} style={{ flexShrink: 0 }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a player or matchup"
          // No border: miniInput's own outline drew a second box inside the
          // card's, which is the "search bar looks off" Sam saw.
          style={{ ...miniInput, fontFamily: body, fontSize: 14, background: "transparent", border: "none", outline: "none", boxShadow: "none", flex: 1, padding: "11px 0", color: FEED_TEXT_HI }}
        />
      </div>}

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={label}>{done} of {total} played</span>
        {q && <span style={{ ...label, textTransform: "none" }}>{shown.length} found</span>}
      </div>
      <div style={{ height: 6, background: FEED_CARD, borderRadius: 3, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ width: (total ? (done / total) * 100 : 0) + "%", height: "100%", background: FEED_LIME }} />
      </div>

      {shown.length === 0 && <Empty msg={q ? "No fixtures match that search." : emptyText || "Nothing left to play. Every fixture has a result."} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shown.map((f: any) => (
          (
            <SurfaceCard key={f.id} radius={16} pad="12px 14px">
              <button onClick={() => openRow(f)} style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                {labelFor?.(f) && (
                  <div style={{ fontFamily: body, fontWeight: 600, fontSize: 11.5, color: FEED_LIME, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{labelFor(f)}</div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                      {nm(f.p1)}
                    </span>
                  </span>
                  <span style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_LOW, flexShrink: 0 }}>v</span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                    <span style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                      {nm(f.p2)}
                    </span>
                  </span>
                </div>

                {/* The prediction sits where a score would on a played card:
                    same shape, different state. */}
                {(() => {
                  const p1 = prob(f.p1, f.p2);
                  return (
                    <>
                      <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", background: FEED_RAISED }}>
                        <div style={{ width: p1 + "%", background: FORM_WIN }} />
                        <div style={{ width: (100 - p1) + "%", background: FORM_LOSS }} />
                      </div>
                      <div style={{ ...tabular, display: "flex", justifyContent: "space-between", fontFamily: body, fontWeight: 500, fontSize: 11, color: FEED_TEXT_MID, marginTop: 5 }}>
                        <span>{p1}%</span>
                        <span style={{ color: FEED_TEXT_LOW }}>win chance</span>
                        <span>{100 - p1}%</span>
                      </div>
                    </>
                  );
                })()}

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
                  {(() => {
                    const when = formatMatchDateTime(f.booked);
                    if (!when) return null;
                    // A booking that has been and gone stops shouting in
                    // lime: it is no longer something to turn up to, it is a
                    // result somebody still owes the league.
                    const past = (timeOf(f.booked) as number) < Date.now();
                    return (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: past ? FEED_RAISED : FEED_LIME, color: past ? FEED_TEXT_MID : FEED_LIME_INK, borderRadius: 999, padding: "2px 9px", fontFamily: body, fontWeight: 600, fontSize: 11.5 }}>
                        <Calendar size={11} strokeWidth={2.2} />{when}
                      </span>
                    );
                  })()}
                  {f.venue?.name && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0, fontFamily: body, fontWeight: 500, fontSize: 11.5, color: FEED_TEXT_MID, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <MapPin size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />{venueLabel(f.venue)}
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_LIME, flexShrink: 0 }}>
                    {open === f.id ? "Close" : timeOf(f.booked) != null && (timeOf(f.booked) as number) < Date.now() ? "Add the result" : "Book or enter result"}
                  </span>
                </div>
              </button>

              {open === f.id && editor(f)}
            </SurfaceCard>
          )
        ))}
      </div>
    </div>
  );
}
