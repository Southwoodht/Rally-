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
  const items: Array<[string, string]> = [
    ["Official", "The headline table. Every result is judged by how strong the opponent actually is: a win over a strong player earns a lot, a loss to a strong player costs little, and the other way round for weaker ones. How strong someone is comes from their results this season, with their level filling in while they have played only a few matches — so beating a newcomer down as Advanced still counts as a big win, and a dropdown that is wrong stops mattering once they have played. Then it is multiplied by how much you have played, so two good wins will not put you top. Playing the best player in the club never costs you: losing to them is cheap and beating them is worth the most of anything."],
    ["ELO", "A pure skill rating, starting at 0. Beating someone stronger than you earns a lot; losing to someone stronger costs almost nothing. It answers 'how good are you', ignoring how often you play."],
    ["Strength", "Built from who beat whom, rather than from your totals. Your strength is the average strength of everyone you played, plus how you did against them — so beating the people you face puts you above them, and holding your own against strong players keeps you up there even on a losing record. Because everyone's strength depends on everyone else's, it is worked out by going round and round until it settles. It is the only one here that never looks at anybody's level: it works out how good your opponents are from their own results. It is also what ranks the Global table."],
    ["Record", "The simple one — your win rate (share of games won, a draw counts as half), nudged by how strong your opponents were and how much you've played."],
    ["Win %", "The rawest number — just wins divided by games played (draws count as half a win), no adjustment for opponent strength or activity."],
    ["Form", "Just your last 5 results — a win scores +1, a loss −1, a draw 0. Shows who's hot right now, regardless of overall record."],
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
