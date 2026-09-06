"use client";
import React from "react";
import { ChevronRight, Trophy, Users, UserCheck } from "lucide-react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { FEED_LIME, FEED_LOSS, FEED_TEXT_HI, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

// The short rows at the foot of a profile: trophies, and the settings that
// used to be cards of their own.

const RULE = "inset 0 -0.5px 0 " + FEED_LOSS;

export interface ProfileTrophy {
  id: string;
  competition: string;
  /** "Champion", "Runner-up", "No. 4". */
  result?: string | null;
  season?: string | null;
  clubName?: string | null;
  /** True when a club admin recorded it against the player row rather than
   *  the player claiming it themselves. */
  recorded?: boolean;
}

/**
 * The trophies themselves, not a count of them.
 *
 * A row reading "2 trophies" is a locked box: the whole point of a verified
 * honour is that it says what it was and who vouched for it. The count only
 * survives as the empty state, where there is nothing to name.
 */
export function VerifiedTrophiesRow({ trophies = [], onClaim }: { trophies?: ProfileTrophy[]; onClaim?: () => void }) {
  if (!trophies.length) {
    return (
      <SurfaceCard radius={18} pad="14px 16px">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Trophy size={19} color={FEED_TEXT_MID} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 15, color: FEED_TEXT_HI }}>Verified trophies</div>
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 1 }}>None yet</div>
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

  return (
    <SurfaceCard radius={18} pad={0} clip>
      {trophies.map((t, i) => (
        <div
          key={t.id}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
            boxShadow: i === trophies.length - 1 && !onClaim ? undefined : RULE,
          }}
        >
          <Trophy size={19} color={FEED_LIME} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {t.result ? t.result + " — " + t.competition : t.competition}
            </div>
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {[t.clubName || "Club", t.season || null, t.recorded ? "recorded by the club" : "verified"].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      ))}
      {onClaim && (
        <button
          onClick={onClaim}
          style={{ display: "block", width: "100%", background: "transparent", border: "none", padding: "12px 16px", cursor: "pointer", color: FEED_LIME, fontFamily: body, fontWeight: 400, fontSize: 14, textAlign: "left" }}
        >
          Claim another
        </button>
      )}
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
