// Tests for People you may know. Relative imports: see tiebreak.test.ts.
import { peopleYouMayKnow } from "./suggestions";

let checks = 0, failures = 0;
const ok = (cond: boolean, what: string) => { checks++; if (!cond) { failures++; console.error("  FAIL  " + what); } };

const players = [
  { id: "me", auth_id: "A-me", name: "Sam", last: "Henry" },
  { id: "zr", auth_id: "A-zr", name: "Zaach", last: "Rodriguez" },
  { id: "ch", auth_id: "A-ch", name: "Charlie", last: "Henry" },
  { id: "ce", auth_id: null, name: "Charlie" },            // a shell: nobody to add
  { id: "ab", auth_id: "A-ab", name: "Adrian", last: "Bowels" },
  { id: "old", auth_id: "A-old", name: "Gone", inactive: true },
  { id: "fr", auth_id: "A-fr", name: "Already", last: "Friend" },
];
const matches = [
  { p1: "me", p2: "zr" }, { p1: "zr", p2: "me" }, { p1: "me", p2: "ch" },
  { p1: "me", p2: "ce" }, { p1: "ch", p2: "ab" },
];
const fof = [
  { authId: "A-out", name: "Outside Person", avatarUrl: null, via: "A-fr" },
  { authId: "A-out", name: "Outside Person", avatarUrl: "x.png", via: "A-f2" },
  { authId: "A-ab", name: "Adrian Bowels", avatarUrl: null, via: "A-fr" },
  { authId: "A-me", name: "Sam Henry", avatarUrl: null, via: "A-fr" },
  { authId: "A-pend", name: "Pending", avatarUrl: null, via: "A-fr" },
];

const s = peopleYouMayKnow({
  meAuthId: "A-me", mePlayerId: "me", players, matches, friendsOfFriends: fof,
  known: ["A-fr", "A-pend"], leagueName: "Seacourt",
});
const ids = s.map((x) => x.authId);

ok(ids[0] === "A-zr" && s[0].played === 2 && s[0].reason === "Played you 2 times", "the person you have played most comes first");
ok(ids[1] === "A-ch" && s[1].reason === "Played you once", "then somebody played once");
ok(!ids.includes("A-me"), "never yourself");
ok(!ids.includes("A-fr") && !ids.includes("A-pend"), "never a friend or a pending request");
ok(!ids.includes("A-old"), "never an inactive player");
ok(ids.filter((x) => x === "A-out").length === 1, "one person through two friends is one suggestion");
const out = s.find((x) => x.authId === "A-out")!;
ok(out.mutual === 2 && out.reason === "2 mutual friends" && out.playerId === null, "counted as two mutuals, from outside the league");
ok(out.avatarUrl === "x.png", "a photo from either list is kept");
const ab = s.find((x) => x.authId === "A-ab")!;
ok(ab.mutual === 1 && ab.sameLeague && ab.reason === "1 mutual friend", "a league mate with a mutual says the mutual");
ok(ids.indexOf("A-out") < ids.indexOf("A-ab"), "two mutuals outweigh one mutual plus a shared league");
ok(s.every((x) => x.authId !== undefined && !("vias" in x) && !("score" in x)), "no working fields leak out");
ok(ids.length === 4, "zaach, charlie, outside, adrian — shells and known people excluded");

const none = peopleYouMayKnow({ meAuthId: "A-me", players: [players[0]], matches: [], friendsOfFriends: [], known: [] });
ok(none.length === 0, "nobody to suggest is an empty list");

const lg = peopleYouMayKnow({ meAuthId: "A-me", players: [players[0], players[4]], matches: [], friendsOfFriends: [], known: [], leagueName: "Seacourt" });
ok(lg[0].reason === "In Seacourt", "a league mate alone says the league");

if (failures) { console.error(`${failures} of ${checks} checks failed (suggestions)`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (suggestions)`);
