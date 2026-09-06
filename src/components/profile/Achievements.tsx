"use client";
import React from "react";
import { Award, CircleDot, Flame, Handshake, Lock, Medal, PartyPopper, Trophy } from "lucide-react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { FEED_LIME, FEED_LOSS, FEED_TEXT_DIM, FEED_TEXT_HI, FEED_TEXT_MID, body } from "@/lib/theme";

// Achievements as a strip you push sideways, not a grid you scroll past.
//
// Nine tiles stacked three-by-three took a screen's worth of height to say
// something most people glance at once. A strip says the same in one band
// and lets the sections that get read every visit sit higher up.
//
// Icons are drawn, never emoji. The brief asked for Tabler; this uses lucide
// because lucide is already the app's icon set — every other icon in Rally
// comes from it — and a second icon library would reintroduce exactly the
// inconsistency that banning emoji was meant to fix.

export type AchievementIcon = "firstWin" | "medal" | "runnerUp" | "streak" | "matches" | "fairPlay" | "trophy";

const ICONS: Record<AchievementIcon, any> = {
  firstWin: PartyPopper,
  medal: Medal,
  runnerUp: Award,
  streak: Flame,
  matches: CircleDot,
  fairPlay: Handshake,
  trophy: Trophy,
};

export interface Achievement {
  id: string;
  icon: AchievementIcon;
  label: string;
  earned: boolean;
  /** "2026" when earned. */
  year?: string;
  /**
   * "22 to go" when locked.
   *
   * Required rather than optional in spirit: a locked tile with nothing
   * under it says only "you haven't got this", which the greyness already
   * said. The distance is the only part that tells somebody what to do.
   */
  progress?: string;
}

export function Achievements({ items }: { items: Achievement[] }) {
  if (!items || !items.length) return null;
  const earned = items.filter((a) => a.earned).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_HI }}>Achievements</span>
        <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID }}>{earned} of {items.length}</span>
      </div>
      <SurfaceCard radius={18} pad="14px 0">
        <div style={{ display: "flex", gap: 14, overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
          {items.map((a) => {
            const Icon = a.earned ? ICONS[a.icon] : Lock;
            const ring = a.earned ? FEED_LIME : FEED_LOSS;
            return (
              <div key={a.id} style={{ width: 58, flexShrink: 0, textAlign: "center" }}>
                <div style={{ width: 44, height: 44, margin: "0 auto", borderRadius: 22, border: "1.5px solid " + ring, display: "grid", placeItems: "center" }}>
                  <Icon size={20} color={a.earned ? FEED_LIME : FEED_TEXT_DIM} strokeWidth={1.8} />
                </div>
                <div style={{ fontFamily: body, fontWeight: 400, fontSize: 11, color: a.earned ? FEED_TEXT_HI : FEED_TEXT_DIM, marginTop: 6, lineHeight: 1.25 }}>
                  {a.label}
                </div>
                <div style={{ fontFamily: body, fontWeight: 400, fontSize: 10, color: FEED_TEXT_MID, marginTop: 2 }}>
                  {a.earned ? a.year : a.progress}
                </div>
              </div>
            );
          })}
        </div>
      </SurfaceCard>
    </div>
  );
}
