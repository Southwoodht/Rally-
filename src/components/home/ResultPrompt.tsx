"use client";
import React, { useState } from "react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { formatMatchDateTime } from "@/lib/format";
import {
  DOT_LOSS, FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_RAISED,
  FEED_TEXT_HI, FEED_TEXT_MID, body, tabular, tight,
} from "@/lib/theme";

export interface AwaitingResult {
  fixtureId: string;
  /** Their full name. */
  opponent: string;
  /** Their first name — the buttons say "You" and one short name, never two
   *  full names, which do not fit side by side on a phone. */
  opponentFirst: string;
  /** Which side of the fixture I am, so "You won" maps to the right one. */
  meIsP1: boolean;
  /** The booked time, unformatted. */
  when: any;
}

/**
 * "How did it go?"
 *
 * The booking loop never closed: you could arrange a match and the app would
 * never mention it again, so the arrangement and the result were two
 * unrelated chores. This is the second half — it appears once the match
 * should be over and asks, with the answer buttons on the card rather than
 * two screens away.
 *
 * It waits until the match is *finished* rather than until the day arrives,
 * because being asked how it went while you are still playing is worse than
 * not being asked at all.
 *
 * Rendered client-side from data already loaded, never pushed. Rally is a
 * PWA and iOS push is unreliable, so a notification that fires for some
 * people and not others is worse than a card everybody sees when they next
 * open the app.
 */
export function ResultPrompt({ items, onResolve, onCancel }: {
  items: AwaitingResult[];
  onResolve: (fixtureId: string, winner: "p1" | "p2" | "draw", score: string) => Promise<boolean> | void;
  onCancel?: (fixtureId: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.fixtureId ?? null);
  const [score, setScore] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!items.length) return null;

  const submit = async (it: AwaitingResult, winner: "p1" | "p2" | "draw") => {
    setSaving(true); setError(null);
    let ok = false;
    try {
      ok = (await onResolve(it.fixtureId, winner, score.trim())) !== false;
    } catch (e) {
      console.error("Saving a result from the Home prompt failed", e);
      ok = false;
    }
    setSaving(false);
    // A refused save keeps the score. The whole point of this card is that it
    // does not lose what you told it.
    if (ok) { setScore(""); setOpenId(null); }
    else setError("Couldn't save. Try again.");
  };

  const btn = (bg: string, fg: string) => ({
    flex: 1, minWidth: 0, background: bg, color: fg, border: "none", borderRadius: 14,
    padding: "11px 10px", cursor: "pointer", fontFamily: body, fontWeight: 500, fontSize: 14,
    whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis",
  });

  return (
    <div style={{ marginBottom: 12 }}>
      {items.map((it) => {
        const open = openId === it.fixtureId;
        return (
          <SurfaceCard key={it.fixtureId} radius={20} pad="16px 16px 14px" style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: body, fontWeight: 500, fontSize: 19, color: FEED_TEXT_HI, ...tight(19) }}>
              How did it go?
            </div>
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, marginTop: 4 }}>
              You v {it.opponent}
            </div>
            <div style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, marginTop: 2 }}>
              {formatMatchDateTime(it.when)}
            </div>

            {open ? (
              <div style={{ marginTop: 14 }}>
                <input
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="Score, e.g. 6-2, 6-3 (optional)"
                  style={{
                    ...tabular, width: "100%", boxSizing: "border-box", background: FEED_RAISED,
                    color: FEED_TEXT_HI, border: "none", borderRadius: 14, padding: "12px 13px",
                    fontFamily: body, fontSize: 15, marginBottom: 10, outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  {/* "You" and their first name. Two full names side by side
                      do not fit on a phone and truncate to "Samuel Hen…",
                      which is a worse label than no label. */}
                  <button disabled={saving} onClick={() => submit(it, it.meIsP1 ? "p1" : "p2")} style={btn(FEED_RAISED, FEED_TEXT_HI)}>You won</button>
                  <button disabled={saving} onClick={() => submit(it, "draw")} style={{ ...btn(FEED_RAISED, FEED_TEXT_MID), flex: "0 0 auto", padding: "11px 14px" }}>Draw</button>
                  <button disabled={saving} onClick={() => submit(it, it.meIsP1 ? "p2" : "p1")} style={btn(FEED_RAISED, FEED_TEXT_HI)}>{it.opponentFirst} won</button>
                </div>
                {error && (
                  <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: DOT_LOSS, marginTop: 10 }}>{error}</div>
                )}
                {onCancel && (
                  <button
                    onClick={() => onCancel(it.fixtureId)}
                    style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, background: "transparent", border: "none", padding: "12px 0 0", cursor: "pointer" }}
                  >
                    It didn&apos;t happen
                  </button>
                )}
              </div>
            ) : (
              <button onClick={() => { setOpenId(it.fixtureId); setError(null); }} style={{ ...btn(FEED_LIME, FEED_LIME_INK), width: "100%", marginTop: 14, flex: "none" }}>
                Add the result
              </button>
            )}
          </SurfaceCard>
        );
      })}
    </div>
  );
}
