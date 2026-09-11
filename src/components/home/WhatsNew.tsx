"use client";
import React from "react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { WHATS_NEW } from "@/lib/whatsNew";
import {
  FEED_LIME, FEED_LIME_INK, FEED_TEXT_HI, FEED_TEXT_MID, body, tight,
} from "@/lib/theme";

/** Read once, gone for good. See lib/whatsNew.ts for why it isn't a post. */
export function WhatsNew({ onDismiss }: { onDismiss: () => void }) {
  if (!WHATS_NEW.length) return null;
  return (
    <SurfaceCard radius={20} pad="18px 16px 16px" style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: body, fontWeight: 500, fontSize: 19, color: FEED_TEXT_HI, ...tight(19) }}>
        What&apos;s new
      </div>
      <div style={{ marginTop: 12 }}>
        {WHATS_NEW.map((n, i) => (
          <div key={n.title} style={{ marginTop: i ? 13 : 0 }}>
            <div style={{ fontFamily: body, fontWeight: 500, fontSize: 14.5, color: FEED_TEXT_HI }}>{n.title}</div>
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_TEXT_MID, marginTop: 2, lineHeight: 1.5 }}>
              {n.detail}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onDismiss}
        style={{ width: "100%", background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 16, padding: "13px 14px", cursor: "pointer", fontFamily: body, fontWeight: 500, fontSize: 15, marginTop: 18 }}
      >
        Got it
      </button>
    </SurfaceCard>
  );
}
