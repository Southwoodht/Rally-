"use client";
import React from "react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { fullNameOf } from "@/lib/format";
import { FEED_LIME, FEED_LOST, FEED_MUTED_FILL, FEED_PAD, FEED_PAD_Y, FEED_RADIUS, FEED_TEXT_MID, body, display, tabular } from "@/lib/theme";

/**
 * Rivals (Sam, 2026-10-30): straight under the career record, the same hero
 * style — "10 – 3", people you lead against people who lead you (opponents,
 * not matches, said underneath so it is never read as a record), and one
 * muted line naming the best win and the nemesis. The whole card opens the
 * head-to-head section further down.
 */
export function RivalsCard({ lead, behind, self, bestWin, nemesis, onOpen }: {
  lead: number; behind: number; self: boolean;
  /** The highest-rated player beaten (the first of Best wins). */
  bestWin?: any;
  /** The player lost to most. */
  nemesis?: any;
  onOpen?: () => void;
}) {
  // Each fact kept whole, so a narrow phone breaks the line at the dot and
  // never inside somebody's name.
  const facts = [bestWin ? "Best win: " + fullNameOf(bestWin) : null, nemesis ? "Nemesis: " + fullNameOf(nemesis) : null].filter(Boolean) as string[];
  const num = (n: number, colour: string) => (
    <span style={{ ...tabular, fontFamily: display, fontWeight: 700, fontSize: 50, lineHeight: 1, color: colour }}>{n}</span>
  );
  return (
    <div role={onOpen ? "button" : undefined} onClick={onOpen} style={{ marginTop: 12, cursor: onOpen ? "pointer" : "default" }}>
      <SurfaceCard className="sw-hero" radius={FEED_RADIUS} pad={FEED_PAD_Y + "px " + FEED_PAD + "px"}>
        <div style={{ textAlign: "center", fontFamily: body, fontWeight: 600, fontSize: 13, color: FEED_TEXT_MID, marginBottom: 10 }}>Rivals</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
          {num(lead, FEED_LIME)}
          <span aria-hidden="true" style={{ width: 14, height: 2, background: FEED_MUTED_FILL, flexShrink: 0 }} />
          {num(behind, FEED_LOST)}
        </div>
        <div style={{ textAlign: "center", fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID, marginTop: 8 }}>
          {self ? "you lead · they lead" : "leads · trails"}
        </div>
        {facts.length > 0 && (
          <div style={{ textAlign: "center", fontFamily: body, fontWeight: 500, fontSize: 13.5, color: FEED_TEXT_MID, marginTop: 14, lineHeight: 1.45 }}>
            {facts.map((f, i) => (
              <React.Fragment key={f}>{i > 0 && " · "}<span style={{ whiteSpace: "nowrap" }}>{f}</span></React.Fragment>
            ))}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
