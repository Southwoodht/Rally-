"use client";
import React, { useEffect, useState } from "react";
import { Check, MessageSquare, UserPlus, UserX } from "lucide-react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { acceptFriendRequest, getFriendshipWith, removeFriendship, sendFriendRequest, type FriendRow } from "@/lib/friends";
import {
  FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body,
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
  fontFamily: body, fontWeight: 500, fontSize: 13.5, flex: 1, minWidth: 0,
};

const lime: React.CSSProperties = { ...btnBase, background: FEED_LIME, color: FEED_LIME_INK };
const quiet: React.CSSProperties = { ...btnBase, background: FEED_RAISED, color: FEED_TEXT_HI };

function FriendButton({ theirAuthId, myAuthId }: { theirAuthId: string; myAuthId: string }) {
  const [row, setRow] = useState<FriendRow | null | "loading">("loading");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setRow("loading");
    getFriendshipWith(theirAuthId).then(setRow).catch(() => setRow(null));
  };
  useEffect(load, [theirAuthId, myAuthId]);

  // Nothing rather than a flicker of the wrong state: "Add friend" appearing
  // for a moment on somebody you are already friends with is worse than a
  // gap that fills in.
  if (row === "loading") return null;

  const act = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch { /* the button re-reads either way */ }
    setBusy(false);
    load();
  };

  if (!row) {
    return (
      <button style={quiet} disabled={busy} onClick={() => act(() => sendFriendRequest(theirAuthId))}>
        <UserPlus size={15} strokeWidth={2} color={FEED_LIME} />Add friend
      </button>
    );
  }
  if (row.status === "accepted") {
    return (
      <button style={quiet} disabled={busy} onClick={() => act(() => removeFriendship(row.id))}>
        <Check size={15} strokeWidth={2.4} color={FEED_LIME} />Friends
      </button>
    );
  }
  if (row.requester_id === myAuthId) {
    return (
      <button style={{ ...quiet, color: FEED_TEXT_MID }} disabled={busy} onClick={() => act(() => removeFriendship(row.id))}>
        <UserX size={15} strokeWidth={2} />Request sent
      </button>
    );
  }
  return (
    <button style={lime} disabled={busy} onClick={() => act(() => acceptFriendRequest(row.id))}>
      <Check size={15} strokeWidth={2.4} />Accept request
    </button>
  );
}

export interface ProfileActionsProps {
  /** Their account. Null when they have never claimed their profile. */
  theirAuthId?: string | null;
  myAuthId?: string | null;
  onMessage?: (authId: string) => void;
}

export function ProfileActions({ theirAuthId, myAuthId, onMessage }: ProfileActionsProps) {
  if (!myAuthId) return null;

  if (!theirAuthId) {
    return (
      <SurfaceCard radius={16} style={{ marginTop: 12 }}>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_LOW, lineHeight: 1.5 }}>
          They haven&apos;t claimed their profile yet, so there is no account to
          message or add as a friend.
        </div>
      </SurfaceCard>
    );
  }
  if (theirAuthId === myAuthId) return null;

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      {onMessage && (
        <button style={lime} onClick={() => onMessage(theirAuthId)}>
          <MessageSquare size={15} strokeWidth={2} />Message
        </button>
      )}
      <FriendButton theirAuthId={theirAuthId} myAuthId={myAuthId} />
    </div>
  );
}
