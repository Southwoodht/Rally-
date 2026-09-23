"use client";
import React, { useEffect, useState } from "react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { Avatar } from "@/components/ui/Avatar";
import { friendsOf, type PublicFriend } from "@/lib/friends";
import {
  FEED_LIME, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body,
} from "@/lib/theme";

// Who they know, and who you both know.
//
// Sam, 2026-09-23: "when on ur profile or looking at someone's u can see
// friends, mutual friends and click and go on their profile through there
// etc just like Facebook."
//
// Mutuals first and marked, because that is the part that means anything.
// "They have 14 friends" is a number; "you both know Charlie Easey" is a
// reason to message somebody, and on a club app it is usually the answer to
// "who is this person".
//
// NEEDS schema_public_friends.sql. The friends table can only be read by the
// two people in a friendship, so without that function this list is empty and
// the card does not render — not an error, not an empty state, just absent.
// A pending migration should cost a feature and never a screen.
//
// Only ACCEPTED friendships come back. A request nobody has answered stays
// between the two of them, which is the half that would actually embarrass
// someone.

const AVATAR = 40;
/** Enough to show the shape of somebody's circle without becoming a list. */
const SHOWN = 8;

export function FriendsCard({ authId, isMe, onOpenProfile }: {
  /** Whose profile this is. Their ACCOUNT id — a shell player has none. */
  authId?: string | null;
  isMe?: boolean;
  onOpenProfile?: (authId: string) => void;
}) {
  const [rows, setRows] = useState<PublicFriend[] | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!authId) { setRows([]); return; }
    setRows(null);
    friendsOf(authId)
      .then((r) => { if (alive) setRows(r); })
      // A failed read is not an empty circle. Both land as "no card", but the
      // distinction matters if this ever grows a "none yet" state.
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [authId]);

  // Nothing to say, or nothing to say it with. Either way the card is absent
  // rather than empty — a profile with a blank Friends panel reads as broken,
  // where a profile without one reads as a profile.
  if (!rows || !rows.length) return null;

  const mutual = rows.filter((r) => r.isMutual).length;
  const shown = all ? rows : rows.slice(0, SHOWN);

  return (
    <SurfaceCard radius={18} pad="14px" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, textTransform: "uppercase", letterSpacing: 0.8 }}>
          Friends
        </span>
        <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID }}>
          {/* The count of mutuals rather than of friends, on somebody else's
              profile — it is the number you opened the card for. On your own
              there is no such thing as a mutual, so it says the total. */}
          {isMe || !mutual ? rows.length + (rows.length === 1 ? " friend" : " friends")
            : mutual + (mutual === 1 ? " you both know" : " you both know")}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 12 }}>
        {shown.map((f) => (
          <button
            key={f.authId}
            onClick={onOpenProfile ? () => onOpenProfile(f.authId) : undefined}
            style={{
              background: "transparent", border: "none", padding: 0, minWidth: 0,
              cursor: onOpenProfile ? "pointer" : "default", textAlign: "center",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}
          >
            <Avatar player={{ id: f.authId, name: f.name, avatarUrl: f.avatarUrl }} size={AVATAR} />
            <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_HI, lineHeight: 1.25, width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {f.name}
            </span>
            {/* Marked rather than grouped. A separate "Mutual" section would
                split one person's circle into two lists and make you read
                both to answer "do I know anybody here". */}
            {!isMe && f.isMutual && (
              <span style={{ fontFamily: body, fontWeight: 400, fontSize: 10.5, color: FEED_LIME, lineHeight: 1 }}>
                you both know
              </span>
            )}
          </button>
        ))}
      </div>

      {rows.length > SHOWN && (
        <button
          onClick={() => setAll(!all)}
          style={{ background: "transparent", border: "none", padding: "12px 0 0", cursor: "pointer", fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_LIME, display: "block", textAlign: "left" }}
        >
          {all ? "Show fewer" : rows.length - SHOWN + " more"}
        </button>
      )}
    </SurfaceCard>
  );
}
