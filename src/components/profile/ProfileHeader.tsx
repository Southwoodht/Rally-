"use client";
import React from "react";
import { ChevronDown, Settings, Star, StarHalf } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { starsForLevel } from "@/core/stars";
import { shortNameOf } from "@/lib/format";
import { FEED_CARD, FEED_LIME, FEED_LOSS, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, body, tight } from "@/lib/theme";

// The top of the profile: whose it is, and how good they are.

const STAR_SIZE = 13;

/**
 * A level as five stars, always five slots.
 *
 * Absolute, not relative — the fifth star means Pro, not "best in this
 * league". A scale that rescales itself to the room would tell the same
 * player two different things depending on who else turned up.
 *
 * Stars carry the category only; the label beside them carries the
 * sub-level. See core/stars.ts for why: eighteen grades do not fit ten
 * half-star positions, and compressing the Beginners — over half of
 * Seacourt — would have been the wrong place to lose the resolution.
 */
export function LevelStars({ level, label }: { level: any; label?: string }) {
  const stars = starsForLevel(level);
  const filled = stars === null ? 0 : Math.floor(stars);
  const half = stars !== null && stars % 1 >= 0.5;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }} role="img" aria-label={stars === null ? "No level set" : `${stars} out of 5`}>
        {[0, 1, 2, 3, 4].map((i) => {
          if (i < filled) return <Star key={i} size={STAR_SIZE} color={FEED_LIME} fill={FEED_LIME} strokeWidth={0} />;
          if (i === filled && half) return <StarHalf key={i} size={STAR_SIZE} color={FEED_LIME} fill={FEED_LIME} strokeWidth={0} />;
          return <Star key={i} size={STAR_SIZE} color={FEED_LOSS} fill={FEED_LOSS} strokeWidth={0} />;
        })}
      </span>
      {label && <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID }}>{label}</span>}
    </span>
  );
}

export interface ProfileHeaderProps {
  leagueName: string;
  player: any;
  /** "27 · Seacourt · 9 years playing" — assembled by the caller, who knows
   *  which parts are actually known. */
  meta?: string;
  /** "Intermediate · Medium", or undefined when they've never set one. */
  levelLabel?: string;
  viewer?: "self" | "other";
  onPickLeague?: () => void;
  onSettings?: () => void;
}

export function ProfileHeader({
  leagueName, player, meta, levelLabel, viewer = "self", onPickLeague, onSettings,
}: ProfileHeaderProps) {
  const isSelf = viewer === "self";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <button
            onClick={onPickLeague}
            disabled={!onPickLeague}
            style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "transparent", border: "none", padding: 0, cursor: onPickLeague ? "pointer" : "default", maxWidth: "100%" }}
          >
            <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{leagueName}</span>
            {onPickLeague && <ChevronDown size={13} color={FEED_TEXT_MID} strokeWidth={2} />}
          </button>
          <div style={{ ...tight(30), fontFamily: body, fontWeight: 500, fontSize: 30, letterSpacing: "-0.035em", color: FEED_TEXT_HI, marginTop: 2 }}>
            Profile
          </div>
        </div>
        {/* Somebody else's profile has no settings — there is nothing on it
            that belongs to the person reading. */}
        {isSelf && onSettings && (
          <button
            onClick={onSettings}
            aria-label="Settings"
            style={{ width: 34, height: 34, borderRadius: 17, background: FEED_RAISED, border: "none", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
          >
            <Settings size={17} color={FEED_TEXT_MID} strokeWidth={1.9} />
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Card-coloured gap inside the ring, so it reads on any avatar —
            the generated colours include the ball yellow, which would
            otherwise swallow a plain lime ring whole. */}
        <span style={{ borderRadius: "50%", boxShadow: "0 0 0 2px " + FEED_CARD + ", 0 0 0 4px " + FEED_LIME, display: "flex", flexShrink: 0 }}>
          <Avatar player={player} size={62} enlargeable />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...tight(22), fontFamily: body, fontWeight: 500, fontSize: 22, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {shortNameOf(player)}
          </div>
          {meta && (
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</div>
          )}
          <div style={{ marginTop: 6 }}>
            <LevelStars level={player?.level} label={levelLabel} />
          </div>
        </div>
      </div>
    </div>
  );
}
