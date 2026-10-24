"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trophy, X } from "lucide-react";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { FormDots, SurfaceCard, type FormResult } from "@/components/ui/Surfaces";
import {
  bracketSize, champion, knockoutBracket, leagueTable, roundName, roundRobin, tiesReadyToDraw,
  type Competition, type CompetitionFormat, type CompetitionKind, type CompetitionPair,
  type CompetitionResult, type KnockoutFixture, type Tie,
} from "@/core/doubles/competition";
import { formatMatchDate, fullNameOf } from "@/lib/format";
import { addDays, dayNumber, londonDay, londonDayStart, roundDeadlines, tieState, type Season } from "@/core/seasons";
import {
  DOT_LOSS, FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED,
  FEED_DOWN, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, FEED_UP, LINE, body, miniInput, tabular,
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

/** What the create form hands back. */
export interface NewCompetition {
  name: string; format: CompetitionFormat; legs: number; pointsWin: number; pointsDraw: number;
  /** The season it belongs to, whose dates it takes; null for none. */
  seasonId: string | null;
}

/** One tie as the deadlines section sees it, whichever kind it is. */
export interface TieRow {
  id: string; round: number | null; pairA: string | null; pairB: string | null;
  done: boolean; playBy: string | null; outcome: string | null;
  /** The walkover values for side A and side B: singles "walkover_p1/p2",
   *  doubles "walkover_a/b". */
  woA: string; woB: string;
}

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
  onCreate: (c: NewCompetition, entries: Array<{ p1: string; p2: string | null }>) => Promise<string>;
  onDraw: (c: Competition, ties: Tie[]) => Promise<void>;
  /** The club's seasons, for the create form's picker; active first. */
  seasons?: Season[];
  /** Every tie of a competition, decided or not, with its deadline — the
   *  deadlines section reads these. */
  tieRowsOf?: (c: Competition) => TieRow[];
  /** "Left" per entry, for the league table. */
  remainingOf?: (c: Competition) => Record<string, number>;
  /** An organiser changing one tie: its play-by day, a walkover, a void. */
  onSetTie?: (c: Competition, tieId: string, patch: { playBy?: string | null; outcome?: string | null }) => Promise<void>;
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
  /** Opened from the Table's "Create a division": the form says "New
   *  division", is named for the next one and is a league — no format to pick. */
  createPreset?: { title: string; name: string } | null;
  /** The create form closed, created or cancelled. */
  onCreateClosed?: () => void;
}

/** "Winter Doubles · Semi-finals" — how a competition tie labels itself anywhere. */
export function competitionLabel(c: Competition, entryCount: number, round: number | null): string {
  if (c.format === "ladder") return `${c.name} · challenge`;
  if (round == null) return c.name;
  if (c.format === "knockout") {
    const total = Math.round(Math.log2(bracketSize(entryCount)));
    return `${c.name} · ${roundName(round, total)}`;
  }
  return `${c.name} · Round ${round}`;
}

const label: React.CSSProperties = {
  fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID,
  letterSpacing: 0,
};

const btn = (fill: string, ink: string): React.CSSProperties => ({
  flex: 1, fontFamily: body, fontWeight: 600, fontSize: 13.5, padding: "11px 10px",
  borderRadius: 10, border: "none", cursor: "pointer", background: fill, color: ink,
});

const field: React.CSSProperties = {
  ...miniInput, fontFamily: body, fontSize: 15, background: FEED_RAISED,
  color: FEED_TEXT_HI, padding: "10px 12px", boxSizing: "border-box" as const, width: "100%",
};

const segment = (on: boolean): React.CSSProperties => ({
  flex: 1, height: 36, borderRadius: 10, border: "none", cursor: "pointer",
  background: on ? FEED_LIME : FEED_RAISED, color: on ? FEED_LIME_INK : FEED_TEXT_MID,
  fontFamily: body, fontSize: 14, fontWeight: 600,
});

/** "pairs" or "players" — the one word that differs between the two kinds. */
const unit = (kind: CompetitionKind, n: number) =>
  kind === "doubles" ? (n === 1 ? "pair" : "pairs") : (n === 1 ? "player" : "players");

let handledCreateSignal = 0;

export function Competitions(props: Props) {
  const { kind, players, competitions, entries, canManage, unavailable } = props;
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  // Open the form once per press of "Start a competition", not on every
  // mount: the signal stays bumped in the parent, and this screen unmounts
  // with every tab change, so a component-local check re-opened the form each
  // time Fixtures was visited (Sam: "confused me here"). Module state, like
  // the robins' last-animated count, outlives the mount.
  useEffect(() => {
    if (props.createSignal && canManage && props.createSignal !== handledCreateSignal) {
      handledCreateSignal = props.createSignal;
      setOpenId(null); setCreating(true);
    }
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
        onCancel={() => { setCreating(false); props.onCreateClosed?.(); }}
        seasons={props.seasons || []}
        preset={props.createPreset || null}
        onCreate={async (c, es) => { const id = await props.onCreate(c, es); setCreating(false); setOpenId(id); props.onCreateClosed?.(); }}
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
          <span style={{ display: "block", fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
          <span style={{ display: "block", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>{sub}</span>
        </span>
        <ChevronRight size={16} color={FEED_LIME} strokeWidth={2} style={{ flexShrink: 0 }} />
      </button>
    );
  };

  // sw-fix does nothing on a phone (the card, then the fixtures under it).
  // On a wide laptop (the foot of globals.css) it puts the two side by side.
  return (
    <div className="sw-fix">
      <div className="sw-fix-side">
      <SurfaceCard radius={16} pad="14px 14px 6px" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI }}>Competitions</span>
          {canManage && (
            <button onClick={() => setCreating(true)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 13, cursor: "pointer", padding: 0 }}>
              <Plus size={14} strokeWidth={2.4} />New
            </button>
          )}
        </div>
        {!competitions.length && (
          <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, padding: "4px 0 10px" }}>
            Run a {kind} league or a knockout: pick the {unit(kind, 2)} and Southwood draws the matches, keeps the table and moves winners through.
          </div>
        )}
        {running.map(row)}
        {finished.length > 0 && <div style={{ ...label, padding: "12px 0 2px" }}>Finished</div>}
        {finished.map(row)}
      </SurfaceCard>
      </div>
      <div className="sw-fix-main">{props.children}</div>
    </div>
  );
}

/**
 * A league-format competition's table: place, name, P, Left, W, D, L, sets,
 * points. One component for the competition's own screen and for the
 * Divisions view on the Table tab, so the two can never show different
 * tables for the same division.
 *
 * Tapping a row opens that player's matches underneath — who, the result,
 * the score and the points it earned, plus what is left to play. Sam,
 * 2026-10-22: "is there a way to click on a profile or wins to see where it
 * all come from?" The points come from the same pointsWin / pointsDraw the
 * table adds up, so the list always sums to the Pts column.
 */
/**
 * Promotion and relegation for one division (Divisions passes it; the
 * competition screen does not): how many rows go up and down, and where to.
 * The counts follow the season planner (core/promotion.ts), so the table and
 * the planner can never disagree about who moves.
 */
export interface TableZones { up: number; down: number; upTo?: string; downTo?: string }

const zoneKey = (z: TableZones): string => [
  z.up ? (z.up === 1 ? "Top place goes up" : `Top ${z.up} go up`) + (z.upTo ? " to " + z.upTo : "") : null,
  z.down ? (z.down === 1 ? "Bottom place drops" : `Bottom ${z.down} drop`) + (z.downTo ? " to " + z.downTo : "") : null,
].filter(Boolean).join(" · ");

export function LeagueTable({ kind, entries, results, pointsWin, pointsDraw, left, meId, entryName, onOpenEntry, zones }: {
  kind: CompetitionKind; entries: CompetitionPair[]; results: CompetitionResult[];
  pointsWin: number; pointsDraw: number; left: Record<string, number> | null; meId: string;
  entryName: (id: string | null | undefined, short?: boolean) => string;
  /** Tap a row — the Divisions view opens the player's profile. */
  onOpenEntry?: (entry: CompetitionPair) => void;
  zones?: TableZones | null;
}) {
  const table = leagueTable(entries, results, pointsWin, pointsDraw);
  const [open, setOpen] = useState<string | null>(null);
  // Last five results per entry, oldest first, from this competition only and
  // counted the way the table counts (confirmed only).
  const form = useMemo(() => {
    const out: Record<string, FormResult[]> = {};
    const counted = results.filter((r) => r.status === undefined || r.status === "confirmed")
      .slice().sort((x, y) => (x.date ?? 0) - (y.date ?? 0));
    for (const r of counted) {
      for (const [id, asA] of [[r.pairA, true], [r.pairB, false]] as Array<[string, boolean]>) {
        if (!id) continue;
        const o: FormResult = r.winner === "draw" ? "D" : (r.winner === "A") === asA ? "W" : "L";
        (out[id] = out[id] || []).push(o);
      }
    }
    for (const id of Object.keys(out)) out[id] = out[id].slice(-5);
    return out;
  }, [results]);
  // P, Left, W, D, L, Sets, Pts — every column kept (Sam, 2026-10-24).
  const cols = left ? "22px 1fr 22px 28px 22px 22px 22px 34px 30px" : "22px 1fr 26px 26px 26px 26px 36px 34px";
  const head: React.CSSProperties = { fontFamily: body, fontWeight: 600, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: FEED_TEXT_MID, textAlign: "right" };
  const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
  const n = table.length;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 4, padding: "0 8px 6px" }}>
        <span /><span style={{ ...head, textAlign: "left" }}>{kind === "doubles" ? "Pair" : "Player"}</span><span style={head}>P</span>{left && <span style={head}>Left</span>}<span style={head}>W</span><span style={head}>D</span><span style={head}>L</span><span style={head}>Sets</span><span style={head}>Pts</span>
      </div>
      <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid " + LINE }}>
      {table.map((r, i) => {
        const entry = entries.find((p) => p.id === r.pairId);
        const isMine = !!entry && (entry.p1 === meId || entry.p2 === meId);
        const sd = r.setsFor - r.setsAgainst;
        const up = !!zones && i < zones.up;
        const down = !!zones && !up && i >= n - zones.down;
        const fresh = r.played === 0;
        const bg = isMine ? tint(FEED_TEXT_HI, 7) : up ? tint(FEED_UP, 10) : down ? tint(FEED_DOWN, 10) : "transparent";
        const f = form[r.pairId] || [];
        return (
          <React.Fragment key={r.pairId}>
          <div onClick={() => setOpen(open === r.pairId ? null : r.pairId)} style={{ display: "grid", gridTemplateColumns: cols, gap: 4, alignItems: "center", padding: "9px 8px", background: bg, borderTop: i ? "1px solid " + LINE : "none", fontFamily: body, fontSize: 14, color: FEED_TEXT_HI, cursor: "pointer", opacity: fresh ? 0.55 : 1, ...tabular }}>
            <span style={{ fontWeight: 600, color: FEED_TEXT_MID, display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1 }}>
              {r.place}
              {(up || down) && <span style={{ fontSize: 9, color: up ? FEED_UP : FEED_DOWN, marginTop: 2 }}>{up ? "▲" : "▼"}</span>}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: isMine ? 700 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entryName(r.pairId)}</span>
              {fresh
                ? <span style={{ display: "block", fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>Not played yet</span>
                : f.length > 0 && <span style={{ display: "block", marginTop: 4 }}><FormDots form={f} size={6} /></span>}
            </span>
            <span style={{ textAlign: "right", color: FEED_TEXT_MID }}>{r.played}</span>
            {left && <span style={{ textAlign: "right", color: FEED_TEXT_MID }}>{left[r.pairId] || 0}</span>}
            <span style={{ textAlign: "right" }}>{r.won}</span>
            <span style={{ textAlign: "right" }}>{r.drawn}</span>
            <span style={{ textAlign: "right" }}>{r.lost}</span>
            <span style={{ textAlign: "right", fontWeight: 600, color: sd > 0 ? FEED_UP : sd < 0 ? FEED_DOWN : FEED_TEXT_MID }}>{sd > 0 ? "+" + sd : sd}</span>
            <span style={{ textAlign: "right", fontWeight: 700 }}>{r.points}</span>
          </div>
          {open === r.pairId && (
            <div style={{ padding: "0 8px" }}>
            <RowMatches
              pairId={r.pairId} results={results} pointsWin={pointsWin} pointsDraw={pointsDraw}
              left={left ? left[r.pairId] || 0 : null} entryName={entryName}
              onOpen={onOpenEntry && entry ? () => onOpenEntry(entry) : undefined}
            />
            </div>
          )}
          </React.Fragment>
        );
      })}
      </div>
      {zones && (zones.up > 0 || zones.down > 0) && n > 1 && (
        <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, padding: "8px 4px 0" }}>{zoneKey(zones)}</div>
      )}
    </div>
  );
}

/** One entry's results in a league table, each with the points it earned. */
function RowMatches({ pairId, results, pointsWin, pointsDraw, left, entryName, onOpen }: {
  pairId: string; results: CompetitionResult[]; pointsWin: number; pointsDraw: number; left: number | null;
  entryName: (id: string | null | undefined, short?: boolean) => string; onOpen?: () => void;
}) {
  // The same filter leagueTable counts with, so the rows sum to Pts.
  const mine = results.filter((r) => (r.status === undefined || r.status === "confirmed") && (r.pairA === pairId || r.pairB === pairId))
    .sort((x, y) => (y.date ?? 0) - (x.date ?? 0)); // newest first; walkovers (no date) last
  const small: React.CSSProperties = { fontFamily: body, fontSize: 13, color: FEED_TEXT_MID };
  return (
    <div style={{ background: FEED_RAISED, borderRadius: 10, padding: "8px 12px", margin: "0 0 8px" }}>
      {mine.map((r, i) => {
        const asA = r.pairA === pairId;
        const opp = asA ? r.pairB : r.pairA;
        const outcome = r.winner === "draw" ? "D" : (r.winner === "A") === asA ? "W" : "L";
        const pts = outcome === "W" ? pointsWin : outcome === "D" ? pointsDraw : 0;
        const score = r.walkover ? "walkover" : (r.sets || []).map((x) => asA ? `${x.a}-${x.b}` : `${x.b}-${x.a}`).join(", ");
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
            <span style={{ fontFamily: body, fontWeight: 600, fontSize: 13, width: 14, flexShrink: 0, color: outcome === "W" ? FEED_LIME : outcome === "L" ? DOT_LOSS : FEED_TEXT_HI }}>{outcome}</span>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: body, fontSize: 14, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {outcome === "W" ? "Beat " : outcome === "L" ? "Lost to " : "Drew with "}{entryName(opp)}
              </span>
              {r.date != null && <span style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_LOW, ...tabular }}>{formatMatchDate(r.date)}</span>}
            </span>
            {score && <span style={{ ...small, ...tabular, flexShrink: 0 }}>{score}</span>}
            <span style={{ fontFamily: body, fontSize: 13, color: pts ? FEED_TEXT_HI : FEED_TEXT_LOW, width: 34, textAlign: "right", flexShrink: 0, ...tabular }}>+{pts}</span>
          </div>
        );
      })}
      {!mine.length && <div style={{ ...small, padding: "4px 0" }}>No results yet.</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        {left !== null && <span style={{ ...small, flex: 1 }}>{left ? `${left} left to play` : "All played"}</span>}
        {onOpen && <button onClick={onOpen} style={{ marginLeft: "auto", background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 13, cursor: "pointer", padding: 0 }}>Open profile</button>}
      </div>
    </div>
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
  const n = cEntries.length;

  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e: any) { setErr(e?.message || "Couldn't do that. Try again."); }
    setBusy(false);
  };

  const left = props.remainingOf ? props.remainingOf(c) : null;
  return (
    <div>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 14, cursor: "pointer", padding: "0 0 10px" }}>
        <ChevronLeft size={16} strokeWidth={2.2} />Competitions
      </button>

      <SurfaceCard radius={16} pad="16px 14px" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: body, fontWeight: 600, fontSize: 20, color: FEED_TEXT_HI }}>{c.name}</div>
        <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, marginTop: 3 }}>
          {c.format === "league"
            ? `League · ${n} ${unit(kind, n)} · play each ${c.legs === 1 ? "once" : c.legs === 2 ? "twice" : c.legs + " times"} · ${c.pointsWin} for a win, ${c.pointsDraw} for a draw`
            : `Knockout · ${n} ${unit(kind, n)}, seeded`}
          {c.status === "finished" ? " · Finished" : ""}
        </div>

        {champ && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: FEED_LIME, color: FEED_LIME_INK, borderRadius: 12, padding: "12px 14px", marginTop: 14 }}>
            <Trophy size={20} strokeWidth={2} />
            <span style={{ fontFamily: body, fontWeight: 600, fontSize: 15 }}>Won by {entryName(champ, false)}</span>
          </div>
        )}

        {c.format === "league" && (
          <LeagueTable kind={kind} entries={cEntries} results={props.resultsOf(c)} pointsWin={c.pointsWin} pointsDraw={c.pointsDraw} left={left} meId={meId} entryName={entryName} />
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

      {props.tieRowsOf && (
        <Deadlines
          c={c}
          rows={props.tieRowsOf(c)}
          entryName={entryName}
          canManage={canManage}
          roundLabel={(round) => competitionLabel(c, n, round).replace(c.name + " · ", "")}
          onSetTie={props.onSetTie}
        />
      )}

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
// Deadlines
// ---------------------------------------------------------------------------

/**
 * Play-by days, round by round, and what to do about a tie nobody played.
 *
 * Brief item 1, with Sam's addition: rounds are spread evenly, and an
 * organiser can move ANY round's date — "winter weather will need
 * flexibility". Moving a round moves every unplayed tie in it; a single tie
 * can be extended on its own from the overdue list.
 *
 * Everybody sees the dates and the overdue flags. Only organisers see the
 * buttons, and the database (schema_seasons.sql's fixture guard) refuses
 * anyone else regardless.
 *
 * A walkover gives the points to the side that turned up and counts nowhere
 * else — there was no match, so no rating moves. A void takes the tie out of
 * the competition entirely.
 */
function Deadlines({ c, rows, entryName, canManage, roundLabel, onSetTie }: {
  c: Competition;
  rows: TieRow[];
  entryName: (id: string | null | undefined, short?: boolean) => string;
  canManage: boolean;
  roundLabel: (round: number) => string;
  onSetTie?: (c: Competition, tieId: string, patch: { playBy?: string | null; outcome?: string | null }) => Promise<void>;
}) {
  const [editRound, setEditRound] = useState<number | null>(null);
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dated = rows.filter((r) => r.playBy);
  if (!dated.length) return null;

  const act = async (fn: () => Promise<void>) => {
    if (busy || !onSetTie) return;
    setBusy(true); setErr(null);
    try { await fn(); } catch (e: any) { setErr(e?.message || "Couldn't save that."); }
    setBusy(false);
  };

  // One line per round: its date (the latest of its ties', so an extended
  // tie does not make the round look earlier than it is), and how many are
  // still to play.
  const rounds = Array.from(new Set(dated.map((r) => r.round ?? 0))).sort((a, b) => a - b);
  const roundDay = (round: number) => dated.filter((r) => (r.round ?? 0) === round).map((r) => r.playBy as string).sort().slice(-1)[0];
  const openIn = (round: number) => rows.filter((r) => (r.round ?? 0) === round && tieState(r) !== "played" && tieState(r) !== "walkover" && tieState(r) !== "void");
  const overdue = rows.filter((r) => tieState(r) === "overdue");
  const decided = rows.filter((r) => r.outcome);
  const date = (d: string) => formatMatchDate(londonDayStart(d));
  const small: React.CSSProperties = { background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 9, padding: "7px 10px", fontFamily: body, fontSize: 12.5, cursor: "pointer" };

  return (
    <SurfaceCard radius={16} pad="14px" style={{ marginBottom: 14 }}>
      <div style={{ ...label, marginBottom: 6 }}>Play by</div>
      {rounds.map((round, i) => {
        const open = openIn(round);
        const d = roundDay(round);
        const late = open.some((r) => tieState(r) === "overdue");
        return (
          <div key={round} style={{ padding: "8px 0", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: body, fontSize: 14, ...tabular }}>
              <span style={{ flex: 1, minWidth: 0, color: FEED_TEXT_HI }}>{roundLabel(round)}</span>
              <span style={{ color: late ? DOT_LOSS : FEED_TEXT_MID }}>{date(d)}</span>
              <span style={{ width: 54, textAlign: "right", color: FEED_TEXT_MID, fontSize: 12.5 }}>{open.length ? `${open.length} left` : "done"}</span>
              {canManage && onSetTie && open.length > 0 && (
                <button onClick={() => { setEditRound(editRound === round ? null : round); setDay(d); }} style={{ ...small, padding: "5px 9px" }}>Move</button>
              )}
            </div>
            {editRound === round && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input type="date" value={day} onChange={(e) => setDay(e.target.value)} style={{ ...field, flex: 1, minWidth: 0, WebkitAppearance: "none", appearance: "none", colorScheme: "dark" } as React.CSSProperties} />
                <button
                  disabled={busy || !day}
                  onClick={() => act(async () => { for (const r of open) await onSetTie!(c, r.id, { playBy: day }); setEditRound(null); })}
                  style={{ ...small, background: FEED_LIME, color: FEED_LIME_INK }}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        );
      })}

      {overdue.length > 0 && (
        <>
          <div style={{ ...label, color: DOT_LOSS, margin: "12px 0 4px" }}>Overdue</div>
          {overdue.map((r) => (
            <div key={r.id} style={{ padding: "8px 0", borderTop: "0.5px solid " + FEED_HAIRLINE }}>
              <div style={{ fontFamily: body, fontSize: 14, color: FEED_TEXT_HI }}>{entryName(r.pairA)} v {entryName(r.pairB)}</div>
              <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>Was due {date(r.playBy as string)}</div>
              {canManage && onSetTie && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  <button disabled={busy} onClick={() => act(() => onSetTie(c, r.id, { playBy: addDays(londonDay(), 14) }))} style={small}>Extend 2 weeks</button>
                  <button disabled={busy} onClick={() => act(() => onSetTie(c, r.id, { outcome: r.woA }))} style={small}>Walkover to {entryName(r.pairA)}</button>
                  <button disabled={busy} onClick={() => act(() => onSetTie(c, r.id, { outcome: r.woB }))} style={small}>Walkover to {entryName(r.pairB)}</button>
                  <button disabled={busy} onClick={() => act(() => onSetTie(c, r.id, { outcome: "void" }))} style={{ ...small, color: DOT_LOSS }}>Void</button>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {decided.length > 0 && (
        <>
          <div style={{ ...label, margin: "12px 0 4px" }}>Decided by the organisers</div>
          {decided.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "0.5px solid " + FEED_HAIRLINE, fontFamily: body, fontSize: 13.5 }}>
              <span style={{ flex: 1, minWidth: 0, color: FEED_TEXT_HI }}>
                {entryName(r.pairA)} v {entryName(r.pairB)}
                <span style={{ color: FEED_TEXT_MID }}> · {r.outcome === "void" ? "void" : `walkover to ${entryName(r.outcome === r.woA ? r.pairA : r.pairB)}`}</span>
              </span>
              {canManage && onSetTie && (
                <button disabled={busy} onClick={() => act(() => onSetTie(c, r.id, { outcome: null }))} style={small}>Undo</button>
              )}
            </div>
          ))}
        </>
      )}
      {err && <div style={{ fontFamily: body, fontSize: 13, color: DOT_LOSS, marginTop: 8 }}>{err}</div>}
    </SurfaceCard>
  );
}

// ---------------------------------------------------------------------------
// Setting one up
// ---------------------------------------------------------------------------

function CreateForm({ kind, players, onCreatePlayer, onCancel, onCreate, seasons, preset }: {
  kind: CompetitionKind; players: any[]; onCreatePlayer?: (p: any) => void;
  preset?: { title: string; name: string } | null;
  onCancel: () => void;
  onCreate: (c: NewCompetition, entries: Array<{ p1: string; p2: string | null }>) => Promise<void>;
  seasons: Season[];
}) {
  // Brief item 1: a competition lives inside a season and takes its dates.
  // Only a running season with an end date can hold one — deadlines are
  // spread up to that end. Defaults to the running season; "No season" keeps
  // the old shape (no dates) for a quick one-off.
  const usable = seasons.filter((x) => x.status === "active" && !!x.endsOn);
  const [seasonId, setSeasonId] = useState<string>(usable[0]?.id ?? "");
  const season = usable.find((x) => x.id === seasonId) || null;
  const doubles = kind === "doubles";
  const blank = () => ({ p1: "", p2: "" });
  const [name, setName] = useState(preset?.name || "");
  const [format, setFormat] = useState<CompetitionFormat>("league");
  // Twice by default (Sam, 2026-10-21): a group of five playing each other
  // twice is eight matches each over a winter, roughly one a fortnight — and
  // enough for the season table, which ranks at three.
  const [legs, setLegs] = useState(2);
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

  const rounds = n >= 2 ? (format === "league"
    ? roundRobin(complete.map((_, i) => String(i)), legs).reduce((m, t) => Math.max(m, t.round), 0)
    : Math.round(Math.log2(bracketSize(n)))) : 0;
  const from = season ? (dayNumber(londonDay()) > dayNumber(season.startsOn) ? londonDay() : season.startsOn) : null;
  const deadlines = season && from && rounds ? roundDeadlines(from, season.endsOn as string, rounds) : [];
  const every = deadlines.length > 1 ? Math.round((dayNumber(deadlines[deadlines.length - 1]) - dayNumber(from as string)) / deadlines.length) : 0;
  const summary = n < 2 ? `Add at least two ${unit(kind, 2)}.`
    : format === "league" ? `${n} ${unit(kind, n)} · ${roundRobin(complete.map((_, i) => String(i)), legs).length} matches`
    : (() => { const size = bracketSize(n); const byes = size - n; return `${n} ${unit(kind, n)} · ${byes ? `${byes} ${byes === 1 ? "bye" : "byes"} for the top seed${byes === 1 ? "" : "s"}` : "no byes"}`; })();

  const create = async () => {
    if (!ready || busy) return;
    setBusy(true); setErr(null);
    try {
      await onCreate(
        { name: name.trim(), format, legs: format === "league" ? legs : 1, pointsWin: format === "league" ? pw : 3, pointsDraw: format === "league" ? pd : 1, seasonId: season?.id ?? null },
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
      <div style={{ fontFamily: body, fontWeight: 600, fontSize: 18, color: FEED_TEXT_HI, marginBottom: 14 }}>{preset ? preset.title : `New ${kind} competition`}</div>

      <div style={{ ...label, marginBottom: 6 }}>Name</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={doubles ? "e.g. Winter Doubles 2026" : "e.g. Club Championship 2026"} style={{ ...field, marginBottom: 14 }} />

      <div style={{ ...label, marginBottom: 6 }}>Season</div>
      {usable.length ? (
        <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} style={{ ...field, marginBottom: 6 }}>
          {usable.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          <option value="">No season — no deadlines</option>
        </select>
      ) : (
        <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.45, marginBottom: 6 }}>
          No season with an end date is running, so this one has no deadlines. Start a season in Run your club to give matches play-by dates.
        </div>
      )}
      {season && (
        <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.45, marginBottom: 14, ...tabular }}>
          {formatMatchDate(londonDayStart(season.startsOn))} to {formatMatchDate(londonDayStart(season.endsOn as string))}.
          {rounds ? ` ${rounds} ${rounds === 1 ? "round" : "rounds"}${every ? `, one about every ${every} days` : ""} — the last due ${formatMatchDate(londonDayStart(deadlines[deadlines.length - 1]))}. Any round's date can be moved later.` : ""}
        </div>
      )}
      {!season && usable.length > 0 && <div style={{ marginBottom: 14 }} />}

      {!preset && <>
      <div style={{ ...label, marginBottom: 6 }}>Format</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button onClick={() => setFormat("league")} style={segment(format === "league")}>League</button>
        <button onClick={() => setFormat("knockout")} style={segment(format === "knockout")}>Knockout</button>
      </div>
      </>}
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
            <button onClick={() => setLegs(3)} style={segment(legs === 3)}>Three times</button>
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
