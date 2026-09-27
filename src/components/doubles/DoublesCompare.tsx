"use client";
import React, { useMemo, useState } from "react";
import { AlertCircle, ArrowLeftRight } from "lucide-react";
import { Empty } from "@/components/ui/atoms";
import { Avatar } from "@/components/ui/Avatar";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { compareTeams, type Pair, type WDL } from "@/core/doubles/compare";
import { showDelta, type DoublesMatch } from "@/core/doubles/elo";
import { formatMatchDate, fullNameOf } from "@/lib/format";
import {
  FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LOSS, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, body, tabular,
} from "@/lib/theme";

/**
 * Compare, for doubles — two pairs, who would win, and the numbers behind it.
 *
 * Sam, 27 Sep 2026: "When we select singles keep it exactly how it is but if
 * ur in doubles then compare u can compare 2 v 2 to see what teams would win
 * and stats". Singles Compare (HeadToHead) is untouched; this is its twin,
 * drawn in the same pieces — the predicted-win card, the two-column stat rows
 * with a bar under each — so the two read as one screen in two modes.
 *
 * The counting is core/doubles/compare.ts. The odds are the doubles rating
 * only, the same number a booked doubles fixture shows.
 */

const sectionLabel: React.CSSProperties = {
  fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID,
  textTransform: "uppercase", letterSpacing: 0.8,
};

const rec = (r: WDL) => `${r.w}–${r.d}–${r.l}`;
const rate = (r: WDL) => { const n = r.w + r.d + r.l; return n ? (r.w + r.d * 0.5) / n : null; };

export function DoublesCompare({ players, matches, meId, onOpen, onCreatePlayer }: {
  players: any[];
  matches: Array<DoublesMatch & { sets?: Array<{ a: number; b: number }> }>;
  meId?: string | null;
  onOpen?: (id: string) => void;
  onCreatePlayer?: (...args: any[]) => any;
}) {
  // Your side starts with you in it: the question is almost always "could we
  // beat them", and that is one pick fewer.
  const [ids, setIds] = useState<[string, string, string, string]>([meId || "", "", "", ""]);
  const set = (i: number) => (v: string) => setIds((cur) => { const n = [...cur] as typeof cur; n[i] = v; return n; });

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const first = (id: string) => ((byId.get(id)?.name || "").trim() || fullNameOf(byId.get(id)) || "?");
  const pairName = (p: Pair) => `${first(p[0])} & ${first(p[1])}`;
  // Nobody twice: each picker offers everybody not already on court.
  const eligible = (i: number) => players.filter((p) => !p.inactive && !ids.some((x, j) => j !== i && x === p.id));

  const complete = ids.every(Boolean);
  const a: Pair = [ids[0], ids[1]];
  const b: Pair = [ids[2], ids[3]];
  const c = useMemo(() => (complete ? compareTeams(matches, a, b) : null), [complete, matches, ids.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const picker = (i: number, placeholder: string) => (
    <PlayerPicker players={eligible(i)} value={ids[i]} onChange={set(i)} onCreatePlayer={onCreatePlayer} placeholder={placeholder} />
  );

  const StatRow = ({ label, av, bv, na, nb, last = false }: any) => {
    const both = Number.isFinite(na) && Number.isFinite(nb);
    const aWins = both && na > nb, bWins = both && nb > na;
    const total = both ? Math.max(0, na) + Math.max(0, nb) : 0;
    return (
      <div style={{ padding: "10px 0", borderBottom: last ? undefined : "0.5px solid " + FEED_HAIRLINE }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ ...tabular, flex: 1, minWidth: 0, fontFamily: body, fontSize: 16, fontWeight: 500, color: aWins ? FEED_LIME : FEED_TEXT_MID }}>{av}</span>
          <span style={{ flex: "none", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID }}>{label}</span>
          <span style={{ ...tabular, flex: 1, minWidth: 0, fontFamily: body, fontSize: 16, fontWeight: 500, color: bWins ? FEED_LIME : FEED_TEXT_MID, textAlign: "right" }}>{bv}</span>
        </div>
        {both && total > 0 && (
          <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", marginTop: 7, background: FEED_RAISED }}>
            <div style={{ width: (Math.max(0, na) / total) * 100 + "%", background: aWins ? FEED_LIME : FEED_RAISED }} />
            <div style={{ width: (Math.max(0, nb) / total) * 100 + "%", background: bWins ? FEED_LIME : FEED_RAISED }} />
          </div>
        )}
      </div>
    );
  };

  const teamHeader = (p: Pair, right: boolean) => (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: right ? "flex-end" : "flex-start", gap: 6 }}>
      <span style={{ display: "inline-flex" }}>
        {p.map((id, i) => (
          <span key={id} onClick={() => onOpen?.(id)} style={{ marginLeft: i ? -10 : 0, display: "inline-flex", cursor: onOpen ? "pointer" : "default" }}>
            <Avatar player={byId.get(id)} size={34} />
          </span>
        ))}
      </span>
      <span style={{ fontFamily: body, fontWeight: 500, fontSize: 13.5, color: FEED_TEXT_HI, textAlign: right ? "right" : "left", lineHeight: 1.3 }}>{pairName(p)}</span>
    </div>
  );

  return (
    <div>
      {/* Two rows of two, a team per row, with "v" between: the same shape
          as the entry screen, so picking a pairing reads as setting a court. */}
      <div style={{ ...sectionLabel, marginBottom: 6 }}>Team A</div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{picker(0, "Player")}</div>
        <div style={{ flex: 1, minWidth: 0 }}>{picker(1, "Partner")}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0" }}>
        <div style={{ flex: 1, height: 0.5, background: FEED_HAIRLINE }} />
        <span style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID }}>v</span>
        <div style={{ flex: 1, height: 0.5, background: FEED_HAIRLINE }} />
      </div>
      <div style={{ ...sectionLabel, marginBottom: 6 }}>Team B</div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{picker(2, "Player")}</div>
        <div style={{ flex: 1, minWidth: 0 }}>{picker(3, "Partner")}</div>
      </div>
      <div style={{ display: "flex", gap: 6, margin: "12px 0 16px" }}>
        <button
          onClick={() => setIds(([p, q, r, s]) => [r, s, p, q])}
          disabled={!ids.some(Boolean)}
          aria-label="Swap the two teams"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: FEED_CARD, border: "none", borderRadius: 999, padding: "7px 12px", cursor: "pointer", fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID }}
        >
          <ArrowLeftRight size={13} strokeWidth={2} />Swap teams
        </button>
      </div>

      {!c ? <Empty msg="Pick two pairs to compare." /> : (() => {
        const [ta, tb] = c.teams;
        const favA = c.chanceA >= 50;
        const fav = favA ? ta : tb;
        const gap = Math.abs(ta.rating - tb.rating);
        const thin = [...ta.players, ...tb.players].filter((p) => p.provisional);
        const mt = c.meetings.w + c.meetings.d + c.meetings.l;
        const why = c.chanceA === 50
          ? "Dead level on doubles rating — this one is a coin toss."
          : `Southwood favours ${pairName(fav.pair)} — a ${gap}-point edge on doubles rating, the average of the two partners.`;
        return (
          <>
            <SurfaceCard radius={18} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                {teamHeader(ta.pair, false)}
                {teamHeader(tb.pair, true)}
              </div>
              <div style={{ textAlign: "center", ...sectionLabel }}>Predicted win</div>
              <div style={{ ...tabular, display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontFamily: body, fontSize: 34, fontWeight: 500, letterSpacing: "-0.04em", color: favA ? FEED_LIME : FEED_TEXT_MID }}>{c.chanceA}%</span>
                <span style={{ fontFamily: body, fontSize: 34, fontWeight: 500, letterSpacing: "-0.04em", color: !favA || c.chanceA === 50 ? FEED_LIME : FEED_TEXT_MID }}>{100 - c.chanceA}%</span>
              </div>
              <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: FEED_RAISED, marginTop: 8 }}>
                <div style={{ width: c.chanceA + "%", background: FEED_LIME }} />
                <div style={{ width: 100 - c.chanceA + "%", background: FEED_LOSS }} />
              </div>
              <div style={{ borderTop: "0.5px solid " + FEED_HAIRLINE, marginTop: 14, paddingTop: 12, fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
                {why}
                {mt > 0 && ` They have met ${mt === 1 ? "once" : mt + " times"}: ${pairName(ta.pair)} ${c.meetings.w > c.meetings.l ? "lead" : c.meetings.w < c.meetings.l ? "trail" : "are level at"} ${rec(c.meetings)}.`}
                {mt === 0 && ` These two pairs have never played each other.`}
              </div>
            </SurfaceCard>

            {thin.length > 0 && (
              <SurfaceCard radius={16} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <AlertCircle size={16} color={FEED_LIME} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
                    {thin.map((p) => `${first(p.id)} has played ${p.played} doubles ${p.played === 1 ? "match" : "matches"}`).join(", ")}. Treat the prediction as a rough guide.
                  </div>
                </div>
              </SurfaceCard>
            )}

            {/* What it would be worth — each player's own swing, because
                partners move by their own K and a provisional player moves
                faster off the same result. */}
            <SurfaceCard radius={18} style={{ marginBottom: 12 }}>
              <div style={{ ...sectionLabel, marginBottom: 10 }}>What it's worth</div>
              {[ta, tb].map((t, ti) => (
                <div key={ti} style={{ padding: "8px 0", borderTop: ti ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
                  {t.players.map((p) => {
                    const up = ti === 0 ? c.swing.ifA[p.id] : c.swing.ifB[p.id];
                    const down = ti === 0 ? c.swing.ifB[p.id] : c.swing.ifA[p.id];
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "3px 0" }}>
                        <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 14, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullNameOf(byId.get(p.id))}</span>
                        <span style={{ ...tabular, fontFamily: body, fontSize: 13, color: FEED_TEXT_MID }}>{p.rating}</span>
                        <span style={{ ...tabular, fontFamily: body, fontSize: 13, color: FEED_LIME, width: 64, textAlign: "right" }}>win {showDelta(up ?? 0)}</span>
                        <span style={{ ...tabular, fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, width: 64, textAlign: "right" }}>lose {showDelta(down ?? 0)}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </SurfaceCard>

            <SurfaceCard radius={18} style={{ marginBottom: 12 }}>
              <StatRow label="Head to head" av={rec(c.meetings)} bv={`${c.meetings.l}–${c.meetings.d}–${c.meetings.w}`} na={c.meetings.w} nb={c.meetings.l} />
              <StatRow label="Team rating" av={ta.rating} bv={tb.rating} na={ta.rating} nb={tb.rating} />
              <StatRow label="Played together" av={ta.together.played} bv={tb.together.played} na={ta.together.played} nb={tb.together.played} />
              <StatRow label="Record together" av={rec(ta.together)} bv={rec(tb.together)} />
              <StatRow
                label="Win rate together"
                av={rate(ta.together) == null ? "–" : Math.round(rate(ta.together)! * 100) + "%"}
                bv={rate(tb.together) == null ? "–" : Math.round(rate(tb.together)! * 100) + "%"}
                na={rate(ta.together) ?? undefined}
                nb={rate(tb.together) ?? undefined}
              />
              <StatRow label="Form together" av={ta.form.join(" ") || "–"} bv={tb.form.join(" ") || "–"} />
              <StatRow
                label="Doubles played"
                av={ta.players[0].played + ta.players[1].played}
                bv={tb.players[0].played + tb.players[1].played}
                na={ta.players[0].played + ta.players[1].played}
                nb={tb.players[0].played + tb.players[1].played}
                last
              />
            </SurfaceCard>

            {/* Player against player, any partners. A pair-v-pair record is
                usually one match; this is where the actual history is. */}
            <SurfaceCard radius={18} style={{ marginBottom: 12 }}>
              <div style={{ ...sectionLabel, marginBottom: 6 }}>Across the net</div>
              {c.crossings.map((x, i) => {
                const n = x.record.w + x.record.d + x.record.l;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "9px 0", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
                    <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 14, color: FEED_TEXT_HI }}>{first(x.a)} v {first(x.b)}</span>
                    <span style={{ ...tabular, fontFamily: body, fontSize: 14, fontWeight: 500, color: n && x.record.w > x.record.l ? FEED_LIME : FEED_TEXT_MID }}>
                      {n ? rec(x.record) : "never met"}
                    </span>
                  </div>
                );
              })}
              <div style={{ fontFamily: body, fontSize: 11.5, color: FEED_TEXT_MID, marginTop: 6, lineHeight: 1.5 }}>
                Every doubles match the two were on opposite sides, with any partner.
              </div>
            </SurfaceCard>

            <div style={{ ...sectionLabel, margin: "18px 0 8px" }}>Their matches</div>
            {c.meetings.matches.length ? c.meetings.matches.map((m) => {
              const aOnA = m.teamA[0] === ta.pair[0] || m.teamA[1] === ta.pair[0];
              const aWon = m.winner !== "draw" && (m.winner === "A") === aOnA;
              // The score from the winners' side, as the roundup writes it, so
              // "won · 2–6" can never appear; a draw reads from team A's.
              const fromA = m.winner === "draw" ? true : m.winner === "A";
              const sets = (((m as any).sets || []) as Array<{ a: number; b: number }>).map((s) => (fromA ? `${s.a}–${s.b}` : `${s.b}–${s.a}`)).join(" ");
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", fontFamily: body, fontSize: 13.5, color: FEED_TEXT_HI }}>
                  <span style={{ ...tabular, color: FEED_TEXT_MID, flexShrink: 0 }}>{formatMatchDate(m.playedAt)}</span>
                  <span style={{ textAlign: "right" }}>
                    {m.winner === "draw" ? "Drawn" : (aWon ? pairName(ta.pair) : pairName(tb.pair)) + " won"}
                    {sets ? <span style={{ ...tabular, color: FEED_TEXT_MID }}> · {sets}</span> : null}
                  </span>
                </div>
              );
            }) : (
              <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, padding: "6px 0" }}>
                Never played as these pairs — the prediction comes from each player&apos;s doubles rating.
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
