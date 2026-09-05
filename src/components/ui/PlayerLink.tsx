"use client";
import React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BALL, CHALK, body } from "@/lib/theme";

// A person's name, wherever one appears in a sentence — with their face
// beside it and a tap that goes to them.
//
// It is a <button> rather than a wrapper around one, which is the whole
// reason this exists: a name inside a row that is itself a button can't be
// clickable, because nesting buttons is invalid and the outer one eats the
// tap. So anywhere a name should open a profile, the row around it has to
// stop being one big button and let the names be their own targets.
//
// Falls back to plain text when we don't hold a player record — somebody
// from a league we can only see the outside of has no profile to open, and
// a link that goes nowhere is worse than no link.
export function PlayerLink({ player, name, onOpen, size = 20, avatar = true, strong = true }: any) {
  const label = player ? player.name + (player.last ? " " + player.last : "") : (name || "Someone");
  const text = (
    <span style={{ fontFamily: body, fontWeight: strong ? 700 : 500, fontSize: "inherit", color: "inherit", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
  if (!player || !onOpen) {
    return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: CHALK }}>{avatar && player ? <Avatar player={player} size={size} /> : null}{text}</span>;
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(player.id); }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none",
        padding: 0, margin: 0, cursor: "pointer", color: BALL, font: "inherit", lineHeight: "inherit",
      }}
    >
      {avatar && <Avatar player={player} size={size} />}
      {text}
    </button>
  );
}
