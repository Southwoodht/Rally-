"use client";
import React, { useState } from "react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { LEVELS, SUBS } from "@/core/constants";
import {
  FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_RAISED,
  FEED_TEXT_HI, FEED_TEXT_MID, body, tight,
} from "@/lib/theme";

/**
 * "Rally has six levels now."
 *
 * The scale went from four categories to six, which left Amateur and
 * Semi-pro empty — not because nobody belongs there but because nobody has
 * been asked since they appeared. Everyone who picked a level picked it from
 * the old four, so half the club is filed under a heading they never had the
 * option to avoid.
 *
 * Self-selection, not reclassification. Sam's ruling: nobody gets moved by an
 * admin or by arithmetic. This asks once, and takes no for an answer.
 *
 * It is also the repair for the one-off ELO shift the new scale caused. The
 * pairs that moved apart move back when the person between them takes up the
 * tier that now exists.
 */
export function LevelRecheck({ current, onPick, onDismiss }: {
  current?: { cat: string; sub: string } | null;
  onPick: (cat: string, sub: string) => void;
  onDismiss: () => void;
}) {
  const [cat, setCat] = useState(current?.cat || "");
  const [sub, setSub] = useState(current?.sub || SUBS[1]);

  const pill = (active: boolean): React.CSSProperties => ({
    background: active ? FEED_LIME : FEED_RAISED,
    color: active ? FEED_LIME_INK : FEED_TEXT_MID,
    border: "none", borderRadius: 999, padding: "9px 13px", cursor: "pointer",
    fontFamily: body, fontWeight: 500, fontSize: 13.5, whiteSpace: "nowrap",
  });

  return (
    <SurfaceCard radius={20} pad="18px 16px 16px" style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: body, fontWeight: 500, fontSize: 19, color: FEED_TEXT_HI, ...tight(19) }}>
        Rally has six levels now
      </div>
      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, marginTop: 6, lineHeight: 1.5 }}>
        Amateur and Semi-pro were added after you picked yours. Worth a look —
        nobody gets moved automatically.
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
        {LEVELS.map((l: string) => (
          <button key={l} onClick={() => setCat(l)} style={pill(cat === l)}>{l}</button>
        ))}
      </div>

      {/* Sub-level only once a category is chosen: asking how good a Beginner
          you are before you have said Beginner is a question out of order. */}
      {cat && (
        <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
          {SUBS.map((sv: string) => (
            <button key={sv} onClick={() => setSub(sv)} style={{ ...pill(sub === sv), flex: 1 }}>{sv}</button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          disabled={!cat}
          onClick={() => cat && onPick(cat, sub)}
          style={{
            flex: 1, background: cat ? FEED_LIME : FEED_RAISED, color: cat ? FEED_LIME_INK : FEED_TEXT_MID,
            border: "none", borderRadius: 16, padding: "13px 14px", cursor: cat ? "pointer" : "default",
            fontFamily: body, fontWeight: 500, fontSize: 15,
          }}
        >
          {current?.cat && cat === current.cat && sub === current.sub ? "Keep it" : "That's me"}
        </button>
        <button
          onClick={onDismiss}
          style={{ background: FEED_CARD, color: FEED_TEXT_MID, border: "none", borderRadius: 16, padding: "13px 16px", cursor: "pointer", fontFamily: body, fontWeight: 500, fontSize: 15 }}
        >
          Not now
        </button>
      </div>
    </SurfaceCard>
  );
}
