"use client";
import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trophy, X } from "lucide-react";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { DoublesFixtures } from "@/components/doubles/DoublesFixtures";
import type { DoublesStats } from "@/core/doubles/elo";
import {
  bracketSize, champion, knockoutBracket, leagueTable, roundName, roundRobin, tiesReadyToDraw,
  type Competition, type CompetitionFormat, type CompetitionPair, type KnockoutFixture, type Tie,
} from "@/core/doubles/competition";
import type { DoublesFixture, DoublesRow } from "@/lib/doublesData";
import { fullNameOf } from "@/lib/format";
import {
  DOT_LOSS, FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED,
  FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, miniInput, tabular,
} from "@/lib/theme";

/**
 * Doubles competitions — Part B.
 *
 * Sam, 26 Sep 2026: "custom yourself, I guess it's different per club." So a
 * competition is a container with a format rather than one club's rulebook:
 * a league (everyone plays everyone, once or twice, points of the club's own
 * choosing) or a seeded knockout. Staff set it up; everybody plays it through
 * the same doubles fixtures and results as any other match, and every match
 * still counts towards the doubles ratings, because it is a real match.
 *
 * Nothing here is stored that could be derived. The table is computed from
 * the results and the bracket from the fixtures, so correcting a result
 * corrects both with nothing to repair by hand.
 */

interface Props {
  players: any[];
  competitions: Competition[];
  pairs: CompetitionPair[];
  fixtures: DoublesFixture[];
  matches: DoublesRow[];
  stats: DoublesStats;
  meId: string;
  canManage: boolean;
  unavailable: boolean;
  onCreatePlayer?: (p: any) => void;
  onCreate: (c: { name: string; format: CompetitionFormat; legs: number; pointsWin: number; pointsDraw: number }, pairs: Array<{ p1: string; p2: string }>) => Promise<string>;
  onDraw: (c: Competition, ties: Tie[]) => Promise<void>;
  onDelete: (c: Competition) => Promise<void>;
  onFinish: (c: Competition, finished: boolean) => Promise<void>;
  onReschedule: (id: string, booked: number | null) => Promise<void>;
  onCancel: (f: DoublesFixture) => Promise<void>;
  onComplete: (f: DoublesFixture, m: { sets: Array<{ a: number; b: number }>; winner: string }) => Promise<void>;
  /** The ordinary doubles fixtures, shown under the list and hidden while a
   *  competition or the create form is open, so one screen does one thing. */
  children?: React.ReactNode;
}

/** "Winter Doubles · Semi-finals" — how a competition tie labels itself anywhere. */
export function competitionLabel(c: Competition, pairCount: number, round: number | null): string {
  if (round == null) return c.name;
  if (c.format === "knockout") {
    const total = Math.round(Math.log2(bracketSize(pairCount)));
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

export function DoublesCompetitions(props: Props) {
  const { players, competitions, pairs, fixtures, matches, stats, meId, canManage, unavailable } = props;
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // The SQL is not run yet: say nothing rather than something wrong, and
  // leave the ordinary fixtures exactly as they were.
  if (unavailable) return <>{props.children}</>;

  const pairsOf = (cid: string) => pairs.filter((p) => p.competitionId === cid).sort((a, b) => a.seed - b.seed);
  const pairName = (pid: string | null | undefined, short = true): string => {
    const p = pairs.find((x) => x.id === pid);
    if (!p) return "";
    const n = (id: string) => { const pl = byId.get(id); return pl ? (short ? (pl.name || "").trim() || fullNameOf(pl) : fullNameOf(pl)) : "?"; };
    return `${n(p.p1)} & ${n(p.p2)}`;
  };

  const open = competitions.find((c) => c.id === openId) || null;
  if (open) return <Detail {...props} c={open} cPairs={pairsOf(open.id)} pairName={pairName} onBack={() => setOpenId(null)} />;
  if (creating) {
    return (
      <CreateForm
        players={players}
        meId={meId}
        onCreatePlayer={props.onCreatePlayer}
        onCancel={() => setCreating(false)}
        onCreate={async (c, ps) => { const id = await props.onCreate(c, ps); setCreating(false); setOpenId(id); }}
      />
    );
  }

  const running = competitions.filter((c) => c.status === "running");
  const finished = competitions.filter((c) => c.status === "finished");
  if (!competitions.length && !canManage) return <>{props.children}</>;

  const row = (c: Competition) => {
    const cp = pairsOf(c.id);
    let sub = `${c.format === "league" ? "League" : "Knockout"} · ${cp.length} pairs`;
    if (c.format === "knockout") {
      const ko = knockoutBracket(cp, koFixtures(c, fixtures, matches));
      const champ = champion(ko);
      if (champ) sub = `Won by ${pairName(champ)}`;
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
          Run a doubles league or a knockout: pick the pairs and Rally draws the fixtures, keeps the table and moves winners through.
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

/** A competition's fixtures as the bracket reads them: winner from the linked result. */
function koFixtures(c: Competition, fixtures: DoublesFixture[], matches: DoublesRow[]): KnockoutFixture[] {
  const byMatch = new Map(matches.map((m) => [m.id, m]));
  return fixtures
    .filter((f) => f.competitionId === c.id)
    .map((f) => {
      const m = f.matchId ? byMatch.get(f.matchId) : undefined;
      const counted = m && (m.status === undefined || m.status === "confirmed");
      return { id: f.id, round: f.round, pairA: f.pairA, pairB: f.pairB, winner: counted ? m!.winner : null };
    });
}

// ---------------------------------------------------------------------------
// One competition
// ---------------------------------------------------------------------------

function Detail({ c, cPairs, pairName, onBack, fixtures, matches, players, stats, meId, canManage, onDraw, onDelete, onFinish, onReschedule, onCancel, onComplete, onCreatePlayer }: Props & {
  c: Competition; cPairs: CompetitionPair[]; pairName: (id: string | null | undefined, short?: boolean) => string; onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mine = fixtures.filter((f) => f.competitionId === c.id);
  const unplayed = mine.filter((f) => !f.done);
  const results = matches.filter((m) => m.competitionId === c.id);
  const bracket = c.format === "knockout" ? knockoutBracket(cPairs, koFixtures(c, fixtures, matches)) : [];
  const ready = c.format === "knockout" && c.status === "running" ? tiesReadyToDraw(bracket) : [];
  const champ = c.format === "knockout" ? champion(bracket) : null;
  const table = c.format === "league"
    ? leagueTable(cPairs, results.filter((m) => m.teamAPairId && m.teamBPairId).map((m) => ({ pairA: m.teamAPairId as string, pairB: m.teamBPairId as string, winner: m.winner, sets: m.sets, status: m.status })), c.pointsWin, c.pointsDraw)
    : [];

  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e: any) { setErr(e?.message || "Couldn't do that. Try again."); }
    setBusy(false);
  };

  const roundOf = (f: DoublesFixture) => competitionLabel(c, cPairs.length, f.round);

  return (
    <div>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 14, cursor: "pointer", padding: "0 0 10px" }}>
        <ChevronLeft size={16} strokeWidth={2.2} />Competitions
      </button>

      <SurfaceCard radius={16} pad="16px 14px" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 20, color: FEED_TEXT_HI }}>{c.name}</div>
        <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, marginTop: 3 }}>
          {c.format === "league"
            ? `League · ${cPairs.length} pairs · play each ${c.legs === 1 ? "once" : c.legs === 2 ? "twice" : c.legs + " times"} · ${c.pointsWin} for a win, ${c.pointsDraw} for a draw`
            : `Knockout · ${cPairs.length} pairs, seeded`}
          {c.status === "finished" ? " · Finished" : ""}
        </div>

        {champ && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: FEED_LIME, color: FEED_LIME_INK, borderRadius: 12, padding: "12px 14px", marginTop: 14 }}>
            <Trophy size={20} strokeWidth={2} />
            <span style={{ fontFamily: body, fontWeight: 500, fontSize: 15 }}>Won by {pairName(champ, false)}</span>
          </div>
        )}

        {c.format === "league" && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "22px 1fr 26px 26px 26px 26px 34px 34px", gap: 4, ...label, textTransform: "none", letterSpacing: 0, paddingBottom: 6 }}>
              <span /><span>Pair</span><span style={{ textAlign: "right" }}>P</span><span style={{ textAlign: "right" }}>W</span><span style={{ textAlign: "right" }}>D</span><span style={{ textAlign: "right" }}>L</span><span style={{ textAlign: "right" }}>Sets</span><span style={{ textAlign: "right" }}>Pts</span>
            </div>
            {table.map((r) => {
              const isMine = cPairs.some((p) => p.id === r.pairId && (p.p1 === meId || p.p2 === meId));
              const sd = r.setsFor - r.setsAgainst;
              return (
                <div key={r.pairId} style={{ display: "grid", gridTemplateColumns: "22px 1fr 26px 26px 26px 26px 34px 34px", gap: 4, alignItems: "center", padding: "8px 0", borderTop: "0.5px solid " + FEED_HAIRLINE, fontFamily: body, fontSize: 14, color: FEED_TEXT_HI, ...tabular }}>
                  <span style={{ color: isMine ? FEED_LIME : FEED_TEXT_MID }}>{r.place}</span>
                  <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: isMine ? FEED_LIME : FEED_TEXT_HI }}>{pairName(r.pairId)}</span>
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
                return <span style={{ color: won ? FEED_LIME : lost ? FEED_TEXT_MID : FEED_TEXT_HI, fontWeight: won ? 600 : 400 }}>{pairName(p)}</span>;
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

        {/* Anyone in the league can draw a tie whose two pairs are known: it
            only creates the fixture the bracket already implies, and the
            unique index makes two people pressing it at once harmless. */}
        {ready.length > 0 && (
          <button disabled={busy} onClick={() => act(() => onDraw(c, ready))} style={{ ...btn(FEED_LIME, FEED_LIME_INK), width: "100%", marginTop: 14 }}>
            {busy ? "Drawing…" : `Draw ${ready.length === 1 ? "the next match" : `the next ${ready.length} matches`}`}
          </button>
        )}
        {err && <div style={{ fontFamily: body, fontSize: 13, color: DOT_LOSS, marginTop: 10 }}>{err}</div>}
      </SurfaceCard>

      <div style={{ ...label, marginBottom: 8 }}>Matches to play</div>
      <DoublesFixtures
        players={players}
        fixtures={unplayed}
        stats={stats}
        meId={meId}
        canManage={canManage}
        unavailable={false}
        hideBooking
        emptyText={c.format === "knockout" && champ ? "All played." : c.format === "knockout" ? "Nothing to play until the next round is drawn." : "Every match has a result."}
        labelFor={roundOf}
        noDraw={() => c.format === "knockout"}
        onCreatePlayer={onCreatePlayer}
        onBook={async () => { /* hidden */ }}
        onReschedule={onReschedule}
        onCancel={onCancel}
        onComplete={onComplete}
      />

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
                Delete {c.name}? {unplayed.length ? `Its ${unplayed.length} unplayed ${unplayed.length === 1 ? "match goes" : "matches go"} with it. ` : ""}
                {results.length ? `The ${results.length} ${results.length === 1 ? "result" : "results"} already played ${results.length === 1 ? "is" : "are"} kept, and still count on the doubles table.` : ""} This cannot be undone.
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

function CreateForm({ players, meId, onCreatePlayer, onCancel, onCreate }: {
  players: any[]; meId: string; onCreatePlayer?: (p: any) => void;
  onCancel: () => void;
  onCreate: (c: { name: string; format: CompetitionFormat; legs: number; pointsWin: number; pointsDraw: number }, pairs: Array<{ p1: string; p2: string }>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<CompetitionFormat>("league");
  const [legs, setLegs] = useState(1);
  const [pointsWin, setPointsWin] = useState("3");
  const [pointsDraw, setPointsDraw] = useState("1");
  const [entries, setEntries] = useState<Array<{ p1: string; p2: string }>>([{ p1: "", p2: "" }, { p1: "", p2: "" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  void meId;

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const used = entries.flatMap((e) => [e.p1, e.p2]).filter(Boolean);
  const eligible = (self: string) => players.filter((p) => p.id === self || !used.includes(p.id));
  const set = (i: number, k: "p1" | "p2", v: string) => setEntries(entries.map((e, j) => (j === i ? { ...e, [k]: v } : e)));

  const complete = entries.filter((e) => e.p1 && e.p2);
  const n = complete.length;
  const half = entries.some((e) => !!e.p1 !== !!e.p2);
  const pw = parseInt(pointsWin, 10), pd = parseInt(pointsDraw, 10);
  const ready = !!name.trim() && n >= 2 && !half && (format === "knockout" || (Number.isFinite(pw) && Number.isFinite(pd) && pw >= 0 && pd >= 0));

  // Say what pressing Create will actually do, before it does it.
  const summary = n < 2 ? "Add at least two pairs."
    : format === "league" ? `${n} pairs · ${roundRobin(complete.map((_, i) => String(i)), legs).length} matches`
    : (() => { const size = bracketSize(n); const byes = size - n; return `${n} pairs · ${byes ? `${byes} ${byes === 1 ? "bye" : "byes"} for the top seed${byes === 1 ? "" : "s"}` : "no byes"}`; })();

  const create = async () => {
    if (!ready || busy) return;
    setBusy(true); setErr(null);
    try {
      await onCreate({ name: name.trim(), format, legs: format === "league" ? legs : 1, pointsWin: format === "league" ? pw : 3, pointsDraw: format === "league" ? pd : 1 }, complete);
    } catch (e: any) {
      setErr(e?.message || "Couldn't create it. Try again.");
    }
    setBusy(false);
  };

  const who = (id: string) => { const p = byId.get(id); return p ? fullNameOf(p) : ""; };

  return (
    <SurfaceCard radius={16} pad="16px 14px">
      <div style={{ fontFamily: body, fontWeight: 500, fontSize: 18, color: FEED_TEXT_HI, marginBottom: 14 }}>New competition</div>

      <div style={{ ...label, marginBottom: 6 }}>Name</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winter Doubles 2026" style={{ ...field, marginBottom: 14 }} />

      <div style={{ ...label, marginBottom: 6 }}>Format</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button onClick={() => setFormat("league")} style={segment(format === "league")}>League</button>
        <button onClick={() => setFormat("knockout")} style={segment(format === "knockout")}>Knockout</button>
      </div>
      <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.45, marginBottom: 14 }}>
        {format === "league"
          ? "Every pair plays every other pair. A table on points, then sets, then games."
          : "Seeded in the order below — the top pair is seed 1. Winners go through; a match can't end level."}
      </div>

      {format === "league" && (
        <>
          <div style={{ ...label, marginBottom: 6 }}>Play each pair</div>
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

      <div style={{ ...label, marginBottom: 4 }}>Pairs</div>
      {entries.map((e, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
          <span style={{ width: 18, fontFamily: body, fontSize: 13, color: FEED_TEXT_LOW, ...tabular }}>{i + 1}</span>
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {(["p1", "p2"] as const).map((k) => (
              <span key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 14.5, color: e[k] ? FEED_TEXT_HI : FEED_TEXT_LOW, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {e[k] ? who(e[k]) : k === "p1" ? "Player" : "Partner"}
                </span>
                <PlayerPicker players={eligible(e[k])} value={e[k]} onChange={(v: string) => set(i, k, v)} onCreatePlayer={onCreatePlayer} triggerLabel={e[k] ? "Change" : "Add"} />
              </span>
            ))}
          </span>
          {entries.length > 2 && (
            <button aria-label={`Remove pair ${i + 1}`} onClick={() => setEntries(entries.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
              <X size={16} color={FEED_TEXT_MID} />
            </button>
          )}
        </div>
      ))}
      <button onClick={() => setEntries([...entries, { p1: "", p2: "" }])} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 13.5, cursor: "pointer", padding: "8px 0 14px" }}>
        <Plus size={14} strokeWidth={2.4} />Add a pair
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
