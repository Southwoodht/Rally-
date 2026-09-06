"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ClaimTrophyForm } from "@/components/profile/ClaimTrophyForm";
import { ProfileView } from "@/components/profile/ProfileView";
import type { Achievement, AchievementIcon } from "@/components/profile/Achievements";
import { computeAchievements } from "@/core/achievements";
import { levelAt } from "@/core/levels";
import { buildMatchQuality, shareSentence } from "@/core/matchQuality";
import { rankMaps } from "@/core/rank";
import { topRivalries } from "@/core/rivalries";
import { TIER_HEIGHTS } from "@/core/stars";
import { listApprovedTrophiesForPlayer } from "@/lib/trophies";
import { fullNameOf } from "@/lib/format";

// Everything the profile needs, worked out from the league it belongs to.
//
// The view below this is presentational and stays that way: it receives
// finished numbers and renders them. All the counting lives here, and all
// the ranking maths it uses lives in core/.

const ICON_FOR: Record<string, AchievementIcon> = {
  first_win: "firstWin",
  wins_10: "medal", wins_25: "medal", wins_50: "runnerUp",
  matches_100: "matches",
  streak_3: "streak", streak_5: "streak", streak_10: "streak",
  first_draw: "fairPlay",
};

const ordinal = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return n + "th";
  return n + (["th", "st", "nd", "rd"][n % 10] || "th");
};

const shortDate = (ts: number) => {
  const d = new Date(ts);
  return d.getDate() + " " + d.toLocaleString("en-GB", { month: "short" });
};

export function ProfileContainer({
  player, players, matches, elo, wdl, form, deltas, ratingBefore, meId, group, groups,
  viewer = "self", onOpen, onOpenMatch, onProposeEdit, onSettings, onPickLeague,
  onFriends, onLinkedPlayer, onClaimTrophy, onAllHistory, onAllOpponents, onStyleDetails,
}: any) {
  const pid = player?.id;
  const isSelf = viewer === "self";
  const [trophies, setTrophies] = useState<any[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [reloadTrophies, setReloadTrophies] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!pid) return;
    listApprovedTrophiesForPlayer(pid, player?.auth_id)
      .then((t) => { if (alive) setTrophies(t); })
      // Trophies nobody could fetch are not "no trophies", but the row has
      // nowhere to say "couldn't load". Left empty, which at least offers the
      // claim link rather than asserting a number that might be wrong.
      .catch(() => {});
    return () => { alive = false; };
  }, [pid, player?.auth_id, reloadTrophies]);

  const data = useMemo(() => {
    if (!pid) return null;
    const byId: Record<string, any> = {};
    (players || []).forEach((p: any) => { byId[p.id] = p; });
    const r = wdl?.[pid] || { w: 0, d: 0, l: 0, gp: 0 };

    const mine = (matches || [])
      .filter((m: any) => m.p1 === pid || m.p2 === pid)
      .sort((a: any, b: any) => a.date - b.date);
    const played = mine.filter((m: any) => m.status !== "pending");
    const outcome = (m: any): "W" | "D" | "L" =>
      m.winner === "draw" ? "D" : ((m.winner === "p1" ? m.p1 : m.p2) === pid ? "W" : "L");

    let currentStreak = 0;
    for (let i = played.length - 1; i >= 0; i--) { if (outcome(played[i]) === "W") currentStreak++; else break; }
    let bestStreak = 0, run = 0;
    for (const m of played) { if (outcome(m) === "W") { run++; bestStreak = Math.max(bestStreak, run); } else run = 0; }

    // Height is the opponent's level as recorded on the day. Never today's —
    // see core/levels.ts levelAt for why that distinction is the
    // whole point of the bars.
    const formBars = played.slice(-5).map((m: any) => {
      const o = byId[m.p1 === pid ? m.p2 : m.p1];
      const lv = levelAt(o, m.date);
      return {
        outcome: outcome(m),
        height: lv?.cat ? (TIER_HEIGHTS[lv.cat] ?? null) : null,
        opponentName: fullNameOf(o),
        levelLabel: lv?.cat ? lv.cat + " · " + lv.sub : undefined,
      };
    });

    const ranks = rankMaps(players, matches, elo, wdl);
    const field = Object.keys(ranks.off).length;
    const rankings = [
      { label: group?.name || "League", value: ranks.off[pid] ? ordinal(ranks.off[pid]) + " of " + field : "unranked", emphasis: true },
      { label: "Elo", value: ranks.el[pid] ? ordinal(ranks.el[pid]) + " of " + field : "unranked" },
      { label: "Record", value: ranks.rec[pid] ? ordinal(ranks.rec[pid]) + " of " + field : "unranked" },
    ];

    // Head-to-head totals against everyone they have faced.
    const h: Record<string, { w: number; d: number; l: number }> = {};
    for (const m of played) {
      const opp = m.p1 === pid ? m.p2 : m.p1;
      const x = (h[opp] = h[opp] || { w: 0, d: 0, l: 0 });
      const o = outcome(m);
      if (o === "W") x.w++; else if (o === "D") x.d++; else x.l++;
    }
    const oppRec = (id: string) => ({
      player: byId[id], w: h[id].w, d: h[id].d, l: h[id].l,
      levelLabel: byId[id]?.level?.cat || undefined,
    });
    const lead = Object.keys(h).filter((o) => byId[o] && h[o].w > h[o].l).map(oppRec);
    const behind = Object.keys(h).filter((o) => byId[o] && h[o].l > h[o].w).map(oppRec);

    const rivalries = topRivalries(pid, matches || [], 3)
      .filter((v: any) => byId[v.oid])
      .map((v: any) => ({
        me: player, them: byId[v.oid],
        w: v.w, d: v.d, l: v.l, recent: v.recent, total: v.total,
        lastPlayed: shortDate(v.lastMeeting),
        onOpen,
      }));

    const bestWins = played
      .filter((m: any) => outcome(m) === "W")
      .map((m: any) => {
        const oid = m.p1 === pid ? m.p2 : m.p1;
        const lv = levelAt(byId[oid], m.date);
        return {
          matchId: m.id,
          opponent: byId[oid],
          rating: (ratingBefore?.[m.id] || {})[oid] ?? 0,
          subtitle: (lv?.cat || "Level not recorded") + " · " + new Date(m.date).getFullYear(),
        };
      })
      .filter((w: any) => w.opponent)
      .sort((a: any, b: any) => b.rating - a.rating)
      .slice(0, 3)
      .map(({ matchId, opponent, subtitle }: any) => ({ matchId, opponent, subtitle }));

    // The gap to whoever is directly above, which is the only rank change
    // within reach. A gap to the leader is a fact; a gap to the person one
    // place up is a target.
    const officialOrder = (players || [])
      .filter((p: any) => wdl?.[p.id]?.gp > 0 && !p.inactive)
      .sort((a: any, b: any) => (ranks.off[a.id] ?? 1e9) - (ranks.off[b.id] ?? 1e9));
    const myIdx = officialOrder.findIndex((p: any) => p.id === pid);
    const above = myIdx > 0 ? officialOrder[myIdx - 1] : null;

    let gap: { headline: string; advice: string } | null = null;
    if (isSelf && above) {
      const places = (ranks.off[pid] ?? 0) - (ranks.off[above.id] ?? 0);
      gap = {
        headline: places === 1
          ? "One place behind " + fullNameOf(above) + "."
          : places + " places behind " + fullNameOf(above) + ".",
        advice: "Beating higher-level players is the fastest way to close it.",
      };
    } else if (!isSelf && meId) {
      // Somebody else's profile answers the question you actually have about
      // them, which is how you do against them — not how far they are from
      // the player above them, which is their business.
      //
      // Read from the VIEWER's book, not the owner's. `h` above is this
      // profile's own record, so h[meId] is what they have done to you — and
      // reading that as yours printed every head-to-head backwards: two
      // losses to Zaach came out as "You lead Zaach 2–0". It is the same
      // function the matches screen uses, so the orientation is fixed in one
      // tested place rather than flipped by hand here.
      const versus = buildMatchQuality(meId, players, matches).opponents
        .find((o: any) => o.player?.id === pid);
      const x = versus?.record;
      if (x && x.w + x.d + x.l > 0) {
        const meetings = x.w + x.d + x.l;
        gap = {
          headline: x.w === x.l ? "You are level with " + fullNameOf(player) + ", " + x.w + "–" + x.d + "–" + x.l + "."
            : x.w > x.l ? "You lead " + fullNameOf(player) + " " + x.w + "–" + x.d + "–" + x.l + "."
            : fullNameOf(player) + " leads you " + x.l + "–" + x.d + "–" + x.w + ".",
          advice: "Across " + meetings + (meetings === 1 ? " meeting." : " meetings."),
        };
      }
    }

    const wins = r.w;
    const gp = played.length;
    const toGo = (target: number, have: number) => Math.max(0, target - have) + " to go";
    const achievements: Achievement[] = computeAchievements(pid, matches || []).map((a: any) => {
      const n = parseInt((a.id.match(/\d+/) || ["0"])[0], 10);
      const progress = a.id.startsWith("wins_") ? toGo(n, wins)
        : a.id === "matches_100" ? toGo(100, gp)
        : a.id.startsWith("streak_") ? toGo(n, bestStreak)
        : "not yet";
      return {
        id: a.id,
        icon: ICON_FOR[a.id] || "medal",
        label: a.label,
        earned: a.achieved,
        year: a.date ? String(new Date(a.date).getFullYear()) : undefined,
        progress,
      };
    });

    const history = [...mine].reverse().map((m: any) => {
      const o = byId[m.p1 === pid ? m.p2 : m.p1];
      const d = deltas?.[m.id];
      const pending = m.status === "pending";
      return {
        matchId: m.id,
        outcome: outcome(m),
        opponent: fullNameOf(o),
        opponentId: o?.id,
        onOpenPlayer: onOpen,
        date: shortDate(m.date),
        score: m.score || null,
        delta: pending || !d ? null : Math.round(d[pid] * 10) / 10,
        pending,
        onOpen: onOpenMatch ? () => onOpenMatch(m.id) : undefined,
        onEdit: pending && onProposeEdit ? () => onOpenMatch && onOpenMatch(m.id) : undefined,
      };
    });

    const started = player?.levelHistory?.[0]?.from;
    const startYear = started == null ? null : typeof started === "number" ? started : parseInt(String(started).split("-")[0], 10);
    const years = startYear ? new Date().getFullYear() - startYear : null;
    const meta = [
      player?.age || null,
      group?.name || null,
      years && years > 0 ? years + (years === 1 ? " year playing" : " years playing") : null,
    ].filter(Boolean).join(" · ");

    // The verdict on who they have been playing. The same function the
    // matches screen runs, so the card and the screen it opens cannot
    // disagree — this is the summary, that is the working.
    const quality = buildMatchQuality(pid, players, matches);
    const playingStyle = quality.total
      ? { title: quality.verdict || "Not enough to judge", description: shareSentence(quality) }
      : null;

    return {
      record: { record: { w: r.w, d: r.d, l: r.l }, form: formBars, winRate: r.gp ? Math.round(((r.w + r.d * 0.5) / r.gp) * 100) : 0, currentStreak, bestStreak, rankings },
      gap, playingStyle, rivalries, bestWins, opponents: { lead, behind }, achievements, history,
      historyTotal: mine.length, meta,
    };
  }, [pid, players, matches, elo, wdl, deltas, ratingBefore, group, isSelf, meId, player, onOpen, onOpenMatch, onProposeEdit]);

  if (!player || !data) return null;

  return (
    <>
    <ProfileView
      viewer={viewer}
      header={{
        leagueName: group?.name || "League",
        player,
        meta: data.meta || undefined,
        levelLabel: player?.level?.cat ? player.level.cat + " · " + player.level.sub : "No level set",
        onPickLeague: groups && groups.length > 1 ? onPickLeague : undefined,
        onSettings,
      }}
      record={data.record}
      gap={data.gap}
      playingStyle={data.playingStyle ? { ...data.playingStyle, onDetails: onStyleDetails } : null}
      rivalries={data.rivalries}
      bestWins={data.bestWins}
      opponents={data.opponents}
      achievements={data.achievements}
      trophies={{
        list: trophies.map((t: any) => ({
          id: t.id,
          competition: t.competition || "Trophy",
          result: t.result,
          season: t.season,
          clubName: t.clubs?.name,
          recorded: !t.claimed_by,
        })),
        // Only your own profile offers it. Claiming a trophy on somebody
        // else's behalf is exactly what the club-admin flow exists for, and
        // it is not this button.
        onClaim: isSelf ? () => setClaiming(true) : undefined,
      }}
      history={data.history}
      historyTotal={data.historyTotal}
      settings={[
        { key: "friends", icon: "friends", label: "Friends", onClick: onFriends },
        { key: "linked", icon: "linked", label: "Linked player", detail: fullNameOf(player), onClick: onLinkedPlayer },
      ]}
      onOpenPlayer={onOpen}
      onOpenMatch={onOpenMatch}
      onAllHistory={onAllHistory}
      onAllOpponents={onAllOpponents}
    />
    {claiming && (
      <ClaimTrophyForm
        claimantName={fullNameOf(player)}
        onClose={() => setClaiming(false)}
        onSubmitted={() => setReloadTrophies((n) => n + 1)}
      />
    )}
    </>
  );
}
