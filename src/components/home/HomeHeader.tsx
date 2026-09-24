"use client";
import React from "react";
import { ChevronDown } from "lucide-react";
import { FEED_TEXT_HI, FEED_TEXT_MID, body, display } from "@/lib/theme";

// League name, greeting, bell. The greeting arrives finished so the clock
// lives in one place (greetingFor in lib/format.ts) rather than in a
// component that would then have to be re-rendered to stay honest.

export interface HomeHeaderProps {
  leagueName: string;
  /** Already built — "Evening, Sam". */
  greeting: string;
  onPickLeague?: () => void;
  /** The header's controls — the bell, and whatever else the screen
   *  carries — passed in rather than imported, so this file doesn't depend
   *  on the notification stack to render. The caller styles them: this is a
   *  row, not a single round button, because Home has two of them.  */
  bell?: React.ReactNode;
}

export function HomeHeader({ leagueName, greeting, onPickLeague, bell }: HomeHeaderProps) {
  const league = (
    // 14px per the mockup, up from 12. The club selector is the one control
    // above the greeting and it was reading as a caption.
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
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
        {/* The greeting: display font, 30/700, letter-spacing -0.6px. Exactly
            the mockup, and the first place in the app where Bricolage does the
            job the old condensed face was reserved for. */}
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 30, letterSpacing: "-0.6px", color: FEED_TEXT_HI, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {greeting}
        </div>
      </div>
      {bell && <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{bell}</div>}
    </div>
  );
}
