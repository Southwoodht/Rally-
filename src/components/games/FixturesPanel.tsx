"use client";
import React, { useMemo, useState } from "react";
import { Calendar, Check, Plus, Search } from "lucide-react";
import { Empty } from "@/components/ui/atoms";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { predictProb } from "@/core/predict";
import { fullNameOf } from "@/lib/format";
import {
  DOT_LOSS, FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED,
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
const toInputValue = (v: any): string => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sat 13 Sep, 2:00pm" — and "Today"/"Tomorrow" when that is friendlier. */
function whenLabel(v: any): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const h = d.getHours(), m = d.getMinutes();
  const time = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(d) - midnight(new Date())) / 86400000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  const day = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return `${day}, ${time}`;
}

const timeOf = (v: any): number | null => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return isNaN(t) ? null : t;
};

export function FixturesPanel({ fixtures, players, elo, matches, nameOf, meId, onResolve, onBook, onAddFixture }: any) {
  const who = (id: string) => players.find((x: any) => x.id === id) || null;
  const nm = (id: string) => { const p = who(id); return p ? fullNameOf(p) : nameOf(id); };
  const prob = (a: string, b: string) => Math.round(predictProb(a, b, matches, elo, players) * 100);
  const [open, setOpen] = useState<string | null>(null);
  const [whenText, setWhenText] = useState("");
  const [scoreText, setScoreText] = useState("");
  const [search, setSearch] = useState("");
  const [booking, setBooking] = useState(false);
  const [newOpp, setNewOpp] = useState("");
  const [newWhen, setNewWhen] = useState("");

  const done = fixtures.filter((f: any) => f.done).length;
  const total = fixtures.length;

  const openRow = (f: any) => { setOpen(open === f.id ? null : f.id); setWhenText(toInputValue(f.booked)); setScoreText(""); };

  // Soonest booking first, then everything unbooked, then what's been played.
  // A list of arranged games is a diary, and a diary that isn't in order is
  // a list you have to read all of to use.
  const ordered = useMemo(() => {
    const rank = (f: any) => (f.done ? 2 : timeOf(f.booked) != null ? 0 : 1);
    return [...fixtures].sort((a: any, b: any) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (ra === 0) return (timeOf(a.booked) as number) - (timeOf(b.booked) as number);
      return 0;
    });
  }, [fixtures]);

  const q = search.trim().toLowerCase();
  const shown = q ? ordered.filter((f: any) => (nm(f.p1) + " " + nm(f.p2)).toLowerCase().includes(q)) : ordered;

  const canBookNew = !!(onAddFixture && meId);
  const opponents = useMemo(
    () => players.filter((p: any) => p.id !== meId).sort((a: any, b: any) => fullNameOf(a).localeCompare(fullNameOf(b))),
    [players, meId],
  );

  const bookNew = () => {
    if (!newOpp) return;
    onAddFixture(meId, newOpp, newWhen ? new Date(newWhen).toISOString() : null);
    setNewOpp(""); setNewWhen(""); setBooking(false);
  };

  const bookPanel = canBookNew && (
    <div style={{ marginBottom: 14 }}>
      {!booking ? (
        <button
          onClick={() => setBooking(true)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 12, padding: "12px 14px", fontFamily: body, fontWeight: 500, fontSize: 14.5, cursor: "pointer" }}
        >
          <Plus size={17} strokeWidth={2.4} />Book a match
        </button>
      ) : (
        <SurfaceCard radius={16} pad="14px">
          <div style={{ ...label, marginBottom: 7 }}>Who against</div>
          <select
            value={newOpp}
            onChange={(e) => setNewOpp(e.target.value)}
            style={{ ...field, width: "100%", marginBottom: 12, appearance: "none" as const }}
          >
            <option value="">Pick a player…</option>
            {opponents.map((p: any) => <option key={p.id} value={p.id}>{fullNameOf(p)}</option>)}
          </select>

          <div style={{ ...label, marginBottom: 7 }}>When</div>
          <input
            type="datetime-local"
            value={newWhen}
            onChange={(e) => setNewWhen(e.target.value)}
            style={{ ...field, width: "100%", marginBottom: 12 }}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={bookNew} disabled={!newOpp} style={{ ...actionBtn(newOpp ? FEED_LIME : FEED_RAISED, newOpp ? FEED_LIME_INK : FEED_TEXT_LOW), cursor: newOpp ? "pointer" : "default" }}>Book it</button>
            <button onClick={() => { setBooking(false); setNewOpp(""); setNewWhen(""); }} style={actionBtn(FEED_RAISED, FEED_TEXT_MID)}>Cancel</button>
          </div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, lineHeight: 1.5, marginTop: 10 }}>
            A booking is just an arrangement — nothing counts until somebody enters the result.
          </div>
        </SurfaceCard>
      )}
    </div>
  );

  if (!total) {
    return (
      <div>
        {bookPanel}
        <SurfaceCard radius={18}>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, marginBottom: 6 }}>Nothing booked yet.</div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
            {canBookNew
              ? <>Book a match with anyone in the league above. A league owner can also set up a whole season at once in <span style={{ color: FEED_TEXT_HI }}>Profile → Manage players &amp; league → Fixtures</span>.</>
              : <>A league owner can set these up in <span style={{ color: FEED_TEXT_HI }}>Profile → Manage players &amp; league → Fixtures</span> — either an automatic round-robin or hand-picked matchups.</>}
          </div>
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div>
      {bookPanel}

      <div style={{ display: "flex", alignItems: "center", gap: 8, background: FEED_CARD, borderRadius: 12, padding: "0 12px", marginBottom: 14 }}>
        <Search size={15} color={FEED_TEXT_MID} strokeWidth={2} style={{ flexShrink: 0 }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a player or matchup"
          style={{ ...miniInput, fontFamily: body, fontSize: 14, background: "transparent", flex: 1, padding: "11px 0", color: FEED_TEXT_HI }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={label}>{done} of {total} played</span>
        {q && <span style={{ ...label, textTransform: "none" }}>{shown.length} found</span>}
      </div>
      <div style={{ height: 6, background: FEED_CARD, borderRadius: 3, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ width: (total ? (done / total) * 100 : 0) + "%", height: "100%", background: FEED_LIME }} />
      </div>

      {shown.length === 0 && <Empty msg="No fixtures match that search." />}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shown.map((f: any) => (
          f.done ? (
            // Played: it is a result now, so it reads as one.
            <SurfaceCard key={f.id} radius={16} pad="12px 14px">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Check size={16} color={FEED_LIME} strokeWidth={2.4} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 14, color: FEED_TEXT_MID, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.winner === "draw"
                    ? <><span style={{ color: FEED_TEXT_HI }}>{nm(f.p1)}</span> drew <span style={{ color: FEED_TEXT_HI }}>{nm(f.p2)}</span></>
                    : <><span style={{ fontWeight: 500, color: FEED_TEXT_HI }}>{nm(f.winner === "p1" ? f.p1 : f.p2)}</span> beat {nm(f.winner === "p1" ? f.p2 : f.p1)}</>}
                  {f.score ? <span style={{ ...tabular }}> · {f.score}</span> : null}
                </span>
                <button
                  onClick={() => onResolve(f, null)}
                  style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, background: "transparent", border: "none", padding: "4px 0 4px 8px", cursor: "pointer", flexShrink: 0 }}
                >
                  Undo
                </button>
              </div>
            </SurfaceCard>
          ) : (
            <SurfaceCard key={f.id} radius={16} pad="12px 14px">
              <button onClick={() => openRow(f)} style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                      {nm(f.p1)}
                    </span>
                  </span>
                  <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, flexShrink: 0 }}>v</span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                    <span style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
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
                        <div style={{ width: p1 + "%", background: FEED_LIME }} />
                        <div style={{ width: (100 - p1) + "%", background: DOT_LOSS }} />
                      </div>
                      <div style={{ ...tabular, display: "flex", justifyContent: "space-between", fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID, marginTop: 5 }}>
                        <span>{p1}%</span>
                        <span style={{ color: FEED_TEXT_LOW }}>win chance</span>
                        <span>{100 - p1}%</span>
                      </div>
                    </>
                  );
                })()}

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
                  {(() => {
                    const when = whenLabel(f.booked);
                    if (!when) return null;
                    // A booking that has been and gone stops shouting in
                    // lime: it is no longer something to turn up to, it is a
                    // result somebody still owes the league.
                    const past = (timeOf(f.booked) as number) < Date.now();
                    return (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: past ? FEED_RAISED : FEED_LIME, color: past ? FEED_TEXT_MID : FEED_LIME_INK, borderRadius: 999, padding: "2px 9px", fontFamily: body, fontWeight: 500, fontSize: 11.5 }}>
                        <Calendar size={11} strokeWidth={2.2} />{when}
                      </span>
                    );
                  })()}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_LIME, flexShrink: 0 }}>
                    {open === f.id ? "Close" : timeOf(f.booked) != null && (timeOf(f.booked) as number) < Date.now() ? "Enter result" : "Book or enter result"}
                  </span>
                </div>
              </button>

              {open === f.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid " + FEED_HAIRLINE }}>
                  <div style={{ ...label, marginBottom: 7 }}>Set a game</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: f.booked ? 8 : 16 }}>
                    <input
                      type="datetime-local"
                      value={whenText}
                      onChange={(e) => setWhenText(e.target.value)}
                      style={{ ...field, flex: 1 }}
                    />
                    <button
                      onClick={() => onBook(f.id, whenText ? new Date(whenText).toISOString() : null)}
                      style={{ ...actionBtn(FEED_LIME, FEED_LIME_INK), flex: "0 0 auto", padding: "10px 16px" }}
                    >
                      Book
                    </button>
                  </div>
                  {f.booked && (
                    <button
                      onClick={() => onBook(f.id, null)}
                      style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, background: "transparent", border: "none", padding: "0 0 16px", cursor: "pointer", display: "block" }}
                    >
                      Clear booking
                    </button>
                  )}

                  <div style={{ ...label, marginBottom: 7 }}>Enter result</div>
                  <input
                    value={scoreText}
                    onChange={(e) => setScoreText(e.target.value)}
                    placeholder="Score, e.g. 6-3 (optional)"
                    style={{ ...field, width: "100%", marginBottom: 10 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { onResolve(f, "p1", scoreText.trim()); setOpen(null); }} style={actionBtn(FEED_RAISED, FEED_TEXT_HI)}>{nm(f.p1)} won</button>
                    <button onClick={() => { onResolve(f, "draw", scoreText.trim()); setOpen(null); }} style={{ ...actionBtn(FEED_RAISED, FEED_TEXT_MID), flex: "0 0 auto", padding: "10px 14px" }}>Draw</button>
                    <button onClick={() => { onResolve(f, "p2", scoreText.trim()); setOpen(null); }} style={actionBtn(FEED_RAISED, FEED_TEXT_HI)}>{nm(f.p2)} won</button>
                  </div>
                </div>
              )}
            </SurfaceCard>
          )
        ))}
      </div>
    </div>
  );
}
