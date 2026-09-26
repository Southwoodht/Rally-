"use client";
import React, { useMemo } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { fullNameOf } from "@/lib/format";
import { partnersOf, mostPlayedWith, BEST_PARTNER_MINIMUM } from "@/core/doubles/partners";
import type { DoublesMatch } from "@/core/doubles/elo";
import {
  FEED_BAR, FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_RADIUS, FEED_TEXT_HI,
  FEED_TEXT_MID, body, display, tabular,
} from "@/lib/theme";

/**
 * The Partners card — Appendix C.
 *
 * Who you play doubles with, how you do together, and who you do best with.
 * The maths is core/doubles/partners.ts; this only draws it.
 *
 * "MOST PLAYED WITH" IN THE HEADER AND "Best" ON A ROW ARE DIFFERENT PEOPLE,
 * usually. The list is sorted by matches played, so the top row is who you
 * turn up with; the badge is who you actually win with, and it needs three
 * matches together before it will say so. Showing both is the point of the
 * card — one is habit and the other is evidence.
 */

interface Props {
  players: any[];
  matches: DoublesMatch[];
  playerId: string;
  /**
   * Your overall doubles win rate, counted the same way (a draw is half), so
   * each partnership can say how it compares. The doubles-only question the
   * singles profile has no version of: not "how good am I" but "who am I
   * better with".
   */
  overall?: number;
}

export function PartnersCard({ players, matches, playerId, overall }: Props) {
  const rows = useMemo(() => partnersOf(matches, playerId), [matches, playerId]);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const most = mostPlayedWith(rows);

  if (!rows.length) return null;

  return (
    <div style={{ margin: "12px 16px 0", padding: "20px 18px 10px", borderRadius: FEED_RADIUS, background: FEED_CARD }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 20, color: FEED_TEXT_HI }}>Partners</div>
        {most && (
          <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Most played with: {fullNameOf(byId.get(most))}
          </div>
        )}
      </div>

      {rows.map((r) => {
        const partner = byId.get(r.partnerId);
        const pct = Math.round(r.winRate * 100);
        return (
          <div key={r.partnerId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
            <Avatar player={partner} size={40} />
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", fontFamily: body, fontWeight: 600, fontSize: 16, color: FEED_TEXT_HI, minWidth: 0 }}>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullNameOf(partner)}</span>
                {r.best && (
                  <span style={{ marginLeft: 6, flexShrink: 0, fontFamily: body, fontSize: 11, fontWeight: 700, color: FEED_LIME_INK, background: FEED_LIME, borderRadius: 8, padding: "2px 7px" }}>
                    Best
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                {/* The track is --bar-fill, the same token the Table's rating
                    bar uses. Not an alpha: three of the five themes are light
                    and an alpha only reads as "quieter" against a known
                    background. */}
                <div style={{ flexGrow: 1, height: 6, borderRadius: 3, background: FEED_BAR, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: 6, borderRadius: 3, background: FEED_LIME }} />
                </div>
                <span style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, whiteSpace: "nowrap", ...tabular }}>
                  {r.won}–{r.lost}{r.drawn ? `–${r.drawn}` : ""}
                </span>
              </div>
            </div>
            <div style={{ width: 56, textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontFamily: display, fontWeight: 700, fontSize: 18, color: FEED_TEXT_HI, ...tabular }}>{pct}%</div>
              {/* Only once it means something: the same three-match floor the
                  Best badge uses. "+50 on your average" off one win is the
                  claim that floor exists to stop. */}
              {overall !== undefined && r.played >= BEST_PARTNER_MINIMUM && (() => {
                const diff = pct - Math.round(overall * 100);
                return (
                  <div style={{ fontFamily: body, fontSize: 11, marginTop: 2, whiteSpace: "nowrap", color: diff > 0 ? FEED_LIME : FEED_TEXT_MID, ...tabular }}>
                    {diff === 0 ? "your avg" : `${diff > 0 ? "+" : "−"}${Math.abs(diff)} vs avg`}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
