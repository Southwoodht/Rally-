"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Search as SearchIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { listFriends } from "@/lib/friends";
import { currentUserId } from "@/lib/messages";
import { searchProfiles, type Profile } from "@/lib/profiles";
import {
  FEED_CARD, FEED_PAGE, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW,
  FEED_TEXT_MID, body, fontImport, tight,
} from "@/lib/theme";

const RECENTS_KEY = "rally.recentProfiles";
const MAX_RECENTS = 5;

interface Recent { id: string; name: string; avatar_url: string | null }

/** The last few profiles you opened, so an empty box isn't an empty screen. */
export function rememberProfile(p: Recent): void {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const list: Recent[] = raw ? JSON.parse(raw) : [];
    const next = [p, ...list.filter((x) => x.id !== p.id)].slice(0, MAX_RECENTS);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch { /* a convenience, never a requirement */ }
}

function readRecents(): Recent[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/**
 * Find anybody on Rally.
 *
 * Searches accounts, not league rows — which is the whole point, since the
 * complaint was that you cannot reach somebody you do not share a league
 * with. `searchProfiles` already did the querying (display name, plus an
 * exact friend code) and already avoided building a PostgREST filter string
 * out of raw user input; this adds the screen around it.
 *
 * Ordering is friends, then people you share a league with, then everyone
 * else. Alphabetical would be no order at all — the person you are looking
 * for is nearly always somebody you already know.
 */
export function PlayerSearch({ leagueAuthIds = [] }: { leagueAuthIds?: string[] }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Profile[] | null>(null);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [meId, setMeId] = useState<string | null>(null);
  const [recents, setRecents] = useState<Recent[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setRecents(readRecents());
    inputRef.current?.focus();
    let live = true;
    (async () => {
      try {
        const mine = await currentUserId();
        if (live) setMeId(mine);
        const fs = await listFriends();
        if (live) setFriendIds(new Set(fs.map((f) => f.profile.id)));
      } catch { /* search still works without knowing who your friends are */ }
    })();
    return () => { live = false; };
  }, []);

  // Debounced, because a query per keystroke is a query per keystroke.
  useEffect(() => {
    const term = q.trim();
    if (!term) { setRows(null); setSearching(false); return; }
    setSearching(true);
    let live = true;
    const t = setTimeout(async () => {
      try {
        const found = await searchProfiles(term, meId || undefined);
        if (live) setRows(found);
      } catch (e) {
        console.error("Search failed", e);
        if (live) setRows([]);
      } finally {
        if (live) setSearching(false);
      }
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [q, meId]);

  const ordered = useMemo(() => {
    if (!rows) return null;
    const league = new Set(leagueAuthIds);
    const rank = (p: Profile) => (friendIds.has(p.id) ? 0 : league.has(p.id) ? 1 : 2);
    return [...rows].sort((a, b) => rank(a) - rank(b) || (a.display_name || "").localeCompare(b.display_name || ""));
  }, [rows, friendIds, leagueAuthIds]);

  const open = (p: { id: string; display_name?: string; name?: string; avatar_url: string | null }) => {
    rememberProfile({ id: p.id, name: p.display_name || p.name || "Player", avatar_url: p.avatar_url });
    window.location.href = "/players/" + encodeURIComponent(p.id);
  };

  const row = (key: string, name: string, sub: string | null, avatarUrl: string | null, onClick: () => void) => (
    <button
      key={key}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56,
        background: FEED_CARD, border: "none", borderRadius: 14, padding: "9px 12px",
        marginBottom: 8, cursor: "pointer", textAlign: "left",
      }}
    >
      <Avatar player={{ id: key, name, avatarUrl }} size={38} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: body, fontWeight: 500, fontSize: 15.5, color: FEED_TEXT_HI, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
        {sub && (
          <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sub}
          </span>
        )}
      </span>
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: FEED_PAGE, paddingTop: "env(safe-area-inset-top)" }}>
      <style dangerouslySetInnerHTML={{ __html: fontImport }} />
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "8px 16px 48px" }}>
        <button
          onClick={() => window.history.back()}
          aria-label="Back"
          style={{ display: "flex", alignItems: "center", gap: 2, background: "transparent", border: "none", color: FEED_TEXT_MID, cursor: "pointer", padding: "10px 6px 10px 0", fontFamily: body, fontSize: 15 }}
        >
          <ChevronLeft size={22} strokeWidth={2.2} /> Back
        </button>

        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 26, color: FEED_TEXT_HI, ...tight(26), marginBottom: 14 }}>
          Find a player
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 9, background: FEED_RAISED, borderRadius: 14, padding: "0 13px", marginBottom: 16 }}>
          <SearchIcon size={17} color={FEED_TEXT_MID} strokeWidth={2} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or friend code"
            autoFocus
            style={{
              flex: 1, minWidth: 0, height: 46, background: "transparent", border: "none",
              color: FEED_TEXT_HI, fontFamily: body, fontWeight: 400, fontSize: 15.5, outline: "none",
            }}
          />
        </div>

        {!q.trim() && !!recents.length && (
          <>
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, marginBottom: 8 }}>Recently viewed</div>
            {recents.map((r) => row(r.id, r.name, null, r.avatar_url, () => open(r)))}
          </>
        )}

        {!!q.trim() && ordered && !ordered.length && !searching && (
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14.5, color: FEED_TEXT_MID, padding: "18px 2px", lineHeight: 1.5 }}>
            No one called &ldquo;{q.trim()}&rdquo;.
          </div>
        )}

        {ordered?.map((p) =>
          row(
            p.id,
            p.display_name || "Player",
            friendIds.has(p.id) ? "Friend" : leagueAuthIds.includes(p.id) ? "In your league" : null,
            p.avatar_url,
            () => open(p),
          )
        )}

        {searching && !ordered?.length && (
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_LOW, padding: "14px 2px" }}>Searching…</div>
        )}
      </div>
    </div>
  );
}
