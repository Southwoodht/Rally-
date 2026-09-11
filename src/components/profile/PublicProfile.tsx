"use client";
import React, { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { getPublicPlayerCard, type PublicPlayerCard } from "@/lib/profiles";
import {
  acceptFriendRequest, getFriendshipWith, listFriends, sendFriendRequest,
  type FriendWithProfile,
} from "@/lib/friends";
import { currentUserId } from "@/lib/messages";
import { supabase, withSupabaseTimeout } from "@/lib/supabase";
import { formatMatchDate } from "@/lib/format";
import {
  DOT_LOSS, DOT_WIN, FEED_LIME, FEED_LIME_INK, FEED_PAGE,
  FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, fontImport,
  tabular, tight,
} from "@/lib/theme";

type FriendState = "none" | "requested" | "incoming" | "friends" | "unknown";

/**
 * Somebody else's profile, readable by anyone signed in.
 *
 * The id arrives in two shapes and both have to work. An account id (the
 * uuid in `profiles`) comes from search and the friends list; a league
 * `players.id` comes from the table, a match card or the feed. Resolving
 * both means every existing tap target works without rewriting each one to
 * look up an account first.
 *
 * An unclaimed player has no account behind them, which is a real state this
 * screen says out loud rather than spinning on.
 */
export function PublicProfile({ id }: { id: string }) {
  const [authId, setAuthId] = useState<string | null>(null);
  const [card, setCard] = useState<PublicPlayerCard | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [friendState, setFriendState] = useState<FriendState>("unknown");
  const [friendRowId, setFriendRowId] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unclaimed" | "missing" | "signedOut">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const mine = await currentUserId();
        // These routes sit outside AuthGate, which only wraps "/". Without
        // this a signed-out visitor got the page — and whether that leaked
        // anything came down to whether the profiles table happens to be
        // readable by anon, which is not a thing to leave to chance.
        if (!mine) { if (live) setState("signedOut"); return; }
        if (live) setMeId(mine);

        let resolved: string | null = /^[0-9a-f-]{36}$/i.test(id) ? id : null;
        if (!resolved && supabase) {
          const res: any = await withSupabaseTimeout(
            supabase.from("players").select("auth_id").eq("id", id).maybeSingle(),
            { data: null, error: { message: "timed out" } } as any,
          );
          if (res?.error) { if (live) setState("missing"); return; }
          resolved = res?.data?.auth_id ?? null;
          if (!resolved) { if (live) setState("unclaimed"); return; }
        }
        if (!resolved) { if (live) setState("missing"); return; }
        if (live) setAuthId(resolved);

        const c = await getPublicPlayerCard(resolved);
        if (!live) return;
        if (!c) { setState("missing"); return; }
        setCard(c);
        setState("ready");

        if (mine && mine !== resolved) {
          try {
            const f: any = await getFriendshipWith(resolved);
            if (!live) return;
            if (!f) setFriendState("none");
            else if (f.status === "accepted") { setFriendState("friends"); setFriendRowId(f.id); }
            else if (f.requester_id === mine) { setFriendState("requested"); setFriendRowId(f.id); }
            else { setFriendState("incoming"); setFriendRowId(f.id); }
          } catch { if (live) setFriendState("none"); }
        }

        // A profile without its friends list is still a profile.
        try { const list = await listFriends(); if (live) setFriends(list); } catch { /* ignore */ }
      } catch (e) {
        console.error("Couldn't load that profile", e);
        if (live) setState("missing");
      }
    })();
    return () => { live = false; };
  }, [id]);

  const back = () => { if (typeof window !== "undefined") window.history.back(); };

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: FEED_PAGE, paddingTop: "env(safe-area-inset-top)" }}>
      <style dangerouslySetInnerHTML={{ __html: fontImport }} />
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "8px 16px 48px" }}>
        <button
          onClick={back}
          aria-label="Back"
          style={{ display: "flex", alignItems: "center", gap: 2, background: "transparent", border: "none", color: FEED_TEXT_MID, cursor: "pointer", padding: "10px 6px 10px 0", fontFamily: body, fontSize: 15 }}
        >
          <ChevronLeft size={22} strokeWidth={2.2} /> Back
        </button>
        {children}
      </div>
    </div>
  );

  if (state === "loading") {
    return shell(<div style={{ fontFamily: body, color: FEED_TEXT_MID, padding: 30, textAlign: "center" }}>Loading…</div>);
  }

  if (state === "signedOut") {
    return shell(
      <SurfaceCard radius={20} pad="22px 18px">
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 18, color: FEED_TEXT_HI }}>Sign in to see profiles</div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, marginTop: 8, lineHeight: 1.5 }}>
          Rally profiles are for people with an account.
        </div>
        <a href="/" style={{ display: "block", textAlign: "center", background: FEED_LIME, color: FEED_LIME_INK, borderRadius: 16, padding: "12px 14px", marginTop: 16, textDecoration: "none", fontFamily: body, fontWeight: 500, fontSize: 15 }}>
          Go to Rally
        </a>
      </SurfaceCard>
    );
  }

  if (state === "unclaimed") {
    return shell(
      <SurfaceCard radius={20} pad="22px 18px">
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 18, color: FEED_TEXT_HI }}>Not on Rally yet</div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, marginTop: 8, lineHeight: 1.5 }}>
          This player has a record in a league but no account, so there is no
          profile to open. Their results still count wherever they have played.
        </div>
      </SurfaceCard>
    );
  }

  if (state === "missing" || !card) {
    return shell(
      <SurfaceCard radius={20} pad="22px 18px">
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 18, color: FEED_TEXT_HI }}>No such player</div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, marginTop: 8 }}>
          That profile does not exist, or it is not shared with you.
        </div>
      </SurfaceCard>
    );
  }

  const isMe = !!meId && meId === authId;
  const s = card.stats;
  const asPlayer = { id: card.id, name: card.display_name || "Player", avatarUrl: card.avatar_url, avatar: null };

  const pill = (fill: string, ink: string): React.CSSProperties => ({
    flex: 1, minWidth: 0, background: fill, color: ink, border: "none", borderRadius: 16,
    padding: "12px 10px", cursor: busy ? "default" : "pointer", fontFamily: body,
    fontWeight: 500, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  });

  const friendLabel = friendState === "friends" ? "Friends"
    : friendState === "requested" ? "Requested"
    : friendState === "incoming" ? "Accept" : "Add friend";

  const onFriend = async () => {
    if (!authId || busy) return;
    setBusy(true);
    try {
      if (friendState === "none") { await sendFriendRequest(authId); setFriendState("requested"); }
      else if (friendState === "incoming" && friendRowId) { await acceptFriendRequest(friendRowId); setFriendState("friends"); }
    } catch (e) {
      console.error("Friend action failed", e);
    } finally {
      setBusy(false);
    }
  };

  const level = s?.level ? s.level.cat + " · " + s.level.sub : null;
  const subtitle = [level, s?.home].filter(Boolean).join(" · ");

  return shell(
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "6px 2px 16px" }}>
        <Avatar player={asPlayer} size={84} enlargeable />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 25, color: FEED_TEXT_HI, ...tight(25), overflow: "hidden", textOverflow: "ellipsis" }}>
            {card.display_name || "Player"}
          </div>
          {s?.nick && (
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, marginTop: 2 }}>
              &ldquo;{s.nick}&rdquo;
            </div>
          )}
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_TEXT_MID, marginTop: 4 }}>
            {subtitle || "No level set"}
          </div>
        </div>
      </div>

      {/* Your own profile belongs on your own tab, where it is editable. */}
      {isMe ? (
        <a href="/" style={{ ...pill(FEED_RAISED, FEED_TEXT_HI), display: "block", textAlign: "center", textDecoration: "none", marginBottom: 14 }}>
          This is you — open your profile
        </a>
      ) : (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <a href={"/?challenge=" + encodeURIComponent(card.id)} style={{ ...pill(FEED_LIME, FEED_LIME_INK), display: "block", textAlign: "center", textDecoration: "none" }}>
            Challenge
          </a>
          <a href={"/?message=" + encodeURIComponent(card.id)} style={{ ...pill(FEED_RAISED, FEED_TEXT_HI), display: "block", textAlign: "center", textDecoration: "none" }}>
            Message
          </a>
          <button
            onClick={onFriend}
            disabled={busy || friendState === "friends" || friendState === "requested"}
            style={pill(FEED_RAISED, FEED_TEXT_HI)}
          >
            {friendLabel}
          </button>
        </div>
      )}

      {/* The record. Absent until public_player_card() is installed, and the
          screen says which of those it is rather than showing 0-0-0, which
          would be a claim about somebody rather than an admission. */}
      {s ? (
        <SurfaceCard radius={20} pad="16px" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 18 }}>
            {([["Won", s.wins], ["Drawn", s.draws], ["Lost", s.losses]] as Array<[string, number]>).map(([label, n]) => (
              <div key={label}>
                <div style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 26, color: FEED_TEXT_HI }}>{n}</div>
                <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID }}>{label}</div>
              </div>
            ))}
            {!!s.form.length && (
              <div style={{ marginLeft: "auto", alignSelf: "center", display: "flex", gap: 4 }}>
                {s.form.map((r, i) => (
                  <span key={i} style={{ width: 7, height: 7, borderRadius: 4, background: r === "W" ? DOT_WIN : r === "D" ? FEED_TEXT_LOW : DOT_LOSS }} />
                ))}
              </div>
            )}
          </div>
        </SurfaceCard>
      ) : (
        <SurfaceCard radius={20} pad="16px" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
            Their record isn&apos;t showing. Everything else on this page works.
          </div>
          {card.statsProblem && (
            <div style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, marginTop: 8 }}>
              {card.statsProblem}
            </div>
          )}
        </SurfaceCard>
      )}

      {/* You against them. Only when you have actually played — a 0-0-0
          head to head is not a fact about a rivalry, it is the absence of
          one, and printing it invents a history. */}
      {s?.h2h && (
        <SurfaceCard radius={20} pad="16px" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, marginBottom: 10 }}>
            You v {(card.display_name || "them").trim().split(/s+/)[0]}
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {([["Won", s.h2h.w], ["Drawn", s.h2h.d], ["Lost", s.h2h.l]] as Array<[string, number]>).map(([label, n]) => (
              <div key={label}>
                <div style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 24, color: label === "Won" ? FEED_LIME : FEED_TEXT_HI }}>{n}</div>
                <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID }}>{label}</div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      {!!s?.recent?.length && (
        <SurfaceCard radius={20} pad="16px" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, marginBottom: 10 }}>Recent matches</div>
          {s.recent.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, flexShrink: 0, background: m.won == null ? FEED_TEXT_LOW : m.won ? DOT_WIN : DOT_LOSS }} />
              <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_HI, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.won == null ? "Drew with " : m.won ? "Beat " : "Lost to "}{m.opponent || "someone"}
              </span>
              {m.score && <span style={{ ...tabular, fontFamily: body, fontSize: 13, color: FEED_TEXT_MID }}>{m.score}</span>}
              <span style={{ ...tabular, fontFamily: body, fontSize: 12.5, color: FEED_TEXT_LOW, flexShrink: 0 }}>{formatMatchDate(m.date)}</span>
            </div>
          ))}
        </SurfaceCard>
      )}

      {!!friends.length && (
        <SurfaceCard radius={20} pad="16px">
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, marginBottom: 12 }}>Friends</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {friends.slice(0, 8).map((f) => (
              <a key={f.id} href={"/players/" + f.profile.id} style={{ textDecoration: "none", textAlign: "center", width: 58 }}>
                <Avatar player={{ id: f.profile.id, name: f.profile.display_name, avatarUrl: f.profile.avatar_url }} size={44} />
                <div style={{ fontFamily: body, fontWeight: 400, fontSize: 11.5, color: FEED_TEXT_MID, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(f.profile.display_name || "").split(/\s+/)[0]}
                </div>
              </a>
            ))}
          </div>
        </SurfaceCard>
      )}
    </>
  );
}
