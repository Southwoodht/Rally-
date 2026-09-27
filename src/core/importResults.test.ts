/** Reading pasted results. Plain asserts; relative imports (see tiebreak.test.ts). */
import { expandRecord, findDate, isAlreadyIn, parseResults, resolveName, scoreSays, splitName } from "./importResults";

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
ok(findDate("10-2-12", NOW) === null, "a dashed W-D-L is not a date");
ok(findDate("12-03-2019", NOW)!.t === day(2019, 3, 12), "a dashed date with a full year is");

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

// ---------------------------------------------------------------- records
{
  // Sam's own paste, 27 Sep: read as ONE match with the numbers thrown away.
  const r = parseResults("George Henry and Will Allen are 2 and 2 in matches estimated 2026", ["George Henry", "Will Allen"], NOW);
  ok(r.rows.length === 0 && r.records.length === 1, "a record is a record, not one match");
  const x = r.records[0];
  ok(x.left === "George Henry" && x.right === "Will Allen" && x.leftWins === 2 && x.rightWins === 2 && x.draws === 0 && x.year === 2026, "names, 2 and 2, 2026");
}
{
  const x = parseResults("Sam v Charlie 5-1-3 (2025)", [], NOW).records[0];
  ok(x && x.leftWins === 5 && x.draws === 1 && x.rightWins === 3 && x.year === 2025, "W-D-L with a year in brackets");
  const y = parseResults("Zaach leads Adrian 6-4", [], NOW).records[0];
  ok(y && y.left === "Zaach" && y.right === "Adrian" && y.leftWins === 6 && y.rightWins === 4 && y.year === null, "leads");
  const z = parseResults("Sam and Charlie 3 each", [], NOW).records[0];
  ok(z && z.leftWins === 3 && z.rightWins === 3, "N each");
  const w = parseResults("Hugh v Mike 4-2 with 1 draw in 2019", [], NOW).records[0];
  ok(w && w.leftWins === 4 && w.rightWins === 2 && w.draws === 1 && w.year === 2019, "draws named separately");
}
ok(parseResults("Sam v Charlie 6-4", [], NOW).records.length === 0, "a single set is not a record");
ok(parseResults("Sam v Charlie 6-4 6-2 2025", [], NOW).records.length === 0, "two sets are a match, even with a year");
ok(parseResults("Sam beat Charlie 6-4 in 2019", [], NOW).records.length === 0, "'beat' is one match");
{
  const r = parseResults("George Henry Will Allen 2 2 whatever", ["George Henry", "Will Allen"], NOW);
  ok(r.rows.length === 0 && r.unreadable.length === 1, "numbers it can't explain: unreadable, never one silent match");
}
{
  const rec = { line: 1, raw: "", left: "a", right: "b", leftWins: 3, draws: 1, rightWins: 2, year: 2025 };
  const out = expandRecord(rec, 0, NOW.getTime());
  ok(out.length === 6, "one match per result");
  ok(out.filter((o) => o.winner === "left").length === 3 && out.filter((o) => o.winner === "draw").length === 1, "the counts survive");
  ok(out[0].date === day(2025, 1, 1) && out[5].date === day(2025, 12, 31), "spread across the year");
  const seq = out.map((o) => o.winner[0]).join("");
  ok(!/lll|rr r/.test(seq) && seq !== "llldrr", `interleaved, not all the wins first — got ${seq}`);
  const thisYear = expandRecord({ ...rec, year: 2026 }, 0, NOW.getTime());
  ok(thisYear.every((o) => o.date <= NOW.getTime()), "this year's record never dated in the future");
  const noYear = expandRecord({ ...rec, year: null }, 12345, NOW.getTime());
  ok(noYear.every((o) => o.date === 12345), "no year: the date the screen asks for");
}

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
