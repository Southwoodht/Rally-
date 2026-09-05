// The one short phrase on the right of a scoreline card's lime bar.
//
// It has to be the fact as it stood *then*, not now: a card for a match in
// February that says "3rd straight" has to mean their third straight in
// February. So this replays the whole history once in order and hands back a
// phrase per match, rather than asking a question of today's standings —
// core/rank.ts's currentStreakOf answers "how are they doing now", which is
// the right answer to a different question and would put the same label on
// every row of a winning run.
//
// Most matches get nothing, on purpose. A phrase on every card is wallpaper;
// the point of the right-hand side of that bar is that it's occasionally
// worth reading.

const ordinal = (n: number): string => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return n + "th";
  return n + (["th", "st", "nd", "rd"][n % 10] || "th");
};

/** Phrases keyed by match id. Absent means there was nothing worth saying. */
export function feedContexts(matches: any[], nameOf: (id: string) => string): Record<string, string> {
  const out: Record<string, string> = {};
  const streak: Record<string, number> = {};
  const met = new Set<string>();
  const beaten = new Set<string>();

  const pair = (a: string, b: string) => a + "|" + b;

  for (const m of [...matches].filter((x) => x.status !== "pending").sort((a, b) => a.date - b.date)) {
    if (m.winner === "draw") {
      streak[m.p1] = 0;
      streak[m.p2] = 0;
      met.add(pair(m.p1, m.p2));
      met.add(pair(m.p2, m.p1));
      continue;
    }
    const win = m.winner === "p1" ? m.p1 : m.p2;
    const lose = m.winner === "p1" ? m.p2 : m.p1;

    streak[win] = (streak[win] || 0) + 1;
    streak[lose] = 0;

    // A first win only reads as an achievement against somebody you'd
    // already played and not beaten. The first time two people ever meet is
    // not "first win vs" — it's just a win, and labelling it that way would
    // put the phrase on half the cards in a young league.
    const firstOverThem = !beaten.has(pair(win, lose)) && met.has(pair(win, lose));
    if (firstOverThem) {
      out[m.id] = "First win vs " + nameOf(lose);
    } else if (streak[win] >= 3) {
      out[m.id] = ordinal(streak[win]) + " straight";
    }

    beaten.add(pair(win, lose));
    met.add(pair(win, lose));
    met.add(pair(lose, win));
  }
  return out;
}
