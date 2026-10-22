"use client";
import React from "react";
import { BALL, CHALK, body } from "@/lib/theme";

// What each ranking means, in the order the chips offer them.
//
// CONTENT ONLY — no overlay, no header, no close button. FilterChips already
// wraps this in a Sheet with its own title and its own dismiss. It used to
// render a second full-screen overlay on top of that one, carrying a "Close"
// wired to an onClose nobody passed: `<RankingInfo />`, no props. So the
// button did nothing, and the panel it drew covered the real sheet's close as
// well. Sam reported it as "there's a glitch where I can't press close".
//
// A component that draws its own modal cannot also be embedded in one. This
// one is embedded, so it draws none.

export function RankingInfo() {
  // One ranking since 2026-10-22 (Sam: "members want one table"), so this
  // explains that one and how the list is laid out — not the five modes the
  // chips used to offer.
  const items: Array<[string, string]> = [
    ["The rating", "One number per player, with a ± for how sure it is — the Glicko system chess uses. You start from your level: 1500 is Intermediate · Low, and each step up or down the level scale is 50. After that only results move you: a win, a draw or a loss, not the score. Beating someone rated well above you moves you a lot; beating someone well below, very little."],
    ["The ±", "How sure the rating is. It shrinks as you play and grows again while you don't, so a regular is sure of their number and somebody back after a year off is not — their next few results move them a lot."],
    ["Provisional", "Over ± 130 the rating is still a guess. Provisional players are listed under the table without a place, and take one once a few more results come in. Nobody provisional is ever shown as the leader."],
    ["A few more matches", "A place needs 5 matches all time, or 3 in a season. Anyone short of that is in the one line at the foot of the table — tap it to see who, and how many they need."],
    ["Global table", "Everyone you have played, across every club. It is its own table — the link at the top."],
  ];
  return (
    <div>
      {items.map(([t, d], i) => (
        <div key={t} style={{ paddingTop: i ? 16 : 0 }}>
          <div style={{ fontFamily: body, fontSize: 16, fontWeight: 500, color: BALL }}>{t}</div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13.5, color: CHALK, marginTop: 4, lineHeight: 1.55 }}>{d}</div>
        </div>
      ))}
    </div>
  );
}
