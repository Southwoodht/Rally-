// No React hook may appear after an early return in the same component.
//
// WHY THIS EXISTS, TWICE
//
// RallyApp returns early while it is loading and again if the load failed. A
// useState or useEffect placed below those returns does not run on the first
// render and does run on the second, React counts more hooks than last time,
// and the app dies with "Rendered more hooks than during the previous render."
//
// It only breaks once a league finishes loading, which is the one transition
// a typecheck, a build and a component preview all sail past. Commit 3c76c81
// shipped that crash live, fixed it, and its message says it also added this
// check. It did not — that commit contains no script. So the same bug landed
// again on 20 Sep, in the same file, for the same reason.
//
// SCOPE, WHICH IS THE WHOLE DIFFICULTY
//
// The first version of this flagged about a hundred lines and was useless. It
// took the first early return anywhere in the file as the boundary, and these
// files open with small helpers — fmtBoundary, ordinalSuffix, nextUpLine —
// that return early quite properly, twenty lines above the component. Every
// hook in the file then looked like a violation.
//
// So the boundary resets at every top-level declaration: a return only counts
// against hooks in the same function. Both are matched at two-space indent,
// which is a component body in this codebase and not a callback inside one.

const fs = require("fs");
const path = require("path");

const HOOK = /^ {2}(?:const|let|var)?\s*.*?\b(useState|useEffect|useMemo|useCallback|useRef|useReducer|useLayoutEffect)\s*\(/;
// A top-level declaration: where a new function begins and the boundary resets.
const TOP_LEVEL = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s|^(?:export\s+)?const\s+\w+\s*[:=].*(?:=>|function)/;
// A return in a component body, with something after it — `return (`,
// `return <div`, `return null;`. Not a bare `return;`, and not the
// deeper-indented returns inside callbacks.
const EARLY_RETURN = /^ {2}(?:if\s*\(.*\)\s*)?return[ (<]/;

const root = path.join(__dirname, "..");
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx$/.test(entry.name)) files.push(full);
  }
})(path.join(root, "src"));

const problems = [];
for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  let firstReturn = -1;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (TOP_LEVEL.test(raw)) { firstReturn = -1; continue; }   // a new function; forget the last one's returns
    if (/^\s*(?:\/\/|\*|\/\*)/.test(raw)) continue;            // comments say nothing about hooks
    const code = raw.replace(/\/\/.*$/, "");
    if (firstReturn < 0) {
      if (EARLY_RETURN.test(code)) firstReturn = i;
      continue;
    }
    if (HOOK.test(code)) {
      problems.push({
        file: path.relative(root, file),
        line: i + 1,
        text: code.trim().slice(0, 90),
        after: firstReturn + 1,
      });
    }
  }
}

if (problems.length) {
  console.error("hook order: a hook sits below an early return\n");
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}  (early return at line ${p.after})`);
    console.error(`    ${p.text}`);
  }
  console.error(
    "\nMove it up with the other hooks, above every return. A hook below one\n" +
    "runs on some renders and not others, and React throws when the count\n" +
    "changes — which happens only once the early return stops firing, a\n" +
    "moment no build or typecheck ever reaches.",
  );
  process.exit(1);
}

console.log("hook order: clean");
