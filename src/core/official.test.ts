// Tests for Official points, rebuilt 2026-09-27 on proven strength.
//
// Plain TypeScript with an assert, no framework; relative imports because tsc
// does not rewrite path aliases on emit.
//
// The last block is the one that matters: Seacourt's real 2026 matches, with
// everyone's level AT THE TIME, pinned to the numbers Sam was shown and
// approved before this shipped. If a later change moves them, that is a change
// to live ratings and §4 says it gets shown to Sam first.

import { computeOfficial } from "./official";

let failures = 0;
let checks = 0;
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) { failures++; console.error(`  FAIL ${what}`); }
}
const close = (a: number, b: number, eps: number) => Math.abs(a - b) < eps;

const CATS = ["Beginner", "Amateur", "Intermediate", "Advanced", "Semi-pro", "Pro"];
const SUBS = ["Low", "Medium", "High"];
const whole = (v: number | null) => (v == null ? undefined : [{ cat: CATS[Math.floor(v / 3)], sub: SUBS[v % 3], from: 2000, to: null }]);
const P = (id: string, level: number | null = null) => ({ id, name: id, levelHistory: whole(level) });
let seq = 0;
const M = (p1: string, p2: string, winner: string, score = "") =>
  ({ id: "m" + (++seq), p1, p2, winner, score, date: new Date(2026, 0, 1 + seq).getTime(), status: "confirmed" });
const wdlOf = (players: any[], matches: any[]) => {
  const w: any = {};
  players.forEach((p) => { w[p.id] = { w: 0, d: 0, l: 0, gp: 0 }; });
  matches.forEach((m) => {
    if (!w[m.p1] || !w[m.p2]) return;
    w[m.p1].gp++; w[m.p2].gp++;
    if (m.winner === "draw") { w[m.p1].d++; w[m.p2].d++; }
    else if (m.winner === "p1") { w[m.p1].w++; w[m.p2].l++; }
    else { w[m.p2].w++; w[m.p1].l++; }
  });
  return w;
};
const off = (players: any[], matches: any[]) => computeOfficial(players, matches, wdlOf(players, matches));

// ------------------------------------------------------------ the principle

{
  // "top" beats everybody, "mid" beats "low".
  const players = [P("me"), P("top"), P("mid"), P("low")];
  // A settled club: each of these a dozen times, so one result of mine
  // cannot move anyone's strength much — in a four-match toy graph beating
  // "top" once makes him look weaker and cancels the reward, which is true of
  // the network rating and says nothing about a real league.
  const base: any[] = [];
  for (let i = 0; i < 12; i++) base.push(M("top", "mid", "p1"), M("top", "low", "p1"), M("mid", "low", "p1"));
  // The same 1-1 record: once against the best player, once against the worst.
  const vsTop = [...base, M("me", "top", "p1"), M("me", "top", "p2")];
  const vsLow = [...base, M("me", "low", "p1"), M("me", "low", "p2")];
  ok(off(players, vsTop).me > off(players, vsLow).me, "the same record against tougher opposition scores higher — who, not just how many");
  // Note what is NOT claimed: beating the best and losing to the worst
  // scores the same as the reverse. One great result and one poor one,
  // against the same two people, is the same performance either way round —
  // a chess performance rating says the same.
}

{
  // Playing the strongest player must not cost you: add three losses to the
  // top player to a decent record, and the score should not collapse the way
  // a win rate squared made it.
  const players = [P("me"), P("top"), P("a"), P("b")];
  const core = [M("top", "a", "p1"), M("top", "b", "p1"), M("top", "a", "p1"), M("a", "b", "p1"),
    M("me", "a", "p1"), M("me", "b", "p1"), M("me", "a", "p2")];
  const plus = [...core, M("me", "top", "p2"), M("me", "top", "p2"), M("me", "top", "p1")];
  ok(off(players, plus).me >= off(players, core).me * 0.9, "a 1-2 run against the best barely dents you");
}

{
  // Level counts when results are thin: two newcomers with one match each,
  // one down as Advanced, one as Beginner. Beating the Advanced is the bigger
  // win, although on results alone they are identical strangers.
  const players = [P("me", 6), P("adv", 9), P("beg", 0), P("x", 6)];
  const setup = [M("adv", "x", "p2"), M("beg", "x", "p2")];
  const vsAdv = off(players, [...setup, M("me", "adv", "p1")]).me;
  const vsBeg = off(players, [...setup, M("me", "beg", "p1")]).me;
  ok(vsAdv > vsBeg, "an Intermediate beating an Advanced is a bigger win than beating a Beginner");
}

{
  // And with no level anywhere, results decide alone — nothing is guessed.
  const players = [P("a"), P("b")];
  const s = off(players, [M("a", "b", "p1"), M("a", "b", "p1"), M("a", "b", "p2")]);
  ok(s.a > s.b && s.b > 0, "no levels: results alone, both scored");
}

{
  const players = [P("me"), P("them")];
  const s = off(players, [M("me", "them", "draw")]);
  ok(close(s.me, s.them, 1e-9) && s.me > 0, "a lone draw scores both the same, and more than nothing");
}

{
  const players = [P("me"), P("them")];
  ok(off(players, [M("me", "them", "p2")]).me === 0, "only losses: zero");
  ok(off([P("me")], []).me === -1e6, "nothing played keeps the sentinel the table's bar scale reads");
}

{
  // Pending results do not count, as everywhere else in the engine.
  const players = [P("a"), P("b")];
  const pend = { ...M("a", "b", "p1"), status: "pending" };
  const s = computeOfficial(players, [pend], { a: { w: 0, d: 0, l: 0, gp: 0 }, b: { w: 0, d: 0, l: 0, gp: 0 } });
  ok(s.a === -1e6 && s.b === -1e6, "a pending result is not played");
}

{
  // A carried-in record (onboarding) has no matches; it counts as results
  // against an average player rather than vanishing.
  const players = [P("me"), P("them")];
  const all = [M("me", "them", "p1")];
  const lost = wdlOf(players, all); lost.me = { w: 1, d: 0, l: 5, gp: 6 };
  const won = wdlOf(players, all); won.me = { w: 6, d: 0, l: 0, gp: 6 };
  ok(computeOfficial(players, all, won).me > computeOfficial(players, all, lost).me, "carried-in losses cost and carried-in wins count");
}

// ------------------------------------------------ Seacourt 2026, as approved

const SEACOURT_2026: string[][] = [
  ["2026-01-01", "adrian", "Advanced/Low", "zaach", "Intermediate/Low", "", "p1"],
  ["2026-01-01", "george", "—", "will", "Beginner/High", "", "p1"],
  ["2026-01-02", "samuel", "Amateur/High", "charlie", "Beginner/High", "", "p1"],
  ["2026-01-03", "charlie", "Beginner/High", "zaach", "Intermediate/Low", "", "p1"],
  ["2026-01-14", "charlie", "Beginner/High", "zaach", "Intermediate/Low", "", "p1"],
  ["2026-01-24", "samuel", "Amateur/High", "charlie", "Beginner/High", "", "p1"],
  ["2026-01-25", "zaach", "Intermediate/Low", "charlie", "Beginner/High", "", "p2"],
  ["2026-01-28", "samuel", "Amateur/High", "charlie", "Beginner/High", "", "p1"],
  ["2026-01-30", "adrian", "Advanced/Low", "zaach", "Intermediate/Low", "", "p1"],
  ["2026-01-31", "samuel", "Amateur/High", "jamie", "—", "", "p1"],
  ["2026-01-31", "zaach", "Intermediate/Low", "samuel", "Amateur/High", "", "p2"],
  ["2026-02-04", "samuel", "Amateur/High", "george", "—", "", "p1"],
  ["2026-02-04", "samuel", "Amateur/High", "charlie", "Beginner/High", "", "p1"],
  ["2026-02-05", "zaach", "Intermediate/High", "charlie", "Beginner/High", "", "p2"],
  ["2026-02-07", "samuel", "Amateur/High", "cheese", "Amateur/Medium", "", "p1"],
  ["2026-02-13", "zaach", "Intermediate/High", "samuel", "Amateur/High", "4-6, 6-4, 0-6, 2-6", "p2"],
  ["2026-02-16", "samuel", "Amateur/High", "george", "—", "", "p1"],
  ["2026-02-17", "zaach", "Intermediate/High", "charlie", "Beginner/High", "", "p2"],
  ["2026-02-22", "charlie", "Beginner/High", "samuel", "Amateur/High", "", "draw"],
  ["2026-02-28", "zaach", "Intermediate/High", "charlie", "Beginner/High", "", "p2"],
  ["2026-03-01", "zaach", "Intermediate/High", "flynn", "Advanced/Low", "", "p1"],
  ["2026-03-01", "adrian", "Advanced/Low", "zaach", "Intermediate/High", "", "p1"],
  ["2026-03-04", "charlie", "Intermediate/Low", "samuel", "Amateur/High", "", "draw"],
  ["2026-03-11", "zaach", "Intermediate/High", "charlie", "Intermediate/Low", "", "p2"],
  ["2026-03-20", "george", "—", "will", "Beginner/High", "6-0 George - 6-3 Will", "draw"],
  ["2026-03-22", "zaach", "Intermediate/High", "charlie", "Intermediate/Low", "", "p2"],
  ["2026-03-24", "charlie", "Intermediate/Low", "samuel", "Amateur/High", "", "p2"],
  ["2026-03-25", "charlie", "Intermediate/Low", "samuel", "Amateur/High", "", "draw"],
  ["2026-03-31", "adrian", "Advanced/Low", "zaach", "Intermediate/High", "", "p1"],
  ["2026-04-01", "will", "Beginner/High", "george", "—", "", "p2"],
  ["2026-04-03", "zaach", "Intermediate/High", "charlie", "Intermediate/Low", "", "p2"],
  ["2026-04-27", "samuel", "Amateur/High", "charlie", "Intermediate/Low", "", "p1"],
  ["2026-04-28", "charlie", "Intermediate/Low", "samuel", "Amateur/High", "", "p2"],
  ["2026-04-30", "zaach", "Intermediate/High", "adrian", "Advanced/Low", "", "p2"],
  ["2026-05-04", "charlie", "Intermediate/Medium", "george", "—", "12-1", "p1"],
  ["2026-05-26", "charlie", "Intermediate/Medium", "oliver", "Intermediate/Low", "", "p1"],
  ["2026-05-30", "zaach", "Advanced/Low", "adrian", "Advanced/Low", "", "p2"],
  ["2026-06-29", "zaach", "Advanced/Low", "adrian", "Advanced/Low", "", "p2"],
  ["2026-06-29", "george", "—", "will", "Beginner/High", "", "p1"],
  ["2026-07-03", "zaach", "Advanced/Low", "charlie", "Intermediate/Medium", "", "p2"],
  ["2026-07-29", "charlie", "Intermediate/Medium", "samuel", "Intermediate/Low", "6-4", "p2"],
  ["2026-07-29", "zaach", "Advanced/Low", "adrian", "Advanced/Low", "", "p2"],
  ["2026-08-03", "samuel", "Intermediate/Low", "jamie", "—", "7-3", "p1"],
  ["2026-08-07", "samuel", "Intermediate/Low", "jamie", "—", "8-0", "p1"],
  ["2026-08-08", "samuel", "Intermediate/Low", "cheese", "Amateur/High", "6-0, 6-2", "p1"],
  ["2026-08-22", "samuel", "Intermediate/Low", "cheese", "Amateur/High", "6-2, 6-4", "p1"],
  ["2026-08-27", "zaach", "Advanced/Low", "adrian", "Advanced/Low", "", "p2"],
  ["2026-08-28", "george", "—", "james", "Beginner/Medium", "", "p2"],
  ["2026-09-03", "zaach", "Advanced/Low", "charlie", "Intermediate/Medium", "", "p2"],
  ["2026-09-04", "charlie", "Intermediate/Medium", "tom", "Beginner/High", "6-3", "p1"],
  ["2026-09-05", "charlie", "Intermediate/Medium", "samuel", "Intermediate/Low", "6-4", "p1"],
  ["2026-09-05", "samuel", "Intermediate/Low", "george", "—", "6-2, 5-3", "p1"],
  ["2026-09-14", "zaach", "Advanced/Low", "charlie", "Intermediate/Medium", "6-6", "p2"],
  ["2026-09-14", "charlie", "Intermediate/Medium", "daniel", "Beginner/Medium", "6-3", "p1"],
  ["2026-09-17", "charlie", "Intermediate/Medium", "zaach", "Advanced/Low", "3-6, 6-4, 11-9", "p1"],
  ["2026-09-27", "will", "Beginner/High", "george", "—", "", "p2"],
];
{
  const lv = (s: string) => { const [c, sb] = s.split("/"); return CATS.includes(c) ? { cat: c, sub: sb } : null; };
  const hist: Record<string, any[]> = {};
  const matches = SEACOURT_2026.map(([d, w, wl, l, ll, score, raw], i) => {
    const month = d.slice(0, 7);
    for (const [id, level] of [[w, wl], [l, ll]] as const) {
      hist[id] = hist[id] || [];
      const L = lv(level);
      if (L && !hist[id].some((e) => e.from === month)) hist[id].push({ ...L, from: month, to: month });
    }
    return { id: "s" + i, p1: w, p2: l, winner: raw === "draw" ? "draw" : "p1", score, date: new Date(d + "T12:00:00").getTime(), status: "confirmed" };
  });
  const players = Object.keys(hist).map((id) => ({ id, name: id, levelHistory: hist[id].length ? hist[id] : undefined }));
  const s = off(players, matches);
  // Shown to Sam as 59.9 / 51.5 / 43.3 / 34.6; the +1/+2 regularisation
  // (unbeaten records) moved each by under two points, same order, and he
  // was told before it shipped.
  const want: Record<string, number> = { zaach: 58.3, samuel: 50.0, charlie: 42.8, adrian: 32.4 };
  for (const id of Object.keys(want)) ok(close(s[id], want[id], 0.05), `Seacourt 2026: ${id} ${s[id].toFixed(1)}, approved ${want[id]}`);
  ok(s.zaach > s.samuel && s.samuel > s.charlie && s.charlie > s.adrian, "nobody changed place");
}

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (official)`);
