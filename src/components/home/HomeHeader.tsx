"use client";
import React from "react";
import { ChevronDown } from "lucide-react";
import { FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, body, tight } from "@/lib/theme";

// League name, greeting, bell. The greeting arrives finished so the clock
// lives in one place (greetingFor in lib/format.ts) rather than in a
// component that would then have to be re-rendered to stay honest.

export interface HomeHeaderProps {
  leagueName: string;
  /** Already built — "Evening, Sam". */
  greeting: string;
  onPickLeague?: () => void;
  /** The bell, passed in rather than imported, so this file doesn't depend
   *  on the notification stack to render. */
  bell?: React.ReactNode;
}

export function HomeHeader({ leagueName, greeting, onPickLeague, bell }: HomeHeaderProps) {
  const league = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
      {leagueName}
      {onPickLeague && <ChevronDown size={13} color={FEED_TEXT_MID} strokeWidth={2} />}
    </span>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {onPickLeague ? (
          <button onClick={onPickLeague} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "block", maxWidth: "100%" }}>
            {league}
          </button>
        ) : league}
        <div style={{ ...tight(28), fontFamily: body, fontWeight: 500, fontSize: 28, letterSpacing: "-0.035em", color: FEED_TEXT_HI, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {greeting}
        </div>
      </div>
      {bell && (
        <div style={{ width: 36, height: 36, borderRadius: 18, background: FEED_RAISED, display: "grid", placeItems: "center", flexShrink: 0 }}>
          {bell}
        </div>
      )}
    </div>
  );
}
