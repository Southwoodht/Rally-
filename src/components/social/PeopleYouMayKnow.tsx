"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { friendsOf, listFriends, listIncomingRequests, listOutgoingRequests, sendFriendRequest } from "@/lib/friends";
import { peopleYouMayKnow, type FriendOfFriend, type SuggestionMatch, type SuggestionPlayer } from "@/core/social/suggestions";
import {
  FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body,
} from "@/lib/theme";

// People you may know — Sam, 27 Sep 2026: "a people you may know and u can
// see and add them? Dunno where we could put them".
//
// Two places, one component. On your own profile it is a sideways strip under
// your friends, the Facebook shape, with "See all" going to Friends. On the
// Friends screen it is a list, because that is where you went to add people.
//
// Who, and in what order, is decided in core/social/suggestions.ts: people
// you have played, then people with friends in common, then the rest of the
// league. This file gathers those lists and draws the answer.
//
// Friends of friends cost one call per friend, capped. There is no SQL for
// it: public_friends_of() already answers "who does this person know", and a
// new function would be a migration for Sam to run to learn nothing more.

/** Friends whose lists are read. Past this the extra calls find very little
 *  the first twenty-five had not. */
const FRIENDS_READ = 25;

const openProfile = (authId: string) => {
  if (typeof window !== "undefined") window.location.href = "/?profile=" + encodeURIComponent(authId);
};

export function PeopleYouMayKnow({
  meAuthId, mePlayerId, players, matches, leagueName, variant = "strip", limit, onSeeAll, flash,
}: {
  meAuthId: string | null | undefined;
  mePlayerId?: string | null;
  players: SuggestionPlayer[];
  matches: SuggestionMatch[];
  leagueName?: string;
  variant?: "strip" | "list";
  limit?: number;
  onSeeAll?: () => void;
  flash?: (msg: string) => void;
}) {
  const [known, setKnown] = useState<string[] | null>(null);
  const [fof, setFof] = useState<FriendOfFriend[]>([]);
  const [sent, setSent] = useState<Record<string, "sending" | "sent">>({});

  useEffect(() => {
    let alive = true;
    if (!meAuthId) return;
    (async () => {
      try {
        const [f, i, o] = await Promise.all([listFriends(), listIncomingRequests(), listOutgoingRequests()]);
        if (!alive) return;
        setKnown([...f, ...i, ...o].map((r) => r.profile.id));
        const lists = await Promise.all(
          f.slice(0, FRIENDS_READ).map((r) =>
            friendsOf(r.profile.id).then((xs) => xs.map((x) => ({ authId: x.authId, name: x.name, avatarUrl: x.avatarUrl, via: r.profile.id })))),
        );
        if (alive) setFof(lists.flat());
      } catch {
        // A failed read must not look like "you know everybody already" —
        // but nor should it suggest your own friends back to you, which is
        // what an empty known-list would do. So the card stays away.
        if (alive) setKnown(null);
      }
    })();
    return () => { alive = false; };
  }, [meAuthId]);

  const list = useMemo(() => {
    if (!meAuthId || known === null) return [];
    return peopleYouMayKnow({
      meAuthId, mePlayerId, players, matches, friendsOfFriends: fof, known, leagueName,
      limit: limit ?? (variant === "strip" ? 10 : 20),
    });
  }, [meAuthId, mePlayerId, players, matches, fof, known, leagueName, limit, variant]);

  if (!list.length) return null;

  const add = async (authId: string, name: string) => {
    setSent((s) => ({ ...s, [authId]: "sending" }));
    try {
      await sendFriendRequest(authId);
      setSent((s) => ({ ...s, [authId]: "sent" }));
      flash?.("Friend request sent to " + name);
    } catch {
      setSent((s) => { const n = { ...s }; delete n[authId]; return n; });
      flash?.("Couldn't send that request");
    }
  };

  const addButton = (authId: string, name: string, wide = false) => {
    const st = sent[authId];
    return (
      <button
        onClick={(e) => { e.stopPropagation(); if (!st) add(authId, name); }}
        disabled={!!st}
        style={{
          fontFamily: body, fontWeight: 600, fontSize: 13, border: "none", borderRadius: 10,
          padding: "7px 14px", cursor: st ? "default" : "pointer", whiteSpace: "nowrap",
          width: wide ? "100%" : undefined,
          background: st ? FEED_RAISED : FEED_LIME, color: st ? FEED_TEXT_MID : FEED_LIME_INK,
        }}
      >
        {st === "sent" ? "Requested" : st === "sending" ? "Sending…" : "Add friend"}
      </button>
    );
  };

  const title = (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
      <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, textTransform: "uppercase", letterSpacing: 0.8 }}>
        People you may know
      </span>
      {onSeeAll && (
        <button onClick={onSeeAll} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: body, fontSize: 13, color: FEED_LIME }}>
          See all ›
        </button>
      )}
    </div>
  );

  if (variant === "list") {
    return (
      <SurfaceCard radius={18} pad="14px" style={{ marginBottom: 20 }}>
        {title}
        {list.map((p, i) => (
          <div key={p.authId} onClick={() => openProfile(p.authId)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", cursor: "pointer", borderTop: i ? "0.5px solid " + FEED_RAISED : "none" }}>
            <Avatar player={{ id: p.authId, name: p.name, avatarUrl: p.avatarUrl }} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
              <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 2 }}>{p.reason}</div>
            </div>
            {addButton(p.authId, p.name)}
          </div>
        ))}
      </SurfaceCard>
    );
  }

  // The strip: cards side by side, scrolling sideways, so a dozen people cost
  // one card's height on a profile that is already long.
  return (
    <SurfaceCard radius={18} pad="14px 0 14px 14px" style={{ marginTop: 16 }}>
      <div style={{ paddingRight: 14 }}>{title}</div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingRight: 14, scrollbarWidth: "none" }}>
        {list.map((p) => (
          <div
            key={p.authId}
            onClick={() => openProfile(p.authId)}
            style={{ flex: "0 0 128px", background: FEED_RAISED, borderRadius: 14, padding: "14px 10px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", boxSizing: "border-box" }}
          >
            <Avatar player={{ id: p.authId, name: p.name, avatarUrl: p.avatarUrl }} size={52} />
            {/* Two lines for the name rather than an ellipsis: "Samuel Hen…"
                is the one part of the card you needed. */}
            <div style={{ fontFamily: body, fontWeight: 600, fontSize: 13.5, color: FEED_TEXT_HI, textAlign: "center", lineHeight: 1.25, width: "100%", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 34 }}>
              {p.name}
            </div>
            <div style={{ fontFamily: body, fontSize: 11.5, color: FEED_TEXT_MID, textAlign: "center", lineHeight: 1.25, minHeight: 29 }}>{p.reason}</div>
            {addButton(p.authId, p.name, true)}
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}
