"use client";
import React from "react";
import { ChevronRight } from "lucide-react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { FEED_LIME, FEED_LIME_INK, FEED_LIME_INK_2, FEED_RADIUS, FEED_TEXT_HI, FEED_TEXT_MID, body } from "@/lib/theme";

// The one sentence about where you stand that a number cannot say.
//
// Lime because it is the only actionable thing on the screen: everything
// else reports, this suggests. Two lines, and the second is the reason the
// first is worth reading — "41 points behind Zaach" on its own is another
// statistic.

export interface GapInsightProps {
  /** "41 points behind Zaach." — built by the caller, who knows the metric. */
  headline: string;
  /** The bit that tells you what to do about it. */
  advice?: string;
}

export function GapInsight({ headline, advice }: GapInsightProps) {
  return (
    <div style={{ background: FEED_LIME, borderRadius: FEED_RADIUS, padding: 18 }}>
      <div style={{ fontFamily: body, fontWeight: 500, fontSize: 16, color: FEED_LIME_INK, lineHeight: 1.35 }}>{headline}</div>
      {advice && (
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_LIME_INK_2, lineHeight: 1.45, marginTop: 6 }}>{advice}</div>
      )}
    </div>
  );
}

export interface PlayingStyleProps {
  title: string;
  description: string;
  onDetails?: () => void;
}

export function PlayingStyle({ title, description, onDetails }: PlayingStyleProps) {
  return (
    <SurfaceCard radius={18}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_HI }}>{title}</div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.45, marginTop: 4 }}>{description}</div>
        </div>
        {onDetails && (
          <button
            onClick={onDetails}
            style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "transparent", border: "none", padding: 0, cursor: "pointer", color: FEED_LIME, fontFamily: body, fontWeight: 400, fontSize: 13, flexShrink: 0 }}
          >
            Details<ChevronRight size={14} strokeWidth={2} />
          </button>
        )}
      </div>
    </SurfaceCard>
  );
}
