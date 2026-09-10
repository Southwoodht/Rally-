import {
  AUTO_CANCEL_DAYS, DEFAULT_DURATION_MINUTES, countsInLeagueTable, endsAt,
  initialStatus, isNearMyLevel, needsResultPrompt, resolveLeague,
  shouldAnnounce, shouldAutoCancel, statusAfterReport,
} from "./booking";

let pass = 0, fail = 0;
const eq = (got: any, want: any, msg: string) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fail++;
  console.error(`  FAIL ${msg}\n    expected ${w}\n    got      ${g}`);
};

const claimed = { id: "z", auth_id: "auth-1" };
const shell = { id: "s", auth_id: null };

// Who has to agree -------------------------------------------------------
eq(initialStatus(claimed), "proposed", "a real person is asked first");
eq(initialStatus(shell), "scheduled", "a shell has nobody to ask, so it is simply booked");
eq(initialStatus(undefined), "scheduled", "a missing opponent does not become a proposal");

// The newsfeed -----------------------------------------------------------
eq(shouldAnnounce("scheduled"), true, "announce once it is agreed");
eq(shouldAnnounce("proposed"), false, "never announce a match nobody has agreed to");
["awaiting", "reported", "confirmed", "cancelled", "declined"].forEach((s) =>
  eq(shouldAnnounce(s as any), false, `no booking announcement for "${s}"`));

// Which league -----------------------------------------------------------
eq(resolveLeague(["a"], ["a"]), { kind: "single", leagueId: "a" }, "one shared league is assigned silently");
eq(resolveLeague(["a", "b"], ["b", "a"]), { kind: "choose", options: ["a", "b"] }, "several shared leagues must be asked about");
eq(resolveLeague(["a"], ["b"]), { kind: "friendly" }, "no shared league is a friendly");
eq(resolveLeague([], []), { kind: "friendly" }, "no leagues at all is a friendly");
eq(resolveLeague(["a", "b"], ["b"]), { kind: "single", leagueId: "b" }, "only the leagues BOTH are in count");
eq(countsInLeagueTable(null), false, "a friendly is in no league table");
eq(countsInLeagueTable("a"), true, "a league match is");

// Someone at my level ----------------------------------------------------
const lvl = (cat: string) => ({ cat, sub: "Medium" });
eq(isNearMyLevel(lvl("Intermediate"), lvl("Intermediate")), true, "same category matches");
eq(isNearMyLevel(lvl("Intermediate"), lvl("Advanced")), true, "one category up matches");
eq(isNearMyLevel(lvl("Intermediate"), lvl("Amateur")), true, "one category down matches");
eq(isNearMyLevel(lvl("Intermediate"), lvl("Pro")), false, "three categories up does not");
eq(isNearMyLevel(lvl("Beginner"), lvl("Intermediate")), false, "two categories apart does not");
// Sub-level is deliberately ignored: it is the half of the dropdown people
// get wrong, and comparing on it is arithmetic performed on a guess.
eq(isNearMyLevel({ cat: "Intermediate", sub: "Low" }, { cat: "Intermediate", sub: "High" }), true,
  "sub-level never separates two people in the same category");
// No level set is not a level.
eq(isNearMyLevel(null, lvl("Intermediate")), false, "somebody with no level matches nobody");
eq(isNearMyLevel(lvl("Intermediate"), null), false, "and is matched by nobody");
eq(isNearMyLevel(lvl("Intermediate"), { cat: "Nonsense" }), false, "an unknown category matches nobody");

// How did it go ----------------------------------------------------------
const HOUR = 3600000, DAY = 86400000;
const booked = (date: number, status = "scheduled", durationMinutes?: number) => ({ date, status, durationMinutes });
const T = 1_800_000_000_000;
eq(endsAt(booked(T)), T + DEFAULT_DURATION_MINUTES * 60000, "two hours by default");
eq(endsAt(booked(T, "scheduled", 45)), T + 45 * 60000, "or whatever the booking says");
eq(needsResultPrompt(booked(T), T + HOUR), false, "not while it is still being played");
eq(needsResultPrompt(booked(T), T + 3 * HOUR), true, "once it is over, ask");
eq(needsResultPrompt(booked(T, "proposed"), T + 3 * HOUR), false, "never ask about a match nobody agreed to");
eq(needsResultPrompt(booked(T, "confirmed"), T + 3 * HOUR), false, "or one already resolved");
eq(needsResultPrompt(booked(T, "cancelled"), T + 3 * HOUR), false, "or one that did not happen");
eq(shouldAutoCancel(booked(T), T + 3 * HOUR), false, "a few hours late is not given up on");
eq(shouldAutoCancel(booked(T), T + (AUTO_CANCEL_DAYS + 1) * DAY), true, "a week later it is");
eq(shouldAutoCancel(booked(T, "confirmed"), T + 30 * DAY), false, "a resolved match is never auto-cancelled");

// Result agreement -------------------------------------------------------
eq(statusAfterReport(shell), "confirmed", "against a shell the result is final — nobody can disagree");
eq(statusAfterReport(claimed), "reported", "against a real person it waits for them");

console.log(fail ? `\nFAILED — ${fail} of ${pass + fail} checks` : `\nPASSED — ${pass}/${pass} checks`);
if (fail) process.exit(1);
