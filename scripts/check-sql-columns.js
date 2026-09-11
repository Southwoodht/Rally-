#!/usr/bin/env node
/**
 * Check every column referenced in supabase/*.sql against the columns this
 * codebase actually knows about.
 *
 * WHY THIS EXISTS
 *
 * A coding session cannot query the database. It writes SQL from inference,
 * and Postgres is unhelpfully forgiving about it: `create or replace
 * function` validates plpgsql *syntax* and not table names, so a function
 * referencing a column that does not exist is created successfully and fails
 * only when something calls it.
 *
 * That happened twice on 2026-09-11 in one file. `players.updated_at` was
 * invented outright — the column is `claimed_at` — and the fix shipped
 * alongside a second runtime-only failure. Both reported "success" when run.
 * Three rounds of guessing went into diagnosing them, and the evidence was
 * sitting in leagueData.ts the whole time, which lists every column the app
 * reads or writes.
 *
 * So: derive the schema from the code, and check the SQL against it.
 *
 * WHAT IT CANNOT DO
 *
 * It does not know the real database. It knows what this repo demonstrably
 * touches — the row mappers plus every column any migration adds or creates.
 * A column that exists in Postgres and is never referenced here is unknown
 * to it, so an unknown column is a **warning to verify**, not proof of a bug.
 * Add it to EXTRA_COLUMNS below once confirmed.
 *
 * Exit code 1 on anything unknown, so it can sit in the gate.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SQL_DIR = path.join(ROOT, "supabase");

/**
 * Columns proven by the app's own read/write mappers.
 *
 * Parsed rather than hardcoded: `playerToRow` and friends ARE the schema as
 * far as this codebase is concerned, and a hardcoded copy would drift from
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
    // `column: expression,` — the left-hand side is the database column.
    for (const m of block[0].matchAll(/^\s{2}([a-z_][a-z0-9_]*):/gm)) cols.add(m[1]);
    out[table] = cols;
  }
  // The readers add columns the writers never set (created_at is Postgres's).
  for (const [table, re] of [["matches", /const rowToMatch[\s\S]*?\n\}\);/], ["players", /const rowToPlayer[\s\S]*?\n\}\);/]]) {
    const block = src.match(re);
    if (!block) continue;
    for (const m of block[0].matchAll(/r\.([a-z_][a-z0-9_]*)/g)) (out[table] ||= new Set()).add(m[1]);
  }
  return out;
}

/** Columns any migration adds or creates — those are real by construction. */
function columnsFromMigrations(known) {
  for (const file of fs.readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql"))) {
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
        if (c && !/^(primary|foreign|unique|constraint|check)$/i.test(c[1])) (known[table] ||= new Set()).add(c[1]);
      }
    }
  }
  return known;
}

/** Real columns this repo has no other evidence for. Add once verified. */
const EXTRA_COLUMNS = {
  players: ["created_at", "updated_at_unknown_do_not_use"].slice(0, 1),
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
  for (const [t, cols] of Object.entries(EXTRA_COLUMNS)) for (const c of cols) (known[t] ||= new Set()).add(c);
  return known;
}

/** Postgres gives every table these. They are real and never declared. */
const SYSTEM_COLUMNS = new Set(["ctid", "xmin", "xmax", "cmin", "cmax", "tableoid", "oid"]);

/** alias -> table, from every FROM/JOIN/UPDATE in a statement. */
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

function main() {
  const known = buildKnown();
  const problems = [];

  for (const file of fs.readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql"))) {
    const raw = fs.readFileSync(path.join(SQL_DIR, file), "utf8");
    // Comments are prose and full of words that look like columns.
    const sql = raw.replace(/--[^\n]*/g, "");
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
        problems.push(`${file}:${line}  ${alias}.${col}  — no evidence "${col}" exists on ${table}`);
      }
    }
  }

  if (!problems.length) {
    console.log("sql column check: clean");
    return;
  }
  console.error("sql column check: " + problems.length + " reference(s) with no evidence\n");
  for (const p of problems) console.error("  " + p);
  console.error("\nEach is either a typo, an invented column, or a real column this repo");
  console.error("never touches. Verify against the database, then add it to");
  console.error("EXTRA_COLUMNS in scripts/check-sql-columns.js.");
  process.exit(1);
}

main();
