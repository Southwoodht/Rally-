"use client";
import React from "react";
import { ChevronLeft } from "lucide-react";
import { ProfileContainer } from "@/components/profile/ProfileContainer";
import { FEED_PAGE, FEED_TEXT_MID, body } from "@/lib/theme";

// The same profile, read by somebody else. viewer="other" is the whole
// difference: no settings, no linked player, no Edit on a result that isn't
// yours, and the lime card answers "how do I do against them" instead of
// "who is one place above me" — which is their business, not the reader's.
//
// Full screen rather than a sheet since 2026-09-11. It was an 88vh panel over
// a dimmed page, which is right for a quick look and wrong for the thing it
// actually holds — a whole profile with a record, form, rivalries and a match
// history. A sheet says "glance at this and dismiss it"; this is somewhere
// you read and scroll.
//
// It is still a component rather than a route, deliberately. Everything on it
// comes from the league already loaded in RallyApp, so the page renders
// instantly with no second fetch, and closing it puts you back exactly where
// you were. /players/[id] is the route, and it exists for people whose data
// this app does NOT have — somebody from search or the friends list, where
// there is no shared league to read from.
export function ProfileModal({ player, onClose, profileYear, ...shared }: any) {
  return (
    <div style={{ position: "fixed", inset: 0, background: FEED_PAGE, zIndex: 120, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "calc(8px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom))" }}>
        {/* Back, on the left, where back lives — not a Close on the right,
            which is what a dismissible sheet has. */}
        <button
          onClick={onClose}
          aria-label="Back"
          style={{ display: "flex", alignItems: "center", gap: 2, background: "transparent", border: "none", color: FEED_TEXT_MID, cursor: "pointer", padding: "10px 6px 10px 0", fontFamily: body, fontWeight: 400, fontSize: 15 }}
        >
          <ChevronLeft size={22} strokeWidth={2.2} /> Back
        </button>

        <ProfileContainer
          key={player.id + ":" + String(profileYear ?? "all")}
          {...shared}
          player={player}
          viewer={shared?.meId === player.id ? "self" : "other"}
        />
      </div>
    </div>
  );
}
