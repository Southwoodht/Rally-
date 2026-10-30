/**
 * The words for an organiser's correction, shared by the bell and the email
 * route. No imports, so the server route can use it without pulling in the
 * browser's Supabase client.
 */

/** The parts of a result a correction can change, as they are saved. */
export interface ResultSnapshot { date: number; winner: string; score: string; status: string; p1?: string; p2?: string }

/** "Won 6-4 on 12 Mar" — one side of a correction, from a player's side. */
export function describeResult(s: ResultSnapshot | null, side: "p1" | "p2", fmt: (t: number) => string): string {
  if (!s) return "removed";
  const res = s.winner === "draw" ? "Drew" : s.winner === side ? "Won" : "Lost";
  return `${res}${s.score ? " " + s.score : ""} on ${fmt(s.date)}`;
}
