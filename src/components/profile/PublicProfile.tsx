"use client";
import React, { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { GapInsight } from "@/components/profile/GapInsight";
import { MatchHistoryList, type MatchHistoryItem } from "@/components/profile/MatchHistoryList";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { RecordCard } from "@/components/profile/RecordCard";
import { RivalryCard } from "@/components/profile/RivalryCard";
import type { FormBarItem } from "@/components/profile/FormBars";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { getPublicPlayerCard, type PublicPlayerCard } from "@/lib/profiles";
import { acceptFriendRequest, getFriendshipWith, sendFriendRequest } from "@/lib/friends";
import { currentUserId } from "@/lib/messages";
import { supabase, withSupabaseTimeout } from "@/lib/supabase";
import { formatMatchDate } from "@/lib/format";
import {
  FEED_LIME, FEED_LIME_INK, FEED_PAGE, FEED_RAISED, FEED_TEXT_HI,
  FEED_TEXT_LOW, FEED_TEXT_MID, body, fontImport,
} from "@/lib/theme";

type FriendState = "none" | "requested" | "incoming" | "friends" | "unknown";

/**
 * Somebody else's profile, for people you share no league with.
 *
 * **It is built from the same components as your own profile**, and that is
 * the point of this file. An earlier version was styled from scratch and sat
 * next to the real thing looking like a different app — two designs for one
 * idea, which is exactly what §10 says not to do. So: ProfileHeader,
 * RecordCard, GapInsight and MatchHistoryList, fed from what a stranger is
 * allowed to read.
 *
 * What it cannot show, and does not fake:
 *
 * - **Rankings.** "5th of 23" is a claim about a league, and we share none.
 *   `rankings` is omitted rather than filled with a number that would have to
 *   be qualified into meaninglessness.
 * - **Opponent level on the form bars.** A bar's height encodes who they
 *   played, which needs level history this query does not carry. `height:
 *   null` is a real state FormBars already handles — a stub, which reads as
 *   "not participating" rather than "weak opponent".
 *
 * Everything else — record, form, win rate, streaks, head to head, history —
 * is derived from the match list, the same way the real profile derives it
 * from the league.
 */
export function PublicProfile({ id }: { id: string }) {
  const [authId, setAuthId] = useState<string | null>(null);
  const [card, setCard] = useState<PublicPlayerCard | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [friendState, setFriendState] = useState<FriendState>("unknown");
  const [friendRowId, setFriendRowId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unclaimed" | "missing" | "signedOut">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const mine = await currentUserId();
        // These routes sit outside AuthGate, which only wraps "/".
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

        if (mine !== resolved) {
          try {
            const f: any = await getFriendshipWith(resolved);
            if (!live) return;
            if (!f) setFriendState("none");
            else if (f.status === "accepted") { setFriendState("friends"); setFriendRowId(f.id); }
            else if (f.requester_id === mine) { setFriendState("requested"); setFriendRowId(f.id); }
            else { setFriendState("incoming"); setFriendRowId(f.id); }
          } catch { if (live) setFriendState("none"); }
        }
      } catch (e) {
        console.error("Couldn't load that profile", e);
        if (live) setState("missing");
      }
    })();
    return () => { live = false; };
  }, [id]);

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: FEED_PAGE, paddingTop: "env(safe-area-inset-top)" }}>
      <style dangerouslySetInnerHTML={{ __html: fontImport }} />
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "8px 16px calc(40px + env(safe-area-inset-bottom))" }}>
        <button
          onClick={() => window.history.back()}
          aria-label="Back"
          style={{ display: "flex", alignItems: "center", gap: 2, background: "transparent", border: "none", color: FEED_TEXT_MID, cursor: "pointer", padding: "10px 6px 10px 0", fontFamily: body, fontWeight: 400, fontSize: 15 }}
        >
          <ChevronLeft size={22} strokeWidth={2.2} /> Back
        </button>
        {children}
      </div>
    </div>
  );

  const note = (title: string, detail: string, cta?: boolean) => shell(
    <SurfaceCard radius={20} pad="22px 18px">
      <div style={{ fontFamily: body, fontWeight: 500, fontSize: 18, color: FEED_TEXT_HI }}>{title}</div>
      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, marginTop: 8, lineHeight: 1.5 }}>{detail}</div>
      {cta && (
        <a href="/" style={{ display: "block", textAlign: "center", background: FEED_LIME, color: FEED_LIME_INK, borderRadius: 16, padding: "12px 14px", marginTop: 16, textDecoration: "none", fontFamily: body, fontWeight: 500, fontSize: 15 }}>
          Go to Rally
        </a>
      )}
    </SurfaceCard>
  );

  if (state === "loading") return shell(<div style={{ fontFamily: body, color: FEED_TEXT_MID, padding: 30, textAlign: "center" }}>Loading…</div>);
  if (state === "signedOut") return note("Sign in to see profiles", "Rally profiles are for people with an account.", true);
  if (state === "unclaimed") return note("Not on Rally yet", "This player has a record in a league but no account, so there is no profile to open. Their results still count wherever they have played.");
  if (state === "missing" || !card) return note("No such player", "That profile does not exist, or it is not shared with you.");

  const isMe = !!meId && meId === authId;
  const s = card.stats;
  const asPlayer = { id: card.id, name: card.display_name || "Player", avatarUrl: card.avatar_url, avatar: null, level: card.stats?.level ?? null };
  const first = (card.display_name || "them").trim().split(/\s+/)[0];

  const recent = s?.recent ?? [];
  const outcomeOf = (m: { won: boolean | null }): "W" | "D" | "L" => (m.won == null ? "D" : m.won ? "W" : "L");

  const played = (s?.wins ?? 0) + (s?.draws ?? 0) + (s?.losses ?? 0);
  const winRate = played ? Math.round(((s?.wins ?? 0) / played) * 100) : 0;

  // recent is newest-first, so the current streak reads straight off the top.
  let currentStreak = 0;
  for (const m of recent) { if (outcomeOf(m) === "W") currentStreak++; else break; }
  let bestStreak = 0, run = 0;
  for (const m of recent) { if (outcomeOf(m) === "W") { run++; bestStreak = Math.max(bestStreak, run); } else run = 0; }

  const form: FormBarItem[] = recent.slice(0, 5).map((m) => ({
    outcome: outcomeOf(m),
    height: null,
    opponentName: m.opponent || "someone",
  }));

  const history: MatchHistoryItem[] = recent.map((m) => ({
    matchId: m.id,
    outcome: outcomeOf(m),
    opponent: m.opponent || "someone",
    date: formatMatchDate(m.date),
    score: m.score ?? null,
  }));

  const pill = (fill: string, ink: string): React.CSSProperties => ({
    flex: 1, minWidth: 0, background: fill, color: ink, border: "none", borderRadius: 16,
    padding: "12px 10px", cursor: busy ? "default" : "pointer", fontFamily: body,
    fontWeight: 500, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    textAlign: "center", textDecoration: "none", display: "block",
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

  // "23 · Seacourt · 9 years playing", assembled the way ProfileContainer
  // assembles it — from the first entry in their level history.
  const startedRaw: any = s?.levelHistory?.[0]?.from;
  const startYear = startedRaw == null ? null
    : typeof startedRaw === "number" ? startedRaw
    : parseInt(String(startedRaw).split("-")[0], 10);
  const years = startYear ? new Date().getFullYear() - startYear : null;
  const meta = [
    s?.age || null,
    s?.home || null,
    years && years > 0 ? years + (years === 1 ? " year playing" : " years playing") : null,
  ].filter(Boolean).join(" · ");

  /**
   * Who they play, from the match list.
   *
   * Computed here rather than with core/rivalries, which scores by closeness
   * and recency across a whole league and needs players and ratings this page
   * does not have. This is the plainer question — who have you played most —
   * and the card is the one the real profile already uses.
   */
  const rivalries = (() => {
    const by = new Map<string, { id: string | null; name: string; avatar: string | null; w: number; d: number; l: number; last: string; seq: Array<"W" | "D" | "L"> }>();
    for (const m of recent) {
      const key = m.opponentId || m.opponent;
      if (!key) continue;
      const o = outcomeOf(m);
      const cur = by.get(key) || { id: m.opponentId, name: m.opponent || "someone", avatar: m.opponentAvatar, w: 0, d: 0, l: 0, last: m.date, seq: [] as Array<"W" | "D" | "L"> };
      if (o === "W") cur.w++; else if (o === "D") cur.d++; else cur.l++;
      cur.seq.push(o);
      by.set(key, cur);
    }
    return [...by.values()]
      .filter((r) => r.w + r.d + r.l >= 2)
      .sort((a, b) => (b.w + b.d + b.l) - (a.w + a.d + a.l))
      .slice(0, 3);
  })();

  const h2h = s?.h2h;
  const full = card.display_name || first;
  const headline = h2h
    ? (h2h.w === h2h.l
        ? "You and " + first + " are level " + h2h.w + "–" + h2h.d + "–" + h2h.l + "."
        : h2h.w > h2h.l
          ? "You lead " + full + " " + h2h.w + "–" + h2h.d + "–" + h2h.l + "."
          : full + " leads you " + h2h.l + "–" + h2h.d + "–" + h2h.w + ".")
    : null;

  return shell(
    <>
      <ProfileHeader
        leagueName={s?.home || "Rally"}
        player={asPlayer}
        meta={meta || undefined}
        levelLabel={s?.level ? s.level.cat + " · " + s.level.sub : undefined}
        viewer="other"
      />

      {!isMe && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <a href={"/?challenge=" + encodeURIComponent(card.id)} style={pill(FEED_LIME, FEED_LIME_INK)}>Challenge</a>
          <a href={"/?message=" + encodeURIComponent(card.id)} style={pill(FEED_RAISED, FEED_TEXT_HI)}>Message</a>
          <button onClick={onFriend} disabled={busy || friendState === "friends" || friendState === "requested"} style={pill(FEED_RAISED, FEED_TEXT_HI)}>
            {friendLabel}
          </button>
        </div>
      )}

      {s ? (
        <>
          <RecordCard
            record={{ w: s.wins, d: s.draws, l: s.losses }}
            form={form}
            winRate={winRate}
            currentStreak={currentStreak}
            bestStreak={bestStreak}
          />

          {headline && (
            <div style={{ marginTop: 12 }}>
              <GapInsight headline={headline} advice={"Across " + (h2h!.w + h2h!.d + h2h!.l) + " meetings."} />
            </div>
          )}

          {!!rivalries.length && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, marginBottom: 10 }}>Rivalries</div>
              {rivalries.map((r) => (
                <div key={r.id || r.name} style={{ marginBottom: 8 }}>
                  <RivalryCard
                    me={asPlayer}
                    them={{ id: r.id || r.name, name: r.name, avatar: r.avatar }}
                    w={r.w} d={r.d} l={r.l}
                    recent={r.seq.slice(0, 5).reverse()}
                    total={r.w + r.d + r.l}
                    lastPlayed={formatMatchDate(r.last)}
                  />
                </div>
              ))}
            </div>
          )}

          {!!history.length && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, marginBottom: 10 }}>Recent matches</div>
              <MatchHistoryList items={history.slice(0, 10)} />
            </div>
          )}
        </>
      ) : (
        <SurfaceCard radius={20} pad="16px">
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
            Their record isn&apos;t showing. Everything else on this page works.
          </div>
          {card.statsProblem && (
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, marginTop: 8 }}>
              {card.statsProblem}
            </div>
          )}
        </SurfaceCard>
      )}
    </>
  );
}
