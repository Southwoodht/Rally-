"use client";
import React, { useMemo, useState } from "react";
import { AlertCircle, Check, ChevronLeft, X } from "lucide-react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import {
  isAlreadyIn, parseResults, resolveName, splitName,
  type NameStatus, type ParsedRow, type Side,
} from "@/core/importResults";
import { formatSets } from "@/core/sets";
import { formatMatchDate, fullNameOf, uid } from "@/lib/format";
import {
  DOT_LOSS, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID,
  body, miniInput, tabular,
} from "@/lib/theme";

/**
 * Import old results — paste, sort out names, check, add.
 *
 * Sam, 27 Sep 2026: "I'm aiming to get club admins on this". A club moving
 * onto Rally has years of results in a spreadsheet or a notes app; this takes
 * a paste of them. The reading is core/importResults.ts, tested. This screen
 * is the part a person does, and it is built on one rule: NOTHING SAVES UNTIL
 * SOMEBODY HAS SEEN IT. Every name the importer was unsure of is a question,
 * every row it could not read is listed with the reason, and the last step
 * says the number out loud before anything is written (§3).
 *
 * The results land confirmed, like the old Bulk / history entry: it is league
 * staff recording history, not a player claiming a win, and there is nobody
 * to ask about a match from 2019. That is why it lives in Run your league.
 */

type Step = "paste" | "names" | "check" | "done";
type Pick = { kind: "player"; id: string } | { kind: "new" } | { kind: "unset" };

const EXAMPLE = `12/03/2019  Sam Henry beat Charlie Henry  6-4 6-2
14/03/2019  Zaach Rodriguez v Adrian Bowles  3-6 6-3 6-4
Hugh Jones lost to Mike Tait 2-6 4-6`;

const lbl: React.CSSProperties = { fontFamily: body, fontSize: 11, color: FEED_TEXT_MID, textTransform: "uppercase", letterSpacing: 0.8 };
const note: React.CSSProperties = { fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.5 };
const btn = (fill: string, ink: string, disabled = false): React.CSSProperties => ({
  fontFamily: body, fontWeight: 500, fontSize: 14.5, padding: "12px 14px", borderRadius: 12, border: "none",
  cursor: disabled ? "default" : "pointer", background: fill, color: ink, opacity: disabled ? 0.5 : 1, width: "100%",
});
const chip = (on: boolean): React.CSSProperties => ({
  fontFamily: body, fontSize: 13, padding: "7px 12px", borderRadius: 999, border: "none", cursor: "pointer",
  background: on ? FEED_LIME : FEED_RAISED, color: on ? FEED_LIME_INK : FEED_TEXT_HI, whiteSpace: "nowrap",
});

const keyOf = (written: string) => written.trim().toLowerCase().replace(/\s+/g, " ");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function ImportResults({ players, matches, meId, leagueName, onImport, onBack }: {
  players: any[];
  matches: any[];
  meId?: string | null;
  leagueName?: string;
  /** Saves players first, then matches (saveData's order). True when it all landed. */
  onImport: (newPlayers: any[], newMatches: any[]) => Promise<boolean>;
  onBack: () => void;
}) {
  const [step, setStep] = useState<Step>("paste");
  const [text, setText] = useState("");
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [statuses, setStatuses] = useState<Record<string, NameStatus>>({});
  // Per-row overrides: a winner chosen by hand, or a row left out.
  const [winners, setWinners] = useState<Record<number, Side>>({});
  const [excluded, setExcluded] = useState<Record<number, boolean>>({});
  const [undatedDate, setUndatedDate] = useState(todayStr());
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<{ results: number; players: number } | null>(null);
  const [showAll, setShowAll] = useState(false);
  // What "already in Rally" is checked against: the league as it stood when
  // the check step opened. Checked against the live list, the rows being
  // saved struck themselves out as duplicates mid-save.
  const [baseline, setBaseline] = useState<any[]>(matches);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const knownNames = useMemo(() => players.flatMap((p) => [fullNameOf(p), p.name, p.nick].filter(Boolean)), [players]);
  const parsed = useMemo(() => (text.trim() ? parseResults(text, knownNames) : { rows: [], unreadable: [] }), [text, knownNames]);

  // Distinct names, in the order they first appear, with how many results each.
  const names = useMemo(() => {
    const seen = new Map<string, { written: string; count: number }>();
    parsed.rows.forEach((r) => [r.left, r.right].forEach((n) => {
      const k = keyOf(n);
      const e = seen.get(k);
      if (e) e.count++; else seen.set(k, { written: n, count: 1 });
    }));
    return Array.from(seen.entries()).map(([key, v]) => ({ key, ...v }));
  }, [parsed]);

  const goNames = () => {
    const st: Record<string, NameStatus> = {};
    const pk: Record<string, Pick> = {};
    names.forEach((n) => {
      const s = resolveName(n.written, players);
      st[n.key] = s;
      // Keep a choice already made if they came back to edit the paste.
      pk[n.key] = picks[n.key] && picks[n.key].kind !== "unset" ? picks[n.key]
        : s.kind === "matched" ? { kind: "player", id: s.playerId } : s.kind === "new" ? { kind: "new" } : { kind: "unset" };
    });
    setStatuses(st); setPicks(pk); setStep("names");
  };

  // New players get their ids now, so the check step can show real rows.
  const newIds = useMemo(() => {
    const out: Record<string, string> = {};
    names.forEach((n) => { if (picks[n.key]?.kind === "new") out[n.key] = "new:" + n.key; });
    return out;
  }, [names, picks]);
  const idFor = (written: string): string | null => {
    const p = picks[keyOf(written)];
    if (!p || p.kind === "unset") return null;
    return p.kind === "player" ? p.id : newIds[keyOf(written)];
  };
  const nameFor = (written: string) => {
    const p = picks[keyOf(written)];
    return p?.kind === "player" ? fullNameOf(byId.get(p.id)) : written;
  };

  // --- the check step: every row, with what is wrong with it --------------
  const undatedT = useMemo(() => { const [y, m, d] = undatedDate.split("-").map(Number); return new Date(y, m - 1, d, 12).getTime(); }, [undatedDate]);
  const checked = useMemo(() => parsed.rows.map((r: ParsedRow) => {
    const p1 = idFor(r.left), p2 = idFor(r.right);
    const winner = winners[r.line] ?? r.winner;
    const date = r.date ?? undatedT;
    let problem: string | null = null;
    let duplicate = false;
    if (!p1 || !p2) problem = "A name still needs choosing";
    else if (p1 === p2) problem = "Both names are the same player";
    else if (date > Date.now() + 86400000) problem = "Dated in the future";
    else if (!winner) problem = "Who won?";
    else duplicate = isAlreadyIn(p1, p2, date, winner === "left" ? "p1" : winner === "right" ? "p2" : "draw", baseline);
    const out = excluded[r.line] ?? duplicate;
    return { r, p1, p2, winner, date, problem, duplicate, out };
  }), [parsed, picks, winners, excluded, undatedT, baseline, newIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = checked.filter((c) => !c.problem && !c.out);
  const needWinner = checked.filter((c) => c.problem === "Who won?" && !c.out);
  const dupes = checked.filter((c) => c.duplicate && c.out);
  const undated = parsed.rows.filter((r) => r.date == null).length;
  const newPlayerKeys = Array.from(new Set(ready.flatMap((c) => [c.r.left, c.r.right].map(keyOf)).filter((k) => picks[k]?.kind === "new")));

  const save = async () => {
    setSaving(true);
    const realIds: Record<string, string> = {};
    const newPlayers = newPlayerKeys.map((k) => {
      const written = names.find((n) => n.key === k)!.written;
      const id = uid();
      realIds["new:" + k] = id;
      const { name, last } = splitName(written);
      return { id, name, last: last || undefined, avatar: null, auth_id: null };
    });
    const real = (id: string) => realIds[id] || id;
    const now = Date.now();
    const newMatches = ready.map((c) => ({
      id: uid(),
      date: c.date,
      p1: real(c.p1!),
      p2: real(c.p2!),
      winner: c.winner === "left" ? "p1" : c.winner === "right" ? "p2" : "draw",
      score: c.r.sets ? formatSets(c.r.sets) : "",
      status: "confirmed",
      reportedBy: meId || null,
      loggedAt: now,
    }));
    const ok = await onImport(newPlayers, newMatches);
    setSaving(false);
    setConfirming(false);
    if (ok) { setAdded({ results: newMatches.length, players: newPlayers.length }); setStep("done"); }
  };

  const back = (label: string, to: () => void) => (
    <button onClick={to} style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 14, cursor: "pointer", padding: "0 0 12px" }}>
      <ChevronLeft size={16} strokeWidth={2.2} />{label}
    </button>
  );
  const stepLabel = (n: number, title: string) => (
    <div style={{ marginBottom: 10 }}>
      <div style={lbl}>Step {n} of 3</div>
      <div style={{ fontFamily: body, fontWeight: 500, fontSize: 19, color: FEED_TEXT_HI, marginTop: 2 }}>{title}</div>
    </div>
  );

  // ---------------------------------------------------------------- paste
  if (step === "paste") {
    const found = parsed.rows.length;
    return (
      <>
        {back("Run your league", onBack)}
        {stepLabel(1, "Paste your old results")}
        <div style={{ ...note, marginBottom: 12 }}>
          From a spreadsheet, a notes app or a group chat — one result per line. Rally reads dates, scores and who beat whom, and you check everything before it&apos;s added.
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLE}
          rows={10}
          style={{ ...miniInput, fontFamily: body, fontSize: 14, lineHeight: 1.5, width: "100%", boxSizing: "border-box", background: FEED_RAISED, color: FEED_TEXT_HI, padding: 12, resize: "vertical", minHeight: 180 }}
        />
        <div style={{ ...note, margin: "8px 2px 14px", ...tabular }}>
          {text.trim()
            ? `${found} result${found === 1 ? "" : "s"} found${parsed.unreadable.length ? ` · ${parsed.unreadable.length} line${parsed.unreadable.length === 1 ? "" : "s"} couldn't be read` : ""}`
            : "Works with: “Sam beat Charlie 6-4 6-2”, “Sam v Charlie”, “Charlie lost to Sam”, and spreadsheet columns such as Date · Winner · Loser · Score. A date on its own line counts for the results under it."}
        </div>
        <button disabled={!found} onClick={goNames} style={btn(FEED_LIME, FEED_LIME_INK, !found)}>Next: check the names</button>
      </>
    );
  }

  // ---------------------------------------------------------------- names
  if (step === "names") {
    const unsure = names.filter((n) => picks[n.key]?.kind === "unset").length;
    return (
      <>
        {back("Edit the paste", () => setStep("paste"))}
        {stepLabel(2, "Who's who")}
        <div style={{ ...note, marginBottom: 12 }}>
          {names.length} names. Rally only links a name to a player when nobody else could be meant — anything else is your call, so nobody&apos;s results land on the wrong person.
        </div>
        <SurfaceCard radius={18} pad="4px 14px" style={{ marginBottom: 14 }}>
          {names.map((n, i) => {
            const p = picks[n.key] || { kind: "unset" };
            const st = statuses[n.key];
            const set = (v: Pick) => setPicks((cur) => ({ ...cur, [n.key]: v }));
            const cands = st?.kind === "choose" ? st.candidates : [];
            return (
              <div key={n.key} style={{ padding: "12px 0", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontWeight: 500, fontSize: 15.5, color: FEED_TEXT_HI }}>“{n.written}”</span>
                  <span style={{ ...note, ...tabular }}>{n.count} result{n.count === 1 ? "" : "s"}</span>
                </div>
                {p.kind === "player" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <Check size={15} color={FEED_LIME} strokeWidth={2.5} />
                    <span style={{ flex: 1, fontFamily: body, fontSize: 14, color: FEED_TEXT_HI }}>{fullNameOf(byId.get(p.id))}</span>
                    <button onClick={() => set({ kind: "unset" })} style={{ ...chip(false), padding: "5px 10px", fontSize: 12.5 }}>Change</button>
                  </div>
                )}
                {p.kind === "new" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <span style={{ flex: 1, fontFamily: body, fontSize: 14, color: FEED_TEXT_MID }}>New player — added to {leagueName || "the league"}</span>
                    <button onClick={() => set({ kind: "unset" })} style={{ ...chip(false), padding: "5px 10px", fontSize: 12.5 }}>Change</button>
                  </div>
                )}
                {p.kind === "unset" && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ ...note, marginBottom: 8, color: FEED_LIME }}>{cands.length ? "Which one is this?" : "Who is this?"}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {cands.map((id) => (
                        <button key={id} onClick={() => set({ kind: "player", id })} style={chip(false)}>{fullNameOf(byId.get(id))}</button>
                      ))}
                      <button onClick={() => set({ kind: "new" })} style={chip(false)}>New player</button>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <PlayerPicker players={players} value="" onChange={(id: string) => set({ kind: "player", id })} triggerLabel="Someone else in the league…" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </SurfaceCard>
        <button disabled={!!unsure} onClick={() => { setBaseline(matches); setStep("check"); }} style={btn(FEED_LIME, FEED_LIME_INK, !!unsure)}>
          {unsure ? `${unsure} name${unsure === 1 ? "" : "s"} still to choose` : "Next: check the results"}
        </button>
      </>
    );
  }

  // ---------------------------------------------------------------- done
  if (step === "done" && added) {
    return (
      <>
        <SurfaceCard radius={18} pad="22px 18px" style={{ marginBottom: 14, textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: FEED_LIME, display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
            <Check size={24} color={FEED_LIME_INK} strokeWidth={3} />
          </div>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 19, color: FEED_TEXT_HI, ...tabular }}>
            {added.results} result{added.results === 1 ? "" : "s"} added
          </div>
          <div style={{ ...note, marginTop: 4 }}>
            {added.players ? `${added.players} new player${added.players === 1 ? "" : "s"} too. ` : ""}The table, profiles and head-to-heads already include them.
          </div>
        </SurfaceCard>
        <button onClick={() => { setText(""); setPicks({}); setWinners({}); setExcluded({}); setAdded(null); setStep("paste"); }} style={{ ...btn(FEED_RAISED, FEED_TEXT_HI), marginBottom: 10 }}>Import more</button>
        <button onClick={onBack} style={btn(FEED_LIME, FEED_LIME_INK)}>Done</button>
      </>
    );
  }

  // ---------------------------------------------------------------- check
  const visible = showAll ? checked : checked.slice(0, 60);
  return (
    <>
      {back("Names", () => setStep("names"))}
      {stepLabel(3, "Check the results")}

      <SurfaceCard radius={18} pad="14px" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, ...tabular }}>
          <Stat n={ready.length} label="ready to add" hi />
          {needWinner.length > 0 && <Stat n={needWinner.length} label="need a winner" />}
          {dupes.length > 0 && <Stat n={dupes.length} label="already in Rally" />}
          {parsed.unreadable.length > 0 && <Stat n={parsed.unreadable.length} label="couldn't read" />}
        </div>
        {undated > 0 && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid " + FEED_HAIRLINE }}>
            <div style={{ ...note, marginBottom: 6 }}>{undated} result{undated === 1 ? " has" : "s have"} no date. They&apos;ll be dated:</div>
            <input type="date" value={undatedDate} max={todayStr()} onChange={(e) => e.target.value && setUndatedDate(e.target.value)} style={{ ...miniInput, fontFamily: body, fontSize: 15, background: FEED_RAISED, color: FEED_TEXT_HI, padding: "9px 12px" }} />
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard radius={18} pad="4px 14px" style={{ marginBottom: 12 }}>
        {visible.map((c, i) => {
          const L = nameFor(c.r.left), R = nameFor(c.r.right);
          const sc = c.r.sets ? c.r.sets.map((s) => (c.winner === "right" ? `${s.b}–${s.a}` : `${s.a}–${s.b}`)).join(" ") : "";
          const text = c.winner === "left" ? `${L} beat ${R}` : c.winner === "right" ? `${R} beat ${L}` : c.winner === "draw" ? `${L} drew with ${R}` : `${L} v ${R}`;
          return (
            <div key={c.r.line} style={{ padding: "10px 0", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : "none", opacity: c.out ? 0.5 : 1 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: body, fontSize: 14.5, color: FEED_TEXT_HI, textDecoration: c.out ? "line-through" : "none" }}>
                    {text}{sc && <span style={{ color: FEED_TEXT_MID, ...tabular }}> · {sc}</span>}
                  </div>
                  <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2, ...tabular }}>
                    {formatMatchDate(c.date)}{c.r.date == null ? " (no date given)" : ""} · line {c.r.line}
                    {c.duplicate && " · already in Rally"}
                  </div>
                </div>
                <button
                  onClick={() => setExcluded((cur) => ({ ...cur, [c.r.line]: !c.out }))}
                  aria-label={c.out ? "Include this result" : "Leave this result out"}
                  style={{ background: FEED_RAISED, border: "none", borderRadius: 14, width: 28, height: 28, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
                >
                  {c.out ? <Check size={14} color={FEED_TEXT_MID} strokeWidth={2.5} /> : <X size={14} color={FEED_TEXT_MID} strokeWidth={2.5} />}
                </button>
              </div>
              {c.problem === "Who won?" && !c.out && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  <span style={{ ...note, color: FEED_LIME, alignSelf: "center", marginRight: 2 }}>Who won?</span>
                  <button onClick={() => setWinners((w) => ({ ...w, [c.r.line]: "left" }))} style={chip(false)}>{L}</button>
                  <button onClick={() => setWinners((w) => ({ ...w, [c.r.line]: "right" }))} style={chip(false)}>{R}</button>
                  <button onClick={() => setWinners((w) => ({ ...w, [c.r.line]: "draw" }))} style={chip(false)}>Draw</button>
                </div>
              )}
              {c.problem && c.problem !== "Who won?" && !c.out && (
                <div style={{ ...note, color: DOT_LOSS, marginTop: 6 }}>{c.problem} — it will be left out.</div>
              )}
            </div>
          );
        })}
        {checked.length > visible.length && (
          <button onClick={() => setShowAll(true)} style={{ background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 13.5, padding: "12px 0", cursor: "pointer" }}>
            Show all {checked.length}
          </button>
        )}
      </SurfaceCard>

      {parsed.unreadable.length > 0 && (
        <SurfaceCard radius={18} pad="14px" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <AlertCircle size={15} color={FEED_TEXT_MID} strokeWidth={2} />
            <span style={lbl}>Not added — couldn&apos;t read</span>
          </div>
          {parsed.unreadable.map((u) => (
            <div key={u.line} style={{ padding: "6px 0" }}>
              <div style={{ fontFamily: body, fontSize: 13.5, color: FEED_TEXT_HI, wordBreak: "break-word" }}>{u.raw}</div>
              <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_LOW, marginTop: 1 }}>Line {u.line} · {u.reason}</div>
            </div>
          ))}
          <div style={{ ...note, marginTop: 6 }}>Fix them in the paste and they&apos;ll be picked up.</div>
        </SurfaceCard>
      )}

      {confirming ? (
        <SurfaceCard radius={18} pad="16px 14px">
          <div style={{ fontFamily: body, fontSize: 14.5, color: FEED_TEXT_HI, lineHeight: 1.5, marginBottom: 12, ...tabular }}>
            Add {ready.length} result{ready.length === 1 ? "" : "s"}{newPlayerKeys.length ? ` and ${newPlayerKeys.length} new player${newPlayerKeys.length === 1 ? "" : "s"}` : ""} to {leagueName || "this league"}? They count straight away — nobody is asked to confirm results from before the league used Rally.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={saving} onClick={save} style={{ ...btn(FEED_LIME, FEED_LIME_INK, saving), flex: 1 }}>{saving ? "Adding…" : `Add ${ready.length}`}</button>
            <button disabled={saving} onClick={() => setConfirming(false)} style={{ ...btn(FEED_RAISED, FEED_TEXT_HI), flex: 1 }}>Cancel</button>
          </div>
        </SurfaceCard>
      ) : (
        <button disabled={!ready.length} onClick={() => setConfirming(true)} style={btn(FEED_LIME, FEED_LIME_INK, !ready.length)}>
          {ready.length ? `Add ${ready.length} result${ready.length === 1 ? "" : "s"}…` : "Nothing ready to add yet"}
        </button>
      )}
    </>
  );
}

function Stat({ n, label, hi = false }: { n: number; label: string; hi?: boolean }) {
  return (
    <div>
      <div style={{ fontFamily: body, fontWeight: 500, fontSize: 24, color: hi ? FEED_LIME : FEED_TEXT_HI, letterSpacing: "-0.02em" }}>{n}</div>
      <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID }}>{label}</div>
    </div>
  );
}
