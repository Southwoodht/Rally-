import { gkey } from "@/data/seed";
import { uid } from "@/lib/format";
import { storage } from "@/lib/storage";

export interface HistoricalImportMatch {
  date: string;
  p1: string;
  p2: string;
  winner: "W" | "D" | "L";
}

const PLAYER_DEFS = [
  { name: "Sam", avatar: "🟢", preferredId: "sam" },
  { name: "Charlie", avatar: "🔵", preferredId: "charlie" },
  { name: "Cheese", avatar: "🟠", preferredId: "cheese" },
  { name: "George", avatar: "🔴", preferredId: "george" },
  { name: "Jamie", avatar: "🟤", preferredId: "jamie" },
  { name: "Zaach", avatar: "🟣", preferredId: "zaach" },
  { name: "Connor", avatar: "⚫", preferredId: "connor" },
] as const;

const MATCHES: HistoricalImportMatch[] = [
  { date: "2024-06-08", p1: "Sam", p2: "Cheese", winner: "L" },
  { date: "2024-06-09", p1: "Sam", p2: "Cheese", winner: "L" },
  { date: "2024-06-13", p1: "Sam", p2: "Cheese", winner: "W" },
  { date: "2024-06-16", p1: "Sam", p2: "Cheese", winner: "L" },
  { date: "2024-07-01", p1: "Sam", p2: "Cheese", winner: "L" },
  { date: "2024-07-08", p1: "Sam", p2: "Cheese", winner: "W" },
  { date: "2024-08-11", p1: "Sam", p2: "Cheese", winner: "W" },
  { date: "2024-09-13", p1: "Sam", p2: "Cheese", winner: "W" },
  { date: "2025-01-07", p1: "Sam", p2: "Cheese", winner: "W" },
  { date: "2025-03-03", p1: "Sam", p2: "Cheese", winner: "D" },
  { date: "2025-06-23", p1: "Sam", p2: "Cheese", winner: "W" },
  { date: "2025-06-24", p1: "Sam", p2: "Cheese", winner: "L" },
  { date: "2025-07-25", p1: "Sam", p2: "Cheese", winner: "L" },
  { date: "2025-07-28", p1: "Sam", p2: "Cheese", winner: "W" },
  { date: "2025-08-01", p1: "Sam", p2: "Cheese", winner: "D" },
  { date: "2025-08-02", p1: "Sam", p2: "Cheese", winner: "W" },
  { date: "2025-08-27", p1: "Sam", p2: "Cheese", winner: "D" },
  { date: "2025-12-30", p1: "Sam", p2: "Charlie", winner: "W" },
  { date: "2026-01-02", p1: "Sam", p2: "Charlie", winner: "W" },
  { date: "2026-01-24", p1: "Sam", p2: "Charlie", winner: "W" },
  { date: "2026-01-28", p1: "Sam", p2: "Charlie", winner: "W" },
  { date: "2026-01-31", p1: "Sam", p2: "Jamie", winner: "W" },
  { date: "2026-01-31", p1: "Sam", p2: "Zaach", winner: "L" },
  { date: "2026-02-04", p1: "Sam", p2: "George", winner: "W" },
  { date: "2026-02-04", p1: "Sam", p2: "Charlie", winner: "W" },
  { date: "2026-02-07", p1: "Sam", p2: "Cheese", winner: "W" },
  { date: "2026-02-13", p1: "Sam", p2: "Zaach", winner: "L" },
  { date: "2026-02-16", p1: "Sam", p2: "George", winner: "W" },
  { date: "2026-02-22", p1: "Sam", p2: "Charlie", winner: "D" },
  { date: "2026-03-04", p1: "Sam", p2: "Charlie", winner: "D" },
  { date: "2026-03-24", p1: "Sam", p2: "Charlie", winner: "L" },
  { date: "2026-03-25", p1: "Sam", p2: "Charlie", winner: "D" },
  { date: "2026-04-27", p1: "Sam", p2: "Charlie", winner: "W" },
  { date: "2026-04-28", p1: "Sam", p2: "Charlie", winner: "L" },
  { date: "2026-07-29", p1: "Sam", p2: "Charlie", winner: "L" },
  { date: "2026-08-03", p1: "Sam", p2: "Jamie", winner: "W" },
  { date: "2026-08-07", p1: "Sam", p2: "Jamie", winner: "W" },
  { date: "2026-08-08", p1: "Sam", p2: "Cheese", winner: "W" },
] as const;

export const normalizePlayerName = (value: string) => (value || "").trim().toLowerCase();

const canonicalPlayerKey = (value: string) => {
  const normalized = normalizePlayerName(value);
  if (["sam", "samuel", "samuelhenry", "samuel henry", "samh", "samuelh"].includes(normalized)) return "sam";
  return normalized;
};

const buildWinnerForRow = (row: HistoricalImportMatch) => {
  if (row.winner === "D") return "draw";
  if (row.winner === "W") return row.p1 === "Sam" ? "p1" : "p2";
  return row.p1 === "Sam" ? "p1" : "p2"
};

const mergeDuplicatePlayers = (players: any[], matches: any[]) => {
  const groups = new Map<string, any[]>();
  players.forEach((player: any) => {
    const key = canonicalPlayerKey(player.name || "");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(player);
  });

  const mergedPlayers: any[] = [];
  const idRewrites = new Map<string, string>();
  groups.forEach((group) => {
    if (!group.length) return;
    const canonical = { ...group[0] } as any;
    group.forEach((player: any) => {
      if (!canonical.avatar && player.avatar) canonical.avatar = player.avatar;
      if (!canonical.level && player.level) canonical.level = player.level;
      if (!canonical.levelHistory && player.levelHistory) canonical.levelHistory = player.levelHistory;
      if (!canonical.initialRecord && player.initialRecord) canonical.initialRecord = player.initialRecord;
      if (typeof canonical.initialElo !== "number" && typeof player.initialElo === "number") canonical.initialElo = player.initialElo;
      if (!canonical.auth_id && player.auth_id) canonical.auth_id = player.auth_id;
      if (!canonical.last && player.last) canonical.last = player.last;
      if (!canonical.age && player.age) canonical.age = player.age;
      if (!canonical.home && player.home) canonical.home = player.home;
      if (!canonical.nick && player.nick) canonical.nick = player.nick;
      if (!canonical.inactive && player.inactive) canonical.inactive = player.inactive;
      if (player.id !== canonical.id) idRewrites.set(player.id, canonical.id);
    });
    mergedPlayers.push(canonical);
  });

  const rewrittenMatches = (matches || []).map((match: any) => {
    const next = { ...match };
    if (idRewrites.has(next.p1)) next.p1 = idRewrites.get(next.p1)!;
    if (idRewrites.has(next.p2)) next.p2 = idRewrites.get(next.p2)!;
    return next;
  });

  return { players: mergedPlayers, matches: rewrittenMatches };
};

export async function importHistoricalMatches(leagueId: string, options?: { userName?: string }) {
  const storageKey = gkey(leagueId);
  const record = await storage.get(storageKey, true);
  let data: any = record ? JSON.parse(record.value) : null;
  if (!data || !Array.isArray(data.players) || !Array.isArray(data.matches)) {
    data = { players: [], matches: [], me: null, fixtures: [], posts: [] };
  }

  const merged = mergeDuplicatePlayers(data.players || [], data.matches || []);
  data.players = merged.players;
  data.matches = merged.matches;

  const existingPlayers = data.players || [];
  const playerIndex = new Map<string, any>();
  existingPlayers.forEach((player: any) => {
    const key = canonicalPlayerKey(player.name || "");
    if (key) playerIndex.set(key, player);
  });

  const ensurePlayer = (name: string, avatar: string | null, preferredId?: string) => {
    const key = canonicalPlayerKey(name);
    const existing = playerIndex.get(key);
    if (existing) {
      if (!existing.avatar && avatar) existing.avatar = avatar;
      return existing;
    }
    const player = {
      id: preferredId || uid(),
      name,
      level: null,
      avatar,
      auth_id: null,
    };
    existingPlayers.push(player);
    playerIndex.set(key, player);
    return player;
  };

  const mePlayer = ensurePlayer(options?.userName || "Sam", "🟢", "sam");
  data.me = mePlayer.id;

  PLAYER_DEFS.forEach((def) => {
    ensurePlayer(def.name, def.avatar, def.preferredId);
  });

  const existingMatches = new Map<string, any>();
  (data.matches || []).forEach((match: any) => {
    const key = `${match.date}|${match.p1}|${match.p2}`;
    existingMatches.set(key, match);
  });

  let imported = 0;
  let skipped = 0;

  for (const row of MATCHES) {
    const p1 = ensurePlayer(row.p1, row.p1 === "Sam" ? "🟢" : row.p1 === "Charlie" ? "🔵" : row.p1 === "Cheese" ? "🟠" : row.p1 === "George" ? "🔴" : row.p1 === "Jamie" ? "🟤" : row.p1 === "Zaach" ? "🟣" : row.p1 === "Connor" ? "⚫" : null, row.p1 === "Sam" ? "sam" : row.p1 === "Charlie" ? "charlie" : row.p1 === "Cheese" ? "cheese" : row.p1 === "George" ? "george" : row.p1 === "Jamie" ? "jamie" : row.p1 === "Zaach" ? "zaach" : row.p1 === "Connor" ? "connor" : undefined);
    const p2 = ensurePlayer(row.p2, row.p2 === "Sam" ? "🟢" : row.p2 === "Charlie" ? "🔵" : row.p2 === "Cheese" ? "🟠" : row.p2 === "George" ? "🔴" : row.p2 === "Jamie" ? "🟤" : row.p2 === "Zaach" ? "🟣" : row.p2 === "Connor" ? "⚫" : null, row.p2 === "Sam" ? "sam" : row.p2 === "Charlie" ? "charlie" : row.p2 === "Cheese" ? "cheese" : row.p2 === "George" ? "george" : row.p2 === "Jamie" ? "jamie" : row.p2 === "Zaach" ? "zaach" : row.p2 === "Connor" ? "connor" : undefined);
    const winner = buildWinnerForRow(row);
    const key = `${new Date(row.date).getTime()}|${p1.id}|${p2.id}`;
    const existingMatch = existingMatches.get(key);
    if (existingMatch) {
      existingMatch.date = new Date(row.date).getTime();
      existingMatch.p1 = p1.id;
      existingMatch.p2 = p2.id;
      existingMatch.winner = winner;
      existingMatch.status = existingMatch.status || "confirmed";
      existingMatch.reportedBy = existingMatch.reportedBy || mePlayer.id;
      existingMatch.score = existingMatch.score || "";
      existingMatches.set(key, existingMatch);
      skipped += 1;
      continue;
    }
    const match = {
      id: uid(),
      date: new Date(row.date).getTime(),
      p1: p1.id,
      p2: p2.id,
      winner,
      score: "",
      status: "confirmed",
      reportedBy: mePlayer.id,
    };
    data.matches.push(match);
    existingMatches.set(key, match);
    imported += 1;
  }

  data.players = existingPlayers;
  data.matches = data.matches.sort((a: any, b: any) => a.date - b.date);
  await storage.set(storageKey, JSON.stringify(data), true);
  return { imported, skipped, data };
}
