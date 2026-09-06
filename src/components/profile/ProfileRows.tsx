"use client";
import React from "react";
import { ChevronRight, Trophy, Users, UserCheck } from "lucide-react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { FEED_LIME, FEED_LOSS, FEED_TEXT_HI, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

// The short rows at the foot of a profile: trophies, and the settings that
// used to be cards of their own.

const RULE = "inset 0 -0.5px 0 " + FEED_LOSS;

export function VerifiedTrophiesRow({ count = 0, onClaim }: { count?: number; onClaim?: () => void }) {
  return (
    <SurfaceCard radius={18} pad="14px 16px">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Trophy size={19} color={FEED_TEXT_MID} strokeWidth={1.8} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 15, color: FEED_TEXT_HI }}>Verified trophies</div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 1 }}>
            {count > 0 ? count + (count === 1 ? " trophy" : " trophies") : "None yet"}
          </div>
        </div>
        {onClaim && (
          <button onClick={onClaim} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: FEED_LIME, fontFamily: body, fontWeight: 400, fontSize: 14, flexShrink: 0 }}>
            Claim
          </button>
        )}
      </div>
    </SurfaceCard>
  );
}

export interface SettingsRow {
  key: string;
  icon: "friends" | "linked";
  label: string;
  /** A second line — the linked player's name, say. */
  detail?: string;
  /** A count on the right, before the chevron. */
  count?: number;
  onClick?: () => void;
}

const ROW_ICONS = { friends: Users, linked: UserCheck };

/**
 * The settings rows.
 *
 * Friends used to be a card at the top of the profile and the linked player
 * came with an explanatory paragraph. Both are one line each now: a card and
 * a paragraph are what you spend when a thing needs explaining, and "Linked
 * player · Samuel Henry" does not.
 */
export function SettingsList({ rows }: { rows: SettingsRow[] }) {
  if (!rows || !rows.length) return null;
  return (
    <SurfaceCard radius={18} pad={0} clip>
      {rows.map((r, i) => {
        const Icon = ROW_ICONS[r.icon];
        return (
          <button
            key={r.key}
            onClick={r.onClick}
            style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
              background: "transparent", border: "none", padding: "14px 16px",
              cursor: r.onClick ? "pointer" : "default",
              boxShadow: i === rows.length - 1 ? undefined : RULE,
            }}
          >
            <Icon size={19} color={FEED_LIME} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 15, color: FEED_TEXT_HI }}>{r.label}</span>
              {r.detail && (
                <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.detail}</span>
              )}
            </span>
            {typeof r.count === "number" && (
              <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, flexShrink: 0 }}>{r.count}</span>
            )}
            <ChevronRight size={16} color={FEED_TEXT_MID} strokeWidth={2} style={{ flexShrink: 0 }} />
          </button>
        );
      })}
    </SurfaceCard>
  );
}
