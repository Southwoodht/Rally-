/**
 * Reading a club's old results out of pasted text.
 *
 * Sam, 27 Sep 2026: "I'm aiming to get club admins on this". A club that has
 * kept results for years has them in a spreadsheet, a notes app or a WhatsApp
 * thread, and the only way in until now was one pair at a time. This reads a
 * paste of any of those into rows a person then checks.
 *
 * THREE RULES, all of which exist because getting them wrong puts a false
 * result into somebody's record:
 *
 *  1. NOTHING IS GUESSED SILENTLY. A line that cannot be read is returned as
 *     unreadable with the reason, never dropped and never half-filled. A
 *     result with no winner comes back with winner null for a person to
 *     choose. The screen shows every problem before anything saves.
 *
 *  2. NAMES ARE SUGGESTIONS (CLAUDE.md §3, the Charlie incident). A name on
 *     paper is matched to a player row automatically ONLY when exactly one
 *     player could possibly be meant — the full name matches and no other
 *     player shares the first name or nickname. "Charlie" in Seacourt could
 *     be Charlie Henry or Charlie Easey, and the importer says so and asks.
 *
 *  3. DIRECTION IS WORKED OUT, NOT ASSUMED. "Sam beat Charlie 4-6 6-3 6-2"
 *     names the winner; "Sam v Charlie 4-6 3-6" lets the score say. Where the
 *     words say one thing and the score another, the words win and the score
 *     is turned round, because people write scores from the winner's side far
 *     more often than they misname who won. Where there is no word and no
 *     score, there is no winner — see rule 1.
 *
 * Pure: text in, rows out. No ids, no network, no React.
 */

import type { SetScore } from "./sets";

export type Side = "left" | "right" | "draw";

export interface ParsedRow {
  /** 1-based line number in what was pasted, for "line 14" in the UI. */
  line: number;
  raw: string;
  /** Midday local time on the day, or null when the line had none. */
  date: number | null;
  left: string;
  right: string;
  winner: Side | null;
  /** Oriented LEFT first, whatever order they were written in. */
  sets: SetScore[] | null;
}

export interface Unreadable { line: number; raw: string; reason: string }

/**
 * A head-to-head RECORD rather than one match: "George and Will are 2 and 2
 * in 2026", "Sam v Charlie 5-3-1 (2025)", "Zaach leads Adrian 6-4". It is
 * what Bulk / history always took, one pair at a time; here it arrives in the
 * same paste. It becomes left + draws + right matches when added.
 */
export interface ParsedRecord {
  line: number;
  raw: string;
  left: string;
  right: string;
  leftWins: number;
  draws: number;
  rightWins: number;
  /** The year it covers, or null when none was written. */
  year: number | null;
}

export interface ParseResult {
  rows: ParsedRow[];
  records: ParsedRecord[];
  unreadable: Unreadable[];
}

// ------------------------------------------------------------------ dates

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const at = (y: number, m: number, d: number): number | null => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = new Date(y, m - 1, d, 12, 0, 0);
  // new Date(2019, 1, 31) rolls into March. A date that rolled was not a date.
  return t.getMonth() === m - 1 ? t.getTime() : null;
};
const fullYear = (y: number, now: Date) => {
  if (y >= 100) return y;
  const cur = now.getFullYear() % 100;
  return y <= cur ? 2000 + y : 1900 + y;
};

// Dashes need a four-digit year: "10-2-12" is far more likely a W-D-L
// record than 10 February 2012. Slashes and dots may use two digits.
const NUMERIC_DATE = /\b(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})\b|\b(\d{1,2})([/.])(\d{1,2})\5(\d{2}|\d{4})\b|\b(\d{1,2})-(\d{1,2})-(\d{4})\b/;
const WORD_DATE = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?\s+(\d{2,4})\b/i;
const WORD_DATE_US = /\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})\b/i;

/** Finds a date in the text. UK order (day first) unless the year leads. */
export function findDate(text: string, now = new Date()): { t: number; match: string } | null {
  let m = NUMERIC_DATE.exec(text);
  if (m) {
    const t = m[1] ? at(+m[1], +m[2], +m[3])
      : m[4] ? at(fullYear(+m[7], now), +m[6], +m[4])
      : at(+m[10], +m[9], +m[8]);
    if (t != null) return { t, match: m[0] };
  }
  m = WORD_DATE.exec(text);
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) { const t = at(fullYear(Number(m[3]), now), mi + 1, Number(m[1])); if (t != null) return { t, match: m[0] }; }
  }
  m = WORD_DATE_US.exec(text);
  if (m) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mi >= 0) { const t = at(fullYear(Number(m[3]), now), mi + 1, Number(m[2])); if (t != null) return { t, match: m[0] }; }
  }
  return null;
}

// ----------------------------------------------------------------- scores

// A set: two numbers joined by a dash or a slash, with an optional tiebreak
// in brackets after it ("7-6(5)"), which is dropped — it is not a game.
// No lookbehind: Safari before 16.4 cannot compile one, and a regex that
// fails to compile takes the whole screen down on an older iPhone. The
// leading character is captured and put back instead.
const SET_TOKEN = /(^|[^\d/.\-])(\d{1,2})\s*[-–—/]\s*(\d{1,2})(?:\s*\(\d+\))?(?![\d/.\-])/g;

function takeSets(text: string): { sets: SetScore[]; rest: string } {
  const sets: SetScore[] = [];
  // Twice, because a match consumes the character before the next set
  // ("6-4 6-2": the space) and the global scan would skip every other one.
  let rest = text;
  for (let pass = 0; pass < 2; pass++) {
    rest = rest.replace(SET_TOKEN, (_all, pre, a, b) => { sets.push({ a: Number(a), b: Number(b) }); return pre + " "; });
  }
  return { sets, rest };
}

const setsWon = (sets: SetScore[]) => sets.reduce((acc, s) => ({ a: acc.a + (s.a > s.b ? 1 : 0), b: acc.b + (s.b > s.a ? 1 : 0) }), { a: 0, b: 0 });
const games = (sets: SetScore[]) => sets.reduce((acc, s) => ({ a: acc.a + s.a, b: acc.b + s.b }), { a: 0, b: 0 });

/** Who the score says won, reading it left-first: sets, then games. */
export function scoreSays(sets: SetScore[]): Side | null {
  if (!sets.length) return null;
  const w = setsWon(sets);
  if (w.a !== w.b) return w.a > w.b ? "left" : "right";
  const g = games(sets);
  if (g.a !== g.b) return g.a > g.b ? "left" : "right";
  return "draw";
}

const flip = (sets: SetScore[]) => sets.map((s) => ({ a: s.b, b: s.a }));

// ----------------------------------------------------------------- words

// Order matters: the longer phrase first, so "lost to" is not read as "to".
const JOINERS: Array<{ re: RegExp; side: Side | null }> = [
  { re: /\s+(?:lost\s+to|lost\s+against|was\s+beaten\s+by|beaten\s+by)\s+/i, side: "right" },
  { re: /\s+(?:drew\s+with|drew|drawn\s+with|tied\s+with)\s+/i, side: "draw" },
  { re: /\s+(?:beat|beats|bt|def\.?|defeated|defeats|won\s+against|beat\s+up)\s+/i, side: "left" },
  { re: /\s+(?:v|vs\.?|versus|against|x|-|–)\s+/i, side: null },
];

const RESULT_WORD: Record<string, Side> = {
  w: "left", won: "left", win: "left",
  l: "right", lost: "right", loss: "right",
  d: "draw", draw: "draw", drew: "draw", drawn: "draw", tie: "draw", tied: "draw",
};

// Words that are part of how a result is written rather than a name.
const NOISE = /\b(?:ret(?:ired)?|w\/?o|walkover|retd|final|semi|qf|sf|r\d+|round\s*\d+)\b\.?/gi;

const tidyName = (s: string) =>
  s.replace(/[()[\]{}"“”]/g, " ").replace(/^[\s,;:|\-–.]+|[\s,;:|\-–.]+$/g, "").replace(/\s+/g, " ").trim();

const looksLikeName = (s: string) => /[a-z]/i.test(s) && s.length <= 40 && !/\d/.test(s);

// ----------------------------------------------------------- column headers

type Column = "date" | "left" | "right" | "score" | "result" | "ignore";

function headerColumns(cells: string[]): { cols: Column[]; leftIsWinner: boolean } | null {
  const lower = cells.map((c) => c.trim().toLowerCase());
  if (lower.some((c) => /\d/.test(c))) return null;
  const cols: Column[] = [];
  let names = 0;
  let meaningful = 0;
  for (const c of lower) {
    if (/^(date|day|played|when)/.test(c)) { cols.push("date"); meaningful++; }
    else if (/^(winner|won by|victor)/.test(c)) { cols.push("left"); names++; meaningful++; }
    else if (/^(loser|lost|runner)/.test(c)) { cols.push("right"); names++; meaningful++; }
    else if (/^(player|name|home|team)\s*(1|a|one)?$/.test(c) && !cols.includes("left")) { cols.push("left"); names++; meaningful++; }
    else if (/^(player|name|away|opponent|team)\s*(2|b|two)?$/.test(c) || /^(opponent|vs|v)$/.test(c)) { cols.push("right"); names++; meaningful++; }
    else if (/^(score|result|sets|games)$/.test(c) && !cols.includes("score")) { cols.push("score"); meaningful++; }
    else if (/^(w\/l|outcome|result)$/.test(c)) { cols.push("result"); meaningful++; }
    else cols.push("ignore");
  }
  if (names !== 2 || meaningful < 2) return null;
  // A "Winner" / "Loser" header says who won on every row under it.
  return { cols, leftIsWinner: lower.some((c) => /^(winner|won by|victor)/.test(c)) };
}

const splitCells = (line: string): string[] | null => {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes("|")) return line.split("|");
  if (line.includes(";")) return line.split(";");
  if (line.includes(",")) {
    // "6-4, 6-2" is one score, not two cells: only split on commas when the
    // pieces are not all set scores.
    const parts = line.split(",");
    const nonScore = parts.filter((p) => p.trim() && !/^\s*\d{1,2}\s*[-–/]\s*\d{1,2}(\s*\(\d+\))?\s*$/.test(p));
    if (nonScore.length >= 2) return parts;
  }
  return null;
};

// ---------------------------------------------------------------- records

// Words that say "this is a tally, not one match".
const RECORD_WORDS = /\b(record|head[\s-]*to[\s-]*head|h2h|matches|games\s+won|wins|times|each|all|leads?|overall|in\s+total|estimated|approx(?:imately)?|roughly|about|draws?|drawn)\b/i;
// Filler between the names and the numbers ("are", "have", "record:").
const RECORD_FILLER = /\b(are|is|have|has|had|went|stand|stands|at|record|head[\s-]*to[\s-]*head|h2h|overall|currently|about|roughly|approx(?:imately)?|estimated|played)\b|[:=]/gi;
const RECORD_SPLIT = /\s+(?:and|&|v|vs\.?|versus|against|leads?|over|-|–)\s+/i;
const MAX_RECORD = 500;

function readRecord(text: string, hasFullDate: boolean): Omit<ParsedRecord, "line" | "raw"> | null {
  let t = " " + text + " ";
  // A year on its own — "in 2026", "(2025)" — is the span the record covers.
  let year: number | null = null;
  if (!hasFullDate) {
    const y = /(?:\b(?:in|during|for|from|season)\s+)?\(?\b(19\d{2}|20\d{2})\b\)?/i.exec(t);
    if (y) { year = Number(y[1]); t = t.replace(y[0], " "); }
  }
  // "Sam beat Charlie 6-4 in 2019" is one match with a year, not a tally.
  if (/\b(beat|beats|bt|def\.?|defeated|lost\s+to|beaten\s+by|drew\s+with)\b/i.test(t)) return null;
  let a: number, b: number, d = 0;
  let at: number;
  const wdl = /(\d{1,3})\s*[-–]\s*(\d{1,3})\s*[-–]\s*(\d{1,3})/.exec(t);
  const each = /(\d{1,3})\s+(?:all|each|apiece)\b/i.exec(t);
  const pair = /(\d{1,3})\s*(?:and|-|–|to|:|\/)\s*(\d{1,3})/i.exec(t);
  const andPair = /(\d{1,3})\s+and\s+(\d{1,3})/i.test(t);
  if (wdl) { a = +wdl[1]; d = +wdl[2]; b = +wdl[3]; at = wdl.index; }
  else if (each) { a = b = +each[1]; at = each.index; }
  else if (pair) { a = +pair[1]; b = +pair[2]; at = pair.index; }
  else return null;
  // Only a tally if something says so. "Sam v Charlie 6-4" is one set.
  const pairsSeen = (t.match(/\d{1,3}\s*[-–/]\s*\d{1,3}/g) || []).length;
  if (!(wdl || each || andPair || RECORD_WORDS.test(t) || year != null) || pairsSeen > 1) return null;
  const drawsM = /(\d{1,3})\s*(?:draws?|drawn|tied)/i.exec(t.slice(at + 1));
  if (!wdl && drawsM) d = +drawsM[1];
  if (a + b + d === 0 || a + b + d > MAX_RECORD) return null;

  const namesPart = t.slice(0, at).replace(RECORD_FILLER, " ").replace(/\s+/g, " ").trim();
  const parts = namesPart.split(RECORD_SPLIT);
  if (parts.length !== 2) return null;
  const left = tidyName(parts[0]), right = tidyName(parts[1]);
  if (!left || !right || !looksLikeName(left) || !looksLikeName(right)) return null;
  return { left, right, leftWins: a, draws: d, rightWins: b, year };
}

/**
 * A record as dated results. Spread evenly across its year (up to today),
 * and INTERLEAVED — W, L, W, D, L — not all the wins then all the losses,
 * which would hand somebody a fictional five-match streak. With no year they
 * all take `fallback`, the date the screen asks for.
 */
export function expandRecord(r: ParsedRecord, fallback: number, now: number = Date.now()): Array<{ date: number; winner: Side }> {
  const kinds: Array<{ side: Side; n: number }> = [
    { side: "left", n: r.leftWins }, { side: "draw", n: r.draws }, { side: "right", n: r.rightWins },
  ];
  const slots: Array<{ side: Side; pos: number }> = [];
  kinds.forEach(({ side, n }) => { for (let i = 0; i < n; i++) slots.push({ side, pos: (i + 0.5) / n }); });
  slots.sort((x, y) => x.pos - y.pos || (x.side < y.side ? -1 : 1));
  const total = slots.length;
  let from = fallback, to = fallback;
  if (r.year != null) {
    from = new Date(r.year, 0, 1, 12).getTime();
    to = Math.min(new Date(r.year, 11, 31, 12).getTime(), now);
    if (to < from) to = from;
  }
  return slots.map((s, i) => ({ side: s.side, date: total > 1 ? Math.round(from + (to - from) * (i / (total - 1))) : from }))
    .map(({ side, date }) => ({ date, winner: side }));
}

// ------------------------------------------------------------------ parse

export function parseResults(text: string, knownNames: string[] = [], now = new Date()): ParseResult {
  const rows: ParsedRow[] = [];
  const records: ParsedRecord[] = [];
  const unreadable: Unreadable[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let columns: Column[] | null = null;
  let leftIsWinner = false;
  // A date on a line of its own ("Saturday 12 March 2019") applies to the
  // lines under it, which is how a results book is laid out.
  let carriedDate: number | null = null;

  // Longest first, so "Charlie Henry" wins over "Charlie" when both are known.
  const known = Array.from(new Set(knownNames.map((n) => n.trim()).filter(Boolean))).sort((a, b) => b.length - a.length);

  lines.forEach((rawLine, i) => {
    const raw = rawLine.trim();
    const line = i + 1;
    if (!raw) return;

    const cells = splitCells(raw);
    if (cells && !columns) {
      const h = headerColumns(cells);
      if (h) { columns = h.cols; leftIsWinner = h.leftIsWinner; return; }
    }

    // --- a table row under a header we understood --------------------------
    if (cells && columns && cells.length >= columns.filter((c) => c !== "ignore").length) {
      let left = "", right = "", scoreText = "", resultWord = "", dateText = "";
      cells.forEach((c, j) => {
        const col = columns![j];
        if (col === "left") left = c;
        else if (col === "right") right = c;
        else if (col === "score") scoreText += " " + c;
        else if (col === "result") resultWord = c;
        else if (col === "date") dateText = c;
      });
      // Loose comma-split cells that are set scores belong to the score.
      if (columns.includes("score")) cells.slice(columns.length).forEach((c) => { scoreText += " " + c; });
      const d = findDate(dateText, now);
      const { sets } = takeSets(scoreText);
      const worded = RESULT_WORD[resultWord.trim().toLowerCase()] ?? null;
      finish(line, raw, d ? d.t : carriedDate, tidyName(left), tidyName(right), worded, sets, leftIsWinner);
      return;
    }

    // --- a delimited row with no header: cells, classified one by one -------
    if (cells) {
      let dateT: number | null = null;
      let scoreText = "";
      let worded: Side | null = null;
      const names: string[] = [];
      for (const c of cells) {
        const t = c.trim();
        if (!t) continue;
        const d = findDate(t, now);
        if (d && d.match.length >= t.length - 1) { dateT = d.t; continue; }
        if (takeSets(t).sets.length && !/[a-z]/i.test(takeSets(t).rest)) { scoreText += " " + t; continue; }
        if (RESULT_WORD[t.toLowerCase()]) { worded = RESULT_WORD[t.toLowerCase()]; continue; }
        names.push(t);
      }
      // Two names alone are not a result: "Great night everyone, drinks
      // after" is two cells of words. A date, a score or a W/L/D has to be
      // there too, or the line is read as free text, which needs "beat" / "v".
      if (names.length === 2 && (dateT != null || scoreText.trim() || worded)) {
        finish(line, raw, dateT ?? carriedDate, tidyName(names[0]), tidyName(names[1]), worded, takeSets(scoreText).sets, false);
        return;
      }
      // Otherwise fall through and read it as free text.
    }

    // --- free text ----------------------------------------------------------
    let text = " " + raw.replace(NOISE, " ") + " ";
    const d = findDate(text, now);
    if (d) text = text.replace(d.match, " ");
    const rec = readRecord(text, !!d);
    if (rec) { records.push({ line, raw, ...rec }); return; }
    const { sets, rest } = takeSets(text);
    text = rest.replace(/[,;|\t]+/g, " ").replace(/\s+/g, " ");

    // A line that is only a date sets the date for what follows.
    if (d && !sets.length && !/[a-z]{2,}/i.test(text.replace(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/gi, ""))) {
      carriedDate = d.t;
      return;
    }

    let left = "", right = "";
    let worded: Side | null = null;
    for (const j of JOINERS) {
      const parts = (" " + text + " ").split(j.re);
      if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
        left = parts[0]; right = parts[1]; worded = j.side; break;
      }
    }

    // A trailing or leading W / L / D / "won" is a result word, not a name.
    if (left && right) {
      const tail = /\s+(w|l|d|won|lost|draw|drew|drawn)\s*$/i.exec(right);
      if (tail && worded == null) { worded = RESULT_WORD[tail[1].toLowerCase()]; right = right.slice(0, tail.index); }
    }

    // No joining word: find two known names in the line instead.
    if (!left || !right) {
      const hay = text.toLowerCase();
      const found: Array<{ name: string; at: number }> = [];
      let rem = hay;
      for (const n of known) {
        const idx = rem.indexOf(n.toLowerCase());
        if (idx >= 0 && /[^a-z]/.test(rem[idx - 1] || " ") && /[^a-z]/.test(rem[idx + n.length] || " ")) {
          found.push({ name: n, at: idx });
          rem = rem.slice(0, idx) + " ".repeat(n.length) + rem.slice(idx + n.length);
        }
        if (found.length === 2) break;
      }
      if (found.length === 2) {
        found.sort((a, b) => a.at - b.at);
        const leftover = rem.replace(/\s+/g, " ").trim().toLowerCase();
        // Whatever is left once the names are out has to be accounted for.
        // Numbers or words it cannot explain mean the line says something
        // this reader did not understand, and turning it into one match
        // anyway is exactly the silent guess rule 1 forbids.
        const explained = !leftover || !!RESULT_WORD[leftover] || /^(?:and|&|with|played|on|at|the|a|match|game)(?:\s+(?:and|&|with|played|on|at|the|a|match|game))*$/.test(leftover);
        if (!explained) {
          unreadable.push({ line, raw, reason: `Couldn't make sense of “${leftover}” — write it as “Name beat Name 6-4”, or a record as “Name v Name 3-2 2025”` });
          return;
        }
        left = found[0].name; right = found[1].name;
        if (RESULT_WORD[leftover] && worded == null) worded = RESULT_WORD[leftover];
      }
    }

    left = tidyName(left); right = tidyName(right);
    if (!left || !right) {
      unreadable.push({ line, raw, reason: sets.length || d ? "Couldn't tell who played — write it as “Name beat Name” or “Name v Name”" : "Not a result" });
      return;
    }
    finish(line, raw, d ? d.t : carriedDate, left, right, worded, sets, false);
  });

  function finish(line: number, raw: string, date: number | null, left: string, right: string, worded: Side | null, sets: SetScore[], leftIsWinner: boolean) {
    if (!looksLikeName(left) || !looksLikeName(right)) {
      unreadable.push({ line, raw, reason: "Couldn't read two names" });
      return;
    }
    if (left.toLowerCase() === right.toLowerCase()) {
      unreadable.push({ line, raw, reason: "The same name on both sides" });
      return;
    }
    if (leftIsWinner && worded == null) worded = "left";
    const says = scoreSays(sets);
    const winner: Side | null = worded ?? says;
    let oriented: SetScore[] | null = sets.length ? sets : null;
    // Rule 3: the words win, and a score written from the winner's side is
    // turned round to read left-first.
    if (worded && says && worded !== says && worded !== "draw" && says !== "draw") oriented = flip(sets);
    if (worded === "draw" && says && says !== "draw") oriented = null; // a "draw" with a decisive score: keep the result, drop the score
    rows.push({ line, raw, date, left, right, winner, sets: oriented });
  }

  return { rows, records, unreadable };
}

// ------------------------------------------------------------------ names

export interface ImportPlayer { id: string; name?: string; last?: string; nick?: string; inactive?: boolean }

export type NameStatus =
  /** Exactly one player could be meant; used unless changed. */
  | { kind: "matched"; playerId: string }
  /** More than one could be meant, or only part of the name matches. */
  | { kind: "choose"; candidates: string[] }
  /** Nobody in the league looks like this — a new player, unless changed. */
  | { kind: "new" };

const norm = (s: string | undefined) => (s || "").trim().toLowerCase().replace(/[.’']/g, "").replace(/\s+/g, " ");
const fullOf = (p: ImportPlayer) => norm([p.name, p.last].filter(Boolean).join(" "));

/**
 * What a written name could mean. Anything short of a single certain match is
 * a question for a person — see rule 2 at the top of this file.
 */
export function resolveName(written: string, players: ImportPlayer[]): NameStatus {
  const w = norm(written);
  const parts = w.split(" ");
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";

  const exact = players.filter((p) => fullOf(p) === w);
  const likeness = players.filter((p) => {
    const pf = norm(p.name).split(" ")[0];
    const pl = norm(p.last);
    const nick = norm(p.nick);
    if (fullOf(p) === w) return true;
    if (nick && nick === w) return true;
    if (pf === first && (!last || !pl)) return true;               // "Charlie" ~ Charlie Henry
    if (pf === first && pl && last && pl.startsWith(last)) return true;   // "Charlie H"
    if (pl && last === pl && first.length <= 2 && pf.startsWith(first)) return true; // "C Henry"
    return false;
  });

  if (exact.length === 1 && likeness.length === 1) return { kind: "matched", playerId: exact[0].id };
  if (likeness.length) {
    // Exact matches first, then the rest in the order the league lists them.
    const ids = [...exact, ...likeness.filter((p) => !exact.includes(p))].map((p) => p.id);
    return { kind: "choose", candidates: Array.from(new Set(ids)) };
  }
  return { kind: "new" };
}

/** "Hugh de Montfort" → first "Hugh", last "de Montfort". */
export function splitName(written: string): { name: string; last?: string } {
  const t = written.trim().replace(/\s+/g, " ");
  const i = t.indexOf(" ");
  if (i < 0) return { name: t };
  return { name: t.slice(0, i), last: t.slice(i + 1) };
}

// ------------------------------------------------------------- duplicates

export interface ExistingMatch { p1: string; p2: string; date: number; winner: string }

const dayKey = (t: number) => { const d = new Date(t); return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate(); };

/**
 * Whether a result is already in the league: same two people, same day, same
 * winner. Importing the same sheet twice is the easiest mistake to make, and
 * the one that doubles everybody's record without anybody noticing.
 */
export function isAlreadyIn(p1: string, p2: string, date: number, winner: "p1" | "p2" | "draw", existing: ExistingMatch[]): boolean {
  const day = dayKey(date);
  const winnerId = winner === "draw" ? "draw" : winner === "p1" ? p1 : p2;
  return existing.some((m) => {
    const same = (m.p1 === p1 && m.p2 === p2) || (m.p1 === p2 && m.p2 === p1);
    if (!same || dayKey(m.date) !== day) return false;
    const w = m.winner === "draw" ? "draw" : m.winner === "p1" ? m.p1 : m.p2;
    return w === winnerId;
  });
}
