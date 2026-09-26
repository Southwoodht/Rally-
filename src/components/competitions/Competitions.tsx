"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trophy, X } from "lucide-react";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { SurfaceCard } from "@/components/ui/Surfaces";
import {
  bracketSize, champion, knockoutBracket, leagueTable, roundName, roundRobin, tiesReadyToDraw,
  type Competition, type CompetitionFormat, type CompetitionKind, type CompetitionPair,
  type CompetitionResult, type KnockoutFixture, type Tie,
} from "@/core/doubles/competition";
import { fullNameOf } from "@/lib/format";
import {
  DOT_LOSS, FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED,
  FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, miniInput, tabular,
} from "@/lib/theme";

/**
 * Competitions — one component for singles and doubles.
 *
 * Sam, 26 Sep 2026: "custom yourself, I guess it's different per club", and
 * then: the admin must be simple "yet with the same impressive ideas". So a
 * competition is a container with a format — a league (everyone plays
 * everyone, once or twice, points of the club's choosing) or a seeded
 * knockout — and singles and doubles run on exactly the same rules, drawn
 * the same way, so there is one thing to learn rather than two.
 *
 * THIS COMPONENT NEVER READS A FIXTURES OR MATCHES TABLE. Singles and doubles
 * store their fixtures and results differently (the singles ones go through
 * the league's own save; the doubles ones are their own tables), so the
 * parent hands in each competition's ties and results already in the shape
 * the core wants, and a function that draws its fixture list. That is what
 * lets one screen serve both without knowing which it is.
 *
 * Nothing derivable is stored. The table is computed from the results and
 * the bracket from the ties, so correcting a result corrects both.
 */

export interface CompetitionCounts { unplayed: number; played: number }

interface Props {
  kind: CompetitionKind;
  players: any[];
  /** This kind's competitions only. */
  competitions: Competition[];
  entries: CompetitionPair[];
  meId: string;
  canManage: boolean;
  unavailable: boolean;
  onCreatePlayer?: (p: any) => void;
  onCreate: (c: { name: string; format: CompetitionFormat; legs: number; pointsWin: number; pointsDraw: number }, entries: Array<{ p1: string; p2: string | null }>) => Promise<string>;
  onDraw: (c: Competition, ties: Tie[]) => Promise<void>;
  onDelete: (c: Competition) => Promise<void>;
  onFinish: (c: Competition, finished: boolean) => Promise<void>;
  /** Each tie with its winner ('A'/'B' by entry side), for the bracket. */
  tiesOf: (c: Competition) => KnockoutFixture[];
  /** Confirmed results by entry, for the league table. */
  resultsOf: (c: Competition) => CompetitionResult[];
  countsOf: (c: Competition) => CompetitionCounts;
  /** The competition's unplayed fixtures, drawn by the parent's own panel. */
  renderFixtures: (c: Competition, labelFor: (round: number | null) => string, knockout: boolean, emptyText: string) => React.ReactNode;
  /** The ordinary fixtures, under the list; hidden while a competition or the form is open. */
  children?: React.ReactNode;
  /** Bumped by "Start a competition" in Run your league: open the create form. */
  createSignal?: number;
}

/** "Winter Doubles · Semi-finals" — how a competition tie labels itself anywhere. */
export function competitionLabel(c: Competition, entryCount: number, round: number | null): string {
  if (round == null) return c.name;
  if (c.format === "knockout") {
    const total = Math.round(Math.log2(bracketSize(entryCount)));
    return `${c.name} · ${roundName(round, total)}`;
  }
  return `${c.name} · Round ${round}`;
}

const label: React.CSSProperties = {
  fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID,
  textTransform: "uppercase", letterSpacing: 0.8,
};

const btn = (fill: string, ink: string): React.CSSProperties => ({
  flex: 1, fontFamily: body, fontWeight: 500, fontSize: 13.5, padding: "11px 10px",
  borderRadius: 10, border: "none", cursor: "pointer", background: fill, color: ink,
});

const field: React.CSSProperties = {
  ...miniInput, fontFamily: body, fontSize: 15, background: FEED_RAISED,
  color: FEED_TEXT_HI, padding: "10px 12px", boxSizing: "border-box" as const, width: "100%",
};

const segment = (on: boolean): React.CSSProperties => ({
  flex: 1, height: 36, borderRadius: 10, border: "none", cursor: "pointer",
  background: on ? FEED_LIME : FEED_RAISED, color: on ? FEED_LIME_INK : FEED_TEXT_MID,
  fontFamily: body, fontSize: 14, fontWeight: 500,
});

/** "pairs" or "players" — the one word that differs between the two kinds. */
const unit = (kind: CompetitionKind, n: number) =>
  kind === "doubles" ? (n === 1 ? "pair" : "pairs") : (n === 1 ? "player" : "players");

export function Competitions(props: Props) {
  const { kind, players, competitions, entries, canManage, unavailable } = props;
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  useEffect(() => {
    if (props.createSignal && canManage) { setOpenId(null); setCreating(true); }
  }, [props.createSignal, canManage]);

  // The SQL is not run yet: say nothing rather than something wrong, and
  // leave the ordinary fixtures exactly as they were.
  if (unavailable) return <>{props.children}</>;

  const entriesOf = (cid: string) => entries.filter((p) => p.competitionId === cid).sort((a, b) => a.seed - b.seed);
  const entryName = (eid: string | null | undefined, short = true): string => {
    const e = entries.find((x) => x.id === eid);
    if (!e) return "";
    const n = (id: string) => { const pl = byId.get(id); return pl ? (short && e.p2 ? (pl.name || "").trim() || fullNameOf(pl) : fullNameOf(pl)) : "?"; };
    return e.p2 ? `${n(e.p1)} & ${n(e.p2)}` : n(e.p1);
  };

  const open = competitions.find((c) => c.id === openId) || null;
  if (open) return <Detail {...props} c={open} cEntries={entriesOf(open.id)} entryName={entryName} onBack={() => setOpenId(null)} />;
  if (creating) {
    return (
      <CreateForm
        kind={kind}
        players={players}
        onCreatePlayer={props.onCreatePlayer}
        onCancel={() => setCreating(false)}
        onCreate={async (c, es) => { const id = await props.onCreate(c, es); setCreating(false); setOpenId(id); }}
      />
    );
  }

  const running = competitions.filter((c) => c.status === "running");
  const finished = competitions.filter((c) => c.status === "finished");
  if (!competitions.length && !canManage) return <>{props.children}</>;

  const row = (c: Competition) => {
    const ce = entriesOf(c.id);
    let sub = `${c.format === "league" ? "League" : "Knockout"} · ${ce.length} ${unit(kind, ce.length)}`;
    if (c.format === "knockout") {
      const champ = champion(knockoutBracket(ce, props.tiesOf(c)));
      if (champ) sub = `Won by ${entryName(champ)}`;
    }
    return (
      <button key={c.id} onClick={() => setOpenId(c.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: "none", padding: "11px 0", cursor: "pointer", textAlign: "left", borderTop: "0.5px solid " + FEED_HAIRLINE }}>
        <Trophy size={18} color={c.status === "running" ? FEED_LIME : FEED_TEXT_MID} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
          <span style={{ display: "block", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>{sub}</span>
        </span>
        <ChevronRight size={16} color={FEED_LIME} strokeWidth={2} style={{ flexShrink: 0 }} />
      </button>
    );
  };

  return (
    <>
      <SurfaceCard radius={16} pad="14px 14px 6px" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI }}>Competitions</span>
          {canManage && (
            <button onClick={() => setCreating(true)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 13, cursor: "pointer", padding: 0 }}>
              <Plus size={14} strokeWidth={2.4} />New
            </button>
          )}
        </div>
        {!competitions.length && (
          <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, padding: "4px 0 10px" }}>
            Run a {kind} league or a knockout: pick the {unit(kind, 2)} and Rally draws the matches, keeps the table and moves winners through.
          </div>
        )}
        {running.map(row)}
        {finished.length > 0 && <div style={{ ...label, padding: "12px 0 2px" }}>Finished</div>}
        {finished.map(row)}
      </SurfaceCard>
      {props.children}
    </>
  );
}

// ---------------------------------------------------------------------------
// One competition
// ---------------------------------------------------------------------------

function Detail(props: Props & {
  c: Competition; cEntries: CompetitionPair[]; entryName: (id: string | null | undefined, short?: boolean) => string; onBack: () => void;
}) {
  const { c, cEntries, entryName, onBack, meId, canManage, kind, onDraw, onDelete, onFinish } = props;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const counts = props.countsOf(c);
  const bracket = c.format === "knockout" ? knockoutBracket(cEntries, props.tiesOf(c)) : [];
  const ready = c.format === "knockout" && c.status === "running" ? tiesReadyToDraw(bracket) : [];
  const champ = c.format === "knockout" ? champion(bracket) : null;
  const table = c.format === "league" ? leagueTable(cEntries, props.resultsOf(c), c.pointsWin, c.pointsDraw) : [];
  const n = cEntries.length;

  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e: any) { setErr(e?.message || "Couldn't do that. Try again."); }
    setBusy(false);
  };

  const cols = "22px 1fr 26px 26px 26px 26px 34px 34px";
  return (
    <div>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 14, cursor: "pointer", padding: "0 0 10px" }}>
        <ChevronLeft size={16} strokeWidth={2.2} />Competitions
      </button>

      <SurfaceCard radius={16} pad="16px 14px" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 20, color: FEED_TEXT_HI }}>{c.name}</div>
        <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, marginTop: 3 }}>
          {c.format === "league"
            ? `League · ${n} ${unit(kind, n)} · play each ${c.legs === 1 ? "once" : c.legs === 2 ? "twice" : c.legs + " times"} · ${c.pointsWin} for a win, ${c.pointsDraw} for a draw`
            : `Knockout · ${n} ${unit(kind, n)}, seeded`}
          {c.status === "finished" ? " · Finished" : ""}
        </div>

        {champ && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: FEED_LIME, color: FEED_LIME_INK, borderRadius: 12, padding: "12px 14px", marginTop: 14 }}>
            <Trophy size={20} strokeWidth={2} />
            <span style={{ fontFamily: body, fontWeight: 500, fontSize: 15 }}>Won by {entryName(champ, false)}</span>
          </div>
        )}

        {c.format === "league" && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 4, ...label, textTransform: "none", letterSpacing: 0, paddingBottom: 6 }}>
              <span /><span>{kind === "doubles" ? "Pair" : "Player"}</span><span style={{ textAlign: "right" }}>P</span><span style={{ textAlign: "right" }}>W</span><span style={{ textAlign: "right" }}>D</span><span style={{ textAlign: "right" }}>L</span><span style={{ textAlign: "right" }}>Sets</span><span style={{ textAlign: "right" }}>Pts</span>
            </div>
            {table.map((r) => {
              const isMine = cEntries.some((p) => p.id === r.pairId && (p.p1 === meId || p.p2 === meId));
              const sd = r.setsFor - r.setsAgainst;
              return (
                <div key={r.pairId} style={{ display: "grid", gridTemplateColumns: cols, gap: 4, alignItems: "center", padding: "8px 0", borderTop: "0.5px solid " + FEED_HAIRLINE, fontFamily: body, fontSize: 14, color: FEED_TEXT_HI, ...tabular }}>
                  <span style={{ color: isMine ? FEED_LIME : FEED_TEXT_MID }}>{r.place}</span>
                  <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: isMine ? FEED_LIME : FEED_TEXT_HI }}>{entryName(r.pairId)}</span>
                  <span style={{ textAlign: "right", color: FEED_TEXT_MID }}>{r.played}</span>
                  <span style={{ textAlign: "right" }}>{r.won}</span>
                  <span style={{ textAlign: "right" }}>{r.drawn}</span>
                  <span style={{ textAlign: "right" }}>{r.lost}</span>
                  <span style={{ textAlign: "right", color: FEED_TEXT_MID }}>{sd > 0 ? "+" + sd : sd}</span>
                  <span style={{ textAlign: "right", fontWeight: 600 }}>{r.points}</span>
                </div>
              );
            })}
          </div>
        )}

        {c.format === "knockout" && bracket.map((round, ri) => (
          <div key={ri} style={{ marginTop: 14 }}>
            <div style={{ ...label, marginBottom: 4 }}>{roundName(ri + 1, bracket.length)}</div>
            {round.filter((t) => !(t.a === null && t.b === null)).map((t, ti) => {
              const side = (p: string | null | undefined) => {
                if (p === null) return <span style={{ color: FEED_TEXT_LOW }}>bye</span>;
                if (p === undefined) return <span style={{ color: FEED_TEXT_LOW }}>to be decided</span>;
                const won = t.winner === p, lost = typeof t.winner === "string" && t.winner !== p;
                return <span style={{ color: won ? FEED_LIME : lost ? FEED_TEXT_MID : FEED_TEXT_HI, fontWeight: won ? 600 : 400 }}>{entryName(p)}</span>;
              };
              return (
                <div key={ti} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: ti ? "0.5px solid " + FEED_HAIRLINE : "none", fontFamily: body, fontSize: 14 }}>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{side(t.a)}</span>
                  <span style={{ color: FEED_TEXT_LOW, fontSize: 12, flexShrink: 0 }}>v</span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{side(t.b)}</span>
                </div>
              );
            })}
          </div>
        ))}

        {/* Anyone in the league can draw a tie whose two entries are known:
            it only creates the fixture the bracket already implies, and the
            unique index makes two people pressing it at once harmless. */}
        {ready.length > 0 && (
          <button disabled={busy} onClick={() => act(() => onDraw(c, ready))} style={{ ...btn(FEED_LIME, FEED_LIME_INK), width: "100%", marginTop: 14 }}>
            {busy ? "Drawing…" : `Draw ${ready.length === 1 ? "the next match" : `the next ${ready.length} matches`}`}
          </button>
        )}
        {err && <div style={{ fontFamily: body, fontSize: 13, color: DOT_LOSS, marginTop: 10 }}>{err}</div>}
      </SurfaceCard>

      <div style={{ ...label, marginBottom: 8 }}>Matches to play</div>
      {props.renderFixtures(
        c,
        (round) => competitionLabel(c, n, round),
        c.format === "knockout",
        c.format === "knockout" && champ ? "All played." : c.format === "knockout" ? "Nothing to play until the next round is drawn." : "Every match has a result.",
      )}

      {canManage && (
        <div style={{ marginTop: 18 }}>
          {!confirmDelete ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={busy} onClick={() => act(() => onFinish(c, c.status === "running"))} style={btn(FEED_RAISED, FEED_TEXT_HI)}>
                {c.status === "running" ? "Mark finished" : "Reopen"}
              </button>
              <button onClick={() => setConfirmDelete(true)} style={btn(FEED_RAISED, FEED_TEXT_MID)}>Delete</button>
            </div>
          ) : (
            // Two steps, and the confirm says the numbers out loud (§3).
            <div style={{ background: FEED_CARD, borderRadius: 14, padding: 14 }}>
              <div style={{ fontFamily: body, fontSize: 14, color: FEED_TEXT_HI, lineHeight: 1.45, marginBottom: 12 }}>
                Delete {c.name}? {counts.unplayed ? `Its ${counts.unplayed} unplayed ${counts.unplayed === 1 ? "match goes" : "matches go"} with it. ` : ""}
                {counts.played ? `The ${counts.played} ${counts.played === 1 ? "result" : "results"} already played ${counts.played === 1 ? "is" : "are"} kept, and still count on the ${kind} table.` : ""} This cannot be undone.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button disabled={busy} onClick={() => act(() => onDelete(c).then(onBack))} style={btn(DOT_LOSS, FEED_LIME_INK)}>Delete</button>
                <button onClick={() => setConfirmDelete(false)} style={btn(FEED_RAISED, FEED_TEXT_HI)}>Keep it</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setting one up
// ---------------------------------------------------------------------------

function CreateForm({ kind, players, onCreatePlayer, onCancel, onCreate }: {
  kind: CompetitionKind; players: any[]; onCreatePlayer?: (p: any) => void;
  onCancel: () => void;
  onCreate: (c: { name: string; format: CompetitionFormat; legs: number; pointsWin: number; pointsDraw: number }, entries: Array<{ p1: string; p2: string | null }>) => Promise<void>;
}) {
  const doubles = kind === "doubles";
  const blank = () => ({ p1: "", p2: "" });
  const [name, setName] = useState("");
  const [format, setFormat] = useState<CompetitionFormat>("league");
  const [legs, setLegs] = useState(1);
  const [pointsWin, setPointsWin] = useState("3");
  const [pointsDraw, setPointsDraw] = useState("1");
  const [entries, setEntries] = useState<Array<{ p1: string; p2: string }>>([blank(), blank()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const used = entries.flatMap((e) => [e.p1, e.p2]).filter(Boolean);
  const eligible = (self: string) => players.filter((p) => p.id === self || !used.includes(p.id));
  const set = (i: number, k: "p1" | "p2", v: string) => setEntries(entries.map((e, j) => (j === i ? { ...e, [k]: v } : e)));

  const isComplete = (e: { p1: string; p2: string }) => !!e.p1 && (!doubles || !!e.p2);
  const complete = entries.filter(isComplete);
  const n = complete.length;
  const half = doubles && entries.some((e) => !!e.p1 !== !!e.p2);
  const pw = parseInt(pointsWin, 10), pd = parseInt(pointsDraw, 10);
  const ready = !!name.trim() && n >= 2 && !half && (format === "knockout" || (Number.isFinite(pw) && Number.isFinite(pd) && pw >= 0 && pd >= 0));

  // Singles: the whole active league in one tap, which is what "everyone
  // plays everyone" meant on the old fixtures screen.
  const everyone = () => {
    const active = players.filter((p) => !p.inactive).sort((a, b) => fullNameOf(a).localeCompare(fullNameOf(b)));
    setEntries(active.map((p) => ({ p1: p.id, p2: "" })));
  };

  const summary = n < 2 ? `Add at least two ${unit(kind, 2)}.`
    : format === "league" ? `${n} ${unit(kind, n)} · ${roundRobin(complete.map((_, i) => String(i)), legs).length} matches`
    : (() => { const size = bracketSize(n); const byes = size - n; return `${n} ${unit(kind, n)} · ${byes ? `${byes} ${byes === 1 ? "bye" : "byes"} for the top seed${byes === 1 ? "" : "s"}` : "no byes"}`; })();

  const create = async () => {
    if (!ready || busy) return;
    setBusy(true); setErr(null);
    try {
      await onCreate(
        { name: name.trim(), format, legs: format === "league" ? legs : 1, pointsWin: format === "league" ? pw : 3, pointsDraw: format === "league" ? pd : 1 },
        complete.map((e) => ({ p1: e.p1, p2: doubles ? e.p2 : null })),
      );
    } catch (e: any) {
      setErr(e?.message || "Couldn't create it. Try again.");
    }
    setBusy(false);
  };

  const who = (id: string) => { const p = byId.get(id); return p ? fullNameOf(p) : ""; };
  const slots: Array<"p1" | "p2"> = doubles ? ["p1", "p2"] : ["p1"];

  return (
    <SurfaceCard radius={16} pad="16px 14px">
      <div style={{ fontFamily: body, fontWeight: 500, fontSize: 18, color: FEED_TEXT_HI, marginBottom: 14 }}>New {kind} competition</div>

      <div style={{ ...label, marginBottom: 6 }}>Name</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={doubles ? "e.g. Winter Doubles 2026" : "e.g. Club Championship 2026"} style={{ ...field, marginBottom: 14 }} />

      <div style={{ ...label, marginBottom: 6 }}>Format</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button onClick={() => setFormat("league")} style={segment(format === "league")}>League</button>
        <button onClick={() => setFormat("knockout")} style={segment(format === "knockout")}>Knockout</button>
      </div>
      <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.45, marginBottom: 14 }}>
        {format === "league"
          ? `Every ${doubles ? "pair" : "player"} plays every other. A table on points, then sets, then games.`
          : `Seeded in the order below — the top ${doubles ? "pair" : "player"} is seed 1. Winners go through; a match can't end level.`}
      </div>

      {format === "league" && (
        <>
          <div style={{ ...label, marginBottom: 6 }}>Play each {doubles ? "pair" : "player"}</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <button onClick={() => setLegs(1)} style={segment(legs === 1)}>Once</button>
            <button onClick={() => setLegs(2)} style={segment(legs === 2)}>Twice</button>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <label style={{ flex: 1 }}>
              <div style={{ ...label, marginBottom: 6 }}>Points for a win</div>
              <input inputMode="numeric" value={pointsWin} onChange={(e) => setPointsWin(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} style={{ ...field, ...tabular }} />
            </label>
            <label style={{ flex: 1 }}>
              <div style={{ ...label, marginBottom: 6 }}>For a draw</div>
              <input inputMode="numeric" value={pointsDraw} onChange={(e) => setPointsDraw(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} style={{ ...field, ...tabular }} />
            </label>
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={label}>{doubles ? "Pairs" : "Players"}</span>
        {!doubles && (
          <button onClick={everyone} style={{ background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 13, cursor: "pointer", padding: 0 }}>Add everyone</button>
        )}
      </div>
      {entries.map((e, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
          <span style={{ width: 20, fontFamily: body, fontSize: 13, color: FEED_TEXT_LOW, ...tabular }}>{i + 1}</span>
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {slots.map((k) => (
              <span key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 14.5, color: e[k] ? FEED_TEXT_HI : FEED_TEXT_LOW, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {e[k] ? who(e[k]) : k === "p1" ? "Player" : "Partner"}
                </span>
                <PlayerPicker players={eligible(e[k])} value={e[k]} onChange={(v: string) => set(i, k, v)} onCreatePlayer={onCreatePlayer} triggerLabel={e[k] ? "Change" : "Add"} />
              </span>
            ))}
          </span>
          {entries.length > 2 && (
            <button aria-label={`Remove ${i + 1}`} onClick={() => setEntries(entries.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
              <X size={16} color={FEED_TEXT_MID} />
            </button>
          )}
        </div>
      ))}
      <button onClick={() => setEntries([...entries, blank()])} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 13.5, cursor: "pointer", padding: "8px 0 14px" }}>
        <Plus size={14} strokeWidth={2.4} />Add a {doubles ? "pair" : "player"}
      </button>

      <div style={{ fontFamily: body, fontSize: 13, color: half ? DOT_LOSS : FEED_TEXT_MID, marginBottom: 12 }}>
        {half ? "One pair has only one player." : summary}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={!ready || busy} onClick={create} style={{ ...btn(ready ? FEED_LIME : FEED_RAISED, ready ? FEED_LIME_INK : FEED_TEXT_LOW), cursor: ready && !busy ? "pointer" : "default" }}>
          {busy ? "Creating…" : "Create and draw"}
        </button>
        <button onClick={onCancel} style={btn(FEED_RAISED, FEED_TEXT_MID)}>Cancel</button>
      </div>
      {err && <div style={{ fontFamily: body, fontSize: 13, color: DOT_LOSS, marginTop: 10 }}>{err}</div>}
    </SurfaceCard>
  );
}
