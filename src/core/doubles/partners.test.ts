import { partnersOf, mostPlayedWith, bestPartner, BEST_PARTNER_MINIMUM } from "./partners";
import type { DoublesMatch } from "./elo";

let checks = 0;
const ok = (cond: boolean, what: string) => {
  checks++;
  if (!cond) { console.error("FAILED: " + what); process.exit(1); }
};

let n = 0;
const m = (teamA: [string, string | null], teamB: [string, string | null], winner: string, status?: string): DoublesMatch =>
  ({ id: "m" + (++n), playedAt: n, teamA, teamB, winner, status: status ?? "confirmed" });

// ---------------------------------------------------------------------------
// Partner detection on both sides of the net
// ---------------------------------------------------------------------------
{
  const rows = partnersOf([
    m(["me", "geo"], ["c", "d"], "A"),          // partner on team A, first slot
    m(["geo", "me"], ["c", "d"], "A"),          // partner on team A, second slot
    m(["c", "d"], ["me", "geo"], "B"),          // same partner, other side, won
    m(["c", "d"], ["me", "cha"], "A"),          // different partner, lost
  ], "me");

  const geo = rows.find((r) => r.partnerId === "geo")!;
  const cha = rows.find((r) => r.partnerId === "cha")!;
  ok(rows.length === 2, "one row per partner");
  ok(geo.played === 3 && geo.won === 3, "a partner is found in any of the four slots");
  ok(cha.played === 1 && cha.lost === 1, "and a loss on the other side is a loss");
  ok(rows[0].partnerId === "geo", "sorted by matches played together");
  ok(mostPlayedWith(rows) === "geo", "most played with is the top row");
}

// ---------------------------------------------------------------------------
// Best needs the minimum, and is not just the top row
// ---------------------------------------------------------------------------
{
  // "lucky" is 1-0 together — a perfect record off one match. "steady" is
  // 3-1. The badge must go to steady.
  const rows = partnersOf([
    m(["me", "lucky"], ["c", "d"], "A"),
    m(["me", "steady"], ["c", "d"], "A"),
    m(["me", "steady"], ["c", "d"], "A"),
    m(["me", "steady"], ["c", "d"], "A"),
    m(["me", "steady"], ["c", "d"], "B"),
  ], "me");

  const lucky = rows.find((r) => r.partnerId === "lucky")!;
  const steady = rows.find((r) => r.partnerId === "steady")!;
  ok(lucky.winRate === 1, "the one-match partner does have a perfect rate");
  ok(!lucky.best, "but cannot be Best on one match");
  ok(steady.best, "Best goes to the partner who has met the minimum");
  ok(bestPartner(rows) === "steady", "and bestPartner agrees");
  ok(rows.filter((r) => r.best).length === 1, "exactly one Best");
  ok(BEST_PARTNER_MINIMUM === 3, "the minimum is three");

  // Top row by matches is steady here, so also check the case where the most
  // played partner is NOT the best.
  const other = partnersOf([
    m(["me", "often"], ["c", "d"], "B"),
    m(["me", "often"], ["c", "d"], "B"),
    m(["me", "often"], ["c", "d"], "B"),
    m(["me", "often"], ["c", "d"], "B"),
    m(["me", "good"], ["c", "d"], "A"),
    m(["me", "good"], ["c", "d"], "A"),
    m(["me", "good"], ["c", "d"], "A"),
  ], "me");
  ok(mostPlayedWith(other) === "often", "most played is the one played most");
  ok(bestPartner(other) === "good", "best is the one won most with, not played most with");
}

// ---------------------------------------------------------------------------
// Draws, pending, and nobody
// ---------------------------------------------------------------------------
{
  const rows = partnersOf([
    m(["me", "p"], ["c", "d"], "A"),
    m(["me", "p"], ["c", "d"], "draw"),
    m(["me", "p"], ["c", "d"], "B"),
    m(["me", "p"], ["c", "d"], "A", "pending"),
  ], "me");
  const p = rows[0];
  ok(p.played === 3, "a pending doubles match is not counted, here as everywhere");
  ok(p.won === 1 && p.drawn === 1 && p.lost === 1, "W-D-L together");
  ok(Math.abs(p.winRate - 0.5) < 1e-9, "a draw is worth half");

  ok(partnersOf([m(["a", "b"], ["c", "d"], "A")], "nobody").length === 0,
    "a player who has played no doubles has no partners");
  ok(mostPlayedWith([]) === null && bestPartner([]) === null, "and the headers say nothing");
}

// An unknown partner is nobody to list: the match counts for you everywhere
// else, but "Most played with" must not grow a row for an empty seat.
{
  const rows = partnersOf([m(["me", null], ["x", "y"], "A"), m(["me", "p"], ["x", null], "A")], "me");
  ok(rows.length === 1 && rows[0].partnerId === "p", "an unknown partner never becomes a partner row");
}

console.log(`PASSED — ${checks}/${checks} checks`);
