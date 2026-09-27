/**
 * People you may know.
 *
 * Sam, 27 Sep 2026: "a people you may know and u can see and add them".
 *
 * Three kinds of evidence that you know somebody, strongest first:
 *
 *   1. You have PLAYED them. A match is two people on one court for an hour;
 *      no signal an app can see is stronger than that. On a club app most of
 *      the people you play are people you know and have not added.
 *   2. You have friends in COMMON. Facebook's signal, and the one that finds
 *      people outside your league.
 *   3. You are in the same LEAGUE. The weakest — a club of forty is not forty
 *      acquaintances — so it only ever breaks ties and fills the list.
 *
 * Only ACCOUNTS are suggested. A player row with no auth_id is a name on a
 * results sheet and there is nobody to send a request to. Identity is the
 * auth id and nothing else (CLAUDE.md §3): two players called Charlie with
 * one account between them are one suggestion, and two accounts both called
 * Charlie are two.
 *
 * Nobody you already have a relationship with is suggested — friends, and
 * requests pending in EITHER direction. Suggesting somebody whose request is
 * sitting in your inbox would be offering you a second button for the same
 * thing; somebody you already asked is waiting on them, not on you.
 *
 * Pure, no network: the screen gathers the three lists and this decides.
 */

export interface SuggestionPlayer {
  id: string;
  auth_id?: string | null;
  name?: string;
  last?: string;
  avatarUrl?: string | null;
  inactive?: boolean;
}

export interface SuggestionMatch {
  p1: string;
  p2: string;
  status?: string;
}

/** Somebody one of your friends is friends with. */
export interface FriendOfFriend {
  authId: string;
  name: string;
  avatarUrl: string | null;
  /** Whose list they were on — one entry per friend of yours. */
  via: string;
}

export interface Suggestion {
  authId: string;
  name: string;
  avatarUrl: string | null;
  /** Their league player row, when they have one in this league. */
  playerId: string | null;
  played: number;
  mutual: number;
  sameLeague: boolean;
  /** The one reason worth printing under the name. */
  reason: string;
}

/** How much each kind of evidence weighs. One match outweighs two mutual
 *  friends, and a shared league only separates people otherwise equal. */
const W_PLAYED = 3;
const W_MUTUAL = 1.5;
const W_LEAGUE = 0.5;
/** Past this many matches more of them says nothing new. */
const PLAYED_CAP = 5;

export function peopleYouMayKnow({
  meAuthId, mePlayerId, players, matches, friendsOfFriends, known, leagueName, limit = 10,
}: {
  meAuthId: string;
  /** Your player row in this league, if you have one. */
  mePlayerId?: string | null;
  players: SuggestionPlayer[];
  matches: SuggestionMatch[];
  friendsOfFriends: FriendOfFriend[];
  /** Account ids you already have a friendship or a pending request with. */
  known: Iterable<string>;
  leagueName?: string;
  limit?: number;
}): Suggestion[] {
  const skip = new Set<string>(known);
  skip.add(meAuthId);

  const by = new Map<string, Suggestion & { vias: Set<string> }>();
  const entry = (authId: string, name: string, avatarUrl: string | null) => {
    let s = by.get(authId);
    if (!s) {
      s = { authId, name, avatarUrl, playerId: null, played: 0, mutual: 0, sameLeague: false, reason: "", vias: new Set() };
      by.set(authId, s);
    }
    return s;
  };

  // League mates, and how often you have played each. A disputed or refused
  // result is still two people who were on a court together, so any status
  // counts — this is "do you know them", not a rating.
  const accountOf = new Map<string, string>();
  for (const p of players) {
    const aid = p.auth_id;
    if (!aid || skip.has(aid) || p.inactive) continue;
    accountOf.set(p.id, aid);
    const full = [p.name, p.last].map((x) => (x || "").trim()).filter(Boolean).join(" ") || "Player";
    const s = entry(aid, full, p.avatarUrl ?? null);
    s.sameLeague = true;
    if (!s.playerId) s.playerId = p.id;
  }
  if (mePlayerId) {
    for (const m of matches) {
      const other = m.p1 === mePlayerId ? m.p2 : m.p2 === mePlayerId ? m.p1 : null;
      const aid = other ? accountOf.get(other) : undefined;
      if (aid) by.get(aid)!.played++;
    }
  }

  // Friends of friends. The same person reached through two friends is two
  // mutuals, never two suggestions.
  for (const f of friendsOfFriends) {
    if (!f.authId || skip.has(f.authId)) continue;
    const s = entry(f.authId, f.name, f.avatarUrl);
    if (!s.avatarUrl && f.avatarUrl) s.avatarUrl = f.avatarUrl;
    s.vias.add(f.via);
  }

  const out: Array<Suggestion & { score: number }> = [];
  by.forEach((s) => {
    s.mutual = s.vias.size;
    const score = Math.min(s.played, PLAYED_CAP) * W_PLAYED + s.mutual * W_MUTUAL + (s.sameLeague ? W_LEAGUE : 0);
    const reason = s.played
      ? "Played you " + (s.played === 1 ? "once" : s.played + " times")
      : s.mutual
        ? s.mutual + (s.mutual === 1 ? " mutual friend" : " mutual friends")
        : leagueName ? "In " + leagueName : "In your league";
    const { vias: _v, ...rest } = s;
    out.push({ ...rest, reason, score });
  });

  return out
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name) || (a.authId < b.authId ? -1 : 1))
    .slice(0, limit)
    .map(({ score: _s, ...s }) => s);
}
