"use client";
import React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { fullNameOf } from "@/lib/format";
import type { DoublesRow } from "@/lib/doublesData";
import { FEED_TEXT_HI, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

/**
 * One doubles result, in the newsfeed.
 *
 * "Sam & George beat Charlie & Connor 6–4 7–5", with both pairs' avatars.
 *
 * FIRST NAMES IN THE SENTENCE, FULL NAMES IN THE ALT TEXT. Four full names in
 * one line is around sixty characters before the score, which wraps to three
 * lines on a phone and stops reading as a sentence. Singles has room for two
 * full names and uses them; doubles does not, and the avatars carry the
 * identity. Never player.nick either way — §10 records what happened when a
 * session reached for that field.
 *
 * The score is read from the `sets` column, which doubles has and singles
 * does not: singles keeps set scores inside a free-text string that
 * core/sets.ts has to reconcile against the winner, because the old data had
 * no player-one-first convention. Here team A's games are always `a`, so
 * there is nothing to reconcile — and nothing that should be routed through
 * the singles parser.
 */

interface Props {
  match: DoublesRow;
  players: any[];
  meId?: string | null;
  when: string;
}

const firstName = (p: any): string => (p?.name || "").trim() || "Someone";

export function DoublesScoreline({ match, players, meId, when }: Props) {
  const byId = new Map(players.map((p) => [p.id, p]));
  // An empty seat is somebody nobody could name. It stays in the list as
  // null so "& partner" can be said, and is skipped for avatars and titles.
  const a = match.teamA.map((id) => (id == null ? null : byId.get(id)));
  const b = match.teamB.map((id) => (id == null ? null : byId.get(id)));

  const drew = match.winner === "draw";
  // The winning pair leads the sentence, so it reads as a result rather than
  // as a fixture. On a draw the order is as entered, because neither side
  // beat anyone and putting one first would imply otherwise.
  const flip = !drew && match.winner === "B";
  const left = flip ? b : a;
  const right = flip ? a : b;

  const score = match.sets
    .map((s) => (flip ? `${s.b}–${s.a}` : `${s.a}–${s.b}`))
    .join(" ");

  const pair = (ps: any[]) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      {ps.filter(Boolean).map((p, i) => (
        <span key={i} style={{ marginLeft: i ? -10 : 0, display: "inline-flex" }}>
          <Avatar player={p} size={26} />
        </span>
      ))}
    </span>
  );

  const names = (ps: any[]) => ps.map((p) => (p === null ? "partner" : firstName(p))).join(" & ");
  const mine = [...match.teamA, ...match.teamB].includes(meId || "");

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 4px" }}>
      {pair(left)}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontFamily: body, fontSize: 14, color: FEED_TEXT_HI, lineHeight: 1.35 }}
          title={`${left.map((p) => (p ? fullNameOf(p) : "partner")).join(" & ")} ${drew ? "drew with" : "beat"} ${right.map((p) => (p ? fullNameOf(p) : "partner")).join(" & ")}`}
        >
          <strong style={{ fontWeight: mine ? 700 : 600 }}>{names(left)}</strong>
          {drew ? " drew with " : " beat "}
          <strong style={{ fontWeight: 600 }}>{names(right)}</strong>
          {score && <span style={{ ...tabular, color: FEED_TEXT_MID }}>{" " + score}</span>}
        </div>
        <div style={{ fontFamily: body, fontSize: 11, color: FEED_TEXT_MID, marginTop: 2 }}>
          Doubles · {when}
        </div>
      </div>
      {pair(right)}
    </div>
  );
}
