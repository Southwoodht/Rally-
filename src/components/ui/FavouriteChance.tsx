"use client";
import React from "react";
import { FEED_TEXT_MID, FORM_LOSS, FORM_WIN, body, tabular } from "@/lib/theme";

/**
 * Who's the favourite, on a fixture row (Sam, 2026-11-02: "it has some
 * percentages but doesn't say who's the fav"). The bare "67%" was your own
 * win chance, and on a row you weren't in it was the first player's — the
 * number never said whose it was.
 *
 * Now it is always the FAVOURITE's chance, with who that is underneath:
 * "You're fav" (green), "Will A fav" (red, when it's against you), or a
 * neutral name on a row you're not in. 50/50 says "Even".
 *
 * `chanceA` is side A's win chance, 0–100; `you` is "A", "B" or null.
 */
export function FavouriteChance({ chanceA, nameA, nameB, you }: {
  chanceA: number; nameA: string; nameB: string; you: "A" | "B" | null;
}) {
  const even = Math.round(chanceA) === 50;
  const favA = chanceA > 50;
  const pct = even ? 50 : Math.round(favA ? chanceA : 100 - chanceA);
  const favIsYou = !even && you != null && (you === "A") === favA;
  const label = even ? "Even" : favIsYou ? "You're fav" : (favA ? nameA : nameB) + " fav";
  const colour = even || you == null ? FEED_TEXT_MID : favIsYou ? FORM_WIN : FORM_LOSS;
  return (
    <span title="Who's favourite to win" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, maxWidth: 92 }}>
      <span style={{ ...tabular, fontFamily: body, fontWeight: 700, fontSize: 15, lineHeight: 1.1, color: colour }}>{pct}%</span>
      <span style={{ fontFamily: body, fontWeight: 500, fontSize: 12, lineHeight: 1.2, color: FEED_TEXT_MID, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{label}</span>
    </span>
  );
}
