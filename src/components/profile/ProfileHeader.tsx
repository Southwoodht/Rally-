"use client";
import React from "react";
import { ChevronDown, Settings } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { STAR_COUNT, starsForLevel } from "@/core/stars";
import { fullNameOf } from "@/lib/format";
import { FEED_CARD, FEED_LIME, FEED_LOSS, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, body, tight } from "@/lib/theme";

// The top of the profile: whose it is, and how good they are.

const STAR_SIZE = 14;

// A five-pointed star, filled from the left to any fraction.
//
// Drawn rather than composed from lucide's Star and StarHalf, because the
// scale needs thirds and there is no third-star glyph. A gradient with a
// hard stop at the fill point gives any fraction from one drawing, and the
// same path renders empty, a third, two thirds or full.
function TierStar({ fraction, size = STAR_SIZE }: { fraction: number; size?: number }) {
  const id = React.useId();
  const stop = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset={stop + "%"} stopColor={FEED_LIME} />
          <stop offset={stop + "%"} stopColor={FEED_LOSS} />
        </linearGradient>
      </defs>
      <path
        d="M12 2.4l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.47l-5.9 3.1 1.13-6.57L2.45 9.34l6.6-.96z"
        fill={`url(#${id})`}
      />
    </svg>
  );
}

/**
 * A level as stars: one per tier, filled in thirds by sub-level.
 *
 * Absolute, not relative — the sixth star means Pro, not "best in this
 * league". A scale that rescaled itself to the room would tell the same
 * player two different things depending on who else turned up.
 *
 * Six stars because there are six tiers. Five is the more familiar idiom and
 * was the right call for the old whole-star model, but five stars in thirds
 * is fifteen positions for eighteen grades, and the collisions the thirds
 * exist to remove come straight back.
 */
export function LevelStars({ level, label }: { level: any; label?: string }) {
  const stars = starsForLevel(level);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{ display: "inline-flex", alignItems: "center", gap: 2 }}
        role="img"
        aria-label={stars === null ? "No level set" : `${Math.round(stars * 3) / 3} out of ${STAR_COUNT} stars`}
      >
        {Array.from({ length: STAR_COUNT }, (_, i) => (
          <TierStar key={i} fraction={stars === null ? 0 : stars - i} />
        ))}
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
            {fullNameOf(player)}
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
