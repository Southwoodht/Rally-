"use client";
import React, { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { acceptFriendRequest, FriendWithProfile, listFriends, listIncomingRequests, listOutgoingRequests, removeFriendship, sendFriendRequest } from "@/lib/friends";
import { getMyProfile, Profile, searchProfiles } from "@/lib/profiles";
import { BALL, CHALK, CLAY, COURT, MUTED, PANEL2, body, listCard, listRow, miniInput, mono } from "@/lib/theme";

const asPlayer = (p: Profile) => ({ id: p.id, name: p.display_name, avatarUrl: p.avatar_url, avatar: null });

export function Friends({ leagueJoinCode, onBack, flash }: any) {
  const [me, setMe] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [incoming, setIncoming] = useState<FriendWithProfile[]>([]);
  const [outgoing, setOutgoing] = useState<FriendWithProfile[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const [m, f, i, o] = await Promise.all([getMyProfile(), listFriends(), listIncomingRequests(), listOutgoingRequests()]);
      setMe(m); setFriends(f); setIncoming(i); setOutgoing(o);
    } catch (e) {
      console.error(e);
      flash && flash("Couldn't load friends");
    }
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const doSearch = async () => {
    const term = q.trim();
    if (!term) { setResults(null); return; }
    setSearching(true);
    try {
      const r = await searchProfiles(term, me?.id);
      setResults(r);
    } catch (e) {
      console.error(e);
      flash && flash("Search failed");
    }
    setSearching(false);
  };

  const statusFor = (id: string) => {
    if (friends.some((f) => f.profile.id === id)) return "friends";
    if (outgoing.some((f) => f.profile.id === id)) return "sent";
    if (incoming.some((f) => f.profile.id === id)) return "incoming";
    return "none";
  };

  const add = async (id: string) => {
    try { await sendFriendRequest(id); flash && flash("Friend request sent"); await reload(); }
    catch (e) { console.error(e); flash && flash("Couldn't send request"); }
  };
  const accept = async (row: FriendWithProfile) => {
    try { await acceptFriendRequest(row.id); flash && flash(row.profile.display_name + " is now a friend"); await reload(); }
    catch (e) { console.error(e); flash && flash("Couldn't accept"); }
  };
  const remove = async (row: FriendWithProfile) => {
    try { await removeFriendship(row.id); await reload(); }
    catch (e) { console.error(e); flash && flash("Couldn't remove"); }
  };
  const inviteToLeague = async (row: FriendWithProfile) => {
    if (!leagueJoinCode) { flash && flash("No league code available"); return; }
    try {
      await navigator.clipboard.writeText(leagueJoinCode);
      flash && flash(`League code copied — send it to ${row.profile.display_name}`);
    } catch {
      flash && flash(`League code: ${leagueJoinCode}`);
    }
  };

  const actionBtn = (label: string, onClick: () => void, color = BALL, textColor = COURT) => (
    <button onClick={onClick} style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: textColor, background: color, border: "none", borderRadius: 8, padding: "6px 11px", cursor: "pointer", whiteSpace: "nowrap" as const }}>{label}</button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder="Search by name or friend code…"
          style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }}
        />
        <button onClick={doSearch} style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: COURT, background: BALL, border: "none", borderRadius: 10, padding: "9px 16px", cursor: "pointer" }}>{searching ? "…" : "Search"}</button>
      </div>

      {me && (
        <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, marginBottom: 20 }}>
          Your friend code: <span style={{ fontFamily: mono, color: CHALK, fontWeight: 700 }}>{me.friend_code}</span> — share it so people can add you directly.
        </div>
      )}

      {results !== null && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: BALL, marginBottom: 8 }}>Results</div>
          {results.length === 0 ? (
            <div style={{ fontFamily: body, fontSize: 13, color: MUTED, padding: "8px 0" }}>No players match that.</div>
          ) : (
            <div style={listCard}>
              {results.map((p) => {
                const st = statusFor(p.id);
                return (
                  <div key={p.id} style={listRow}>
                    <Avatar player={asPlayer(p)} size={36} />
                    <span style={{ flex: 1, fontFamily: body, fontSize: 15, fontWeight: 600, color: CHALK }}>{p.display_name}</span>
                    {st === "friends" && <span style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: MUTED }}>Friends</span>}
                    {st === "sent" && <span style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: MUTED }}>Requested</span>}
                    {st === "incoming" && <span style={{ fontFamily: body, fontWeight: 600, fontSize: 12, color: BALL }}>Wants to add you</span>}
                    {st === "none" && actionBtn("Add friend", () => add(p.id))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {incoming.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: BALL, marginBottom: 8 }}>Friend requests</div>
          <div style={listCard}>
            {incoming.map((row) => (
              <div key={row.id} style={listRow}>
                <Avatar player={asPlayer(row.profile)} size={36} />
                <span style={{ flex: 1, fontFamily: body, fontSize: 15, fontWeight: 600, color: CHALK }}>{row.profile.display_name}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {actionBtn("Accept", () => accept(row))}
                  {actionBtn("Decline", () => remove(row), "transparent", MUTED)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: MUTED, marginBottom: 8 }}>
          Friends{friends.length ? ` (${friends.length})` : ""}
        </div>
        {loading ? (
          <div style={{ fontFamily: body, fontSize: 13, color: MUTED, padding: "8px 0" }}>Loading…</div>
        ) : friends.length === 0 ? (
          <div style={{ fontFamily: body, fontSize: 13, color: MUTED, padding: "8px 0" }}>No friends yet — search above to find people.</div>
        ) : (
          <div style={listCard}>
            {friends.map((row) => (
              <div key={row.id} style={listRow}>
                <Avatar player={asPlayer(row.profile)} size={36} />
                <span style={{ flex: 1, fontFamily: body, fontSize: 15, fontWeight: 600, color: CHALK }}>{row.profile.display_name}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {leagueJoinCode && actionBtn("Invite to league", () => inviteToLeague(row), PANEL2, CHALK)}
                  {actionBtn("Remove", () => remove(row), "transparent", CLAY)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Friends;
