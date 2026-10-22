"use client";
import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { LADDER_DAYS, LADDER_REACH, busyPlayers, challengeProblem, ladderOrder, type LadderChallenge } from "@/core/ladder";
import type { Competition, CompetitionPair } from "@/core/doubles/competition";
import { fullNameOf } from "@/lib/format";
import {
  DOT_LOSS, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, tabular, tight,
} from "@/lib/theme";

/**
 * The singles ladder, on the Fixtures tab (core/ladder.ts has the rules).
 *
 * Closed, it is one card: your place and how many are on it. Open, it is the
 * rungs top to bottom with a Challenge button on the people you may
 * challenge, your open challenge above them (played and resolved exactly
 * like any other fixture, through the parent's FixturesPanel), and joining
 * or leaving at the foot. Organisers also start the ladder, add anybody,
 * take anybody off and settle a challenge nobody played.
 */
export function Ladder(props: {
  ladder: Competition | null;
  entries: CompetitionPair[];
  challenges: LadderChallenge[];
  players: any[];
  meId: string;
  canManage: boolean;
  /** Who it would start with, top first — the club's rating order. */
  startingOrder: string[];
  onStart: () => Promise<void>;
  onChallenge: (defender: string) => Promise<void>;
  onJoin: (playerId: string) => Promise<void>;
  onLeave: (entryId: string) => Promise<void>;
  /** Organiser: a challenge nobody played — walkover to one side, or call it off. */
  onSettle: (challengeId: string, outcome: "walkover_p1" | "walkover_p2" | "void") => Promise<void>;
  /** The open challenges' fixture cards, drawn by the parent's FixturesPanel. */
  renderOpen: () => React.ReactNode;
}) {
  const { ladder, entries, challenges, players, meId, canManage } = props;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [adding, setAdding] = useState("");

  const order = useMemo(() => (ladder ? ladderOrder(entries.map((e) => ({ id: e.id, p1: e.p1, seed: e.seed })), challenges) : []), [ladder, entries, challenges]);
  const inChallenge = useMemo(() => busyPlayers(challenges), [challenges]);
  const who = (id: string) => players.find((p) => p.id === id);
  const name = (id: string) => { const p = who(id); return p ? fullNameOf(p) : "Someone"; };
  const myPlace = order.indexOf(meId);
  const openCount = challenges.filter((c) => c.open).length;

  const act = async (f: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await f(); } catch (e: any) { setErr(e?.message || "That didn't save. Try again."); }
    setBusy(false); setConfirm(null);
  };

  const note: React.CSSProperties = { fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 };
  const pill = (fill: string, ink: string): React.CSSProperties => ({
    background: fill, color: ink, border: "none", borderRadius: 999, padding: "8px 14px",
    fontFamily: body, fontWeight: 500, fontSize: 13.5, cursor: busy ? "default" : "pointer", flexShrink: 0, opacity: busy ? 0.6 : 1,
  });

  // ------------------------------------------------------------ no ladder yet
  if (!ladder) {
    if (!canManage) return null;
    return (
      <SurfaceCard radius={18} pad="16px" style={{ marginBottom: 14 }}>
        <div style={{ ...tight(18), fontFamily: body, fontWeight: 500, fontSize: 18, color: FEED_TEXT_HI }}>Singles ladder</div>
        <div style={{ ...note, marginTop: 6 }}>
          Challenge anyone up to {LADDER_REACH} places above you; win and you take their place. Singles only.
          It starts with the {props.startingOrder.length} people who have played singles in the last year, in rating
          order, and anyone can join at the bottom after.
        </div>
        {err && <div style={{ ...note, color: DOT_LOSS, marginTop: 8 }}>{err}</div>}
        <button disabled={busy || !props.startingOrder.length} onClick={() => act(props.onStart)} style={{ ...pill(FEED_LIME, FEED_LIME_INK), marginTop: 12 }}>
          Start the ladder
        </button>
      </SurfaceCard>
    );
  }

  // ------------------------------------------------------------ closed: one card
  if (!open) {
    return (
      <SurfaceCard radius={18} pad="0" style={{ marginBottom: 14 }}>
        <button onClick={() => setOpen(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", padding: "16px", cursor: "pointer", textAlign: "left" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: body, fontWeight: 500, fontSize: 17, color: FEED_TEXT_HI }}>{ladder.name}</div>
            <div style={{ ...note, marginTop: 2 }}>
              {myPlace >= 0 ? `You're ${myPlace + 1} of ${order.length}` : `${order.length} on it · join at the bottom`}
              {openCount ? ` · ${openCount} ${openCount === 1 ? "challenge" : "challenges"} on` : ""}
            </div>
          </div>
          <ChevronRight size={18} color={FEED_TEXT_MID} />
        </button>
      </SurfaceCard>
    );
  }

  // ------------------------------------------------------------ open
  const candidates = players.filter((p) => !p.inactive && !order.includes(p.id));
  return (
    <div style={{ marginBottom: 18 }}>
      <button onClick={() => setOpen(false)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 14, cursor: "pointer", padding: "4px 0 10px" }}>
        <ChevronLeft size={16} /> Fixtures
      </button>
      <div style={{ ...tight(22), fontFamily: body, fontWeight: 500, fontSize: 22, color: FEED_TEXT_HI }}>{ladder.name}</div>
      <div style={{ ...note, marginTop: 4, marginBottom: 12 }}>
        Challenge anyone up to {LADDER_REACH} places above you. Win and you take their place; everyone in between
        moves down one. One challenge at a time, played within {LADDER_DAYS} days.
      </div>
      {err && <div style={{ ...note, color: DOT_LOSS, marginBottom: 10 }}>{err}</div>}

      {openCount > 0 && <div style={{ marginBottom: 14 }}>{props.renderOpen()}</div>}

      {canManage && challenges.filter((c) => c.open).map((c) => (
        <div key={c.id} style={{ ...note, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ flex: "1 1 100%" }}>Not played? {name(c.challenger)} v {name(c.defender)}:</span>
          <button disabled={busy} onClick={() => act(() => props.onSettle(c.id, "walkover_p1"))} style={pill(FEED_RAISED, FEED_TEXT_HI)}>Walkover to {who(c.challenger)?.name || "challenger"}</button>
          <button disabled={busy} onClick={() => act(() => props.onSettle(c.id, "walkover_p2"))} style={pill(FEED_RAISED, FEED_TEXT_HI)}>Walkover to {who(c.defender)?.name || "defender"}</button>
          <button disabled={busy} onClick={() => act(() => props.onSettle(c.id, "void"))} style={pill(FEED_RAISED, FEED_TEXT_MID)}>Call it off</button>
        </div>
      ))}

      <SurfaceCard radius={18} pad="4px 14px">
        {order.map((id, i) => {
          const me = id === meId;
          const canChallenge = !challengeProblem(order, challenges, meId, id);
          const entry = entries.find((e) => e.p1 === id);
          const p = who(id);
          return (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
              <span style={{ ...tabular, width: 24, textAlign: "right", fontFamily: body, fontSize: 15, color: me ? FEED_LIME : FEED_TEXT_MID, flexShrink: 0 }}>{i + 1}</span>
              {p && <Avatar player={p} size={32} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: body, fontSize: 15.5, color: me ? FEED_LIME : FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name(id)}</div>
                {inChallenge.has(id) && <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_LOW }}>In a challenge</div>}
              </div>
              {canChallenge && (
                <button disabled={busy} onClick={() => act(() => props.onChallenge(id))} style={pill(FEED_LIME, FEED_LIME_INK)}>Challenge</button>
              )}
              {canManage && !me && entry && (confirm === entry.id ? (
                <button disabled={busy} onClick={() => act(() => props.onLeave(entry.id))} style={pill(FEED_RAISED, DOT_LOSS)}>Remove {p?.name || ""}?</button>
              ) : (
                <button onClick={() => setConfirm(entry.id)} aria-label={`Take ${name(id)} off the ladder`} style={{ background: "none", border: "none", color: FEED_TEXT_LOW, fontFamily: body, fontSize: 18, cursor: "pointer", padding: "0 4px" }}>×</button>
              ))}
            </div>
          );
        })}
      </SurfaceCard>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {myPlace < 0 && meId && who(meId) && (
          <button disabled={busy} onClick={() => act(() => props.onJoin(meId))} style={pill(FEED_LIME, FEED_LIME_INK)}>Join at the bottom</button>
        )}
        {myPlace >= 0 && (() => {
          const mine = entries.find((e) => e.p1 === meId);
          if (!mine) return null;
          return confirm === "leave"
            ? <button disabled={busy} onClick={() => act(() => props.onLeave(mine.id))} style={pill(FEED_RAISED, DOT_LOSS)}>Leave the ladder? Your place goes.</button>
            : <button onClick={() => setConfirm("leave")} style={pill(FEED_RAISED, FEED_TEXT_MID)}>Leave the ladder</button>;
        })()}
      </div>

      {canManage && candidates.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
          <select value={adding} onChange={(e) => setAdding(e.target.value)} style={{ flex: 1, minWidth: 0, background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 10, padding: "10px 12px", fontFamily: body, fontSize: 14.5 }}>
            <option value="">Add a player at the bottom…</option>
            {candidates.map((p) => <option key={p.id} value={p.id}>{fullNameOf(p)}</option>)}
          </select>
          <button disabled={busy || !adding} onClick={() => act(async () => { await props.onJoin(adding); setAdding(""); })} style={pill(FEED_LIME, FEED_LIME_INK)}>Add</button>
        </div>
      )}
    </div>
  );
}
