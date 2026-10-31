"use client";
import React, { useMemo, useState } from "react";
import { LeagueTable, type TableZones } from "@/components/competitions/Competitions";
import { divisionOdds } from "@/core/divisionOdds";
import { leagueTable } from "@/core/doubles/competition";
import type { Competition, CompetitionKind, CompetitionPair, CompetitionResult } from "@/core/doubles/competition";
import { fullNameOf } from "@/lib/format";
import { DOT_LOSS, FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_DIM, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, LINE, body, tabular } from "@/lib/theme";
import { GroupCard, GroupLabel, GroupRow } from "@/components/ui/Grouped";

/** An organiser's controls for one division (Sam, 2026-10-22: "should they
 *  have their own settings — add, remove, delete?"). */
export interface DivisionManage {
  /** Add a player late: they join on 0 points with their matches drawn. Singles only. */
  onAdd?: (c: Competition, playerId: string) => Promise<void>;
  /** Take a player out: their unplayed matches go, and their results come off the table. */
  onRemove?: (c: Competition, entry: CompetitionPair) => Promise<void>;
  /** Settle unplayed ties from matches already played this season; returns how many. Singles only. */
  onFill?: (c: Competition) => Promise<number>;
  onDelete: (c: Competition) => Promise<void>;
  /** Its own start and end (empty = the season's); returns what changed. */
  onDates?: (c: Competition, startsOn: string | null, endsOn: string | null) => Promise<string>;
  /** A new name; returns what to say. */
  onRename?: (c: Competition, name: string) => Promise<string>;
  /** Finish it: off this tab, unplayed matches voided, results and table kept. */
  onEnd?: (c: Competition) => Promise<void>;
}

/** "1 Oct – 31 Mar", "from 1 Oct", or null with no dates at all. */
function dateSpan(d: { startsOn: string | null; endsOn: string | null }): string | null {
  const f = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
  if (d.startsOn && d.endsOn) return f(d.startsOn) + " – " + f(d.endsOn);
  if (d.startsOn) return "from " + f(d.startsOn);
  if (d.endsOn) return "until " + f(d.endsOn);
  return null;
}

function ManagePanel({ c, entries, players, manage, nameOf, dates }: { c: Competition; entries: CompetitionPair[]; players: any[]; manage: DivisionManage; nameOf: (e: CompetitionPair) => string; dates: { startsOn: string | null; endsOn: string | null } }) {
  const [adding, setAdding] = useState("");
  const [newName, setNewName] = useState(c.name);
  const [from, setFrom] = useState(dates.startsOn || "");
  const [to, setTo] = useState(dates.endsOn || "");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inIt = new Set(entries.flatMap((e) => [e.p1, e.p2]));
  const candidates = players.filter((p) => !p.inactive && !inIt.has(p.id)).sort((a, b) => fullNameOf(a).localeCompare(fullNameOf(b)));
  const act = async (f: () => Promise<string | void>) => {
    setBusy(true); setMsg(null);
    try { const r = await f(); if (r) setMsg(r); } catch (e: any) { setMsg(e?.message || "That didn't save. Try again."); }
    setBusy(false); setConfirm(null);
  };
  const pill = (fill: string, ink: string): React.CSSProperties => ({ background: fill, color: ink, border: "none", borderRadius: 999, padding: "8px 14px", fontFamily: body, fontWeight: 600, fontSize: 13, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, flexShrink: 0 });
  const note: React.CSSProperties = { fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, lineHeight: 1.5 };
  const dateBox: React.CSSProperties = { flex: 1, minWidth: 0, background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 10, padding: "8px 10px", fontFamily: body, fontSize: 14, colorScheme: "dark" };
  return (
    <div style={{ borderTop: "0.5px solid " + FEED_HAIRLINE, marginTop: 12, paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      {manage.onRename && (
        <div>
          <div style={{ ...note, color: FEED_TEXT_LOW, marginBottom: 4 }}>Name</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Division name" style={{ ...dateBox, colorScheme: undefined }} />
            <button
              disabled={busy || !newName.trim() || newName.trim() === c.name}
              onClick={() => act(() => manage.onRename!(c, newName))}
              style={{ ...pill(FEED_LIME, FEED_LIME_INK), opacity: busy || !newName.trim() || newName.trim() === c.name ? 0.5 : 1 }}
            >
              Rename
            </button>
          </div>
        </div>
      )}
      {manage.onDates && (
        <div>
          <div style={{ ...note, color: FEED_TEXT_LOW, marginBottom: 4 }}>Dates for this division</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Starts" style={dateBox} />
            <span style={{ ...note, flexShrink: 0 }}>to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Ends" style={dateBox} />
          </div>
          <button
            disabled={busy || (from === (dates.startsOn || "") && to === (dates.endsOn || "")) || (!!from && !!to && to < from)}
            onClick={() => act(() => manage.onDates!(c, from || null, to || null))}
            style={{ ...pill(FEED_LIME, FEED_LIME_INK), marginTop: 8, opacity: busy || (from === (dates.startsOn || "") && to === (dates.endsOn || "")) ? 0.5 : 1 }}
          >
            Save dates
          </button>
          <div style={{ ...note, marginTop: 4 }}>
            {!!from && !!to && to < from ? "The end is before the start." : "Only results inside these dates count here. Matches still to play are due by the end."}
          </div>
        </div>
      )}
      {manage.onAdd && candidates.length > 0 && (
        <div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={adding} onChange={(e) => setAdding(e.target.value)} style={{ flex: 1, minWidth: 0, background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 10, padding: "9px 12px", fontFamily: body, fontSize: 14 }}>
              <option value="">Add a player…</option>
              {candidates.map((p) => <option key={p.id} value={p.id}>{fullNameOf(p)}</option>)}
            </select>
            <button disabled={busy || !adding} onClick={() => act(async () => { await manage.onAdd!(c, adding); setAdding(""); return "Added — their matches are drawn."; })} style={pill(FEED_LIME, FEED_LIME_INK)}>Add</button>
          </div>
          <div style={{ ...note, marginTop: 4 }}>They start on 0 points and get their matches against everyone.</div>
        </div>
      )}
      {manage.onFill && (
        <div>
          <button disabled={busy} onClick={() => act(async () => { const n = await manage.onFill!(c); return n ? `${n} ${n === 1 ? "match" : "matches"} filled in from results already played.` : "Nothing to fill — no matches between these players in the season yet."; })} style={pill(FEED_RAISED, FEED_TEXT_HI)}>
            Fill from results already played
          </button>
          <div style={{ ...note, marginTop: 4 }}>Uses matches inside this division&apos;s dates, earliest first, for any match still to play.</div>
        </div>
      )}
      {manage.onRemove && <div>
        <div style={{ ...note, color: FEED_TEXT_LOW, marginBottom: 4 }}>Take somebody out</div>
        {entries.map((e) => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
            <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 14, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nameOf(e)}</span>
            {confirm === e.id
              ? <button disabled={busy} onClick={() => act(async () => { await manage.onRemove!(c, e); return nameOf(e) + " removed."; })} style={pill(FEED_RAISED, DOT_LOSS)}>Remove? Their results come off</button>
              : <button onClick={() => setConfirm(e.id)} aria-label={"Remove " + nameOf(e)} style={{ background: "none", border: "none", color: FEED_TEXT_LOW, fontSize: 18, cursor: "pointer", padding: "0 4px" }}>×</button>}
          </div>
        ))}
      </div>}
      {manage.onEnd && (
        <div>
          {confirm === "end"
            ? <button disabled={busy} onClick={() => act(async () => { await manage.onEnd!(c); })} style={pill(FEED_RAISED, FEED_TEXT_HI)}>End {c.name}? Its table and results are kept</button>
            : <button onClick={() => setConfirm("end")} style={{ background: "none", border: "none", color: FEED_TEXT_HI, fontFamily: body, fontSize: 13, cursor: "pointer", padding: 0 }}>End this division</button>}
          <div style={{ ...note, marginTop: 4 }}>It leaves this tab, and matches it still had to play are called off. Nothing that was played is lost.</div>
        </div>
      )}
      <div>
        {confirm === "delete"
          ? <button disabled={busy} onClick={() => act(async () => { await manage.onDelete(c); })} style={pill(FEED_RAISED, DOT_LOSS)}>Delete {c.name} and its unplayed matches? Results stay.</button>
          : <button onClick={() => setConfirm("delete")} style={{ background: "none", border: "none", color: FEED_TEXT_LOW, fontFamily: body, fontSize: 13, cursor: "pointer", padding: 0 }}>Delete this division</button>}
      </div>
      {msg && <div style={note}>{msg}</div>}
    </div>
  );
}

/**
 * The one tier label worth printing — Sam, 2026-10-22, after seeing "Top /
 * Middle / Bottom tier" on every card: "you didn't actually need bottom
 * tier". Division 1 says it is the top; the numbers say the rest.
 */
export function tierLabel(index: number, count: number): string | null {
  return count > 1 && index === 0 ? "Top tier" : null;
}

/**
 * Every running league table, one under another, on the Table tab — Division
 * 1, Division 2, Division 3, like the football tables on the back page.
 *
 * Sam, 2026-10-22: the division tables were inside Fixtures → Competitions,
 * one screen each, and "I just want this super easy and simple". Same
 * LeagueTable as the competition's own screen, so the two cannot disagree.
 * Ordered by name with numbers read as numbers, so Division 10 follows 9.
 * Tapping a row lists that player's matches, with a link to their profile.
 */
export function Divisions({ kind, competitions, entries, players, meId, resultsOf, remainingOf, datesOf, oddsOf, onOpenPlayer, onAdd, onPlanNext, manage, vsOf }: {
  kind: CompetitionKind;
  /** "10–3" (ahead–behind) under each name. Singles. */
  vsOf?: (entry: CompetitionPair) => string | undefined;
  /** Running league-format competitions of this kind. */
  competitions: Competition[];
  entries: CompetitionPair[];
  players: any[];
  meId: string;
  resultsOf: (c: Competition) => CompetitionResult[];
  remainingOf: (c: Competition) => Record<string, number>;
  /** Its dates: its own, or its season's (core/backfill.ts divisionDates). */
  datesOf?: (c: Competition) => { startsOn: string | null; endsOn: string | null };
  onOpenPlayer: (id: string) => void;
  /** For the prediction: each division's unplayed matches (entry ids) and an entry's rating. */
  oddsOf?: (c: Competition) => { open: Array<[string, string]>; rating: (entryId: string) => number; rd?: (entryId: string) => number };
  /** Organisers: make the next division. Absent for everyone else. */
  onAdd?: () => void;
  /** Organisers: propose next season's divisions from these tables. */
  onPlanNext?: () => void;
  /** Organisers: per-division settings. */
  manage?: DivisionManage;
}) {
  const [managing, setManaging] = useState<string | null>(null);
  const ordered = useMemo(
    () => [...competitions].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [competitions],
  );
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  // Who goes up and down: the season planner's own rule (core/promotion.ts,
  // two each way, never more than half a division), so the table's arrows and
  // "Plan next season" always agree.
  const zonesFor = (i: number, size: number): TableZones | null => {
    if (ordered.length < 2) return null;
    const moving = Math.max(0, Math.min(2, Math.floor(size / 2)));
    if (!moving) return null;
    return {
      up: i > 0 ? moving : 0, down: i < ordered.length - 1 ? moving : 0,
      upTo: i > 0 ? ordered[i - 1].name : undefined, downTo: i < ordered.length - 1 ? ordered[i + 1].name : undefined,
    };
  };
  const entryName = (eid: string | null | undefined) => {
    const e = entries.find((x) => x.id === eid);
    if (!e) return "";
    const n = (id: string) => { const p = byId.get(id); return p ? fullNameOf(p) : "?"; };
    return e.p2 ? `${(byId.get(e.p1)?.name || "?").trim()} & ${(byId.get(e.p2)?.name || "?").trim()}` : n(e.p1);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {ordered.map((c, i) => {
        const mine = entries.filter((e) => e.competitionId === c.id);
        const dates = datesOf ? datesOf(c) : { startsOn: null, endsOn: null };
        const span = dateSpan(dates);
        return (
          <div key={c.id}>
            <GroupLabel right={manage && <button onClick={() => setManaging(managing === c.id ? null : c.id)} style={{ background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 0, flexShrink: 0 }}>{managing === c.id ? "Done" : "Settings"}</button>}>
              {c.name}
            </GroupLabel>
            <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, padding: "0 4px", ...tabular }}>
              {mine.length} {kind === "doubles" ? "pairs" : "players"} · play each {c.legs === 1 ? "once" : c.legs === 2 ? "twice" : c.legs + " times"} · {c.pointsWin} for a win{span ? " · " + span : ""}
            </div>
            <LeagueTable
              kind={kind} entries={mine} results={resultsOf(c)} pointsWin={c.pointsWin} pointsDraw={c.pointsDraw}
              left={remainingOf(c)} meId={meId} entryName={entryName}
              onOpenEntry={(e) => onOpenPlayer(e.p1)}
              zones={zonesFor(i, mine.length)}
              vsOf={vsOf}
            />
            {manage && managing === c.id && (
              <GroupCard style={{ marginTop: 10, padding: "0 14px 14px" }}>
                <ManagePanel c={c} entries={mine} players={players} manage={manage} nameOf={(e) => entryName(e.id)} dates={dates} />
              </GroupCard>
            )}
          </div>
        );
      })}
      {oddsOf && <DivisionPredictions ordered={ordered} entries={entries} resultsOf={resultsOf} oddsOf={oddsOf} entryName={entryName} />}
      {onPlanNext && (
        <GroupCard>
          <GroupRow first chevron onClick={onPlanNext} title="Plan next season" sub="Promotions and relegations done for you" />
        </GroupCard>
      )}
      {onAdd && (
        <button onClick={onAdd} style={{ alignSelf: "flex-start", background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 999, padding: "10px 16px", fontFamily: body, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
          + Add a division
        </button>
      )}
    </div>
  );
}

/**
 * Who wins each division (core/divisionOdds.ts): the rest of each division
 * played out from today's points and the ratings, a few thousand times. The
 * season's prediction card, one block per division, top three in each.
 */
function DivisionPredictions({ ordered, entries, resultsOf, oddsOf, entryName }: {
  ordered: Competition[];
  entries: CompetitionPair[];
  resultsOf: (c: Competition) => CompetitionResult[];
  oddsOf: (c: Competition) => { open: Array<[string, string]>; rating: (entryId: string) => number; rd?: (entryId: string) => number };
  entryName: (id: string | null | undefined) => string;
}) {
  const [copied, setCopied] = useState(false);
  const blocks = useMemo(() => ordered.map((c) => {
    const mine = entries.filter((e) => e.competitionId === c.id);
    if (mine.length < 2) return null;
    const table = leagueTable(mine, resultsOf(c), c.pointsWin, c.pointsDraw);
    const points = Object.fromEntries(table.map((r) => [r.pairId, r.points]));
    const { open, rating, rd } = oddsOf(c);
    const odds = divisionOdds({ entries: mine.map((e) => e.id), points, open, pointsWin: c.pointsWin, rating, rd, seed: 7 });
    const top = Object.entries(odds).sort((a, b) => b[1] - a[1]).filter(([, p]) => p >= 0.005).slice(0, 3);
    return { c, top, done: !open.length };
  }).filter(Boolean) as Array<{ c: Competition; top: Array<[string, number]>; done: boolean }>,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [ordered, entries, resultsOf, oddsOf]);
  if (!blocks.length) return null;
  const pct = (p: number) => (p >= 0.995 ? "100" : p < 0.01 ? "<1" : String(Math.round(p * 100)));
  // Plain text for the club group chat (Sam: "can you make that copy and paste").
  const copy = async () => {
    const text = ["Who wins each division", ...blocks.map(({ c, top }) => c.name + ": " + top.map(([id, p]) => `${entryName(id)} ${pct(p)}%`).join(", "))].join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  // Inset-grouped (Sam, 2026-10-24): one muted line instead of a paragraph,
  // a small label and a card per division, thin bars with the favourite in
  // the accent and everyone else muted.
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
        <div style={{ flex: 1, fontFamily: body, fontWeight: 700, fontSize: 20, color: FEED_TEXT_HI }}>Who wins each division</div>
        <button onClick={copy} style={{ background: FEED_CARD, color: FEED_TEXT_HI, border: "1px solid " + LINE, borderRadius: 999, padding: "6px 12px", fontFamily: body, fontWeight: 600, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, padding: "2px 4px 0", marginBottom: 14 }}>Simulated from points so far and ratings</div>
      {blocks.map(({ c, top, done }) => (
        <div key={c.id} style={{ marginBottom: 14 }}>
          <GroupLabel>{c.name}{done ? " · all played" : ""}</GroupLabel>
          <GroupCard>
            {top.map(([id, p], i) => (
              <div key={id} style={{ padding: "11px 16px 12px", borderTop: i ? "1px solid " + LINE : "none" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 7 }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entryName(id)}</span>
                  <span style={{ ...tabular, fontFamily: body, fontWeight: 700, fontSize: 15, color: i === 0 ? FEED_LIME : FEED_TEXT_MID }}>{pct(p)}%</span>
                </div>
                <div style={{ height: 3, background: FEED_RAISED, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: Math.max(2, p * 100) + "%", height: "100%", background: i === 0 ? FEED_LIME : FEED_TEXT_DIM, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </GroupCard>
        </div>
      ))}
    </div>
  );
}
