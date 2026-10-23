// Tests for the doubles Mixer (core/doubles/mixer.ts).
// Plain TypeScript with an assert; relative imports (see CLAUDE.md §1).

import { mixerRounds, partnerRepeats } from "./mixer";

let failures = 0;
let checks = 0;
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) { failures++; console.error(`  FAIL ${what}`); }
}

const names = (n: number) => Array.from({ length: n }, (_, i) => "p" + i);
const everyone = (r: { courts: any[]; out: string[] }) => [...r.courts.flatMap((c) => [...c.a, ...c.b]), ...r.out];

// Eight players, two courts, four rounds: nobody partners anybody twice.
const eight = mixerRounds(names(8), { courts: 2, rounds: 4, seed: 7 });
ok(eight.length === 4 && eight.every((r) => r.courts.length === 2 && r.out.length === 0), "8 players, 2 courts: everyone plays every round");
ok(eight.every((r) => new Set(everyone(r)).size === 8), "nobody is on two courts at once");
ok(partnerRepeats(eight) === 0, "a new partner every round");

// Ten players, two courts, five rounds: two sit each round, each sits once.
const ten = mixerRounds(names(10), { courts: 2, rounds: 5, seed: 3 });
const sat = new Map<string, number>();
for (const r of ten) for (const p of r.out) sat.set(p, (sat.get(p) || 0) + 1);
ok(ten.every((r) => r.out.length === 2), "two sit out each round");
ok(names(10).every((p) => sat.get(p) === 1), "everybody sits out exactly once");

// Balance: two strong and two weak make strong+weak against strong+weak.
const rating = (id: string) => (id === "s1" || id === "s2" ? 1800 : 1200);
const one = mixerRounds(["s1", "s2", "w1", "w2"], { courts: 1, rounds: 1, rating, seed: 1 })[0].courts[0];
ok(!(one.a.includes("s1") && one.a.includes("s2")) && !(one.b.includes("s1") && one.b.includes("s2")), "the two strongest are split up");

// More courts than people allow, and too few people.
ok(mixerRounds(names(6), { courts: 3, rounds: 2 }).every((r) => r.courts.length === 1 && r.out.length === 2), "six players fill one court, two sit");
ok(mixerRounds(names(3), { courts: 1, rounds: 2 }).length === 0, "three players can't make a game");

// Seeded: the same night gives the same rotation; a new seed may not.
ok(JSON.stringify(mixerRounds(names(9), { courts: 2, rounds: 3, seed: 5 })) === JSON.stringify(mixerRounds(names(9), { courts: 2, rounds: 3, seed: 5 })), "same seed, same rotation");

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (mixer)`);
