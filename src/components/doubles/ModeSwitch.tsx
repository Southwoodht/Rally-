"use client";
import React from "react";
import { FEED_CARD, FEED_HERO, FEED_ON_HERO, FEED_TEXT_MID, body } from "@/lib/theme";

/**
 * Singles / Doubles, for the Table, Profile and the new-match screen.
 *
 * One component because all three appendices draw the identical control, and
 * three copies of a segmented control is three chances for them to drift
 * apart in padding by a pixel and look like a mistake.
 *
 * The selected pill is --hero with --on-hero ink: the same pairing every
 * other selected control in the app uses since the scoreboard rollout, so it
 * reads as the app's own switch rather than a new one this feature brought
 * with it.
 */

export function ModeSwitch({
  mode, onMode, labels = ["Singles", "Doubles"],
}: {
  mode: "singles" | "doubles";
  onMode: (m: "singles" | "doubles") => void;
  labels?: [string, string];
}) {
  const tab = (id: "singles" | "doubles", label: string) => {
    const on = mode === id;
    return (
      <button
        key={id}
        role="tab"
        aria-selected={on}
        onClick={() => onMode(id)}
        style={{
          flex: 1, height: 36, borderRadius: 18, border: "none", cursor: "pointer",
          background: on ? FEED_HERO : "transparent",
          color: on ? FEED_ON_HERO : FEED_TEXT_MID,
          fontFamily: body, fontSize: 15, fontWeight: 600,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      role="tablist"
      style={{ margin: "18px 16px 0", padding: 4, borderRadius: 22, background: FEED_CARD, display: "flex", gap: 4 }}
    >
      {tab("singles", labels[0])}
      {tab("doubles", labels[1])}
    </div>
  );
}
