#!/usr/bin/env node
/**
 * Static checks on supabase/*.sql, because a coding session cannot run them.
 *
 * Two things are checked, and both exist because they actually happened:
 *
 * 1. **Columns that do not exist.** `create or replace function` validates
 *    plpgsql *syntax* and not table names, so a function naming a missing
 *    column is created successfully and fails only when something calls it.
 *
 * 2. **Dollar quotes that do not pair.** See checkDollarQuotes.
 *
 * WHAT THIS CANNOT DO
 *
 * It does not know the real database. It knows what this repo demonstrably
 * touches — the `create table` statements in supabase/, every `add column`,
 * and the row mappers in leagueData.ts. A column that exists in Postgres and
 * is never referenced here is unknown to it, so an unknown column is a
 * **warning to verify**, not proof of a bug. Add it to EXTRA_COLUMNS once
 * confirmed.
 *
 * Exit code 1 on anything suspect, so it can sit in the gate.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SQL_DIR = path.join(ROOT, "supabase");

const sqlFiles = () => fs.readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql"));
const stripComments = (sql) => sql.replace(/--[^\n]*/g, "");

/**
 * Columns proven by the app's own read/write mappers.
 *
 * Parsed rather than hardcoded, because a hardcoded copy would drift from
 * them silently — which is the same failure this script exists to catch.
 */
function columnsFromMappers() {
  const src = fs.readFileSync(path.join(ROOT, "src/lib/leagueData.ts"), "utf8");
  const out = {};
  const mappers = [
    ["players", /const playerToRow[\s\S]*?\n\}\);/],
    ["matches", /const matchToRow[\s\S]*?\n\}\);/],
    ["fixtures", /const fixtureToRow[\s\S]*?\n\}\);/],
    ["posts", /const postToRow[\s\S]*?\n\}\);/],
  ];
  for (const [table, re] of mappers) {
    const block = src.match(re);
    if (!block) continue;
    const cols = new Set();
    for (const m of block[0].matchAll(/^\s{2}([a-z_][a-z0-9_]*):/gm)) cols.add(m[1]);
    out[table] = cols;
  }
  // Readers pick up columns the writers never set — created_at is Postgres's.
  const readers = [
    ["matches", /const rowToMatch[\s\S]*?\n\}\);/],
    ["players", /const rowToPlayer[\s\S]*?\n\}\);/],
  ];
  for (const [table, re] of readers) {
    const block = src.match(re);
    if (!block) continue;
    for (const m of block[0].matchAll(/r\.([a-z_][a-z0-9_]*)/g)) (out[table] ||= new Set()).add(m[1]);
  }
  return out;
}

/** Columns any migration adds or creates — real by construction. */
function columnsFromMigrations(known) {
  for (const file of sqlFiles()) {
    const sql = fs.readFileSync(path.join(SQL_DIR, file), "utf8");
    for (const m of sql.matchAll(/alter\s+table\s+(?:public\.)?(\w+)([\s\S]*?);/gi)) {
      const table = m[1];
      for (const c of m[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi)) {
        (known[table] ||= new Set()).add(c[1]);
      }
    }
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
      const table = m[1];
      for (const line of m[2].split("\n")) {
        const c = line.trim().match(/^([a-z_][a-z0-9_]*)\s+\w/);
        if (c && !/^(primary|foreign|unique|constraint|check)$/i.test(c[1])) {
          (known[table] ||= new Set()).add(c[1]);
        }
      }
    }
  }
  return known;
}

/** Real columns this repo has no other evidence for. Add once verified. */
const EXTRA_COLUMNS = {
  players: ["created_at"],
  matches: ["created_at"],
  profiles: ["id", "display_name", "avatar_url", "friend_code", "created_at"],
  league_members: ["league_id", "user_id", "role"],
  leagues: ["id", "name", "location", "join_code", "created_by", "created_at"],
  friends: ["id", "requester_id", "addressee_id", "status", "created_at"],
  messages: ["id", "thread_id", "sender_id", "body", "created_at", "read_at"],
  message_threads: ["id", "started_by", "status", "created_at"],
  clubs: ["id", "name", "code", "created_by"],
  club_members: ["club_id", "user_id", "role"],
  trophies: ["id", "player_id", "auth_id", "club_id", "status", "claimant_name", "created_at"],
};

function buildKnown() {
  const known = columnsFromMappers();
  columnsFromMigrations(known);
  for (const [t, cols] of Object.entries(EXTRA_COLUMNS)) {
    for (const c of cols) (known[t] ||= new Set()).add(c);
  }
  return known;
}

/** Postgres gives every table these. Real, never declared. */
const SYSTEM_COLUMNS = new Set(["ctid", "xmin", "xmax", "cmin", "cmax", "tableoid", "oid"]);

/** alias -> table, from every FROM/JOIN/UPDATE in a file. */
function aliasMap(sql) {
  const map = {};
  const re = /\b(?:from|join|update)\s+public\.(\w+)\s+(?:as\s+)?([a-z][a-z0-9_]*)\b/gi;
  for (const m of sql.matchAll(re)) {
    const [, table, alias] = m;
    if (/^(on|where|set|using|select|values|as|and|or|order|group|limit)$/i.test(alias)) continue;
    map[alias] = table;
  }
  return map;
}

/**
 * Dollar quotes must come in pairs.
 *
 * Added 2026-09-12, after a function body opened with a single `$` and
 * Postgres rejected the whole file. The cause was not a typo.
 *
 * In JavaScript's String.replace, `$$` inside the REPLACEMENT string is an
 * escape meaning one literal `$`. So every edit script that rewrote SQL
 * through replace() was silently halving `$$` into `$` — invisible when
 * reading the diff, fatal at run time, and it had already cost Sam a paste.
 *
 * The fix on the writing side is to pass a function as the replacement,
 * `replace(a, () => b)`, which turns off $-substitution entirely. This is the
 * backstop for when somebody forgets.
 */
function checkDollarQuotes(problems) {
  for (const file of sqlFiles()) {
    const sql = stripComments(fs.readFileSync(path.join(SQL_DIR, file), "utf8"));
    const pairs = (sql.match(/\$\$/g) || []).length;
    if (pairs % 2 !== 0) {
      problems.push(file + "  — " + pairs + " dollar-quote marker(s); they must pair up");
    }
    // A lone $ standing where a $$ belongs: "as $", or a line that is just "$;".
    const lone = /(^|\n)[ \t]*(?:as[ \t]+)?\$(?!\$)[ \t]*;?[ \t]*(?=\n)/g;
    for (const m of sql.matchAll(lone)) {
      const line = sql.slice(0, m.index).split("\n").length + 1;
      problems.push(file + ":" + line + "  — a single $ where a $$ was meant");
    }
  }
}

function checkColumns(problems) {
  const known = buildKnown();
  for (const file of sqlFiles()) {
    const sql = stripComments(fs.readFileSync(path.join(SQL_DIR, file), "utf8"));
    const aliases = aliasMap(sql);
    for (const m of sql.matchAll(/\b([a-z][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/g)) {
      const [, alias, col] = m;
      const table = aliases[alias];
      if (!table) continue;
      const cols = known[table];
      if (!cols) continue;
      if (SYSTEM_COLUMNS.has(col)) continue;
      if (!cols.has(col)) {
        const line = sql.slice(0, m.index).split("\n").length;
        problems.push(file + ":" + line + "  " + alias + "." + col + "  — no evidence \"" + col + "\" exists on " + table);
      }
    }
  }
}

function main() {
  const problems = [];
  checkDollarQuotes(problems);
  checkColumns(problems);

  if (!problems.length) {
    console.log("sql check: clean");
    return;
  }
  console.error("sql check: " + problems.length + " problem(s)\n");
  for (const p of problems) console.error("  " + p);
  console.error("\nAn unknown column is either a typo, an invention, or real and never");
  console.error("touched by this repo — verify it, then add it to EXTRA_COLUMNS here.");
  console.error("A lone $ is almost always String.replace eating one; see checkDollarQuotes.");
  process.exit(1);
}

main();
