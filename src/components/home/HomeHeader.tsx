"use client";
import React from "react";
import { ChevronDown } from "lucide-react";
import { ThemePicker } from "@/components/ui/ThemePicker";
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
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
      {leagueName}
      {onPickLeague && <ChevronDown size={13} color={FEED_TEXT_MID} strokeWidth={2} />}
    </span>
  );

  // TWO FULL-WIDTH ROWS, which is the shape every other tab already had.
  //
  // Home used to be one row with a flex:1 left column holding the league and
  // the picker, and the icons as a sibling beside it. That column ends where
  // the icons begin, so "right-aligned" put the picker in the MIDDLE of the
  // screen on Home and hard right everywhere else — the header visibly jumped
  // as you moved between tabs. Sam spotted it across four screenshots.
  //
  // Row 1 is the league and the picker; row 2 is the page's own heading and
  // the icons. Same two rows, same order, same edges as Table, Fixtures and
  // Profile, so nothing moves when you switch tab.
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        {onPickLeague ? (
          <button onClick={onPickLeague} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "block", minWidth: 0 }}>
            {league}
          </button>
        ) : league}
        <ThemePicker />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, marginTop: 6 }}>
        {/* The greeting: display font, 30/700, letter-spacing -0.6px. Exactly
            the mockup, and the first place in the app where Bricolage does the
            job the old condensed face was reserved for. */}
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 30, letterSpacing: "-0.6px", color: FEED_TEXT_HI, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {greeting}
        </div>
        {bell && <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{bell}</div>}
      </div>
    </div>
  );
}
