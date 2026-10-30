"use client";
import React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { fullNameOf } from "@/lib/format";
import { FEED_LOST, FEED_PAD, FEED_PAD_Y, FEED_RADIUS, FEED_TEXT_HI, FEED_TEXT_MID, LINE, body, tabular } from "@/lib/theme";

/**
 * Rivals (Sam, 2026-10-30, second go: "make it about people, not just
 * numbers"). Straight under the career record but deliberately NOT another
 * big-numbers card: one small line of counts, then faces — the three most
 * played with their head-to-head, the nemesis (the best record against
 * them, core/rivals.ts) on a faint tint, and the best win with what that
 * opponent was rated going in. Every face opens that head-to-head.
 */
export interface RivalsCardData {
  top: Array<{ player: any; w: number; d: number; l: number }>;
  nemesis: { player: any; w: number; d: number; l: number } | null;
  bestWin: { player: any; rating: number | null } | null;
  onOpenH2H?: (opponentId: string) => void;
}

/** "Charlie H" — first name and the initial of the last. */
const shortOf = (p: any) => {
  const full = fullNameOf(p) || "";
  const w = full.trim().split(/\s+/);
  return w.length < 2 ? full : `${w[0]} ${w[w.length - 1][0]}`;
};
const rec = (r: { w: number; d: number; l: number }) => `${r.w}–${r.d}–${r.l}`;

export function RivalsCard({ data, lead, behind, self }: { data: RivalsCardData; lead: number; behind: number; self: boolean }) {
  const open = (p: any) => (data.onOpenH2H && p?.id ? () => data.onOpenH2H!(p.id) : undefined);
  const counts = ["Rivals", (self ? "You lead " : "Leads ") + lead, (self ? "They lead " : "Trails ") + behind].join(" · ");
  const row = (key: string, p: any, label: string, right: React.ReactNode, tint?: string) => {
    const go = open(p);
    return (
      <div key={key} role={go ? "button" : undefined} onClick={go} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 14, background: tint || "transparent", cursor: go ? "pointer" : "default" }}>
        <Avatar player={p} size={40} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: body, fontWeight: 500, fontSize: 12.5, color: FEED_TEXT_MID }}>{label}</span>
          <span style={{ display: "block", fontFamily: body, fontWeight: 600, fontSize: 15.5, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullNameOf(p)}</span>
        </span>
        <span style={{ ...tabular, flexShrink: 0, whiteSpace: "nowrap", fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_TEXT_HI }}>{right}</span>
      </div>
    );
  };
  return (
    <SurfaceCard radius={FEED_RADIUS} pad={FEED_PAD_Y + "px " + FEED_PAD + "px"} style={{ marginTop: 12 }}>
      <div style={{ ...tabular, fontFamily: body, fontWeight: 600, fontSize: 13.5, color: FEED_TEXT_MID }}>{counts}</div>

      {data.top.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.top.length}, minmax(0, 1fr))`, gap: 8, marginTop: 14 }}>
          {data.top.map((r) => {
            const go = open(r.player);
            return (
              <div key={r.player?.id} role={go ? "button" : undefined} onClick={go} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: go ? "pointer" : "default", minWidth: 0 }}>
                <Avatar player={r.player} size={56} />
                <span style={{ fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_TEXT_HI, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortOf(r.player)}</span>
                <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID }}>{rec(r)}</span>
              </div>
            );
          })}
        </div>
      )}

      {(data.nemesis || data.bestWin) && (
        <div style={{ borderTop: "1px solid " + LINE, marginTop: 14, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {data.nemesis && row("nemesis", data.nemesis.player, "Nemesis", rec(data.nemesis), `color-mix(in srgb, ${FEED_LOST} 9%, transparent)`)}
          {data.bestWin && row("best", data.bestWin.player, "Best win", data.bestWin.rating != null ? <><span style={{ fontWeight: 500, fontSize: 12, color: FEED_TEXT_MID }}>rated </span>{data.bestWin.rating}</> : null)}
        </div>
      )}
    </SurfaceCard>
  );
}
