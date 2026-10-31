"use client";
import React, { useEffect, useState } from "react";
import { Check, MessageSquare, MoreHorizontal, Share, UserPlus, UserX } from "lucide-react";
import { CrossedRackets } from "@/components/ui/CrossedRackets";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { acceptFriendRequest, getFriendshipWith, removeFriendship, sendFriendRequest, type FriendRow } from "@/lib/friends";
import {
  FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, body,
} from "@/lib/theme";

// Message them, and add them as a friend.
//
// Both of these existed on the old profile body and went with it when that
// file was deleted, which left no way to start a conversation with somebody
// except finding them in a list somewhere else. They are back at the top of
// the profile, where you are already looking at the person you want to talk
// to.
//
// Friendship is between accounts (auth ids), never league players, so none of
// this reads the league's player list. Somebody who has never claimed their
// profile has no account to befriend, and that is said out loud rather than
// silently rendering no button, which reads as a broken screen.

const btnBase: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  border: "none", borderRadius: 12, padding: "10px 14px", cursor: "pointer",
  fontFamily: body, fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0,
};

const filled: React.CSSProperties = { ...btnBase, background: FEED_LIME, color: FEED_LIME_INK, padding: "12px 14px", fontSize: 15 };
const outline: React.CSSProperties = { ...btnBase, background: "transparent", color: FEED_TEXT_HI, boxShadow: "inset 0 0 0 1.5px " + FEED_TEXT_HI, padding: "12px 14px", fontSize: 15 };
const dots: React.CSSProperties = { ...btnBase, flex: "0 0 auto", width: 46, padding: 0, background: "transparent", color: FEED_TEXT_HI, boxShadow: "inset 0 0 0 1.5px " + FEED_TEXT_HI };

/** The friend action, as one row of the ⋯ menu (Sam, 2026-10-31: Friends
 *  moved off the button row). Re-reads after every tap. */
function FriendMenuItem({ theirAuthId, myAuthId }: { theirAuthId: string; myAuthId: string }) {
  const [row, setRow] = useState<FriendRow | null | "loading">("loading");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setRow("loading");
    getFriendshipWith(theirAuthId).then(setRow).catch(() => setRow(null));
  };
  useEffect(load, [theirAuthId, myAuthId]);

  // Optimistic: the item shows what the tap will leave behind straight
  // away (`next`), then re-reads, which puts the truth back if it failed.
  const act = async (fn: () => Promise<unknown>, next: FriendRow | null) => {
    if (busy) return;
    setBusy(true); setRow(next);
    try { await fn(); } catch { /* the row re-reads either way */ }
    setBusy(false);
    getFriendshipWith(theirAuthId).then(setRow).catch(() => setRow(null));
  };
  const asked: FriendRow = { id: "tmp", status: "pending", requester_id: myAuthId, addressee_id: theirAuthId, created_at: new Date().toISOString() };

  if (row === "loading") return <div style={{ ...menuItem, color: FEED_TEXT_LOW, cursor: "default" }}>Friends…</div>;
  if (!row) return <button style={menuItem} disabled={busy} onClick={() => act(() => sendFriendRequest(theirAuthId), asked)}><UserPlus size={16} strokeWidth={2} />Add friend</button>;
  if (row.status === "accepted") return <button style={menuItem} disabled={busy} onClick={() => act(() => removeFriendship(row.id), null)}><UserX size={16} strokeWidth={2} />Remove friend</button>;
  if (row.requester_id === myAuthId) return <button style={menuItem} disabled={busy} onClick={() => act(() => removeFriendship(row.id), null)}><UserX size={16} strokeWidth={2} />Cancel friend request</button>;
  return <button style={menuItem} disabled={busy} onClick={() => act(() => acceptFriendRequest(row.id), { ...row, status: "accepted" })}><Check size={16} strokeWidth={2.4} />Accept friend request</button>;
}

const menuItem: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent", border: "none",
  padding: "12px 14px", cursor: "pointer", fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_TEXT_HI, textAlign: "left",
};

export interface ProfileActionsProps {
  /** Their account. Null when they have never claimed their profile. */
  theirAuthId?: string | null;
  myAuthId?: string | null;
  onMessage?: (authId: string) => void;
  /** Book a match against them: Fixtures, form open, them already chosen. */
  onChallenge?: () => void;
  /** "Share their card", in the ⋯ menu. */
  onShare?: () => void;
}

export function ProfileActions({ theirAuthId, myAuthId, onMessage, onChallenge, onShare }: ProfileActionsProps) {
  const [menu, setMenu] = useState(false);
  if (!myAuthId) return null;
  if (theirAuthId && theirAuthId === myAuthId) return null;

  // Challenge filled, Message outlined, everything else behind ⋯ (Sam,
  // 2026-10-31). Challenge is there for everybody in the club — somebody
  // without an account can still be booked; the result needs no agreement.
  // sw-filled keeps it filled on Southwood, whose stylesheet otherwise turns
  // every accent button into an outline.
  const hasMenu = !!theirAuthId || !!onShare;
  return (
    <>
      <div style={{ display: "flex", gap: 8, marginTop: 14, position: "relative" }}>
        {onChallenge && (
          <button className="sw-filled" style={filled} onClick={onChallenge}>
            <CrossedRackets size={16} />Challenge
          </button>
        )}
        {theirAuthId && onMessage && (
          <button style={outline} onClick={() => onMessage(theirAuthId)}>
            <MessageSquare size={15} strokeWidth={2} />Message
          </button>
        )}
        {hasMenu && (
          <button aria-label="More" aria-expanded={menu} style={dots} onClick={() => setMenu(!menu)}>
            <MoreHorizontal size={18} strokeWidth={2.2} />
          </button>
        )}
        {menu && (
          <>
            <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 61, minWidth: 220, background: FEED_CARD, borderRadius: 14, boxShadow: "0 8px 28px rgba(0,0,0,0.18)", overflow: "hidden" }}>
              {theirAuthId && <FriendMenuItem theirAuthId={theirAuthId} myAuthId={myAuthId} />}
              {onShare && <button style={{ ...menuItem, borderTop: theirAuthId ? "1px solid " + FEED_RAISED : "none" }} onClick={() => { setMenu(false); onShare(); }}><Share size={16} strokeWidth={2} />Share their card</button>}
            </div>
          </>
        )}
      </div>
      {!theirAuthId && (
        <SurfaceCard radius={16} style={{ marginTop: 12 }}>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_LOW, lineHeight: 1.5 }}>
            They haven&apos;t claimed their profile yet, so there is no account to
            message or add as a friend.
          </div>
        </SurfaceCard>
      )}
    </>
  );
}
