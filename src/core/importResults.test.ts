/** Reading pasted results. Plain asserts; relative imports (see tiebreak.test.ts). */
import { findDate, isAlreadyIn, parseResults, resolveName, scoreSays, splitName } from "./importResults";

let checks = 0;
const ok = (cond: boolean, what: string) => {
  checks++;
  if (!cond) { console.error("FAILED: " + what); process.exit(1); }
};
const NOW = new Date(2026, 8, 27, 12);
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();
const one = (line: string, known: string[] = []) => {
  const r = parseResults(line, known, NOW);
  return { row: r.rows[0], bad: r.unreadable[0] };
};
const sets = (row: any) => (row?.sets || []).map((s: any) => s.a + "-" + s.b).join(" ");

// ------------------------------------------------------------------ dates
ok(findDate("12/03/2019", NOW)!.t === day(2019, 3, 12), "UK order: 12/03/2019 is 12 March");
ok(findDate("2019-03-12", NOW)!.t === day(2019, 3, 12), "ISO");
ok(findDate("12.3.19", NOW)!.t === day(2019, 3, 12), "two-digit year, dots");
ok(findDate("3/4/98", NOW)!.t === day(1998, 4, 3), "a two-digit year after this one is last century");
ok(findDate("Sat 12th March 2019", NOW)!.t === day(2019, 3, 12), "words");
ok(findDate("March 12, 2019", NOW)!.t === day(2019, 3, 12), "month first in words");
ok(findDate("31/02/2019", NOW) === null, "31 February is not a date");
ok(findDate("6-4 6-2", NOW) === null, "a score is not a date");

// ----------------------------------------------------------------- scores
ok(scoreSays([{ a: 4, b: 6 }, { a: 6, b: 3 }, { a: 6, b: 2 }]) === "left", "sets decide");
ok(scoreSays([{ a: 6, b: 6 }]) === "draw", "level is a draw");
ok(scoreSays([{ a: 6, b: 1 }, { a: 5, b: 7 }]) === "left", "one set each: games decide");

// ------------------------------------------------------------ free text
{
  const { row } = one("12/03/2019 Sam Henry beat Charlie Henry 6-4 6-2");
  ok(row.left === "Sam Henry" && row.right === "Charlie Henry" && row.winner === "left", "X beat Y");
  ok(row.date === day(2019, 3, 12) && sets(row) === "6-4 6-2", "date and score");
}
{
  const { row } = one("Charlie lost to Sam 6-4, 6-2");
  ok(row.left === "Charlie" && row.right === "Sam" && row.winner === "right", "lost to: the right won");
  ok(sets(row) === "4-6 2-6", `a winner's-side score is turned round to read left-first — got ${sets(row)}`);
}
{
  const { row } = one("Sam v Zaach 3-6 4-6");
  ok(row.winner === "right" && sets(row) === "3-6 4-6", "v with a score: the score decides, as written");
}
{
  const { row } = one("Sam vs. Zaach");
  ok(row && row.winner === null, "no word and no score: no winner, for a person to choose");
}
{
  const { row } = one("Sam Henry beat Adrian Bowles 7-6(5) 6-4 ret");
  ok(sets(row) === "7-6 6-4" && row.right === "Adrian Bowles", "tiebreak brackets and 'ret' dropped");
}
{
  const { row } = one("Sam drew with Charlie 6-6");
  ok(row.winner === "draw", "drew with");
}
{
  const { row } = one("Sam Henry  Charlie Henry  6-4 6-2", ["Sam Henry", "Charlie Henry", "Charlie"]);
  ok(row && row.left === "Sam Henry" && row.right === "Charlie Henry" && row.winner === "left", "no joiner: two known names, longest first");
}
{
  const { bad } = one("Great night at the club everyone");
  ok(!!bad, "chat is reported as unreadable, never dropped silently");
}
{
  const r = parseResults("Great night everyone, drinks after", [], NOW);
  ok(r.rows.length === 0, "a comma does not make two names a result");
}

// ------------------------------------------------------------ spreadsheets
{
  const r = parseResults("Date\tWinner\tLoser\tScore\n12/03/2019\tSam Henry\tCharlie Henry\t6-4 6-2\n13/03/2019\tHugh Jones\tSam Henry\t2-6 4-6", [], NOW);
  ok(r.rows.length === 2 && r.unreadable.length === 0, "a tab table with a header");
  ok(r.rows[0].winner === "left" && r.rows[1].winner === "left", "a Winner column means the left won, whatever the score");
  ok(sets(r.rows[1]) === "6-2 6-4", `and a loser-first score is turned round — got ${sets(r.rows[1])}`);
}
{
  const r = parseResults("12/03/2019, Sam Henry, Charlie Henry, 6-4, 6-2", [], NOW);
  ok(r.rows.length === 1 && r.rows[0].left === "Sam Henry" && sets(r.rows[0]) === "6-4 6-2", "CSV with no header, score split across commas");
}
{
  const r = parseResults("Player 1,Player 2,Result\nSam,Zaach,L\nSam,Adrian,W", [], NOW);
  ok(r.rows[0].winner === "right" && r.rows[1].winner === "left", "a W/L result column");
}
{
  const r = parseResults("Saturday 12 March 2019\nSam beat Zaach 6-3\nCharlie beat Adrian 6-1\n\n19/03/2019 Sam beat Charlie 6-0", [], NOW);
  ok(r.rows.length === 3, "a date heading line is not a result");
  ok(r.rows[0].date === day(2019, 3, 12) && r.rows[1].date === day(2019, 3, 12), "and applies to the lines under it");
  ok(r.rows[2].date === day(2019, 3, 19), "until a line carries its own");
}
ok(parseResults("Sam beat Sam 6-0", [], NOW).unreadable.length === 1, "the same name on both sides is refused");

// ------------------------------------------------------------------ names
const players = [
  { id: "sam", name: "Samuel", last: "Henry" },
  { id: "charlie", name: "Charlie", last: "Henry", nick: "Cheese" },
  { id: "cheese", name: "Charlie" },
  { id: "zaach", name: "Zaach", last: "Rodriguez" },
  { id: "connor", name: "Connor", last: "Henry" },
];
const st = (w: string) => resolveName(w, players);
ok(st("Zaach Rodriguez").kind === "matched", "one exact full name, nobody else like it: matched");
ok(st("zaach  rodriguez").kind === "matched", "case and spacing don't matter");
{
  const c = st("Charlie Henry");
  ok(c.kind === "choose", "Charlie Henry exactly — but another Charlie exists, so it ASKS (the Charlie incident)");
  ok(c.kind === "choose" && c.candidates[0] === "charlie", "with the exact one offered first");
}
ok(st("Charlie").kind === "choose" && (st("Charlie") as any).candidates.length === 2, "'Charlie' could be either: both offered");
ok(st("Cheese").kind === "choose", "a nickname is a suggestion, never a match");
{
  const c: any = st("C Henry");
  ok(c.kind === "choose" && c.candidates.includes("charlie") && c.candidates.includes("connor") && !c.candidates.includes("sam"), "an initial narrows by letter: Charlie or Connor, never Samuel");
}
ok(st("Sam").kind === "new", "'Sam' is not 'Samuel' — a person links them, not the importer");
ok(st("Hugh Jones").kind === "new", "nobody like them: new");
ok(splitName("Hugh de Montfort").name === "Hugh" && splitName("Hugh de Montfort").last === "de Montfort", "surname keeps its particles");

// ------------------------------------------------------------- duplicates
const existing = [{ p1: "sam", p2: "zaach", date: day(2019, 3, 12) + 3600000, winner: "p2" }];
ok(isAlreadyIn("zaach", "sam", day(2019, 3, 12), "p1", existing), "same day, same pair, same winner, either way round");
ok(!isAlreadyIn("sam", "zaach", day(2019, 3, 12), "p1", existing), "a different winner is a different match");
ok(!isAlreadyIn("sam", "zaach", day(2019, 3, 13), "p2", existing), "a different day is a different match");

console.log(`PASSED — ${checks}/${checks} checks (import results)`);
