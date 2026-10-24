"use client";
import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft } from "lucide-react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { movePlayer, promotionPlan, type ProposedDivision } from "@/core/promotion";
import type { Season } from "@/core/seasons";
import { DOT_LOSS, DOT_WIN, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body } from "@/lib/theme";

/**
 * Next season's divisions, proposed from this season's tables
 * (core/promotion.ts) — Sam, 2026-10-22: the app proposes, the coach checks
 * and confirms.
 *
 * Top 2 up and bottom 2 down by default (1 is a tap away), shown with an
 * arrow on everybody who moved. Anybody can be moved a tier by hand. Nothing
 * is created until "Create", and only into a season other than the one these
 * divisions belong to — so the order of play is: end this season, start the
 * next in Run your club, then come here.
 */
export function PlanNextSeason({ divisions, labelOf, seasons, currentSeasonIds, onConfirm, onClose }: {
  /** This season's divisions, top tier first, each with its finishing order (entry ids). */
  divisions: Array<{ name: string; standings: string[] }>;
  /** An entry's name: the player, or "A & B" for a pair. */
  labelOf: (entryId: string) => string;
  /** Seasons that can take the new divisions: running, with an end date. */
  seasons: Season[];
  /** The season(s) the current divisions belong to — never the target. */
  currentSeasonIds: Array<string | null | undefined>;
  onConfirm: (plan: ProposedDivision[], seasonId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [moves, setMoves] = useState(2);
  const [edits, setEdits] = useState<Array<{ id: string; dir: -1 | 1 }>>([]);
  const targets = seasons.filter((s) => s.status === "active" && !!s.endsOn && !currentSeasonIds.includes(s.id));
  const [seasonId, setSeasonId] = useState(targets[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const plan = useMemo(
    () => edits.reduce((p, e) => movePlayer(p, e.id, e.dir), promotionPlan(divisions, moves)),
    [divisions, moves, edits],
  );

  const note: React.CSSProperties = { fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 };
  const seg = (on: boolean): React.CSSProperties => ({
    flex: 1, height: 36, borderRadius: 10, border: "none", cursor: "pointer",
    background: on ? FEED_LIME : FEED_RAISED, color: on ? FEED_LIME_INK : FEED_TEXT_MID, fontFamily: body, fontSize: 14, fontWeight: 600,
  });
  const arrowBtn: React.CSSProperties = { background: FEED_RAISED, border: "none", borderRadius: 8, width: 30, height: 30, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 };

  return (
    <div>
      <button onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 14, cursor: "pointer", padding: "0 0 10px" }}>
        <ChevronLeft size={16} /> Divisions
      </button>
      <div style={{ fontFamily: body, fontWeight: 600, fontSize: 22, color: FEED_TEXT_HI }}>Next season&apos;s divisions</div>
      <div style={{ ...note, marginTop: 4, marginBottom: 12 }}>
        From this season&apos;s tables. Check it, move anyone by hand, then create. Nothing changes until you do.
      </div>

      <div style={{ ...note, color: FEED_TEXT_LOW, marginBottom: 6 }}>Up and down each season</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button onClick={() => { setMoves(1); setEdits([]); }} style={seg(moves === 1)}>1 up, 1 down</button>
        <button onClick={() => { setMoves(2); setEdits([]); }} style={seg(moves === 2)}>2 up, 2 down</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {plan.map((d, di) => (
          <SurfaceCard key={d.name} radius={16} pad="12px 14px">
            <div style={{ fontFamily: body, fontWeight: 600, fontSize: 17, color: FEED_TEXT_HI, marginBottom: 4 }}>{d.name}</div>
            {d.players.map((id, i) => {
              const up = d.up.includes(id), down = d.down.includes(id);
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{labelOf(id)}</span>
                  {up && <span style={{ fontFamily: body, fontSize: 12, color: DOT_WIN, flexShrink: 0 }}>Promoted</span>}
                  {down && <span style={{ fontFamily: body, fontSize: 12, color: DOT_LOSS, flexShrink: 0 }}>Relegated</span>}
                  {di > 0 && <button aria-label={`Move ${labelOf(id)} up a division`} onClick={() => setEdits([...edits, { id, dir: -1 }])} style={arrowBtn}><ArrowUp size={15} color={FEED_TEXT_HI} /></button>}
                  {di < plan.length - 1 && <button aria-label={`Move ${labelOf(id)} down a division`} onClick={() => setEdits([...edits, { id, dir: 1 }])} style={arrowBtn}><ArrowDown size={15} color={FEED_TEXT_HI} /></button>}
                </div>
              );
            })}
            {!d.players.length && <div style={note}>Nobody in this division.</div>}
          </SurfaceCard>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        {targets.length ? (
          <>
            <div style={{ ...note, color: FEED_TEXT_LOW, marginBottom: 6 }}>Create them in</div>
            <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} style={{ width: "100%", background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 10, padding: "10px 12px", fontFamily: body, fontSize: 15, marginBottom: 12 }}>
              {targets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {err && <div style={{ ...note, color: DOT_LOSS, marginBottom: 8 }}>{err}</div>}
            <button
              disabled={busy || !seasonId}
              onClick={async () => {
                setBusy(true); setErr(null);
                try { await onConfirm(plan, seasonId); } catch (e: any) { setErr(e?.message || "That didn't save. Try again."); }
                setBusy(false);
              }}
              style={{ width: "100%", background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 999, padding: "13px 16px", fontFamily: body, fontWeight: 600, fontSize: 15.5, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "Creating…" : `Create ${plan.length} divisions and draw the matches`}
            </button>
            <div style={{ ...note, marginTop: 8 }}>This season&apos;s divisions are marked finished, so their tables and winners stay as they ended.</div>
          </>
        ) : (
          <div style={note}>
            To create these, first end this season and start the next one in <b>Run your club → Season</b>, then come back here.
          </div>
        )}
      </div>
    </div>
  );
}
