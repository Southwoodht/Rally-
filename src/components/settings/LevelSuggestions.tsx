"use client";
import React, { useMemo, useState } from "react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { computeGlicko } from "@/core/glicko";
import { levelSuggestions, type LevelSuggestion } from "@/core/levelSuggest";
import { countsAsPlayed } from "@/core/matchStatus";
import { fullNameOf } from "@/lib/format";
import { FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

/**
 * Players whose results say their stars are wrong (core/levelSuggest.ts) —
 * a suggestion, and an organiser decides. Sam, 2026-10-24: suggest, never
 * automatic, and it has to be very accurate. Nothing here touches a UTR.
 *
 * "Not yet" is remembered on this device for that exact suggestion, so it
 * comes back only if the results move them somewhere else.
 */

const key = (leagueId: string) => "rally.levelSuggest." + leagueId;
const readDismissed = (leagueId: string): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(key(leagueId)) || "{}") || {}; } catch { return {}; }
};
const levelText = (l: { cat: string; sub: string }) => `${l.cat} · ${l.sub}`;

export function levelSuggestionsFor(players: any[], matches: any[]): LevelSuggestion[] {
  return levelSuggestions(players, computeGlicko(players, matches), matches);
}

export function LevelSuggestionsPage({ players, matches, leagueId, onSetLevel }: {
  players: any[]; matches: any[]; leagueId: string;
  onSetLevel: (id: string, level: { cat: string; sub: string }) => Promise<void>;
}) {
  const all = useMemo(() => levelSuggestionsFor(players, matches), [players, matches]);
  const [dismissed, setDismissed] = useState<Record<string, string>>(() => readDismissed(leagueId));
  const [busy, setBusy] = useState<string | null>(null);
  const shown = all.filter((s) => dismissed[s.playerId] !== levelText(s.to));

  const notYet = (s: LevelSuggestion) => {
    const next = { ...dismissed, [s.playerId]: levelText(s.to) };
    setDismissed(next);
    try { localStorage.setItem(key(leagueId), JSON.stringify(next)); } catch { /* still hidden for now */ }
  };

  // The names behind it: who they beat (or lost to) in their recent matches.
  const evidence = (s: LevelSuggestion) => {
    const mine = matches
      .filter((m) => countsAsPlayed(m) && (m.p1 === s.playerId || m.p2 === s.playerId))
      .sort((a, b) => b.date - a.date)
      .slice(0, s.matches);
    const names: string[] = [];
    for (const m of mine) {
      const opp = m.p1 === s.playerId ? m.p2 : m.p1;
      const won = m.winner !== "draw" && (m.winner === "p1" ? m.p1 : m.p2) === s.playerId;
      const lost = m.winner !== "draw" && !won;
      if ((s.up && won) || (!s.up && lost)) {
        const n = fullNameOf(players.find((p) => p.id === opp));
        if (n && !names.includes(n)) names.push(n);
      }
      if (names.length === 3) break;
    }
    return names.length ? `${s.up ? "Beat" : "Lost to"} ${names.join(", ")}` : "";
  };

  return (
    <div>
      <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, margin: "0 2px 14px" }}>
        Players whose results clearly don&apos;t match their stars. Southwood only asks when the whole of their rating&apos;s ± is outside their level, after at least five matches since it last changed. Nothing changes unless you say so.
      </div>
      {!shown.length && (
        <SurfaceCard radius={18} pad="16px 14px">
          <div style={{ fontFamily: body, fontSize: 14.5, color: FEED_TEXT_HI }}>Everyone&apos;s stars match their results.</div>
        </SurfaceCard>
      )}
      {shown.length > 0 && (
        <SurfaceCard radius={18} pad="4px 14px">
          {shown.map((s, i) => {
            const p = players.find((x) => x.id === s.playerId);
            const why = evidence(s);
            return (
              <div key={s.playerId} style={{ padding: "14px 0", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
                <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15.5, color: FEED_TEXT_HI }}>{fullNameOf(p)}</div>
                <div style={{ fontFamily: body, fontSize: 14, color: FEED_TEXT_HI, marginTop: 4, lineHeight: 1.45 }}>
                  Results say <b>{levelText(s.to)}</b>. Set to {levelText(s.from)}.
                </div>
                <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 3, lineHeight: 1.45, ...tabular }}>
                  Rating {Math.round(s.rating)} ± {Math.round(s.rd)} · {s.matches} matches since their level last changed{why ? " · " + why : ""}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    disabled={busy === s.playerId}
                    onClick={async () => { setBusy(s.playerId); try { await onSetLevel(s.playerId, s.to); } catch { /* the caller said why */ } setBusy(null); }}
                    style={{ flex: 1, background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 10, padding: "10px", fontFamily: body, fontWeight: 600, fontSize: 14, cursor: "pointer", opacity: busy === s.playerId ? 0.5 : 1 }}
                  >
                    {busy === s.playerId ? "Saving…" : `Update to ${s.to.cat}`}
                  </button>
                  <button onClick={() => notYet(s)} style={{ flex: 1, background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 10, padding: "10px", fontFamily: body, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                    Not yet
                  </button>
                </div>
              </div>
            );
          })}
        </SurfaceCard>
      )}
    </div>
  );
}
