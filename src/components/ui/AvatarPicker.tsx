"use client";
import React from "react";
import { AvatarArt } from "@/components/ui/AvatarArt";
import { AVATARS, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_MID, body } from "@/lib/theme";

/**
 * Pick a drawn avatar, or your initial.
 *
 * There used to be a free-text box here that accepted any emoji you could
 * paste. It has gone, and that is the point rather than a casualty: the
 * sixteen below are drawn by Rally and look the same on every device, and an
 * arbitrary pasted emoji is drawn by the operating system and does not. One
 * pasted 🐙 would put the one un-styleable thing in the app back on a
 * profile.
 *
 * Nobody loses a picture: a real photo is still the better option and is
 * still there.
 */
export function AvatarPicker({ value, onChange }: any) {
  const cell = (on: boolean): React.CSSProperties => ({
    width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center",
    cursor: "pointer", background: on ? FEED_LIME : FEED_RAISED, border: "none",
  });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      <button onClick={() => onChange(null)} style={cell(!value)} aria-label="Use my initial">
        <span style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: value ? FEED_TEXT_MID : FEED_LIME_INK }}>A–Z</span>
      </button>
      {AVATARS.map((a: string) => (
        <button key={a} onClick={() => onChange(a)} style={cell(value === a)} aria-label={"Avatar " + a}>
          <AvatarArt id={a} size={21} />
        </button>
      ))}
    </div>
  );
}
