"use client";
import { countsAsPlayed, isClaimed, isUnconfirmedResult } from "@/core/matchStatus";
import React, { useState, useEffect, useMemo } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock, HelpCircle, MessageCircle, Plus, Search, Settings as Gear, Swords, Trophy, User, Users } from "lucide-react";
import { storage } from "@/lib/storage";
import { ClubAdminReview } from "@/components/admin/ClubAdminReview";
import { listMyAdminClubs } from "@/lib/clubs";
import { HeadToHead } from "@/components/compare/HeadToHead";
import { HelpGuide } from "@/components/help/HelpGuide";
import { History } from "@/components/games/History";
import { Home } from "@/components/home/Home";
import { LogResult } from "@/components/games/LogResult";
import { BottomNav } from "@/components/layout/BottomNav";
import { GroupSheet } from "@/components/layout/GroupSheet";
import { SubHeader } from "@/components/layout/SubHeader";
import { MyProfile } from "@/components/profile/MyProfile";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { MatchDetail } from "@/components/games/MatchDetail";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { Friends } from "@/components/social/Friends";
import { LegacyProfile } from "@/components/profile/LegacyProfile";
import { ProfileScreen } from "@/components/profile/ProfileScreen";
import { Onboarding } from "@/components/settings/Onboarding";
import { YourMatches, type MatchesMode } from "@/components/matches/YourMatches";
import { LevelRepair } from "@/components/settings/LevelRepair";
import { PROVISIONAL_GAMES, globalKeyFor, globalRankFor } from "@/lib/globalTable";
import { myLeaguePlaces } from "@/lib/myLeaguePlaces";
import { listMyLeagues } from "@/lib/leagues";
import { OFFICIAL_UNIT, type Standing } from "@/components/home/StandingHero";
import { setLevelEstimate } from "@/lib/levelAdmin";
import { SettingsTab } from "@/components/settings/SettingsTab";
import { Globe } from "@/components/ui/Globe";
import { MessageRobins } from "@/components/ui/MessageRobins";
import { ThemePicker } from "@/components/ui/ThemePicker";
import { RallyMark } from "@/components/ui/RallyMark";
import { useDoubles } from "@/components/doubles/useDoubles";
import { ModeSwitch } from "@/components/doubles/ModeSwitch";
import { DoublesStandings } from "@/components/doubles/DoublesStandings";
import { DoublesEntry } from "@/components/doubles/DoublesEntry";
import { DoublesProfile } from "@/components/doubles/DoublesProfile";
import { DoublesRankCard } from "@/components/doubles/DoublesRankCard";
import { RankCarousel } from "@/components/doubles/RankCarousel";
import { DoublesFixtures } from "@/components/doubles/DoublesFixtures";
import { Robin } from "@/components/ui/Robin";
import { Messages } from "@/components/social/Messages";
import { GlobalTable } from "@/components/table/GlobalTable";
import { nudgeAboutMatch, sendMessage, startThread, systemMessage, unreadMessageCount } from "@/lib/messages";
import { LeagueHome } from "@/components/table/LeagueHome";
import PlayerClaim from "@/components/auth/PlayerClaim";
import { Avatar } from "@/components/ui/Avatar";
import { START_ELO } from "@/core/constants";
import { computeStats } from "@/core/elo";
import { rankMaps } from "@/core/rank";
import { buildSnapshots, weekEndingFor } from "@/core/snapshots";
import { alreadyRecorded, loadSnapshots, recordWeek } from "@/lib/rankSnapshots";
import { movementFor, type RankSnapshot } from "@/core/snapshots";
import { computeOfficial } from "@/core/official";
import { formatMatchDate, formatMatchDateTime, fullNameOf, greetingFor, shortNameOf, uid, winPct } from "@/lib/format";
import { LevelRecheck } from "@/components/home/LevelRecheck";
import { SEED_GROUP_DATA } from "@/data/seed";
import { FRIENDLY_LEAGUE_ID, isFriendlyLeague } from "@/lib/leagueData";

/** Kept in step with the id Dashboard mounts for ?__dev_auto=1. */
const DEV_LEAGUE_ID = "g_debug";
const DEV_SEED_KEY = "g_main";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { WhatsNew } from "@/components/home/WhatsNew";
import { RELEASE } from "@/lib/whatsNew";
import { predictProb } from "@/core/predict";
import { AUTO_CANCEL_DAYS, DEFAULT_DURATION_MINUTES } from "@/core/booking";
import { FEED_OVERLAY, BALL, CHALK, COURT, MUTED, PANEL, body, display, listCard, listRow, segmentOption, segmentTrack, wrap } from "@/lib/theme";
import { FEED_LIME_INK, FEED_RAISED, FEED_TEXT_MID, FEED_TEXT_HI, tabular } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { importHistoricalMatches, normalizePlayerName } from "@/lib/historyImport";
import { fetchLeagueData, insertPlayerRow, syncFixtures, syncMatches, syncPlayers, syncPosts, updatePlayerRow } from "@/lib/leagueData";

type LeagueData = {
  players: any[];
  matches: any[];
  me: any;
  fixtures?: any[];
  posts?: any[];
};

const emptyLeagueData: LeagueData = { players: [], matches: [], fixtures: [], posts: [], me: null };

/**
 * The line under the opponent's name on Next Up.
 *
 * Sam's words, banded by the app's own prediction. It is the only place the
 * app talks to you rather than reports at you, so the bands are deliberately
 * coarse: nobody wants a different sentence for 61% and 62%, and a number
 * that precise would be pretending to a confidence the model does not have.
 *
 * Null when there is nothing to predict from — a first meeting is its own
 * kind of interesting and should not be dressed up as a coin flip.
 */
/**
 * "22–28 Sep", or "28 Sep – 4 Oct" when the week straddles a month.
 *
 * Europe/London like every other date in the app — a club plays where the
 * club is, and a week should not shift because somebody opened Rally from a
 * hotel in Spain. See format.ts.
 */
function rangeText(from: number, to: number): string {
  const fmt = (ts: number, withMonth: boolean) => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London", day: "numeric", ...(withMonth ? { month: "short" as const } : {}),
      }).format(new Date(ts));
    } catch { return ""; }
  };
  const monthOf = (ts: number) => { try { return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "short" }).format(new Date(ts)); } catch { return ""; } };
  const sameMonth = monthOf(from) === monthOf(to);
  return sameMonth
    ? fmt(from, false) + "–" + fmt(to, true)
    : fmt(from, true) + " – " + fmt(to, true);
}

/** players.id is the app's own short id; an account is a uuid. §6 records
 *  the same distinction biting trophies.player_id. */
const IS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nextUpLine(pct: number | null): string {
  if (pct == null) return "First meeting. No history, no excuses.";
  if (pct >= 65) return "You're the favourite for a reason. Play like it.";
  if (pct >= 55) return "Slight edge. Don't hand it back.";
  if (pct >= 45) return "Coin flip. First to blink loses.";
  if (pct >= 35) return "Rally's been wrong before.";
  return "Nobody's expecting this one. Show them.";
}

export default function RallyApp({ leagueId, leagueName, leagueRole, leagueJoinCode, displayName, onManageLeagues, doublesEnabled }: any) {
  const [groups, setGroups] = useState<Array<{ id: string; name: string; requireSetup?: boolean; season?: any }>>([]);
  const [gid, setGid] = useState<string | null>(null);
  const [gdata, setGdata] = useState<LeagueData>(emptyLeagueData);
  const [rankingMode, setRankingMode] = useState("overall");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState("home");
  // Set when you arrive at Compare from a Table row, so it opens on the two
  // of you rather than on two empty pickers.
  const [compareWith, setCompareWith] = useState<string | null>(null);
  // Standings or Compare, on the Table tab. Session only — a filter you
  // chose once is not a preference worth remembering across launches, and
  // opening the app into Compare would be answering a question nobody asked.
  const [tableMode, setTableMode] = useState<"standings" | "compare">("standings");
  // Which half of "Your matches" you arrived at. Session only, like the
  // Table's: the mode is decided by the link you followed, and remembering
  // it across launches would override that.
  const [matchesMode, setMatchesMode] = useState<MatchesMode>("quality");
  // Whose matches the screen is showing. Yours unless you opened it from
  // somebody else's profile.
  const [matchesFor, setMatchesFor] = useState<string | null>(null);
  // Where Back goes from the level-history screen. It is reached from two
  // places and should return to whichever one you came from.
  const [levelsFrom, setLevelsFrom] = useState("profile");
  const [snapshots, setSnapshots] = useState<RankSnapshot[]>([]);
  const [profileId, setProfileId] = useState(null);
  const [matchDetailId, setMatchDetailId] = useState<string | null>(null);
  const [legacyId, setLegacyId] = useState(null);
  const [profileYear, setProfileYear] = useState<"all" | number>("all");
  /**
   * Open somebody's profile.
   *
   * Anybody in this league gets the real one — the full profile with their
   * record, form, rivalries and history, rendered full screen rather than as
   * a sheet. Everything it needs is already loaded, so there is no fetch and
   * no flash of an empty page, and Back puts you exactly where you were.
   *
   * Routing every tap to /players/[id] was wrong and briefly shipped that
   * way. That page can only show what a stranger is allowed to read, so
   * sending league-mates to it quietly swapped the profile Sam knows for a
   * thinner one — a downgrade for the common case in order to serve the rare
   * one. The route is for people this app has no data on: somebody found in
   * search, or a friend in another club.
   */
  const openProfile = (id: any, year?: "all" | number) => {
    const known = (gdata.players || []).some((p) => p.id === id);
    if (id && !known && typeof window !== "undefined") { window.location.href = "/players/" + encodeURIComponent(id); return; }
    setProfileId(id); setProfileYear(year ?? "all");
  };
  const [groupSheet, setGroupSheet] = useState(false);

  // Doubles. One load for the whole app; see useDoubles. With the flag off it
  // fetches nothing and every branch below collapses to what was there
  // before, which is how "singles must not change" is enforced rather than
  // promised: there is no doubles code on the singles path to go wrong.
  const doubles = useDoubles(leagueId, !!doublesEnabled);
  // Which sport the Table, Profile and the entry screen are showing. Not
  // persisted: unlike the theme or the season toggle, this is a thing you
  // flick between within a visit, and remembering it means opening the Table
  // to doubles because of something you did last week.
  const [sport, setSport] = useState<"singles" | "doubles">("singles");
  // Anything that turns doubles UI on has to pass BOTH: the league allows it
  // and the person chose it. Two separate conditions, never conflated.
  const showDoubles = !!doublesEnabled && sport === "doubles";
  // Standby view: the Table tab shows the people you've played instead of a
  // league. The league still loads underneath — this changes what's shown,
  // not what's fetched.
  const [personal, setPersonal] = useState(false);
  // Who to open a conversation with when arriving from a profile's Message
  // button. Cleared as soon as Messages has used it, so going back to the
  // screen later doesn't reopen the same thread.
  const [msgWith, setMsgWith] = useState<string | null>(null);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [onboarded, setOnboarded] = useState(true);
  const [toast, setToast] = useState("");
  const [claimUI, setClaimUI] = useState<{ candidate: any; others: any[]; authId: string; nameToUse: string; data: LeagueData; cur: any; gs: any[]; st: any } | null>(null);
  const [declinedCandidate, setDeclinedCandidate] = useState(false);
  const [isClubAdmin, setIsClubAdmin] = useState(false);
  const [myAuthId, setMyAuthId] = useState<string | null>(null);
  // Friendlies need one migration that may not have been run yet. Saying so
  // beats the generic "couldn't load" screen, which points nowhere.
  const [friendlyUnavailable, setFriendlyUnavailable] = useState(false);
  // Where you stand everywhere else: across Rally, and in your other leagues.
  // Loaded after the first paint rather than during boot — one is an RPC and
  // the rest are a full league load each, and the league you actually opened
  // should not wait behind any of it.
  const [otherStandings, setOtherStandings] = useState<Standing[]>([]);
  // Where /players/[id] sends you back to. Both carry an account id, because
  // that is the only identity a page outside a league has to work with.
  const [pendingIntent, setPendingIntent] = useState<{ kind: "message" | "challenge" | "profile"; authId: string } | null>(null);
  // Who the booking form should open with already chosen.
  const [challengeWith, setChallengeWith] = useState<string | null>(null);

  // Acting on where the profile page sent us, once the league is loaded.
  //
  // Message needs only an account id and so always works. Challenge needs a
  // player row in a league we share, because a fixture belongs to a league —
  // if we share none, there is nothing to book yet and saying so is better
  // than opening an empty picker. That gap is the Friendly work, which is
  // recorded in the report rather than faked here.
  useEffect(() => {
    if (!pendingIntent || loading) return;
    // Either shape. Search hands over an account id; anything already
    // holding a league row hands over that. Accepting both means a link to
    // somebody's profile works from wherever it was written, which is the
    // same tolerance /players/[id] already has.
    const target = (gdata.players || []).find((p) => p.auth_id === pendingIntent.authId)
      || (gdata.players || []).find((p) => p.id === pendingIntent.authId);
    if (pendingIntent.kind === "profile") {
      // The real profile, the one with rivalries, best wins and a head to
      // head — not a summary. It only exists where the league data behind it
      // is loaded, which is here. Somebody in no league of mine has no such
      // profile to show, so they get the public page instead.
      if (target) { setProfileId(target.id); setProfileYear("all"); }
      // The public page is keyed on an ACCOUNT, so only send an account to
      // it. Search can now hand over a league player row — a short app id,
      // never a uuid — for somebody with no account at all, and forwarding
      // one of those to /players/ would open a page that can only say it
      // found nobody. Since search only ever returns people from leagues we
      // are in, landing here means they are in a DIFFERENT one of ours.
      else if (!IS_UUID.test(pendingIntent.authId)) {
        flash("They're in another of your leagues — switch to it to see their profile.");
      }
      else if (typeof window !== "undefined") { window.location.replace("/players/" + encodeURIComponent(pendingIntent.authId)); return; }
    } else if (pendingIntent.kind === "message") {
      setMsgWith(pendingIntent.authId);
      setTab("messages");
    } else if (target) {
      setChallengeWith(target.id);
      setTab("fixtures");
    } else {
      flash("You'll need a league in common before you can book a match.");
    }
    setPendingIntent(null);
  }, [pendingIntent, loading, gdata.players]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const message = url.searchParams.get("message");
      const challenge = url.searchParams.get("challenge");
      const profile = url.searchParams.get("profile");
      if (!message && !challenge && !profile) return;
      setPendingIntent(
        profile ? { kind: "profile", authId: profile }
          : message ? { kind: "message", authId: message }
          : { kind: "challenge", authId: challenge as string },
      );
      // Out of the address bar, so a reload doesn't re-run it.
      url.searchParams.delete("message");
      url.searchParams.delete("challenge");
      url.searchParams.delete("profile");
      window.history.replaceState({}, "", url.toString());
    } catch { /* a malformed url is not worth a crash */ }
  }, []);

  // Two prompts that both want the top of Home. They are queued rather than
  // stacked: arriving to three cards asking for something is worse than
  // arriving to one, and neither is urgent.
  const WHATS_NEW_KEY = "whatsNew.seen";
  const [newsSeen, setNewsSeen] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    storage.get(WHATS_NEW_KEY)
      .then((r) => { if (live) setNewsSeen(r?.value ?? null); })
      .catch(() => { if (live) setNewsSeen(RELEASE); });
    return () => { live = false; };
  }, []);
  const closeWhatsNew = () => {
    setNewsSeen(RELEASE);
    storage.set(WHATS_NEW_KEY, RELEASE).catch((e) => console.error("Couldn't remember what's new", e));
  };

  const LEVEL_RECHECK_KEY = "levelRecheck.v6";
  const [levelAsked, setLevelAsked] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    storage.get(LEVEL_RECHECK_KEY)
      .then((r) => { if (live) setLevelAsked(!!r?.value); })
      // A failed read must not look like "never asked" — that is how somebody
      // gets the same card every time the network hiccups.
      .catch(() => { if (live) setLevelAsked(true); });
    return () => { live = false; };
  }, []);

  const closeLevelRecheck = () => {
    setLevelAsked(true);
    storage.set(LEVEL_RECHECK_KEY, String(Date.now())).catch((e) => console.error("Couldn't remember the level prompt", e));
  };


  useEffect(() => {
    listMyAdminClubs().then((cs) => setIsClubAdmin(cs.length > 0)).catch(() => {});
  }, []);

  const finishBoot = async (data: LeagueData, cur: any, gs: any[], st: any) => {
    const nextGroup = { ...gs[0], ownerId: (st?.ownerId || data.me || null) };
    setGroups([nextGroup]); setGid(cur); setGdata(data);
    setRankingMode(st?.rankingMode || "overall");
    setOnboarded(st ? (st.onboarded ?? false) : false);
    setLoading(false);
  };

  const resolveClaim = async (chosenPlayer: any | null) => {
    if (!claimUI) return;
    const { authId, nameToUse, data, cur, gs, st } = claimUI;
    let next: LeagueData;
    if (chosenPlayer) {
      // Explicit, user-picked claim — never inferred from a name match alone.
      const patch = { auth_id: authId, claimedAt: Date.now() };
      next = { ...data, players: (data.players || []).map((p) => p.id === chosenPlayer.id ? { ...p, ...patch } : p), me: chosenPlayer.id };
      try { await updatePlayerRow(chosenPlayer.id, { ...chosenPlayer, ...patch }); } catch (e) { console.error("Failed to persist claim", e); }
    } else {
      const init = { id: uid(), name: nameToUse || "player", level: null, avatar: null, auth_id: authId };
      next = { ...data, players: [...(data.players || []), init], me: init.id };
      try {
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('__dev_auto') === '1') {
          window.localStorage.setItem('rally:diag_seed', JSON.stringify({ init, league: cur }));
        }
      } catch {}
      try { await insertPlayerRow(cur, init); } catch (e) { console.error("Failed to persist new player", e); }
    }
    setClaimUI(null);
    setDeclinedCandidate(false);
    setLoading(true);
    await finishBoot(next, cur, gs, st);
  };

  const boot = async () => {
     setLoading(true);
     setLoadError(false);
     try {
      // The dev league runs entirely offline, on the seed data.
      //
      // ?__dev_auto=1 mounts a league whose id is "g_debug", which is not a
      // uuid, so fetchLeagueData has always failed on it and the app has
      // always sat on "Loading…" forever. The shortcut could never show the
      // app it exists to show.
      //
      // That is not a small thing. A crash shipped today that no typecheck,
      // build or component preview could have caught, because it only
      // happened on the transition from loading to loaded — the one
      // transition nobody could reach locally. Being able to open the real
      // app with realistic data is the check that was missing.
      //
      // Guarded the same way the shortcut itself is: never in production, so
      // it cannot become a way past the login.
      if (leagueId === DEV_LEAGUE_ID) {
        if (process.env.NODE_ENV === "production") { setLoadError(true); setLoading(false); return; }
        const seeded = SEED_GROUP_DATA[DEV_SEED_KEY];
        setGroups([{ id: leagueId, name: "Dev League" }]);
        setGid(leagueId);
        setGdata({ players: seeded.players, matches: seeded.matches, fixtures: [], posts: [], me: seeded.players[0]?.id ?? null });
        setOnboarded(true);
        setLoading(false);
        return;
      }

      // Friendlies. fetchLeagueData already knows to ask for league-less
      // rows, so the only extra work is making sure YOU have a row — a match
      // names two players.id, and somebody who has never joined a league has
      // never had one.
      if (isFriendlyLeague(leagueId)) {
        const { data: userData } = await supabase!.auth.getUser();
        const authId = (userData as any)?.user?.id ?? null;
        // The league path sets this further down, and this branch returns
        // before it ever reaches it — so in Friendlies it stayed null, and
        // everything downstream asking "which account is this" got the wrong
        // answer: the Global table could not find your row to mark, and a
        // profile could not tell yours from somebody else’s.
        setMyAuthId(authId);
        let data = await fetchLeagueData(leagueId);
        let mine = authId ? data.players.find((p: any) => p.auth_id === authId) : null;
        if (authId && !mine) {
          // Created once, on first use, rather than at sign-up: most people
          // never need one, and a row nobody asked for is a row somebody has
          // to explain later.
          mine = { id: uid(), name: displayName || "Me", auth_id: authId, created_by: authId } as any;
          try {
            await insertPlayerRow(leagueId, mine);
            data = await fetchLeagueData(leagueId);
          } catch (e) {
            // players.league_id is still `not null` until
            // schema_friendly_players.sql has been run, so this is the
            // expected failure rather than a broken app — and the generic
            // error screen would send somebody hunting for the wrong thing.
            console.error("Couldn't create your friendly player row", e);
            setFriendlyUnavailable(true); setLoading(false); return;
          }
          mine = data.players.find((p: any) => p.auth_id === authId) || mine;
        }
        setGroups([{ id: leagueId, name: "Friendlies" }]);
        setGid(leagueId);
        setGdata({ ...data, me: mine?.id ?? null });
        setOnboarded(true);
        setLoading(false);
        return;
      }

      // One real league, from Supabase. No demo data — a new league starts empty.
      const cur = leagueId;
      const gs = [{ id: leagueId, name: leagueName || "League", ownerId: null }];
      let st: any = null;
      try { const r = await storage.get("settings_" + leagueId, true); st = r ? JSON.parse(r.value) : null; } catch {}

      // A thrown error here means the load failed (timeout, network, RLS) —
      // that must never be treated the same as "this league has no data
      // yet." Bail out without touching storage rather than falling through
      // to the fresh-league path below and writing empty state over
      // whatever's actually there.
      let data: LeagueData;
      try {
        const fetched = await fetchLeagueData(cur);
        data = { ...fetched, me: null };
      } catch (e) {
        console.error("Failed to load league data — refusing to seed a fresh league over it.", e);
        setLoadError(true);
        setLoading(false);
        return;
      }

      // Link the signed-in account to a player using the Supabase auth user id
      // (stored as `auth_id`). Never by name alone: a name match only ever
      // becomes a *suggestion* the person explicitly confirms or rejects.
      let nameToUse = displayName;
      let authId: string | null = null;
      if (typeof window !== 'undefined' && supabase) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const u = (userData as any)?.user;
          authId = u?.id || null;
          nameToUse = nameToUse || (u?.user_metadata?.full_name) || (u?.email?.split("@")[0]) || nameToUse;
        } catch {}
      }
      setMyAuthId(authId);

      const alreadyLinked = authId ? (data.players || []).find((p) => p.auth_id === authId) : null;
      if (alreadyLinked) {
        data.me = alreadyLinked.id;
        await finishBoot(data, cur, gs, st);
        return;
      }

      const unclaimed = authId ? (data.players || []).filter((p) => !p.auth_id) : [];
      if (authId && unclaimed.length > 0) {
        const candidate = nameToUse ? unclaimed.find((p) => normalizePlayerName(p.name || "") === normalizePlayerName(nameToUse)) || null : null;
        setClaimUI({ candidate, others: unclaimed, authId, nameToUse: nameToUse || "player", data, cur, gs, st });
        setLoading(false);
        return;
      }

      // No auth id, no players at all, or no unclaimed players to offer — start fresh.
      const init = { id: uid(), name: nameToUse || "player", level: null, avatar: null, auth_id: authId };
      data.players = [...(data.players || []), init];
      data.me = init.id;
      try { await insertPlayerRow(cur, init); } catch (e) { console.error("Failed to persist new player", e); }
      try {
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('__dev_auto') === '1') {
          window.localStorage.setItem('rally:diag_seed', JSON.stringify({ init, league: cur }));
        }
      } catch {}
      await finishBoot(data, cur, gs, st);
     } catch (e) {
      console.error(e);
      setLoading(false);
     }
  };

  useEffect(() => { boot(); /* eslint-disable-next-line */ }, []);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2200); };
  const persistSettings = async (extra) => { try { await storage.set("settings_" + gid, JSON.stringify({ currentGroupId: gid, rankingMode, onboarded, ...extra }), true); } catch {} };
  const saveGroups = async (n) => { setGroups(n); try { await storage.set("groups_" + gid, JSON.stringify(n), true); } catch { flash("Couldn't save"); } };
  // Every mutation funnels through here. gdata is updated immediately for a
  // responsive UI, then only the players/matches/fixtures/posts that
  // actually differ from what we had a moment ago are synced to their
  // tables — never a full-blob rewrite, so one bad save can only ever touch
  // the rows it actually changed.
  //
  // A failed save used to leave the screen showing a change the database
  // never took. Worse, the next save diffed against that already-updated
  // state, so the lost change wasn't in the diff and could never be written
  // again — the two drifted apart permanently and silently, and the only
  // clue was one "Couldn't save" you may well have missed.
  //
  // Now a failure re-reads the league and shows what actually saved. Not the
  // pre-save state: these four syncs run together and some can land while
  // others fail, so the previous state is just as much a lie as the new one.
  // The only honest thing to put on screen is what the database really holds.
  // If even the re-read fails we fall back to the pre-save state, since that
  // is at least a view that once existed.
  const saveData = async (n: LeagueData): Promise<boolean> => {
    const prev = gdata;
    setGdata(n);
    if (!gid) return true;
    try {
      // Ordered, because three of these four reference each other.
      //
      // They used to go out together. That is faster and it is wrong in two
      // ways that both produce a half-saved league:
      //
      // A match points at two players. Create a new opponent in the picker
      // and log a result against them in the same breath — which is exactly
      // what the picker is for — and the match could reach the database
      // before the player it names.
      //
      // A resolved fixture points at the match that resolved it. If the
      // match insert fails and the fixture update does not, the fixture is
      // marked played with nothing behind it, and Fixtures now hides played
      // ones, so the evidence disappears too.
      //
      // Awaiting each in turn means a failure stops the ones that depend on
      // it, so a refused save leaves less behind. It is not a transaction —
      // only Postgres can give us that — but it turns "half saved in an
      // arbitrary order" into "saved up to the point it failed".
      //
      // Posts reference nothing and nothing references them, so they still
      // go in parallel and cost no extra time.
      await Promise.all([
        syncPosts(gid, prev.posts || [], n.posts || []),
        (async () => {
          await syncPlayers(gid, prev.players, n.players);
          await syncMatches(gid, prev.matches, n.matches);
          await syncFixtures(gid, prev.fixtures || [], n.fixtures || []);
        })(),
      ]);
      return true;
    } catch (e: any) {
      console.error(e);
      try {
        const fresh = await fetchLeagueData(gid);
        setGdata({ ...fresh, me: n.me ?? prev.me });
        // A refusal knows why it was refused; say that rather than the
        // generic line, which leaves you with nothing to do about it.
        flash(e?.userFacing ? e.message : "Couldn't save — showing what's actually saved");
      } catch (reloadError) {
        console.error(reloadError);
        setGdata(prev);
        flash("Couldn't save — your change was undone");
      }
      return false;
    }
  };
  const importHistoricalResults = async () => {
    try {
      const result = await importHistoricalMatches({ players: gdata.players, matches: gdata.matches }, { userName: displayName || me?.name || "Sam" });
      await saveData({ ...gdata, players: result.data.players, matches: result.data.matches, fixtures: gdata.fixtures, posts: gdata.posts });
      flash(`${result.imported} historical matches imported${result.skipped ? `, ${result.skipped} already present` : ""}`);
    } catch (error) {
      console.error(error);
      flash("Import failed");
    }
  };

  const setPlayers = (np) => saveData({ ...gdata, players: np });
  // A league-less shell needs an owner, and this is the only place one is
  // made. RLS lets you edit or delete a friendly player row only when it is
  // yours (auth_id) or you made it (created_by), and nothing outside the boot
  // path was stamping created_by — so a mate you added in Friendlies was a
  // row you could never rename, level or remove. Silently, too: an UPDATE that
  // RLS refuses matches no rows and reports success, so the change sat on
  // screen and was gone on the next load. Untouched on a league row, where
  // null still means "belongs to a league" and the league policies govern it.
  const addPlayer = (p) =>
    setPlayers([...players, isFriendlyLeague(gid) && myAuthId && !p.created_by ? { ...p, created_by: myAuthId } : p]);
  const setMatches = (nm) => saveData({ ...gdata, matches: nm });
  const setMe = (mid) => {
    if (!mid || mid !== gdata.me) {
      flash("Your account stays linked to one player profile.");
      return;
    }
    saveData({ ...gdata, me: mid });
  };
  const editMatch = (id, patch) => saveData({ ...gdata, matches: gdata.matches.map((m) => m.id === id ? { ...m, ...patch } : m) });
  // Editing a match you played: if the opponent has a real account, the change
  // is only a proposal until they agree it — never a unilateral rewrite of
  // their record. A shell opponent has nobody who could agree, so it applies
  // straight away, same as logging a new result against one.
  const proposeEdit = (id, patch) => {
    const m = gdata.matches.find((x) => x.id === id);
    if (!m) return;
    const actingId = players.some((p) => p.id === gdata.me) ? gdata.me : null;
    const oppId = actingId ? (m.p1 === actingId ? m.p2 : m.p2 === actingId ? m.p1 : null) : null;
    const opp = oppId ? players.find((p) => p.id === oppId) : null;
    if (opp && opp.auth_id) {
      saveData({ ...gdata, matches: gdata.matches.map((x) => x.id === id ? { ...x, pendingEdit: { ...patch, proposedBy: actingId, proposedAt: Date.now() } } : x) });
      flash("Change sent — waiting for them to agree");
    } else {
      editMatch(id, patch);
      flash("Updated");
    }
  };
  const approveEdit = (id) => saveData({ ...gdata, matches: gdata.matches.map((m) => { if (m.id !== id || !m.pendingEdit) return m; const { proposedBy, proposedAt, ...patch } = m.pendingEdit; return { ...m, ...patch, pendingEdit: null }; }) });
  const rejectEdit = (id) => saveData({ ...gdata, matches: gdata.matches.map((m) => m.id === id ? { ...m, pendingEdit: null } : m) });
  const deleteBetween = (a, b, year?: number) => saveData({ ...gdata, matches: gdata.matches.filter((m) => { const between = (m.p1 === a && m.p2 === b) || (m.p1 === b && m.p2 === a); if (!between) return true; if (year == null) return false; return new Date(m.date).getFullYear() !== year; }) });
  // The actual removal — used for the shell-opponent instant path below, for
  // the other participant agreeing, for the 24h timeout sweep, and (via
  // History's "Undo") for league staff correcting a match outright.
  const deleteMatch = (id) => saveData({ ...gdata, matches: gdata.matches.filter((m) => m.id !== id) });
  // Deleting a match you played: same shape as proposeEdit above — a real
  // opponent has to agree (or 24h has to pass) before it actually goes,
  // never a unilateral removal of a match that's on their record too.
  const proposeDelete = (id) => {
    const m = gdata.matches.find((x) => x.id === id);
    if (!m) return;
    const actingId = players.some((p) => p.id === gdata.me) ? gdata.me : null;
    const oppId = actingId ? (m.p1 === actingId ? m.p2 : m.p2 === actingId ? m.p1 : null) : null;
    const opp = oppId ? players.find((p) => p.id === oppId) : null;
    if (opp && opp.auth_id) {
      saveData({ ...gdata, matches: gdata.matches.map((x) => x.id === id ? { ...x, deleteRequestedBy: actingId, deleteRequestedAt: Date.now() } : x) });
      flash("Delete requested — waiting for them to agree");
    } else {
      deleteMatch(id);
      flash("Deleted");
    }
  };
  const agreeDelete = (id) => deleteMatch(id);
  const cancelDeleteRequest = (id) => saveData({ ...gdata, matches: gdata.matches.map((m) => m.id === id ? { ...m, deleteRequestedBy: null, deleteRequestedAt: null } : m) });
  const setMode = (m) => { setRankingMode(m); persistSettings({ rankingMode: m }); };
  const fixtures = gdata.fixtures || [];
  const generateFixtures = (rounds = 1) => {
    const ps = gdata.players; const fx: Array<{ id: string; p1: string; p2: string; done: boolean }> = [];
    for (let r = 0; r < rounds; r++) for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) fx.push({ id: uid(), p1: ps[i].id, p2: ps[j].id, done: false });
    saveData({ ...gdata, fixtures: fx });
    flash(fx.length + " fixtures created");
  };
  const clearFixtures = () => saveData({ ...gdata, fixtures: [] });
  const posts = gdata.posts || [];
  const addPost = (text, isAnnouncement) => saveData({ ...gdata, posts: [...(gdata.posts || []), { id: uid(), by: gdata.me, text, date: Date.now(), isAnnouncement: !!isAnnouncement }] });
  const removePost = (id) => saveData({ ...gdata, posts: (gdata.posts || []).filter((x) => x.id !== id) });
  const addFixture = (p1, p2, booked = null) => saveData({ ...gdata, fixtures: [...(gdata.fixtures || []), { id: uid(), p1, p2, done: false, booked }] });
  /**
   * Call off an arranged match, and say so.
   *
   * Telling them was the part I left out, on the grounds that it needed a
   * soft cancel and a migration: the row is deleted, so there is nothing
   * left for the notification builder to read. The reasoning was sound and
   * the conclusion was wrong — the message does not have to be derived from
   * the row. It can just be sent, now, while we still know what was
   * cancelled. The nudge already works exactly this way.
   *
   * Only somebody with an account gets told, because a shell player has
   * nowhere to be told. And the cancellation stands whether or not the
   * message gets through: being unable to tell them is not a reason to keep
   * a match in the diary that nobody is turning up to.
   */
  const removeFixture = async (id) => {
    const fx = (gdata.fixtures || []).find((f) => f.id === id);
    const ok = await saveData({ ...gdata, fixtures: (gdata.fixtures || []).filter((f) => f.id !== id) });
    if (!ok || !fx) return ok;

    const otherId = fx.p1 === meId ? fx.p2 : fx.p2 === meId ? fx.p1 : null;
    const other = otherId ? gdata.players.find((p) => p.id === otherId) : null;
    if (!other?.auth_id) return ok;

    const me = gdata.players.find((p) => p.id === meId);
    const mine = me ? fullNameOf(me) : "Someone";
    const when = fx.booked ? formatMatchDateTime(fx.booked) : null;
    try {
      const threadId = await startThread(other.auth_id);
      await sendMessage(threadId, systemMessage.cancelled(mine, when), null, "system");
    } catch (e) {
      console.error("Cancelled the match but couldn't tell them", e);
      flash("Match cancelled — couldn't message " + fullNameOf(other));
    }
    return ok;
  };
  /**
   * Call off a doubles booking, and tell the other three — the singles rule
   * above, times three. Only people with an account can be told, and the
   * cancellation stands whether or not the messages get through.
   */
  const cancelDoublesFixture = async (fx) => {
    await doubles.cancel(fx.id);
    const me = gdata.players.find((p) => p.id === meId);
    const mine = me ? fullNameOf(me) : "Someone";
    const when = fx.booked ? formatMatchDateTime(fx.booked) : null;
    const others = [...fx.teamA, ...fx.teamB]
      .filter((id) => id !== meId)
      .map((id) => gdata.players.find((p) => p.id === id))
      .filter((p) => p?.auth_id);
    const missed: string[] = [];
    for (const other of others) {
      try {
        const threadId = await startThread(other.auth_id);
        await sendMessage(threadId, systemMessage.cancelled(mine, when), null, "system");
      } catch (e) {
        console.error("Cancelled the doubles match but couldn't tell them", e);
        missed.push(fullNameOf(other));
      }
    }
    flash(missed.length ? "Match cancelled — couldn't message " + missed.join(", ") : "Match cancelled");
  };
  const bookFixture = (id, when) => saveData({ ...gdata, fixtures: (gdata.fixtures || []).map((f) => f.id === id ? { ...f, booked: when || null } : f) });
  /**
   * Chase a result you logged.
   *
   * The message is how it arrives; matches.nudged_at is what the app
   * remembers. A refusal is worth reading out loud — "already nudged in the
   * last 24 hours" tells you what to do, where a generic failure does not.
   */
  const nudgeMatch = async (matchId: string) => {
    const m = gdata.matches.find((x) => x.id === matchId);
    if (!m) return;
    const otherId = m.p1 === meId ? m.p2 : m.p1;
    const other = gdata.players.find((p) => p.id === otherId);
    if (!other?.auth_id) { flash("They haven't got an account to nudge."); return; }
    const me = gdata.players.find((p) => p.id === meId);
    const mine = me ? fullNameOf(me) : "Someone";
    try {
      await nudgeAboutMatch(matchId, other.auth_id, systemMessage.nudge(mine));
      setGdata({ ...gdata, matches: gdata.matches.map((x) => x.id === matchId ? { ...x, nudgedAt: Date.now() } : x) });
      flash("Nudged " + fullNameOf(other));
    } catch (e: any) {
      console.error("Nudge failed", e);
      flash(e?.message || "Couldn't nudge just now");
    }
  };

  const resolveFixture = async (fx, winner, score): Promise<boolean> => {
    if (winner === null) {
      return saveData({ ...gdata, matches: gdata.matches.filter((m) => m.id !== fx.matchId), fixtures: (gdata.fixtures || []).map((f) => f.id === fx.id ? { ...f, done: false, winner: undefined, matchId: undefined } : f) });
    }
    const mid = uid();
    // Dated from the booking when there was one. Entering Saturday's result
    // on Monday should not file it as Monday's match — the rating replays in
    // date order and the level lookup is by date, so the date is not a label.
    const played = fx.booked ? new Date(fx.booked).getTime() : NaN;
    // Whoever isn't me. If they have an account they get to agree first,
    // exactly as they would if this had been logged through Log a result —
    // the two routes should not disagree about whether somebody's word is
    // enough on its own.
    const byId = (id) => gdata.players.find((p) => p.id === id) || null;
    const iAmIn = fx.p1 === meId || fx.p2 === meId;
    // If I played in it, the person who has to agree is the other one. If I
    // did not — league staff filling in somebody else's result — then either
    // of them having an account is reason enough to wait, because neither of
    // them has said a word about it.
    const needsAgreement = iAmIn
      ? isClaimed(byId(fx.p1 === meId ? fx.p2 : fx.p1))
      : (isClaimed(byId(fx.p1)) || isClaimed(byId(fx.p2)));
    const match = { id: mid, date: isNaN(played) ? Date.now() : played, p1: fx.p1, p2: fx.p2, winner, score: score || "", status: needsAgreement ? "pending" : "confirmed", reportedBy: gdata.me, loggedAt: Date.now() };
    return saveData({ ...gdata, matches: [...gdata.matches, match], fixtures: (gdata.fixtures || []).map((f) => f.id === fx.id ? { ...f, done: true, winner, matchId: mid, booked: null } : f) });
  };

  // Switching leagues reads the real tables, the same way boot() does.
  //
  // It used to read the legacy `grpc5_<id>` blob in shared_storage — a whole
  // league serialised as JSON, left over from before players and matches were
  // real tables. Nothing has written that blob in a long time, so opening the
  // league picker and tapping your own league replaced live data with a
  // months-old snapshot. Deleted matches came back, and worse: the next save
  // diffed against the snapshot and could write those matches back into the
  // real table. That is how a result Sam deleted kept returning after a
  // re-login. Never read that blob again.
  const switchGroup = async (id) => {
    let data: LeagueData;
    try {
      const fetched = await fetchLeagueData(id);
      data = { ...fetched, me: null };
    } catch (e) {
      // A failed read must never look like an empty league — same rule as
      // boot(). Leave what is on screen rather than seeding over real data
      // we simply could not reach.
      console.error("Failed to load league to switch to — leaving current league in place.", e);
      flash("Couldn't load that league — try again");
      return;
    }
    // Link the account to its player the one permitted way: auth_id, never
    // by name. See §3 of the working notes.
    const linked = myAuthId ? (data.players || []).find((p: any) => p.auth_id === myAuthId) : null;
    data.me = linked ? linked.id : null;
    setGid(id); setGdata(data); setGroupSheet(false); setProfileId(null); setTab("home");
    try { await storage.set("settings_c5", JSON.stringify({ currentGroupId: id, rankingMode, onboarded }), true); } catch {}
  };
  const addGroup = async (name) => {
    const id = "g_" + uid(); const g = { id, name };
    // No legacy blob is written any more: nothing reads it, and leaving the
    // write in place implies it is still a source of truth. See switchGroup.
    await saveGroups([...groups, g]); switchGroup(id);
  };
  const renameGroup = (id, name) => saveGroups(groups.map((g) => g.id === id ? { ...g, name } : g));
  const deleteGroup = async (id) => {
    if (groups.length <= 1) return flash("Keep at least one league");
    const next = groups.filter((g) => g.id !== id);
    await saveGroups(next);
    if (gid === id) switchGroup(next[0].id);
  };

  const players = gdata.players, matches = gdata.matches;
  const { elo, wdl, form, deltas, ratingBefore } = useMemo(() => computeStats(players, matches), [players, matches]);
  // First names alone collide often enough (two Sams, two Charlies) that
  // this always includes the surname when there is one.
  const nameOf = (id) => { const p = players.find((p) => p.id === id); return p ? p.name + (p.last ? " " + p.last : "") : "—"; };
  // Places gained since the last snapshot. Only offered when the table is
  // ranked on Official, because that is the ranking the weekly snapshot
  // records — showing Official movement beside an Elo column would be an
  // arrow about a different table.
  const officialRanks = useMemo(() => rankMaps(players, matches, elo, wdl).off, [players, matches, elo, wdl]);
  const officialPoints = useMemo(() => computeOfficial(players, matches, wdl), [players, matches, wdl]);
  const movement = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const id of Object.keys(officialRanks)) {
      const mv = movementFor(id, officialRanks[id], snapshots);
      out[id] = mv ? mv.placesGained : null;
    }
    return out;
  }, [officialRanks, snapshots]);
  // A badge, so it never justifies an error screen — unreadMessageCount
  // already swallows failures and returns 0.
  useEffect(() => {
    let alive = true;
    const tick = () => unreadMessageCount().then((n) => { if (alive) setUnreadMsgs(n); }).catch(() => {});
    tick();
    const timer = setInterval(tick, 30000);
    return () => { alive = false; clearInterval(timer); };
  }, [tab]);

  // Write down where everybody stood, once a week, because rank movement
  // cannot be recovered afterwards: the standings are a full recompute over
  // all history, so a match logged today for a game played in 2019 rewrites
  // last week as well. If nobody records it as it happens, "up 1 place" has
  // nothing to be measured against.
  //
  // No cron and no server — the first person to open the app after a week
  // ends writes that week. It's idempotent by week, so it doesn't matter how
  // many of them do it, and the standings it captures are as of that first
  // open rather than midnight on the Sunday, which is close enough for a
  // number that only ever reads "up 1".
  //
  // Every failure path here does nothing at all. A read that fails must
  // never reach recordWeek as an empty list — that would append this week to
  // nothing and write it back over every week we had.
  useEffect(() => {
    if (!gid || !players.length) return;
    let alive = true;
    (async () => {
      try {
        const week = weekEndingFor();
        const existing = await loadSnapshots(gid);
        if (!alive || alreadyRecorded(existing, week)) return;
        const ranks = rankMaps(players, matches, elo, wdl).off;
        if (!Object.keys(ranks).length) return;
        await recordWeek(gid, buildSnapshots(ranks, elo, week), week);
      } catch {
        // Left for the next open. Movement is a nicety; losing a week of it
        // is not worth showing anybody an error over.
      }
    })();
    return () => { alive = false; };
  }, [gid, players, matches, elo, wdl]);

  // The weeks already on record, for the movement arrows. A failed read
  // leaves this empty and every arrow simply doesn't render, which is the
  // right answer: we don't know, and "no change" would be a claim.
  useEffect(() => {
    let alive = true;
    if (!gid) return;
    loadSnapshots(gid).then((s) => { if (alive) setSnapshots(s); }).catch(() => {});
    return () => { alive = false; };
  }, [gid]);

  // A pending result waits for the opponent to agree it — but only ever for
  // matches logged after this existed (`loggedAt`), so we never mass-confirm
  // an old backlog someone hasn't dealt with yet.
  useEffect(() => {
    const DAY = 24 * 3600 * 1000;
    const now = Date.now();
    const stale = matches.filter((m) => isUnconfirmedResult(m) && m.loggedAt && now - m.loggedAt > DAY);
    if (stale.length) {
      const ids = new Set(stale.map((m) => m.id));
      setMatches(matches.map((m) => (ids.has(m.id) ? { ...m, status: "confirmed" } : m)));
    }
  }, [matches]);
  // A delete request goes through 24h after it's made, if nobody's acted on
  // it — same silent-timeout shape as the pending-match sweep above.
  useEffect(() => {
    const DAY = 24 * 3600 * 1000;
    const now = Date.now();
    const due = matches.filter((m) => m.deleteRequestedAt && now - m.deleteRequestedAt > DAY);
    if (due.length) {
      const ids = new Set(due.map((m) => m.id));
      setMatches(matches.filter((m) => !ids.has(m.id)));
    }
  }, [matches]);
  const confirmMatch = (id) => setMatches(matches.map((m) => m.id === id ? { ...m, status: "confirmed" } : m));
  const disputeMatch = (id) => setMatches(matches.filter((m) => m.id !== id));
  const updateGroup = (id, patch) => saveGroups(groups.map((g) => g.id === id ? { ...g, ...patch } : g));
  const removePlayer = (id) => saveData({ ...gdata, players: gdata.players.filter((p) => p.id !== id), matches: gdata.matches.filter((m) => m.p1 !== id && m.p2 !== id) });
  const ranked = useMemo(() => {
    const arr = players.filter((p) => !p.inactive);
    const avgOpp = {};
    players.forEach((p) => { avgOpp[p.id] = { sum: 0, n: 0 }; });
    matches.filter((m) => countsAsPlayed(m)).forEach((m) => {
      if (avgOpp[m.p1]) { avgOpp[m.p1].sum += (elo[m.p2] ?? 0); avgOpp[m.p1].n++; }
      if (avgOpp[m.p2]) { avgOpp[m.p2].sum += (elo[m.p1] ?? 0); avgOpp[m.p2].n++; }
    });
    const recScore = (p) => {
      const r = wdl[p.id] || { w: 0, d: 0, l: 0, gp: 0 };
      if (!r.gp) return -1;
      const activity = r.gp / (r.gp + 5);
      const ao = avgOpp[p.id].n ? avgOpp[p.id].sum / avgOpp[p.id].n : 0;
      const oppFactor = Math.max(0.5, Math.min(2, 1 + ao / 200));
      return winPct(r) * activity * oppFactor;
    };
    const formScoreOf = (p) => (form[p.id] || []).slice(-5).reduce((s, x) => s + (x === "W" ? 1 : x === "L" ? -1 : 0), 0);
    if (rankingMode === "elo") arr.sort((a, b) => (elo[b.id] ?? START_ELO) - (elo[a.id] ?? START_ELO));
    else if (rankingMode === "record") arr.sort((a, b) => recScore(b) - recScore(a) || (wdl[b.id]?.w ?? 0) - (wdl[a.id]?.w ?? 0));
    else if (rankingMode === "winpct") arr.sort((a, b) => { const ra = wdl[a.id] || { gp: 0 }, rb = wdl[b.id] || { gp: 0 }; if (!ra.gp && !rb.gp) return 0; if (!ra.gp) return 1; if (!rb.gp) return -1; return winPct(rb) - winPct(ra) || rb.gp - ra.gp; });
    else if (rankingMode === "form") arr.sort((a, b) => { const ra = wdl[a.id] || { gp: 0 }, rb = wdl[b.id] || { gp: 0 }; if (!ra.gp && !rb.gp) return 0; if (!ra.gp) return 1; if (!rb.gp) return -1; return formScoreOf(b) - formScoreOf(a) || (rb.w ?? 0) - (ra.w ?? 0); });
    else { const off = officialPoints; arr.sort((a, b) => ((off[b.id] ?? -1e9) - (off[a.id] ?? -1e9)) || ((elo[b.id] ?? 0) - (elo[a.id] ?? 0)) || ((wdl[a.id]?.gp ?? 0) - (wdl[b.id]?.gp ?? 0))); }
    return arr;
  }, [players, elo, wdl, form, matches, rankingMode, officialPoints]);

  /**
   * Your place across Rally, and in the leagues you are in but not looking at.
   *
   * Up here with the other hooks, above every early return, rather than down
   * beside the value it wanted. That is the exact crash §8 records: this
   * component returns early while it loads, so an effect below those returns
   * runs on the second render and not the first, React counts more hooks than
   * last time, and throws. It finds its player row in gdata instead of using
   * the one derived further down — one find, and the hook stays where it has
   * to be.
   *
   * Only while Home is on screen, since that is the only place it shows and
   * the other-league half costs a full league load each. Both loaders cache —
   * sixty seconds for the global table, two minutes for the places — so
   * moving between tabs re-runs nothing.
   *
   * Failures are swallowed per source: a standing nobody could load is one
   * fewer slide, and the league you are actually looking at is already on
   * screen and never at risk from any of it.
   */
  useEffect(() => {
    const mineRow = (gdata.players || []).find((p: any) => p.id === gdata.me);
    if (tab !== "home" || !myAuthId || !mineRow || !gid || isFriendlyLeague(gid)) return;
    let alive = true;
    (async () => {
      const found: Standing[] = [];
      try {
        const place = await globalRankFor(globalKeyFor(mineRow));
        if (place) {
          found.push({
            scope: "Across Rally",
            rank: place.rank,
            // A provisional player has no place on the global table — it
            // prints a dash and a count, and so does this, rather than a
            // number that screen would refuse to show.
            note: place.provisional ? place.played + " played" : null,
            // Named, because this slide and the league slide are two different
            // metrics on two different scales. See Standing.unit.
            unit: place.unit,
            rating: place.rating,
            footer: place.provisional
              ? "Ranked at " + PROVISIONAL_GAMES + " matches"
              : "of " + place.of + " ranked across every league",
          });
        }
      } catch {}
      try {
        const others = (await listMyLeagues()).filter((l: any) => l.id !== gid);
        if (others.length) {
          const places = await myLeaguePlaces(others, myAuthId);
          places.forEach((pl) => found.push({ scope: pl.name, rank: pl.place, rating: pl.rating, unit: OFFICIAL_UNIT, footer: "of " + pl.of + " players" }));
        }
      } catch {}
      if (alive) setOtherStandings(found);
    })();
    return () => { alive = false; };
  }, [tab, myAuthId, gid, gdata]);


  if (friendlyUnavailable) return (
    <div style={{ ...wrap, minHeight: "100vh", padding: "24px 18px 24px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 20, color: CHALK }}>Friendlies aren&apos;t switched on yet</div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 14.5, color: MUTED, marginTop: 10, lineHeight: 1.55 }}>
          Matches outside a league need one database update that hasn&apos;t been
          run — <span style={{ color: CHALK }}>supabase/schema_friendly_players.sql</span>.
          Nothing is broken, and your leagues are unaffected.
        </div>
        <button
          onClick={() => { if (typeof window !== "undefined") window.location.href = "/"; }}
          style={{ width: "100%", background: BALL, color: COURT, border: "none", borderRadius: 16, padding: "13px 14px", marginTop: 18, cursor: "pointer", fontFamily: body, fontWeight: 500, fontSize: 15 }}
        >
          Back to your leagues
        </button>
      </div>
    </div>
  );

  if (loadError) return (
    <div style={{ ...wrap, display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", maxWidth: 300 }}>
        <div style={{ color: CHALK, fontFamily: body, fontSize: 15, marginBottom: 6 }}>Couldn&apos;t load this league</div>
        <div style={{ color: MUTED, fontFamily: body, fontSize: 13, marginBottom: 16 }}>Your data is safe — this was just a connection problem. Nothing was changed.</div>
        <button onClick={() => boot()} style={{ background: BALL, color: COURT, border: "none", borderRadius: 12, padding: "11px 20px", fontFamily: body, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Try again</button>
      </div>
    </div>
  );
  if (loading) return <LoadingScreen />;

  if (claimUI) {
    const showSuggestion = claimUI.candidate && !declinedCandidate;
    return (
      <div style={{ position: "fixed", inset: 0, background: COURT, zIndex: 100, overflowY: "auto" }}>
        {showSuggestion ? (
          <PlayerClaim player={claimUI.candidate} onClaim={() => resolveClaim(claimUI.candidate)} onNotMe={() => setDeclinedCandidate(true)} />
        ) : (
          <div style={{ maxWidth: 620, margin: "0 auto", padding: "40px 20px 60px" }}>
            <div style={{ fontFamily: body, fontWeight: 600, color: BALL, fontSize: 13 }}>Welcome{claimUI.nameToUse ? ", " + claimUI.nameToUse : ""}</div>
            <h1 style={{ fontFamily: body, fontWeight: 700, color: CHALK, margin: "6px 0 16px", fontSize: 26, lineHeight: 1.2 }}>Is one of these you?</h1>
            <div style={{ fontFamily: body, fontSize: 13, color: MUTED, marginBottom: 18, lineHeight: 1.5 }}>Pick your existing player to inherit its history — nothing gets claimed automatically, you choose. Or start a brand new profile.</div>
            <div style={listCard}>
              {claimUI.others.filter((p) => !claimUI.candidate || p.id !== claimUI.candidate.id).map((p) => (
                <button key={p.id} onClick={() => resolveClaim(p)} style={listRow}>
                  <Avatar player={p} size={36} />
                  <span style={{ flex: 1, fontFamily: body, fontSize: 15, color: CHALK, fontWeight: 600 }}>{p.name}{p.last ? " " + p.last : ""}</span>
                  <span style={{ color: BALL, fontFamily: body, fontWeight: 600, fontSize: 13 }}>Claim ›</span>
                </button>
              ))}
            </div>
            <button onClick={() => resolveClaim(null)} style={{ width: "100%", background: "transparent", border: "none", borderRadius: 12, padding: "13px 14px", marginTop: 12, cursor: "pointer", color: MUTED, fontFamily: body, fontWeight: 600, fontSize: 13 }}>
              None of these — create a new profile
            </button>
          </div>
        )}
      </div>
    );
  }

  const group = groups.find((g) => g.id === gid) || { id: gid, name: "League", ownerId: null, requireSetup: undefined, season: undefined };
  const meId = players.some((p) => p.id === gdata.me) ? gdata.me : players[0]?.id;


  /**
   * Asked once, then never again.
   *
   * Kept in user_storage rather than on the player row: it is a fact about
   * this person's relationship with the app, not about the player, and it
   * needs no migration. Answering counts as being asked — so does saying not
   * now, because a prompt that returns after you declined it is not a prompt,
   * it is nagging.
   */

  // Gated on the real league_members.role from Postgres, not the group's
  // ownerId field — that field is never actually persisted anywhere, so it
  // silently fell back to "whoever's currently looking at the screen" and
  // gave every member the same bulk-delete/direct-edit powers as the
  // league's real owner. Only owner/editor gets these.
  const canManageMatches = !!meId && (leagueRole === "owner" || leagueRole === "editor");

  /**
   * A level an owner or editor filled in for somebody who never has.
   *
   * Deliberately not routed through saveData. Every other player write goes
   * out as a whole row and is refused on any row with an auth_id — which is
   * the protection, not an obstacle. This writes four separate columns through
   * set_player_level_estimate(), so the local state is patched directly here
   * rather than through setPlayers, which would try to save the row again and
   * be refused.
   */
  const saveLevelEstimate = async (id: string, level: any, history: any[]) => {
    await setLevelEstimate(id, level, history);
    setGdata((g: any) => ({
      ...g,
      players: (g.players || []).map((p: any) =>
        p.id === id ? { ...p, levelEstimate: level, levelEstimateHistory: history } : p),
    }));
  };
  const me = players.find((p) => p.id === meId);
  const finishOnboarding = (hist) => {
    if (hist && meId) {
      // `hist` may be either the previous array form or the new object form
      // { levelHistory, initialRecord, initialElo } — handle both.
      if (Array.isArray(hist)) {
        const last = hist[hist.length - 1];
        setPlayers(players.map((p) => p.id === meId ? { ...p, levelHistory: hist, level: last ? { cat: last.cat, sub: last.sub } : p.level } : p));
      } else {
        const last = (hist.levelHistory || []).slice(-1)[0];
        setPlayers(players.map((p) => p.id === meId ? {
          ...p,
          levelHistory: hist.levelHistory || p.levelHistory,
          level: last ? { cat: last.cat, sub: last.sub } : p.level,
          initialRecord: hist.initialRecord || p.initialRecord,
          initialElo: hist.initialElo || p.initialElo,
        } : p));
      }
    }
    setOnboarded(true); persistSettings({ onboarded: true });
  };
  // How many active players nobody has recorded a level history for. Their
  // matches count flat, so this is a number worth carrying into the menu.
  // An admin estimate counts: the badge is about whether the ratings can
  // grade those matches, and they grade an estimate exactly as they grade a
  // claim. A badge that stayed lit after the repair was done would send
  // somebody back to a screen with nothing left to do on it.
  const missingLevelHistory = players.filter((p) =>
    !p.inactive
    && !(p.levelHistory && p.levelHistory.length)
    && !(p.levelEstimateHistory && p.levelEstimateHistory.length)).length;
  const pendingForMe = matches.filter((m) => isUnconfirmedResult(m) && (m.p1 === meId || m.p2 === meId) && m.reportedBy !== meId).length;
  const homeData = (() => {
    if (!meId) return null;
    const mine = matches.filter((m) => m.p1 === meId || m.p2 === meId);
    const iAm = (m) => (m.p1 === meId ? "p1" : "p2");
    const first = (id) => players.find((p) => p.id === id)?.name || "them";

    // Where you stand. The place and the arrow both come from officialRanks,
    // which is also what the weekly snapshot records — one source, so the
    // three numbers on this card cannot disagree with each other.
    const rec = wdl[meId];
    const standing = rec && rec.gp > 0 && officialRanks[meId] ? {
      rank: officialRanks[meId],
      rating: Math.round(officialPoints[meId] ?? 0),
      unit: OFFICIAL_UNIT,
      movement: movement[meId] ?? null,
      form: (form[meId] || []).slice(-5),
    } : null;

    // Results you logged that the other player hasn't agreed to yet. Only
    // yours: nudging asks somebody to confirm something, and a result they
    // logged is waiting on you, not on them.
    const pending = mine
      .filter((m) => isUnconfirmedResult(m) && m.reportedBy === meId)
      .map((m) => {
        const them = first(m.p1 === meId ? m.p2 : m.p1);
        const remaining = m.loggedAt ? m.loggedAt + 24 * 3600 * 1000 - Date.now() : null;
        return {
          matchId: m.id,
          headline: m.winner === "draw" ? "You drew with " + them
            : m.winner === iAm(m) ? "You beat " + them : "You lost to " + them,
          score: m.score || null,
          waitingOn: them,
          // Null where there is no loggedAt: those results predate the
          // auto-confirm sweep and never expire, so the card says nothing
          // about timing rather than inventing a deadline.
          autoConfirmsInHours: remaining === null ? null : Math.max(0, Math.ceil(remaining / 3600000)),
          nudgedAt: m.nudgedAt ?? null,
        };
      });

    // Only a booked fixture can fill this tile. An unbooked one has no when,
    // and "next up" without a when is not next anything.
    //
    // Sorted, not found. It used to take whichever booked fixture came first
    // in the array, so "next up" could be three weeks out while one tomorrow
    // sat below it — the tile was answering a different question to the one
    // its label asks.
    const bookedNext = (fixtures || [])
      .filter((f) => !f.done && f.booked && (f.p1 === meId || f.p2 === meId))
      .map((f) => ({ f, t: new Date(f.booked).getTime() }))
      .filter((x) => !isNaN(x.t))
      .sort((a, b) => a.t - b.t)[0]?.f;

    // The other half of the booking loop. A match whose time has been and
    // gone, with no result — ask about it on Home rather than waiting for
    // somebody to remember to visit Fixtures.
    //
    // Measured from the END of the match, not its start: being asked how it
    // went while you are still on court is worse than not being asked.
    //
    // And it stops asking after AUTO_CANCEL_DAYS. A card that has been
    // ignored for a week is not going to be answered, and one that never
    // goes away teaches you to look past that part of the screen. The
    // fixture stays on Fixtures, still enterable — giving up on asking is
    // not the same as deciding it never happened.
    const nowMs = Date.now();
    const awaitingResult = (fixtures || [])
      .filter((f) => !f.done && f.booked && (f.p1 === meId || f.p2 === meId))
      .map((f) => ({ f, ends: new Date(f.booked).getTime() + DEFAULT_DURATION_MINUTES * 60000 }))
      .filter((x) => !isNaN(x.ends) && nowMs > x.ends && nowMs < x.ends + AUTO_CANCEL_DAYS * 86400000)
      .sort((a, b) => a.ends - b.ends)
      .map(({ f }) => {
        const oppId = f.p1 === meId ? f.p2 : f.p1;
        const opp = players.find((p) => p.id === oppId);
        return { fixtureId: f.id, opponent: opp ? fullNameOf(opp) : first(oppId), opponentFirst: first(oppId), meIsP1: f.p1 === meId, when: f.booked };
      });

    let nextUp: any = null;
    if (bookedNext) {
      const oppId = bookedNext.p1 === meId ? bookedNext.p2 : bookedNext.p1;
      const opp = players.find((p) => p.id === oppId);
      // Read the prediction engine, never write to it. predictProb returns
      // null-ish only when it has nothing at all to go on.
      let pct: number | null = null;
      try {
        const raw = predictProb(meId, oppId, matches, elo, players);
        pct = raw == null || isNaN(raw) ? null : Math.round(raw * 100);
      } catch { pct = null; }
      nextUp = {
        opponent: opp ? fullNameOf(opp) : first(oppId),
        when: bookedNext.booked,
        winChance: pct,
        line: nextUpLine(pct),
      };
    }

    // Calendar spans, not rolling windows: "this month" is what the tile
    // says, and people read it as the month they are in. The week starts
    // Monday, which is what a club season runs on — a Sunday start would
    // put last night's match in "this week" on a Sunday morning.
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(midnight);
    weekStart.setDate(midnight.getDate() - ((midnight.getDay() + 6) % 7));
    const spans: { label: string; from: number }[] = [
      { label: "This week", from: weekStart.getTime() },
      { label: "This month", from: new Date(now.getFullYear(), now.getMonth(), 1).getTime() },
      { label: "This year", from: new Date(now.getFullYear(), 0, 1).getTime() },
    ];
    const played = mine.filter((m) => countsAsPlayed(m));
    // Every span, including the empty ones. They were filtered out at first,
    // on the reasoning that a loop landing on "nothing yet" reads as broken —
    // Sam's answer was that he knows he has not played this week and still
    // wants to see it, which is the better argument: an empty week is a fact
    // about his week, and a tile that quietly omits it is a tile you cannot
    // trust to be showing you everything.
    const periods = spans.map(({ label, from }) => {
      const within = played.filter((m) => m.date >= from);
      const w = within.filter((m) => m.winner === iAm(m)).length;
      const l = within.filter((m) => m.winner !== "draw" && m.winner !== iAm(m)).length;
      // Different people, not matches played. Six games against one person is
      // a rivalry and six against six is a season, and the Opponents tile is
      // there to tell those apart.
      //
      // Beaten and lost-to are counted the same way and deliberately overlap:
      // split a pair of matches with somebody and they are in both, because
      // you did beat them and you did lose to them. The two therefore do not
      // have to add up to the number faced, and forcing them to would mean
      // picking which of those two true things to throw away.
      const faced = new Set<string>();
      const beaten = new Set<string>();
      const lostTo = new Set<string>();
      within.forEach((m) => {
        const them = m.p1 === meId ? m.p2 : m.p1;
        faced.add(them);
        if (m.winner === "draw") return;
        if (m.winner === iAm(m)) beaten.add(them); else lostTo.add(them);
      });
      return {
        label, w, l,
        // No matches means no win rate — 0/0 is not 0%. The tile says so in
        // words instead.
        winRate: within.length ? Math.round((w / within.length) * 100) : null,
        opponents: faced.size,
        beaten: beaten.size,
        lostTo: lostTo.size,
        played: within.length,
      };
    });

    // ---------------------------------------------------------------- focus
    //
    // The middle of Home. Sam, 2026-09-22: three cards were spending their
    // whole area saying nothing had happened. What replaces them depends on
    // whether anything has.

    const week = periods[0];               // spans[0] is "This week"
    const weekMatches = played
      .filter((m) => m.date >= spans[0].from)
      .sort((a, b) => a.date - b.date);

    // Days since the last match, counted in whole days from midnight to
    // midnight — not from the kick-off time, which would call a match played
    // this morning "0" and one played last night "1".
    const dayStart = (ts: number) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
    const lastPlayed = played.length ? played.reduce((a, b) => (a.date > b.date ? a : b)) : null;
    const daysSince = lastPlayed ? Math.max(0, Math.round((midnight.getTime() - dayStart(lastPlayed.date)) / 86400000)) : null;
    const lastMatch = lastPlayed ? (() => {
      const them = lastPlayed.p1 === meId ? lastPlayed.p2 : lastPlayed.p1;
      const opp = players.find((p) => p.id === them);
      return {
        opponent: opp ? fullNameOf(opp) : first(them),
        outcome: (lastPlayed.winner === "draw" ? "D" : lastPlayed.winner === iAm(lastPlayed) ? "W" : "L") as "W" | "D" | "L",
        date: lastPlayed.date,
      };
    })() : null;

    // Draws count as half, the same way every other win rate in the app does.
    const allTime = wdl[meId];
    const winRateAllTime = allTime && allTime.gp
      ? Math.round(((allTime.w + allTime.d * 0.5) / allTime.gp) * 100)
      : null;

    /**
     * Two people worth playing next.
     *
     * Sam widened this from "the person immediately above you" — "maybe we
     * have suggested and it has Zaach or Charlie for example as suggested to
     * book against". One name reads as a verdict about the table; two read as
     * an invitation, which is what it is.
     *
     * Ranked on nearness in the table, with a nudge towards people you have
     * not played lately. Both halves matter: the closest player is the best
     * game, and the one you have not seen for six months is the one a
     * suggestion is actually FOR — a card recommending the person you played
     * on Tuesday is telling you something you already knew.
     *
     * Deliberately carries no metric. The old version printed an Official
     * gap, which meant pinning this card to one ranking while the card above
     * it cycled through others; a reason in words cannot disagree with its
     * neighbour, and says more to somebody deciding who to call.
     */
    const suggestions = (() => {
      if (!meId || !officialRanks[meId]) return [];
      const myRank = officialRanks[meId];
      const lastPlayedWith: Record<string, number> = {};
      played.forEach((m) => {
        const them = m.p1 === meId ? m.p2 : m.p1;
        if (!lastPlayedWith[them] || m.date > lastPlayedWith[them]) lastPlayedWith[them] = m.date;
      });
      const DAY = 86400000;
      const scored = players
        .filter((p) => !p.inactive && p.id !== meId && officialRanks[p.id])
        .map((p) => {
          const places = Math.abs(officialRanks[p.id] - myRank);
          const since = lastPlayedWith[p.id] ? (Date.now() - lastPlayedWith[p.id]) / DAY : null;
          // Nearness dominates; staleness breaks the ties it leaves. Capped
          // at 180 days so somebody you have never played does not outrank
          // the whole table on novelty alone.
          const stale = since === null ? 120 : Math.min(180, since);
          return { p, places, since, score: places * 10 - stale / 12 };
        })
        .sort((a, b) => a.score - b.score)
        .slice(0, 2);

      // ONE fact, not two. The first version joined the placement and the
      // staleness — "One place above you · not since 13 Feb 2026" — which is
      // about 38 characters into roughly 155 pixels, so it arrived on screen
      // as "One place above you · not sinc…". Two facts truncated into one and
      // a half is worse than either on its own.
      //
      // So: how long it has been, when that is the notable thing, and where
      // they sit otherwise. Somebody you played last week does not need
      // telling when; somebody you have not seen since February does.
      const monthYear = (ts: number) => {
        try { return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "long", year: "numeric" }).format(new Date(ts)); }
        catch { return formatMatchDate(ts); }
      };
      return scored.map(({ p, places, since }) => {
        const where = officialRanks[p.id] < myRank
          ? places === 1 ? "One place above you" : places + " places above you"
          : places === 1 ? "One place below you" : places + " places below you";
        const reason = since === null ? "You have never played"
          : since >= 60 ? "Last played " + monthYear(lastPlayedWith[p.id])
          : where;
        return { player: p, reason };
      });
    })();

    // Head to head on the booked match, from your side.
    const h2hLine = (oppId: string): string | null => {
      const between = played.filter((m) => (m.p1 === oppId || m.p2 === oppId));
      if (!between.length) return null;
      let w = 0, d = 0, l = 0;
      between.forEach((m) => { if (m.winner === "draw") d++; else if (m.winner === iAm(m)) w++; else l++; });
      const them = players.find((p) => p.id === oppId);
      const head = w > l ? "You lead " : l > w ? (them?.name || "They") + " leads " : "Level at ";
      const last = between.reduce((a, b) => (a.date > b.date ? a : b));
      const lastBit = last.winner === "draw" ? null
        : last.winner === iAm(last) ? " · you won the last one"
        : " · they won the last one";
      return head + w + "–" + d + "–" + l + (lastBit || "");
    };

    const focus = {
      daysSince,
      waiting: Math.max(0, players.filter((p) => !p.inactive && p.id !== meId).length),
      lastMatch,
      week: {
        range: weekMatches.length
          ? rangeText(spans[0].from, spans[0].from + 6 * 86400000)
          : "",
        w: week.w,
        l: week.l,
        opponents: week.opponents,
        results: weekMatches.map((m) => (m.winner === "draw" ? "D" : m.winner === iAm(m) ? "W" : "L") as "W" | "D" | "L"),
      },
      suggestions,
      nextUp: bookedNext ? {
        opponent: nextUp.opponent,
        when: bookedNext.booked,
        venue: (bookedNext as any).venue ?? null,
        h2h: h2hLine(bookedNext.p1 === meId ? bookedNext.p2 : bookedNext.p1),
      } : null,
    };

    return { standing, pending, nextUp, periods, awaitingResult, focus };
  })();
  const profilePlayer = players.find((p) => p.id === profileId);
  const matchDetailMatch = matches.find((m) => m.id === matchDetailId);
  const legacyPlayer = players.find((p) => p.id === legacyId);
  const shared = { players, elo, wdl, form, deltas, ratingBefore, matches, nameOf, ranked, showElo: true, onOpen: openProfile, fixtures, group, groups, meId, myAuthId, onMessage: (authId: string) => { setMsgWith(authId); setProfileId(null); setTab("messages"); }, onOpenMatches: (pid: string, m: MatchesMode) => { setMatchesFor(pid); setMatchesMode(m); setProfileId(null); setTab("matches"); }, onProposeEdit: proposeEdit, onOpenMatch: setMatchDetailId };
  // Home brings its own header — a greeting and a league name, not a page
  // title — so the shared one sits this tab out rather than stacking two.
  const feed = <History mode={tab === "fixtures" ? "fixtures" : "feed"} posts={posts} onPost={addPost} onRemovePost={removePost} matches={matches} players={players} elo={elo} nameOf={nameOf} meId={meId} groupName={group?.name} fixtures={fixtures} onGenerate={generateFixtures} onClearFixtures={clearFixtures} onResolveFixture={resolveFixture} onBookFixture={bookFixture} onAddFixture={addFixture} onRemoveFixture={removeFixture} onCreatePlayer={addPlayer} challengeWith={challengeWith} onConfirm={confirmMatch} onDispute={disputeMatch} onDelete={disputeMatch} canEditMatches={canManageMatches} onEditMatch={editMatch} onApproveEdit={approveEdit} onRejectEdit={rejectEdit} onAgreeDelete={agreeDelete} onCancelDelete={cancelDeleteRequest} onOpenMatch={setMatchDetailId} onOpenProfile={openProfile} wdl={wdl} leagueId={gid} friendly={isFriendlyLeague(gid)} onNudge={nudgeMatch} doublesMatches={!!doublesEnabled && !personal ? doubles.matches : undefined} />;
  const main = tab === "ladder" || tab === "add" || tab === "fixtures" || tab === "profile";
  // Your circle: you, plus everyone you've personally faced. Handed to the
  // ordinary LeagueHome as its player list, which is all it takes to make a
  // personal league behave like any other one — computeStats only counts a
  // match when it has both players, so filtering the roster scopes the
  // results for free, and every control (year, Active/Non-active, ranking
  // mode, Legacy) keeps working untouched.
  const myCirclePlayers = (() => {
    const ids = new Set<string>(meId ? [meId] : []);
    (matches || []).forEach((m: any) => {
      if (m.p1 === meId) ids.add(m.p2);
      else if (m.p2 === meId) ids.add(m.p1);
    });
    return (players || []).filter((p: any) => ids.has(p.id));
  })();
  // No name, no season, no join code — a league you never had to create.
  const personalGroup = { name: "Everyone I've played" };

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "22px 16px 110px" }}>
        {main && (
          <header style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              {/* Same corner mark as Home, in the same place. The header is
                  identical across the four tabs and the logo has to be part
                  of that or it reappears and vanishes as you move. */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <RallyMark title="Rally" />
                <button onClick={() => setGroupSheet(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, background: PANEL, border: "none", borderRadius: 18, padding: "0 14px", cursor: "pointer", color: BALL, fontFamily: body, fontWeight: 600, fontSize: 15, minWidth: 0 }}>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{personal ? "Everyone I've played" : (group?.name || "League")}</span> <ChevronDown size={13} style={{ flexShrink: 0 }} />
                </button>
              </div>
              <ThemePicker />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
              <h1 style={{ fontFamily: display, fontWeight: 800, color: CHALK, margin: "10px 0 0", fontSize: 32, lineHeight: 1.05, textTransform: "uppercase", letterSpacing: "-0.5px", minWidth: 0 }}>
                {tab === "ladder" ? "Table" : tab === "add" ? "Add result" : tab === "fixtures" ? "Fixtures" : "Profile"}
              </h1>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {/* Finding somebody is a top-level thing to want, and until
                    now the only way to reach a person was to already share a
                    league with them. */}
                <a href="/search" aria-label="Find a player" style={{ background: FEED_RAISED, borderRadius: 999, width: 38, height: 38, display: "grid", placeItems: "center", flexShrink: 0, color: FEED_TEXT_MID, textDecoration: "none" }}>
                  <Search size={18} strokeWidth={2} />
                </a>
                <button onClick={() => { setMsgWith(null); setTab("messages"); }} aria-label={unreadMsgs > 0 ? `Messages, ${unreadMsgs} unread` : "Messages"} style={{ position: "relative", background: FEED_RAISED, border: "none", borderRadius: 999, width: 38, height: 38, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0, overflow: "visible" }}>
                  <MessageRobins count={unreadMsgs} />
                </button>
                <div style={{ background: FEED_RAISED, borderRadius: 999, width: 38, height: 38, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <NotificationBell meId={meId} players={players} matches={matches} posts={posts} nameOf={nameOf} onOpenMatch={setMatchDetailId} onGoFriends={() => setTab("friends")} onGoAdmin={() => setTab("clubadmin")} />
                </div>
                {tab === "profile" && (
                  <button onClick={() => setMenuOpen(true)} aria-label="Menu" style={{ background: PANEL, border: "none", borderRadius: 999, width: 36, height: 36, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3.5, flexShrink: 0 }}>
                    {[0, 1, 2].map((i) => <span key={i} style={{ display: "block", width: 17, height: 2, background: BALL, borderRadius: 2 }} />)}
                  </button>
                )}
              </div>
            </div>
          </header>
        )}

        {/* The switch only exists when the league has doubles on. With the
            flag off these two lines render nothing and the screens below are
            byte-for-byte what they were. */}
        {(tab === "ladder" || tab === "add" || tab === "profile" || tab === "fixtures") && !!doublesEnabled && !personal && (
          <ModeSwitch mode={sport} onMode={setSport} />
        )}
        {tab === "ladder" && !personal && pendingForMe > 0 && <button onClick={() => setTab("home")} style={{ width: "100%", background: PANEL, border: "1px solid " + BALL, borderRadius: 14, padding: "12px 14px", marginBottom: 14, cursor: "pointer", color: BALL, fontFamily: body, fontSize: 14, fontWeight: 600, textAlign: "left" }}>{pendingForMe} result{pendingForMe > 1 ? "s" : ""} waiting for you to agree →</button>}
        {tab === "ladder" && <button onClick={() => setTab("global")} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: PANEL, border: "none", borderRadius: 14, padding: "12px 14px", marginBottom: 14, cursor: "pointer", textAlign: "left" }}><Globe size={18} /><span style={{ flex: 1 }}><span style={{ display: "block", fontFamily: body, fontWeight: 500, fontSize: 14.5, color: CHALK }}>Global table</span><span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, marginTop: 1 }}>Everyone you&apos;ve played, ranked on their own record</span></span><ChevronRight size={16} color={BALL} strokeWidth={2} style={{ flexShrink: 0 }} /></button>}
        {tab === "ladder" && (
          <div style={{ ...segmentTrack, marginBottom: 14 }}>
            <button onClick={() => setTableMode("standings")} style={segmentOption(tableMode === "standings")}>Standings</button>
            <button onClick={() => setTableMode("compare")} style={segmentOption(tableMode === "compare")}>Compare</button>
          </div>
        )}
        {tab === "ladder" && tableMode === "compare" && <HeadToHead players={players} matches={matches} elo={elo} wdl={wdl} nameOf={nameOf} onOpen={openProfile} onCreatePlayer={addPlayer} initialA={meId} initialB={compareWith} />}
        {tab === "ladder" && tableMode === "standings" && showDoubles && !personal && (
          doubles.unavailable
            ? <div style={{ margin: "14px 16px 0", padding: 22, borderRadius: 26, background: PANEL, fontFamily: body, fontSize: 15, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
                {/* States what happened, not why. The read failed; the cause
                    might be the migration, might be the network, might be a
                    league id this build made up. Naming one of those as THE
                    reason is a guess presented as a diagnosis. */}
                Couldn&apos;t load doubles for this league just now.
              </div>
            : <DoublesStandings players={players} matches={doubles.matches} meId={meId} onOpen={openProfile} />
        )}
        {tab === "ladder" && tableMode === "standings" && !showDoubles && <LeagueHome players={personal ? myCirclePlayers : players} matches={matches} group={personal ? personalGroup : group} fixtures={personal ? [] : fixtures} mode={rankingMode} onMode={setMode} onOpen={openProfile} onCompare={(id: string) => { setCompareWith(id); setTableMode("compare"); }} onOpenLegacy={setLegacyId} meId={meId} movement={(!rankingMode || rankingMode === "overall" || rankingMode === "official") ? movement : undefined} onGoGlobal={() => setTab("global")} requireSetup={personal ? false : group?.requireSetup} nameOf={nameOf} />}
        {tab === "add" && showDoubles && (
          <DoublesEntry
            players={players}
            history={doubles.matches}
            meId={meId}
            onSave={async (m) => {
              try {
                await doubles.add({ ...m, playedAt: Date.now(), enteredBy: meId });
                flash("Logged");
                setTab("home");
              } catch (e: any) {
                flash(e?.message || "Could not save that doubles match.");
              }
            }}
          />
        )}
        {tab === "add" && !showDoubles && <LogResult players={players} matches={matches} elo={elo} meId={meId} onSave={(mt) => { setMatches([mt, ...matches]); flash(isUnconfirmedResult(mt) ? "Logged — awaiting opponent's OK" : "Logged"); setTab("home"); }} onSaveMany={(arr) => { setMatches([...arr, ...matches]); flash("Added " + arr.length + " results"); setTab("ladder"); }} onCreatePlayer={addPlayer} onDeleteBetween={canManageMatches ? (a, b, year) => { deleteBetween(a, b, year); flash(year ? "Cleared " + year : "Cleared"); } : null} />}
        {tab === "home" && (
          <Home
            doublesCard={!!doublesEnabled && !personal && !doubles.unavailable && meId ? (
              <DoublesRankCard
                players={players}
                matches={doubles.matches}
                meId={meId}
                leagueName={group?.name || leagueName || "League"}
                onLogDoubles={() => { setSport("doubles"); setTab("add"); }}
              />
            ) : undefined}
            header={{
              leagueName: personal ? "Everyone I've played" : (group?.name || "League"),
              greeting: greetingFor(players.find((p) => p.id === meId)?.name || displayName || ""),
              onPickLeague: () => setGroupSheet(true),
              bell: (
                <>
                  {/* Same as the other header: finding somebody is a
                      top-level thing to want. */}
                  <a href="/search" aria-label="Find a player" style={{ background: FEED_RAISED, borderRadius: 999, width: 38, height: 38, display: "grid", placeItems: "center", flexShrink: 0, color: FEED_TEXT_MID, textDecoration: "none" }}>
                    <Search size={18} strokeWidth={2} />
                  </a>
                  <button onClick={() => { setMsgWith(null); setTab("messages"); }} aria-label={unreadMsgs > 0 ? `Messages, ${unreadMsgs} unread` : "Messages"} style={{ position: "relative", background: FEED_RAISED, border: "none", borderRadius: 999, width: 38, height: 38, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0, overflow: "visible" }}>
                    <MessageRobins count={unreadMsgs} />
                  </button>
                  <div style={{ background: FEED_RAISED, borderRadius: 999, width: 38, height: 38, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <NotificationBell meId={meId} players={players} matches={matches} posts={posts} nameOf={nameOf} onOpenMatch={setMatchDetailId} onGoFriends={() => setTab("friends")} onGoAdmin={() => setTab("clubadmin")} />
                  </div>
                </>
              ),
            }}
            standing={homeData?.standing ? {
              ...homeData.standing,
              // This league first — it is the one you opened. The rest follow
              // in whatever order they loaded, which is global then the others.
              standings: [
                { scope: group?.name || "Your standing", ...homeData.standing },
                ...otherStandings,
              ],
            } : null}
            focus={homeData?.focus ? { ...homeData.focus, onBook: () => setTab("fixtures"), onOpenPlayer: openProfile } : null}
            whatsNew={newsSeen !== undefined && newsSeen !== RELEASE ? <WhatsNew onDismiss={closeWhatsNew} /> : null}
            levelRecheck={newsSeen === RELEASE && levelAsked === false && meId ? (
              <LevelRecheck
                current={players.find((p) => p.id === meId)?.level || null}
                onPick={(cat, sub) => {
                  setPlayers(players.map((p) => p.id === meId ? { ...p, level: { cat, sub } } : p));
                  closeLevelRecheck();
                  flash("Level updated");
                }}
                onDismiss={closeLevelRecheck}
              />
            ) : null}
            awaitingResult={homeData?.awaitingResult}
            onResolveFixture={(fixtureId, winner, score) => {
              const fx = (fixtures || []).find((f) => f.id === fixtureId);
              // No fixture means it has already gone — treat that as a
              // failure so the card keeps the score rather than clearing it.
              return fx ? resolveFixture(fx, winner, score) : Promise.resolve(false);
            }}
            onCancelFixture={removeFixture}
          >
            {feed}
          </Home>
        )}
        {tab === "fixtures" && !showDoubles && feed}
        {tab === "fixtures" && showDoubles && !personal && (
          <div style={{ marginTop: 14 }}>
            <DoublesFixtures
              players={players}
              fixtures={doubles.fixtures}
              stats={doubles.stats}
              meId={meId}
              canManage={!!canManageMatches}
              unavailable={doubles.fixturesUnavailable}
              onBook={async (f) => { await doubles.book({ ...f, createdBy: meId || null }); flash("Booked"); }}
              onReschedule={doubles.reschedule}
              onCancel={cancelDoublesFixture}
              onComplete={async (f, m) => { await doubles.complete(f, { ...m, enteredBy: meId }); flash("Logged"); }}
            />
          </div>
        )}
        {tab === "global" && <GlobalTable myAuthId={myAuthId} players={players} onOpenProfile={openProfile} onBack={() => setTab("ladder")} />}
        {/* Back to wherever you came from: the Table if a row sent you here,
            the profile menu otherwise. */}
        {tab === "h2h" && <SubHeader title="Compare" onBack={() => { const from = compareWith ? "ladder" : "profile"; setCompareWith(null); setTab(from); }} />}
        {tab === "h2h" && <HeadToHead players={players} matches={matches} elo={elo} wdl={wdl} nameOf={nameOf} onOpen={openProfile} onCreatePlayer={addPlayer} initialA={meId} initialB={compareWith} />}
        {tab === "profile" && showDoubles && !personal && (
          doubles.unavailable
            ? <div style={{ margin: "14px 16px 0", padding: 22, borderRadius: 26, background: PANEL, fontFamily: body, fontSize: 15, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
                Couldn&apos;t load doubles for this league just now.
              </div>
            : meId
              ? <DoublesProfile players={players} matches={doubles.matches} playerId={meId} leagueName={group?.name || leagueName || "League"} />
              : null
        )}
        {tab === "profile" && !showDoubles && <ProfileScreen players={players} meId={meId} shared={shared} onSetMe={setMe} goH2H={() => setTab("h2h")} goSettings={() => setTab("settings")} goEdit={() => setTab("myprofile")} goFriends={() => setTab("friends")} goQuality={() => { setMatchesFor(null); setMatchesMode("quality"); setTab("matches"); }} goHistory={() => { setMatchesFor(null); setMatchesMode("history"); setTab("matches"); }} />}
        {tab === "myprofile" && <SubHeader title="My profile" onBack={() => setTab("profile")} />}
        {tab === "myprofile" && <MyProfile players={players} meId={meId} setPlayers={setPlayers} flash={flash} />}
        {tab === "settings" && <SubHeader title="Settings" onBack={() => setTab("profile")} />}
        {tab === "settings" && <SettingsTab group={group} updateGroup={updateGroup} onRemovePlayer={removePlayer} fixtures={fixtures} onGenerate={generateFixtures} onClearFixtures={clearFixtures} onAddFixture={addFixture} onRemoveFixture={removeFixture} onLoadDemo={() => { flash("Demo data is off in the live app"); }} onClearResults={() => { setMatches([]); flash("Results cleared"); }} onImportHistoricalMatches={importHistoricalResults} players={players} setPlayers={setPlayers} matches={matches} flash={flash} meId={meId} leagueId={gid} displayName={displayName} />}
        {tab === "matches" && (
          <SubHeader
            title={!matchesFor || matchesFor === meId ? "Your matches" : shortNameOf(players.find((p) => p.id === matchesFor)) + "'s matches"}
            onBack={() => { if (matchesFor && matchesFor !== meId) openProfile(matchesFor); setMatchesFor(null); setTab("profile"); }}
          />
        )}
        {tab === "matches" && (
          <YourMatches
            viewerId={matchesFor || meId}
            meId={meId}
            players={players}
            matches={matches}
            mode={matchesMode}
            onMode={setMatchesMode}
            onOpenPlayer={openProfile}
            onOpenMatch={setMatchDetailId}
            onFixLevels={() => { setLevelsFrom("matches"); setTab("levels"); }}
          />
        )}
        {tab === "levels" && <SubHeader title="Level history" onBack={() => setTab(levelsFrom)} />}
        {tab === "levels" && <LevelRepair players={players} setPlayers={setPlayers} meId={meId} onEstimate={saveLevelEstimate} />}
        {tab === "clubadmin" && <SubHeader title="Club admin" onBack={() => setTab("profile")} />}
        {tab === "clubadmin" && <ClubAdminReview />}
        {tab === "help" && <SubHeader title="Help" onBack={() => setTab("profile")} />}
        {tab === "help" && <HelpGuide />}
        {tab === "messages" && <Messages startWith={msgWith} onStarted={() => setMsgWith(null)} players={players} onBack={() => setTab("profile")} onOpenProfile={openProfile} />}
        {tab === "friends" && <SubHeader title="Friends" onBack={() => setTab("profile")} />}
        {tab === "friends" && <Friends leagueJoinCode={leagueJoinCode} flash={flash} onMessage={(authId: string) => { setMsgWith(authId); setTab("messages"); }} />}
      </div>

      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, background: FEED_OVERLAY, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 96 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: PANEL, width: "100%", maxWidth: 620, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: "18px 16px 36px", boxShadow: "0 -8px 30px var(--shadow-strong)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: MUTED }}>Menu</span>
              <button onClick={() => setMenuOpen(false)} style={{ background: PANEL, border: "none", color: MUTED, borderRadius: 14, padding: "5px 12px", fontFamily: body, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Close</button>
            </div>
            <div style={listCard}>
              <button onClick={() => { setMenuOpen(false); setTab("myprofile"); }} style={listRow}><User size={18} color={BALL} /><span style={{ flex: 1, textAlign: "left", fontFamily: body, fontSize: 15, color: CHALK }}>Edit my profile</span><span style={{ color: MUTED }}>›</span></button>
              <button onClick={() => { setMenuOpen(false); setTab("friends"); }} style={listRow}><Users size={18} color={BALL} /><span style={{ flex: 1, textAlign: "left", fontFamily: body, fontSize: 15, color: CHALK }}>Friends</span><span style={{ color: MUTED }}>›</span></button>
              <button onClick={() => { setMenuOpen(false); setMsgWith(null); setTab("messages"); }} style={listRow}><Robin size={18} /><span style={{ flex: 1, textAlign: "left", fontFamily: body, fontSize: 15, color: CHALK }}>Messages</span>{unreadMsgs > 0 && <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 11, color: FEED_LIME_INK, background: BALL, borderRadius: 999, padding: "1px 8px" }}>{unreadMsgs}</span>}<span style={{ color: MUTED }}>›</span></button>
              <button onClick={() => { setMenuOpen(false); setTab("h2h"); }} style={listRow}><Swords size={18} color={BALL} /><span style={{ flex: 1, textAlign: "left", fontFamily: body, fontSize: 15, color: CHALK }}>Compare players</span><span style={{ color: MUTED }}>›</span></button>
              <button onClick={() => { setMenuOpen(false); setTab("settings"); }} style={listRow}><Gear size={18} color={BALL} /><span style={{ flex: 1, textAlign: "left", fontFamily: body, fontSize: 15, color: CHALK }}>Manage players &amp; league</span><span style={{ color: MUTED }}>›</span></button>
              <button onClick={() => { setMenuOpen(false); setLevelsFrom("profile"); setTab("levels"); }} style={listRow}><Clock size={18} color={BALL} /><span style={{ flex: 1, textAlign: "left", fontFamily: body, fontSize: 15, color: CHALK }}>Level history</span>{missingLevelHistory > 0 && <span style={{ fontFamily: body, fontWeight: 500, fontSize: 11, color: COURT, background: BALL, borderRadius: 999, padding: "1px 8px" }}>{missingLevelHistory}</span>}<span style={{ color: MUTED }}>›</span></button>
              {<button onClick={() => { setMenuOpen(false); setTab("clubadmin"); }} style={listRow}><Trophy size={18} color={BALL} /><span style={{ flex: 1, textAlign: "left", fontFamily: body, fontSize: 15, color: CHALK }}>Club admin</span>{!isClubAdmin && <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID }}>Set up</span>}<span style={{ color: MUTED }}>›</span></button>}
              <button onClick={() => { setMenuOpen(false); setTab("help"); }} style={listRow}><HelpCircle size={18} color={BALL} /><span style={{ flex: 1, textAlign: "left", fontFamily: body, fontSize: 15, color: CHALK }}>Help</span><span style={{ color: MUTED }}>›</span></button>
            </div>
          </div>
        </div>
      )}
      {profilePlayer && <ProfileModal player={profilePlayer} {...shared} profileYear={profileYear} onClose={() => setProfileId(null)} />}
      {legacyPlayer && <LegacyProfile player={legacyPlayer} players={players} matches={matches} meId={meId} nameOf={nameOf} onOpenMatch={setMatchDetailId} onClose={() => setLegacyId(null)} />}
      {matchDetailMatch && <MatchDetail match={matchDetailMatch} players={players} matches={matches} nameOf={nameOf} meId={meId} onProposeEdit={proposeEdit} onUpdateExtras={editMatch} onProposeDelete={proposeDelete} onAgreeDelete={agreeDelete} onCancelDelete={cancelDeleteRequest} groupName={group?.name} season={(group as any)?.season} onOpenProfile={(id) => { setMatchDetailId(null); openProfile(id); }} onClose={() => setMatchDetailId(null)} />}
      {groupSheet && <GroupSheet friendly={isFriendlyLeague(gid)} groups={groups} currentId={gid} personal={personal} onPersonal={() => { setPersonal(!personal); setGroupSheet(false); setProfileId(null); }} onSwitch={(id: string) => { setPersonal(false); switchGroup(id); }} onAdd={addGroup} onDelete={deleteGroup} onManageLeagues={onManageLeagues} onClose={() => setGroupSheet(false)} />}
      {!onboarded && meId && <Onboarding me={me} onFinish={finishOnboarding} />}
      <BottomNav tab={tab} setTab={(t) => { setProfileId(null); setTab(t); }} />
      {toast && <div style={{ position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", background: FEED_RAISED, color: FEED_TEXT_HI, fontFamily: body, fontWeight: 600, padding: "12px 18px", borderRadius: 999, fontSize: 13.5, boxShadow: "0 8px 24px var(--shadow-strong)", zIndex: 80 }}>{toast}</div>}
    </div>
  );
}
