import { computeOfficial } from "@/core/official";
import { computeStats } from "@/core/elo";

export interface Achievement {
  id: string;
  label: string;
  icon: string;
  achieved: boolean;
  date: number | null;
}

// Computed live from a player's own confirmed matches every time — never
// persisted, so there's no stale/fake state to drift from the real record.
export function computeAchievements(playerId: string, matches: any[]): Achievement[] {
  const conf = matches
    .filter((m) => m.status !== "pending" && (m.p1 === playerId || m.p2 === playerId))
    .sort((a, b) => a.date - b.date);

  const winAt: Record<number, number | null> = { 1: null, 10: null, 25: null, 50: null };
  const streakAt: Record<number, number | null> = { 3: null, 5: null, 10: null };
  let matchesAt100: number | null = null;
  let firstDrawDate: number | null = null;
  let wins = 0, played = 0, streak = 0;

  conf.forEach((m) => {
    played++;
    if (m.winner === "draw") {
      if (firstDrawDate == null) firstDrawDate = m.date;
      streak = 0;
    } else {
      const won = (m.winner === "p1" && m.p1 === playerId) || (m.winner === "p2" && m.p2 === playerId);
      if (won) {
        wins++;
        streak++;
        [1, 10, 25, 50].forEach((n) => { if (wins === n && winAt[n] == null) winAt[n] = m.date; });
        [3, 5, 10].forEach((n) => { if (streak === n && streakAt[n] == null) streakAt[n] = m.date; });
      } else {
        streak = 0;
      }
    }
    if (played === 100 && matchesAt100 == null) matchesAt100 = m.date;
  });

  return [
    { id: "first_win", label: "First Win", icon: "🎉", achieved: winAt[1] != null, date: winAt[1] },
    { id: "wins_10", label: "10 Wins", icon: "🏅", achieved: winAt[10] != null, date: winAt[10] },
    { id: "wins_25", label: "25 Wins", icon: "🏅", achieved: winAt[25] != null, date: winAt[25] },
    { id: "wins_50", label: "50 Wins", icon: "🏅", achieved: winAt[50] != null, date: winAt[50] },
    { id: "matches_100", label: "100 Matches", icon: "🎾", achieved: matchesAt100 != null, date: matchesAt100 },
    { id: "streak_3", label: "3-Win Streak", icon: "🔥", achieved: streakAt[3] != null, date: streakAt[3] },
    { id: "streak_5", label: "5-Win Streak", icon: "🔥", achieved: streakAt[5] != null, date: streakAt[5] },
    { id: "streak_10", label: "10-Win Streak", icon: "🔥", achieved: streakAt[10] != null, date: streakAt[10] },
    { id: "first_draw", label: "First Draw", icon: "🤝", achieved: firstDrawDate != null, date: firstDrawDate },
  ];
}

export interface CompetitionTrophy {
  playerId: string;
  medal: "gold" | "silver" | "bronze";
  competition: string;
  date: number;
}

// Mirrors LeagueHome's own "season concluded" podium logic exactly (same
// gating: a season must exist and have either ended or had every fixture
// played) so a trophy only ever appears here if the Table would show that
// same podium. Never invents a competition that hasn't actually happened.
export function computeSeasonTrophies(players: any[], matches: any[], fixtures: any[], group: any): CompetitionTrophy[] {
  const season = group?.season;
  if (!season) return [];
  const ended = season.end && Date.now() > season.end;
  const allPlayed = fixtures && fixtures.length > 0 && fixtures.every((f) => f.done);
  if (!ended && !allPlayed) return [];

  const fxIds = new Set((fixtures || []).filter((f) => f.done && f.matchId).map((f) => f.matchId));
  const useFx = fxIds.size > 0;
  const inSeasonMatches = matches.filter((m) => m.date >= season.start && (season.end == null || m.date <= season.end));
  const fxMatches = useFx ? matches.filter((m) => fxIds.has(m.id)) : inSeasonMatches;
  const fxStats = computeStats(players, fxMatches);
  const fxOff = computeOfficial(players, fxMatches, fxStats.wdl);
  const podium = players
    .filter((p) => (fxStats.wdl[p.id]?.gp || 0) > 0 && !p.inactive)
    .sort((a, b) => (fxOff[b.id] ?? -1e9) - (fxOff[a.id] ?? -1e9))
    .slice(0, 3);

  const medals: Array<"gold" | "silver" | "bronze"> = ["gold", "silver", "bronze"];
  const trophyDate = ended ? season.end : Math.max(...fxMatches.map((m) => m.date), season.start);
  return podium.map((p, i) => ({ playerId: p.id, medal: medals[i], competition: season.name || "Season", date: trophyDate }));
}
