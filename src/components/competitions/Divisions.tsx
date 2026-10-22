"use client";
import React, { useMemo, useState } from "react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { LeagueTable } from "@/components/competitions/Competitions";
import type { Competition, CompetitionKind, CompetitionPair, CompetitionResult } from "@/core/doubles/competition";
import { fullNameOf } from "@/lib/format";
import { DOT_LOSS, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body } from "@/lib/theme";

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
}

function ManagePanel({ c, entries, players, manage, nameOf }: { c: Competition; entries: CompetitionPair[]; players: any[]; manage: DivisionManage; nameOf: (e: CompetitionPair) => string }) {
  const [adding, setAdding] = useState("");
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
  const pill = (fill: string, ink: string): React.CSSProperties => ({ background: fill, color: ink, border: "none", borderRadius: 999, padding: "8px 14px", fontFamily: body, fontWeight: 500, fontSize: 13.5, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, flexShrink: 0 });
  const note: React.CSSProperties = { fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.5 };
  return (
    <div style={{ borderTop: "0.5px solid " + FEED_HAIRLINE, marginTop: 12, paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
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
          <div style={{ ...note, marginTop: 4 }}>Uses matches inside the season&apos;s dates, earliest first, for any match still to play.</div>
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
export function Divisions({ kind, competitions, entries, players, meId, resultsOf, remainingOf, onOpenPlayer, onAdd, onPlanNext, manage }: {
  kind: CompetitionKind;
  /** Running league-format competitions of this kind. */
  competitions: Competition[];
  entries: CompetitionPair[];
  players: any[];
  meId: string;
  resultsOf: (c: Competition) => CompetitionResult[];
  remainingOf: (c: Competition) => Record<string, number>;
  onOpenPlayer: (id: string) => void;
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
  const entryName = (eid: string | null | undefined) => {
    const e = entries.find((x) => x.id === eid);
    if (!e) return "";
    const n = (id: string) => { const p = byId.get(id); return p ? fullNameOf(p) : "?"; };
    return e.p2 ? `${(byId.get(e.p1)?.name || "?").trim()} & ${(byId.get(e.p2)?.name || "?").trim()}` : n(e.p1);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {ordered.map((c, i) => {
        const mine = entries.filter((e) => e.competitionId === c.id);
        const tier = tierLabel(i, ordered.length);
        return (
          <SurfaceCard key={c.id} radius={16} pad="16px 14px">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: body, fontWeight: 500, fontSize: 19, color: FEED_TEXT_HI, flex: 1, minWidth: 0 }}>{c.name}</span>
              {manage && <button onClick={() => setManaging(managing === c.id ? null : c.id)} style={{ background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 13, cursor: "pointer", padding: 0, flexShrink: 0 }}>{managing === c.id ? "Done" : "Settings"}</button>}
              {tier && <span style={{ fontFamily: body, fontWeight: 500, fontSize: 11.5, background: FEED_LIME, color: FEED_LIME_INK, borderRadius: 999, padding: "3px 9px", flexShrink: 0 }}>{tier}</span>}
            </div>
            <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 2 }}>
              {mine.length} {kind === "doubles" ? "pairs" : "players"} · play each {c.legs === 1 ? "once" : c.legs === 2 ? "twice" : c.legs + " times"} · {c.pointsWin} for a win
            </div>
            <LeagueTable
              kind={kind} entries={mine} results={resultsOf(c)} pointsWin={c.pointsWin} pointsDraw={c.pointsDraw}
              left={remainingOf(c)} meId={meId} entryName={entryName}
              onOpenEntry={(e) => onOpenPlayer(e.p1)}
            />
            {manage && managing === c.id && <ManagePanel c={c} entries={mine} players={players} manage={manage} nameOf={(e) => entryName(e.id)} />}
          </SurfaceCard>
        );
      })}
      {onPlanNext && (
        <SurfaceCard radius={16} pad="14px 16px">
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 16, color: FEED_TEXT_HI }}>End of the season?</div>
          <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, marginTop: 4 }}>
            Southwood proposes next season&apos;s divisions from these tables — promotions and relegations done — for you to check and confirm.
          </div>
          <button onClick={onPlanNext} style={{ marginTop: 10, background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 999, padding: "10px 16px", fontFamily: body, fontWeight: 500, fontSize: 14.5, cursor: "pointer" }}>
            Plan next season
          </button>
        </SurfaceCard>
      )}
      {onAdd && (
        <button onClick={onAdd} style={{ alignSelf: "flex-start", background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 999, padding: "10px 16px", fontFamily: body, fontWeight: 500, fontSize: 14.5, cursor: "pointer" }}>
          + Add a division
        </button>
      )}
      {ordered.length > 1 && (
        <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
          Division 1 is the top tier; the order follows the number in each name.
        </div>
      )}
    </div>
  );
}
