"use client";
import { countsAsPlayed, isLegacy, isLegacyClaimed, isUnconfirmedResult } from "@/core/matchStatus";
import { openProfile } from "@/lib/openProfile";
import React, { useEffect, useMemo, useState } from "react";
import { ClaimTrophyForm } from "@/components/profile/ClaimTrophyForm";
import { RecordTrophyForm } from "@/components/profile/RecordTrophyForm";
import { listMyAdminClubs } from "@/lib/clubs";
import { ProfileView } from "@/components/profile/ProfileView";
import { RatingLine } from "@/components/profile/RatingLine";
import type { Achievement, AchievementIcon } from "@/components/profile/Achievements";
import { computeAchievements } from "@/core/achievements";
import { levelAt, levelNow } from "@/core/levels";
import { utrLabel } from "@/core/utr";
import { buildMatchQuality, shareSentence } from "@/core/matchQuality";
import { glickoStandings } from "@/core/glicko";
import { opponentStrength } from "@/core/official";
import { PROVISIONAL_GAMES } from "@/lib/globalTable";
import { mostPlayedRivalries } from "@/core/rivalries";
import { FriendsCard } from "@/components/profile/FriendsCard";
import { PeopleYouMayKnow } from "@/components/social/PeopleYouMayKnow";
import { TIER_HEIGHTS } from "@/core/stars";
import { deleteTrophy, listApprovedTrophiesForPlayer } from "@/lib/trophies";
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
  viewer = "self", onOpen, onOpenMatch, onProposeEdit, onPickLeague,
  onFriends, onLinkedPlayer, onClaimTrophy, onAllHistory, onAllOpponents, onStyleDetails,
  myAuthId, onMessage, onChallenge, onOpenMatches, seasonHonoursOf, onCompare,
  // False where the profile was reached from outside your league (search,
  // a friend's list): the database only lets an admin award inside a league
  // they are in, so the button would only ever fail there.
  awardable = true,
}: any) {
  const pid = player?.id;
  const isSelf = viewer === "self";

  // All time, or one year. ProfileView has declared this prop since it was
  // written and nothing ever supplied it, so the chips have never rendered —
  // the same way playingStyle sat dead for months. An absent prop renders
  // nothing and says nothing, which is why these go unnoticed.
  const [period, setPeriod] = useState<"all" | number>("all");

  // Every year the LEAGUE played, not every year this player did. A year
  // they sat out is still a year you might want to look at, and finding it
  // missing reads as the app having lost it.
  const years = useMemo(
    () => Array.from(new Set((matches || []).filter((m: any) => countsAsPlayed(m)).map((m: any) => new Date(m.date).getFullYear())))
      .sort((a: any, b: any) => b - a),
    [matches],
  );

  // Carried-in records are the reason this cannot simply filter and
  // recompute. `wdl` includes initialRecord from onboarding — Zaach is
  // 32-0-12 there and 2-0-0 in actual match rows — and a carried record has
  // no date, so it belongs to no year. All time keeps using it. A single
  // year is counted from that year's matches alone, which is not a
  // regression but the truth: those thirty wins did not happen in 2024.
  const scopedMatches = useMemo(
    () => period === "all" ? (matches || []) : (matches || []).filter((m: any) => new Date(m.date).getFullYear() === period),
    [matches, period],
  );
  const [trophies, setTrophies] = useState<any[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [reloadTrophies, setReloadTrophies] = useState(0);
  const [giving, setGiving] = useState(false);
  // Whether the viewer runs a club, and so may award trophies. Asked once —
  // it is about the viewer, not the profile — and a failed read means no
  // button rather than a button that fails.
  const [clubAdmin, setClubAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    listMyAdminClubs().then((c) => { if (alive) setClubAdmin(c.length > 0); }).catch(() => {});
    return () => { alive = false; };
  }, []);

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

  // No officialTimeline here any more (2026-10-31). It replays the whole
  // club one match at a time — about 0.8 s on a laptop for 30 players and
  // 600 matches, two seconds and more on a phone — and since profile v3 the
  // profile shows neither per-match points nor the points summary, so every
  // profile open was paying for numbers nobody saw.

  const data = useMemo(() => {
    if (!pid) return null;
    const byId: Record<string, any> = {};
    (players || []).forEach((p: any) => { byId[p.id] = p; });
    const allTime = wdl?.[pid] || { w: 0, d: 0, l: 0, gp: 0 };

    const mine = (scopedMatches || [])
      .filter((m: any) => m.p1 === pid || m.p2 === pid)
      .sort((a: any, b: any) => a.date - b.date);
    const played = mine.filter((m: any) => countsAsPlayed(m));
    const outcome = (m: any): "W" | "D" | "L" =>
      m.winner === "draw" ? "D" : ((m.winner === "p1" ? m.p1 : m.p2) === pid ? "W" : "L");

    // For a single year the record is counted from the matches on screen, so
    // the number and the list behind it cannot disagree — the rule that cost
    // us 28-versus-31 last time.
    const r = period === "all" ? allTime : played.reduce(
      (acc: any, m: any) => { const o = outcome(m); acc[o === "W" ? "w" : o === "D" ? "d" : "l"]++; acc.gp++; return acc; },
      { w: 0, d: 0, l: 0, gp: 0 },
    );

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

    // The club's Table, all time: the same glickoStandings the Table, Home
    // and "your place in other clubs" use (active players, 5 matches, the ±
    // line), so a profile can never show a place the Table doesn't. Elo and
    // Record rows went with the one-ranking Table (Sam, 2026-10-22).
    const cutoff = Date.now() - 365 * 86400000;
    const recent = new Set<string>();
    (matches || []).forEach((m: any) => { if (countsAsPlayed(m) && m.date >= cutoff) { recent.add(m.p1); recent.add(m.p2); } });
    const st = glickoStandings(players || [], matches || [], {
      minGames: PROVISIONAL_GAMES,
      eligible: (id) => recent.has(id) && !byId[id]?.inactive,
    });
    const myStatus = st.status[pid];
    const rankings = [
      {
        label: group?.name || "Club",
        value: myStatus === "placed" ? ordinal(st.place[pid]) + " of " + st.of + " ranked"
          : myStatus === "provisional" ? "Provisional"
          : myStatus === "short" ? (PROVISIONAL_GAMES - (st.played[pid] || 0)) + " more to rank"
          : "Not ranked",
        emphasis: true,
      },
      ...(st.table.rating[pid] != null && (st.played[pid] || 0) > 0
        ? [{ label: "Rating", value: String(Math.round(st.table.rating[pid])), qualifier: "± " + Math.round(st.table.rd[pid]) }]
        : []),
    ];

    // Head-to-head totals against everyone they have faced.
    const h: Record<string, { w: number; d: number; l: number }> = {};
    for (const m of played) {
      const opp = m.p1 === pid ? m.p2 : m.p1;
      const x = (h[opp] = h[opp] || { w: 0, d: 0, l: 0 });
      const o = outcome(m);
      if (o === "W") x.w++; else if (o === "D") x.d++; else x.l++;
    }
    // Legacy results beside them, never inside them (Sam: "11–3–6 (+4
    // legacy)"). Somebody known only from legacy results is still listed,
    // placed by those, so the history does not lose them.
    const hl: Record<string, { w: number; d: number; l: number; claimed: number }> = {};
    for (const m of mine) {
      if (!isLegacy(m)) continue;
      const opp = m.p1 === pid ? m.p2 : m.p1;
      const x = (hl[opp] = hl[opp] || { w: 0, d: 0, l: 0, claimed: 0 });
      const o = outcome(m);
      if (o === "W") x.w++; else if (o === "D") x.d++; else x.l++;
      if (isLegacyClaimed(m)) x.claimed++;
    }
    const zero = { w: 0, d: 0, l: 0 };
    const oppRec = (id: string) => {
      const r0 = h[id] || zero, lg = hl[id];
      return {
        player: byId[id], w: r0.w, d: r0.d, l: r0.l,
        legacy: lg ? lg.w + lg.d + lg.l : 0,
        ...(lg ? { legacyRecord: lg } : {}),
        levelLabel: levelNow(byId[id])?.cat || undefined,
        ...(wdl?.[id] ? { overall: { w: wdl[id].w, d: wdl[id].d, l: wdl[id].l } } : {}),
      };
    };
    const faced = Array.from(new Set([...Object.keys(h), ...Object.keys(hl)])).filter((o) => byId[o]);
    const side = (o: string) => { const r0 = h[o]; return r0 && r0.w + r0.d + r0.l ? r0 : (hl[o] || zero); };
    const lead = faced.filter((o) => side(o).w > side(o).l).map(oppRec);
    const behind = faced.filter((o) => side(o).l > side(o).w).map(oppRec);
    const levelList = faced.filter((o) => side(o).w === side(o).l).map(oppRec);
    const levelWith = levelList.length;

    const rivalries = mostPlayedRivalries(pid, matches || [], 2)
      .filter((v: any) => byId[v.oid])
      .map((v: any) => ({
        me: player, them: byId[v.oid],
        w: v.w, d: v.d, l: v.l, recent: v.recent, total: v.total,
        lastPlayed: shortDate(v.lastMeeting),
        onOpen,
      }));

    const { strength: strengthOf } = opponentStrength(players || [], matches || []);
    // One row per PERSON beaten (Sam, 2026-10-31): "Zaach Rodriguez ·
    // beaten 9 times · best 17 Sep 2026 (Advanced)". People are ranked by
    // their best win — how strong the opponent was that day, everything
    // they have ever played blended with their level on the day, the same
    // measure Official points use (core/official.ts opponentStrength) —
    // and that best win is the match the row opens.
    const winsBy: Record<string, { count: number; best: any; bestRating: number }> = {};
    for (const m of played) {
      if (outcome(m) !== "W") continue;
      const oid = m.p1 === pid ? m.p2 : m.p1;
      if (!byId[oid]) continue;
      const v = strengthOf(oid, m.date);
      const rating = Number.isFinite(v) ? v : -Infinity;
      const g = (winsBy[oid] = winsBy[oid] || { count: 0, best: null, bestRating: -Infinity });
      g.count++;
      if (!g.best || rating > g.bestRating || (rating === g.bestRating && m.date > g.best.date)) { g.best = m; g.bestRating = rating; }
    }
    const bestWins = Object.keys(winsBy)
      .sort((x, y) => winsBy[y].bestRating - winsBy[x].bestRating || winsBy[y].count - winsBy[x].count)
      .slice(0, 3)
      .map((oid) => {
        const g = winsBy[oid];
        const lv = levelAt(byId[oid], g.best.date);
        const when = new Date(g.best.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
        return {
          matchId: g.best.id,
          opponent: byId[oid],
          subtitle: "beaten " + (g.count === 1 ? "once" : g.count + " times") + " · best " + when + (lv?.cat ? " (" + lv.cat + ")" : ""),
        };
      });

    // The gap to whoever is directly above, which is the only rank change
    // within reach. A gap to the leader is a fact; a gap to the person one
    // place up is a target.
    const placedOrder = Object.keys(st.place).sort((a, b) => st.place[a] - st.place[b]);
    const above = st.place[pid] ? byId[placedOrder.filter((id) => st.place[id] < st.place[pid]).pop() as string] ?? null : null;

    // On somebody else's profile: a slim "You vs Charlie" strip (Sam,
    // 2026-10-31), replacing the "You lead X" card. Read from the VIEWER's
    // book, not the owner's — `h` above is this profile's own record, and
    // reading h[meId] as yours printed every head-to-head backwards once
    // ("You lead Zaach 2–0" off two losses). buildMatchQuality fixes the
    // orientation in one tested place.
    let versus: { name: string; w: number; d: number; l: number; last: string | null } | null = null;
    if (!isSelf && meId) {
      const vq = buildMatchQuality(meId, players, matches).opponents
        .find((o: any) => o.player?.id === pid);
      const x = vq?.record;
      if (x && x.w + x.d + x.l > 0) {
        const lastTs = (matches || [])
          .filter((m: any) => countsAsPlayed(m) && ((m.p1 === meId && m.p2 === pid) || (m.p2 === meId && m.p1 === pid)))
          .reduce((t: number, m: any) => Math.max(t, m.date || 0), 0);
        versus = {
          name: String(player?.name || fullNameOf(player) || "them").split(" ")[0],
          w: x.w, d: x.d, l: x.l,
          last: lastTs ? new Date(lastTs).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }) : null,
        };
      }
    }
    const gap = null;
    void above;

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
      const pending = isUnconfirmedResult(m);
      const legacy = isLegacy(m);
      return {
        matchId: m.id,
        legacy,
        claimed: isLegacyClaimed(m),
        outcome: outcome(m),
        opponent: fullNameOf(o),
        opponentId: o?.id,
        onOpenPlayer: onOpen,
        // A year is all some legacy results know; never print a made-up day.
        date: legacy && m.datePrecision === "year" ? String(new Date(m.date).getFullYear()) : shortDate(m.date),
        ts: m.date,
        score: m.score || null,
        // What it did to Official points, the table's number (Sam,
        // 2026-10-22) — replacing the per-match Elo change, which swung
        // −0.9 to −17 for the same loss, and then the grade word that stood
        // in for it for a day.
        points: null,
        pending,
        onOpen: onOpenMatch ? () => onOpenMatch(m.id) : undefined,
        onEdit: pending && onProposeEdit ? () => onOpenMatch && onOpenMatch(m.id) : undefined,
      };
    });

    const started = player?.levelHistory?.[0]?.from;
    const startYear = started == null ? null : typeof started === "number" ? started : parseInt(String(started).split("-")[0], 10);
    const years = startYear ? new Date().getFullYear() - startYear : null;
    void years;
    // "age · club · level" on one line (Sam, 2026-10-31) — the stars went.
    const lvNow = levelNow(player);
    const meta = [
      player?.age || null,
      group?.name || null,
      lvNow ? lvNow.cat + " · " + lvNow.sub + (player?.utr != null ? " · " + utrLabel(player.utr) : "") : "No level set",
    ].filter(Boolean).join(" · ");

    // The verdict on who they have been playing. The same function the
    // matches screen runs, so the card and the screen it opens cannot
    // disagree — this is the summary, that is the working.
    const quality = buildMatchQuality(pid, players, matches);
    const playingStyle = quality.total
      ? { title: quality.verdict || "Not enough to judge", description: shareSentence(quality) }
      : null;

    return {
      record: { record: { w: r.w, d: r.d, l: r.l }, form: formBars, winRate: r.gp ? Math.round((r.w / r.gp) * 100) : 0, unbeatenRate: r.gp ? Math.round(((r.w + r.d) / r.gp) * 100) : undefined, currentStreak, bestStreak, rankings: period === "all" ? rankings : [] },
      gap, versus, playingStyle, rivalries, bestWins, opponents: { lead, behind, level: levelWith, levelList }, achievements, history,
      // The head-to-head hero's small row (Sam, 2026-10-30): club place as
      // "2nd of 7", and the rating with its ± (the Table's own numbers).
      standing: {
        place: myStatus === "placed" ? ordinal(st.place[pid]) + " of " + st.of
          : myStatus === "provisional" ? "Provisional"
          : myStatus === "short" ? (PROVISIONAL_GAMES - (st.played[pid] || 0)) + " to go"
          : "Not ranked",
        rating: st.table.rating[pid] != null && (st.played[pid] || 0) > 0 ? Math.round(st.table.rating[pid]) : null,
        rd: st.table.rd[pid] != null ? Math.round(st.table.rd[pid]) : null,
      },
      historyTotal: mine.length, meta,
    };
  }, [pid, players, matches, scopedMatches, period, elo, wdl, deltas, ratingBefore, group, isSelf, meId, player, onOpen, onOpenMatch, onProposeEdit]);

  if (!player || !data) return null;

  // The Friends card is keyed on the ACCOUNT, not the player row:
  // friendships are between accounts and a shell player has none, so the card
  // renders nothing for one — correct rather than empty.
  //
  // Tapping a friend hands an account id to ?profile=, which RallyApp already
  // resolves either way round (auth_id first, then player id). A friend in
  // this league opens their real profile; one who is not falls through to the
  // public page, with no extra plumbing.
  return (
    <>
    <ProfileView
      period={{
        key: "period",
        label: "When",
        value: period === "all" ? "all" : String(period),
        options: [
          { value: "all", label: "All time" },
          ...years.map((y: number) => ({ value: String(y), label: String(y) })),
        ],
        onChange: (v: string) => setPeriod(v === "all" ? "all" : Number(v)),
      }}
      viewer={viewer}
      header={{
        leagueName: group?.name || "Club",
        player,
        meta: data.meta || undefined,
        levelLabel: (() => { const lv = levelNow(player); return lv ? lv.cat + " · " + lv.sub : "No level set"; })(),
        onPickLeague: groups && groups.length > 1 ? onPickLeague : undefined,
      }}
      record={data.record}
      gap={data.gap}
      versus={data.versus}
      ratingLine={
        <RatingLine
          player={player}
          playerId={pid}
          matches={matches}
          ratingBefore={ratingBefore || {}}
          deltas={deltas || {}}
          startRating={typeof player?.initialElo === "number" ? player.initialElo : undefined}
          nameOf={(oid: string) => fullNameOf(players.find((x: any) => x.id === oid)) || "someone"}
          onOpenMatch={onOpenMatch}
        />
      }
      actions={{ theirAuthId: player?.auth_id ?? null, myAuthId, onMessage, onChallenge: onChallenge && pid !== meId ? () => onChallenge(pid) : undefined }}
      friends={<>
        <FriendsCard
          authId={player?.auth_id ?? null}
          isMe={isSelf}
          onOpenProfile={openProfile}
        />
        {/* Your own profile only: suggestions are about who YOU might know. */}
        {isSelf && myAuthId && (
          <PeopleYouMayKnow
            meAuthId={myAuthId}
            mePlayerId={pid}
            players={players}
            matches={matches}
            leagueName={group?.name}
            onSeeAll={onFriends}
          />
        )}
      </>}
      playingStyle={data.playingStyle ? { ...data.playingStyle, onDetails: onStyleDetails || (onOpenMatches ? () => onOpenMatches(pid, "quality") : undefined) } : null}
      rivalries={data.rivalries}
      bestWins={data.bestWins}
      opponents={data.opponents}
      standing={data.standing}
      onOpenH2H={onCompare && pid ? (oid: string) => onCompare(pid, oid) : undefined}
      achievements={data.achievements}
      trophies={{
        // Honours the app works out from finished seasons come first: they
        // are the club's own, and nobody can take them down but the results.
        list: [...(pid && seasonHonoursOf ? seasonHonoursOf(pid) : []).map((h: any) => ({
          id: h.id, competition: h.competition, result: h.result, season: h.season,
          clubName: group?.name || null, recorded: true, removable: false, wonOn: h.wonOn, format: h.format,
        })), ...trophies.map((t: any) => ({
          id: t.id,
          competition: t.competition || "Trophy",
          result: t.result,
          season: t.season,
          clubName: t.clubs?.name,
          recorded: !t.claimed_by,
          // Yours to take down: anything on your own profile. Your club's to
          // take down: one an admin recorded. Never somebody's own claim.
          removable: isSelf || (clubAdmin && !t.claimed_by),
          wonOn: t.won_on ?? null,
          format: t.format ?? null,
        }))],
        // Only your own profile offers it. Claiming a trophy on somebody
        // else's behalf is exactly what the club-admin flow exists for, and
        // it is not this button.
        onClaim: isSelf ? () => setClaiming(true) : undefined,
        // A club admin awards from the winner's profile.
        onGive: clubAdmin && !isSelf && awardable ? () => setGiving(true) : undefined,
        onRemove: (id: string) => { deleteTrophy(id).catch(() => {}).then(() => setReloadTrophies((n) => n + 1)); },
      }}
      history={data.history}
      historyTotal={data.historyTotal}
      settings={[
        { key: "friends", icon: "friends", label: "Friends", onClick: onFriends },
        { key: "linked", icon: "linked", label: "Linked player", detail: fullNameOf(player), onClick: onLinkedPlayer },
      ]}
      onOpenPlayer={onOpen}
      onOpenMatch={onOpenMatch}
      onAllHistory={onAllHistory || (onOpenMatches ? () => onOpenMatches(pid, "history") : undefined)}
      onAllOpponents={onAllOpponents}
    />
    {giving && (
      <RecordTrophyForm
        playerId={pid}
        playerName={fullNameOf(player)}
        hasAccount={!!player?.auth_id}
        onClose={() => setGiving(false)}
        onSubmitted={() => setReloadTrophies((n) => n + 1)}
      />
    )}
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
