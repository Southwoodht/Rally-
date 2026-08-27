"use client";
import React, { useEffect, useState } from "react";
import { RecordBody } from "@/components/profile/RecordBody";
import { Avatar } from "@/components/ui/Avatar";
import { Empty } from "@/components/ui/atoms";
import { FriendWithProfile, listFriends } from "@/lib/friends";
import { BALL, CHALK, MUTED, PANEL, card, body } from "@/lib/theme";

function FriendsSummary({ myAuthId, goFriends }: any) {
  const [friends, setFriends] = useState<FriendWithProfile[] | null>(null);
  useEffect(() => {
    if (!myAuthId) { setFriends([]); return; }
    listFriends().then(setFriends).catch(() => setFriends([]));
  }, [myAuthId]);
  if (!myAuthId) return null;
  return (
    <button onClick={goFriends} style={{ ...card, marginTop: 4, marginBottom: 14, width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex" }}>
        {(friends || []).slice(0, 4).map((f, i) => (
          <div key={f.id} style={{ marginLeft: i ? -10 : 0, border: "2px solid " + PANEL, borderRadius: "50%" }}>
            <Avatar player={{ id: f.profile.id, name: f.profile.display_name, avatarUrl: f.profile.avatar_url, avatar: null }} size={32} />
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: body, fontWeight: 700, fontSize: 15, color: CHALK }}>Friends</div>
        <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED }}>{friends === null ? "Loading…" : friends.length === 0 ? "Find people to add" : `${friends.length} friend${friends.length === 1 ? "" : "s"}`}</div>
      </div>
      <span style={{ color: BALL, fontFamily: body, fontWeight: 600, fontSize: 13 }}>See all ›</span>
    </button>
  );
}

export function ProfileScreen({ players, meId, shared, onSetMe, goH2H, goSettings, goEdit, goFriends }: any) {
  const me = players.find((p) => p.id === meId);
  return (
    <div>
      <FriendsSummary myAuthId={shared?.myAuthId} goFriends={goFriends} />
      <div style={{ ...card, marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: MUTED }}>Your linked player</span>
          <span style={{ fontFamily: body, fontSize: 13, color: MUTED }}>{me ? me.name + (me.last ? " " + me.last : "") : "No linked profile"}</span>
        </div>
        <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginBottom: 12 }}>Your account stays tied to one player profile. Historical players remain unclaimed until they sign in and confirm their identity.</div>
        {me ? <RecordBody player={me} {...shared} /> : <Empty msg="Add players in Settings first." />}
      </div>
    </div>
  );
}
