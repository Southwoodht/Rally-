// Tests for the aggregation behind "Your matches".
//
// The headline is a percentage, and the complaint that started this screen
// was a percentage being wrong, so the counting is worth pinning down —
// especially the two rules that are easy to get backwards: a booking is not
// a match, and an ungraded match belongs to the unknown bucket rather than
// to neither.

import { buildMatchQuality, overTimeSentence, rateOf, shareSentence, winsFromSentence } from "./matchQuality";

/** Nothing graded — used by both the self and third-person checks below. */
const blindLater = { share: null } as any;

let failures = 0;
let checks = 0;

function eq(actual: unknown, expected: unknown, what: string) {
  checks++;
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) { failures++; console.error(`  FAIL ${what}\n    expected ${b}\n    got      ${a}`); }
}

const D = (s: string) => new Date(s).getTime();
const period = (cat: string, from: any, to: any) => ({ cat, sub: "Medium", from, to });

// Me, Intermediate throughout. Opponents span the categories; `noHist` has a
// level today and no history, which is the state fourteen of Seacourt's
// players are in.
const me = { id: "me", name: "Me", level: { cat: "Intermediate", sub: "Low" }, levelHistory: [period("Intermediate", 2015, null)] };
const adv = { id: "adv", name: "Adv", level: { cat: "Advanced", sub: "Medium" }, levelHistory: [period("Advanced", 2015, null)] };
const peer = { id: "peer", name: "Peer", level: { cat: "Intermediate", sub: "High" }, levelHistory: [period("Intermediate", 2015, null)] };
const ama = { id: "ama", name: "Ama", level: { cat: "Amateur", sub: "Medium" }, levelHistory: [period("Amateur", 2015, null)] };
const beg = { id: "beg", name: "Beg", level: { cat: "Beginner", sub: "Medium" }, levelHistory: [period("Beginner", 2015, null)] };
const noHist = { id: "nohist", name: "NoHist", level: { cat: "Pro", sub: "Low" } };

const players = [me, adv, peer, ama, beg, noHist];

// p1 is always me, so `winner: "p1"` is a win for me.
const m = (id: string, opp: string, winner: "p1" | "p2" | "draw", date: string, extra: any = {}) =>
  ({ id, p1: "me", p2: opp, winner, date: D(date), status: "confirmed", ...extra });

const matches = [
  m("1", "adv", "p1", "2022-03-01"),    // statement
  m("2", "adv", "p2", "2022-04-01"),    // no shame
  m("3", "peer", "p1", "2022-05-01"),   // true test
  m("4", "peer", "draw", "2022-06-01"), // true test
  m("5", "ama", "p1", "2022-07-01"),    // expected
  m("6", "beg", "p1", "2022-08-01"),    // routine
  m("7", "beg", "p2", "2022-09-01"),    // one to forget
  m("8", "nohist", "p1", "2022-10-01"), // ungraded
  m("9", "nohist", "p2", "2022-11-01"), // ungraded
  m("10", "adv", "p1", "2022-12-01", { status: "scheduled" }), // booked, not played
];

const q = buildMatchQuality("me", players, matches);

// ------------------------------------------------------------- the totals
eq(q.total, 9, "a booking is excluded from the total");
eq(q.rows.some((r) => r.matchId === "10"), false, "the booked row is not in the list");

// An unconfirmed result is the opposite case and it is easy to conflate with
// the one above: it HAS a result, so it counts, and it is only the agreement
// that is missing. The row carries `pending` so the screen can say so.
{
  const withUnagreed = buildMatchQuality("me", players, [
    ...matches, m("11", "adv", "p1", "2022-12-02", { status: "pending" }),
  ]);
  eq(withUnagreed.total, 10, "an unconfirmed result DOES count");
  const row: any = withUnagreed.rows.find((r: any) => r.matchId === "11");
  eq(!!row, true, "and it is in the list");
  eq(row?.pending, true, "flagged, so the row can show it is not agreed");
  const agreed: any = withUnagreed.rows.find((r: any) => r.matchId === "1");
  eq(agreed?.pending, false, "an agreed result is not flagged");
}
eq(q.graded, 7, "seven of nine grade");
eq(q.ungraded, 2, "two cannot be graded");
eq(q.rows[0].matchId, "9", "rows are newest first");

// at-or-above: W and L vs Advanced, W and D vs the peer.
eq(q.atOrAbove, { w: 2, d: 1, l: 1 }, "at-or-above record");
// below: W vs Amateur, W and L vs Beginner.
eq(q.below, { w: 2, d: 0, l: 1 }, "below record");
eq(
  q.atOrAbove.w + q.atOrAbove.d + q.atOrAbove.l + q.below.w + q.below.d + q.below.l,
  q.graded,
  "the buckets account for every graded match and nothing else",
);

// ------------------------------------------------------------ the headline
eq(q.share, 4 / 7, "share is over graded, not over all");
eq(q.verdict, "Balanced schedule", "4 of 7 is 57%");
eq(shareSentence(q), "57% of your graded matches were against somebody at your level or above — 4 of 7.",
  "the sentence states its denominator");

// The whole point of the denominator ruling: the ungraded pair must not
// drag the headline down as though those opponents were beginners.
eq(Math.round((4 / 9) * 100), 44, "over all matches it would read 44%");
eq(q.verdict !== "Comfortable schedule", true, "and would have been a worse word");

// ------------------------------------------------------------- by level
eq(q.byLevel.map((r) => r.cat), ["Advanced", "Intermediate", "Amateur", "Beginner"], "hardest first, only categories faced");
eq(q.byLevel.find((r) => r.cat === "Intermediate")!.isMine, true, "my own row is flagged");
eq(q.byLevel.find((r) => r.cat === "Advanced")!.gap, 1, "Advanced is one above me");
eq(q.byLevel.find((r) => r.cat === "Beginner")!.gap, -2, "Beginner is two below me");
eq(q.byLevel.some((r) => r.cat === "Pro"), false, "the ungraded opponent contributes no row");
// Under three matches there is no rate to report.
eq(q.byLevel.find((r) => r.cat === "Amateur")!.winRate, null, "one match is not a win rate");
eq(q.byLevel.find((r) => r.cat === "Advanced")!.winRate, null, "two matches is not a win rate either");
eq(rateOf({ w: 2, d: 0, l: 1 }), 67, "three matches is");
eq(rateOf({ w: 1, d: 1, l: 1 }), 50, "a draw counts as half");

// --------------------------------------------------- where the wins are from
// Wins: adv (above), peer (at), ama + beg (below). The nohist win is in none.
eq(q.winsFrom, { above: 1, at: 1, below: 2 }, "wins split three ways, ungraded in none");
eq(winsFromSentence(q), "Half of your graded wins came at your level or above, half against somebody below.",
  "an exact split is said as one, not rounded onto the flattering side");

// The same sentences read about somebody else. One template, two voices —
// the screen is no longer only ever about the person reading it.
const THEM = { self: false, name: "Charlie" };
eq(shareSentence(q, THEM), "57% of Charlie's graded matches were against somebody at their level or above — 4 of 7.",
  "third person names them and then says 'their', never he or she");
eq(winsFromSentence(q, THEM), "Half of Charlie's graded wins came at their level or above, half against somebody below.",
  "third person, exact split");
eq(winsFromSentence({ ...q, winsFrom: { above: 0, at: 0, below: 4 } } as any, THEM),
  "Every graded win has come against somebody below them.", "third person, all below");
eq(shareSentence(blindLater, THEM), "None of Charlie's matches can be graded yet.", "third person, nothing graded");
eq(
  overTimeSentence([
    { year: 2020, share: 20, graded: 5, matches: 5 },
    { year: 2022, share: 70, graded: 5, matches: 5 },
  ], THEM),
  "Charlie is playing tougher opposition than they used to — 20% in 2020, 70% in 2022.",
  "third person trend",
);
eq(
  overTimeSentence([
    { year: 2020, share: 50, graded: 5, matches: 5 },
    { year: 2022, share: 55, graded: 5, matches: 5 },
  ], THEM),
  "Charlie's schedule has been about as testing as it ever was.",
  "third person, no trend",
);
eq(winsFromSentence({ ...q, winsFrom: { above: 2, at: 1, below: 1 } } as any),
  "75% of your wins came at your level or above.", "a majority up");
eq(winsFromSentence({ ...q, winsFrom: { above: 0, at: 1, below: 3 } } as any),
  "75% of your wins came against somebody below you.", "a majority down");
eq(winsFromSentence({ ...q, winsFrom: { above: 0, at: 0, below: 4 } } as any),
  "Every graded win has come against somebody below you.", "all of them below");
eq(winsFromSentence({ ...q, winsFrom: { above: 1, at: 3, below: 0 } } as any),
  "Every graded win has come at your level or above.", "all of them at or above");

// -------------------------------------------------------------- opponents
eq(q.opponents.map((o) => o.player.id), ["adv", "peer", "ama", "beg", "nohist"],
  "hardest first, and no level sinks rather than counting as low");
eq(q.opponents[0].phrase, "one above you", "the phrase under the name");
eq(q.opponents[1].phrase, "your level", "a peer reads as your level");
eq(q.opponents.find((o) => o.player.id === "nohist")!.phrase, null, "ungraded has no phrase");
eq(q.opponents.find((o) => o.player.id === "adv")!.record, { w: 1, d: 0, l: 1 }, "opponent record");
// Rows are newest first, so the label is the most recent meeting: my last
// match with Advanced was the loss in April.
eq(q.opponents[0].lastGrade, "noShame", "the label is the most recent meeting");

// --------------------------------------------------------------- over time
eq(q.overTime.length, 1, "one year in this fixture");
eq(q.overTime[0], { year: 2022, share: 57, graded: 7, matches: 9 }, "the year's share is over graded");
eq(overTimeSentence(q.overTime), null, "one year cannot describe a trend");

const trend = overTimeSentence([
  { year: 2020, share: 20, graded: 5, matches: 5 },
  { year: 2021, share: 40, graded: 5, matches: 5 },
  { year: 2022, share: 70, graded: 5, matches: 5 },
]);
eq(trend, "You are playing tougher opposition than you used to — 20% in 2020, 70% in 2022.", "a rising trend");
eq(
  overTimeSentence([
    { year: 2020, share: 70, graded: 5, matches: 5 },
    { year: 2022, share: 30, graded: 5, matches: 5 },
  ]),
  "You are playing easier opposition than you used to — 70% in 2020, 30% in 2022.",
  "a falling trend",
);
eq(
  overTimeSentence([
    { year: 2020, share: 50, graded: 5, matches: 5 },
    { year: 2022, share: 55, graded: 5, matches: 5 },
  ]),
  "Your schedule has been about as testing as it ever was.",
  "five points is not a trend",
);
// A year nobody could grade has no share, and cannot be an endpoint.
eq(
  overTimeSentence([
    { year: 2020, share: null, graded: 0, matches: 4 },
    { year: 2021, share: 20, graded: 5, matches: 5 },
    { year: 2022, share: 70, graded: 5, matches: 5 },
  ]),
  "You are playing tougher opposition than you used to — 20% in 2021, 70% in 2022.",
  "an ungradeable year is skipped, not read as zero",
);

// ------------------------------------------------- nothing graded at all
// The state Seacourt is actually in today: levels exist, histories do not.
const blind = buildMatchQuality("me", [{ ...me, levelHistory: undefined }, noHist], [
  m("a", "nohist", "p1", "2022-01-01"),
  m("b", "nohist", "p2", "2022-02-01"),
]);
eq(blind.total, 2, "the matches are still listed");
eq(blind.graded, 0, "none of them grade");
eq(blind.share, null, "no share");
eq(blind.verdict, null, "and no verdict, rather than 'Untested'");
eq(blind.byLevel, [], "no level rows");
eq(blind.winsFrom, { above: 0, at: 0, below: 0 }, "no wins attributed");
eq(winsFromSentence(blind), null, "and no conclusion drawn");
eq(shareSentence(blind), "None of your matches can be graded yet.", "the headline says so plainly");

// ------------------------------------------------------------ perspective
// The profile's head-to-head card read the wrong side of the fixture and
// printed every result backwards — two losses to Zaach came out as "You lead
// Zaach 2-0". An opponent record belongs to the player it was built for, and
// the two sides must be exact mirrors.
const fromMe = buildMatchQuality("me", players, matches).opponents.find((o) => o.player.id === "adv")!;
const fromThem = buildMatchQuality("adv", players, matches).opponents.find((o) => o.player.id === "me")!;
eq(fromMe.record, { w: 1, d: 0, l: 1 }, "my record against them");
eq(fromThem.record, { w: 1, d: 0, l: 1 }, "and theirs against me, mirrored");

const fromMeVsBeg = buildMatchQuality("me", players, matches).opponents.find((o) => o.player.id === "beg")!;
const fromBegVsMe = buildMatchQuality("beg", players, matches).opponents.find((o) => o.player.id === "me")!;
eq(fromMeVsBeg.record, { w: 1, d: 0, l: 1 }, "one each against the beginner");
eq(fromBegVsMe.record, { w: 1, d: 0, l: 1 }, "mirrored");

// A lopsided pair, where getting the side wrong is visible.
const lop = [m("x1", "ama", "p2", "2022-01-01"), m("x2", "ama", "p2", "2022-02-01"), m("x3", "ama", "p1", "2022-03-01")];
const meVsAma = buildMatchQuality("me", players, lop).opponents.find((o) => o.player.id === "ama")!;
const amaVsMe = buildMatchQuality("ama", players, lop).opponents.find((o) => o.player.id === "me")!;
eq(meVsAma.record, { w: 1, d: 0, l: 2 }, "I lost that series");
eq(amaVsMe.record, { w: 2, d: 0, l: 1 }, "so they won it");
eq(meVsAma.record.w, amaVsMe.record.l, "my wins are their losses");
eq(meVsAma.record.l, amaVsMe.record.w, "and my losses are their wins");

// ---------------------------------------------------------------- nobody
const empty = buildMatchQuality("me", players, []);
eq(empty.total, 0, "no matches");
eq(empty.verdict, null, "no verdict");
eq(empty.opponents, [], "no opponents");
eq(empty.overTime, [], "no years");

// -------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// The split must account for every match, for every player.
//
// It didn't. Ungraded matches were dropped from both buckets, so the two
// tiles summed to `graded` while the screen around them said `total` — and
// on a roster where hardly anyone has a level history, that is most of the
// matches, not a rounding difference.

{
  const played3 = (r: any) => r.w + r.d + r.l;
  const P = (id: string, cat: string | null, hasHistory: boolean) => ({
    id, name: id, last: "X",
    level: cat ? { cat, sub: "Medium" } : null,
    levelHistory: hasHistory && cat ? [{ cat, sub: "Medium", from: 2015, to: null }] : null,
  });
  // Deliberately mixed: levels with history, levels without, and none at all.
  const roster = [
    P("a", "Intermediate", true), P("b", "Advanced", true), P("c", "Advanced", false),
    P("d", "Beginner", true), P("e", null, false), P("f", "Pro", false), P("g", "Amateur", true),
  ];
  const ms: any[] = [];
  let k = 0;
  const outcomes = ["p1", "p2", "draw"] as const;
  for (let i = 0; i < roster.length; i++) {
    for (let j = i + 1; j < roster.length; j++) {
      for (let r = 0; r < 3; r++) {
        ms.push({
          id: "x" + ++k, p1: roster[i].id, p2: roster[j].id,
          winner: outcomes[(i + j + r) % 3],
          date: new Date(2019 + ((i + r) % 6), (j % 12), 5).getTime(),
          status: k % 9 === 0 ? "pending" : "confirmed",
        });
      }
    }
  }

  let checked = 0;
  roster.forEach((p) => {
    const r: any = buildMatchQuality(p.id, roster, ms);
    const sum = played3(r.atOrAbove) + played3(r.below) + played3(r.unknown);
    eq(sum, r.total, `${p.id}: at-or-above + below + unknown accounts for every match`);
    eq(played3(r.atOrAbove) + played3(r.below), r.graded, `${p.id}: the two graded buckets sum to graded`);
    eq(played3(r.unknown), r.ungraded, `${p.id}: the unknown bucket is exactly the ungraded count`);
    eq(r.rows.length, r.total, `${p.id}: rows and total agree`);
    checked++;
  });
  eq(checked, 7, "every player in the roster was reconciled");

  // A player nobody can grade at all still adds up.
  const lonely: any = buildMatchQuality("e", roster, ms);
  eq(lonely.graded, 0, "no level, nothing gradeable");
  eq(played3(lonely.unknown), lonely.total, "and every one of their matches is in the unknown bucket");
}


if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks`);
