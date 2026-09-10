import { countsAsPlayed, hasResult, isBooking, isUnconfirmedResult } from "./matchStatus";

let pass = 0, fail = 0;
const eq = (got: any, want: any, msg: string) => {
  if (got === want) { pass++; return; }
  fail++;
  console.error(`  FAIL ${msg}\n    expected ${JSON.stringify(want)}\n    got      ${JSON.stringify(got)}`);
};

const m = (status?: any) => ({ id: "m", p1: "a", p2: "b", winner: "p1", status });

// The whole point of the module: the five booking statuses must never reach
// the ratings. Under the old `!== "pending"` test every one of these counted.
["proposed", "scheduled", "awaiting", "cancelled", "declined"].forEach((s) => {
  eq(countsAsPlayed(m(s)), false, `"${s}" is not a played match`);
  eq(isBooking(m(s)), true, `"${s}" is a booking`);
  eq(hasResult(m(s)), false, `"${s}" has no result`);
});

// Behaviour that must NOT change. Matches carry only these two values today,
// and both answer exactly what `!== "pending"` answered.
eq(countsAsPlayed(m("confirmed")), true, "confirmed counts, as it always has");
eq(countsAsPlayed(m("pending")), false, "pending does not count, as it never has");
eq(isUnconfirmedResult(m("pending")), true, "pending is an unconfirmed result");
eq(hasResult(m("pending")), true, "pending has a result, it just isn't agreed");

// `reported` is the booking flow's name for `pending`. Same state, so the
// rename can happen without a data migration and without a gap where one of
// them is unrecognised.
eq(countsAsPlayed(m("reported")), false, "reported behaves as pending");
eq(isUnconfirmedResult(m("reported")), true, "reported is an unconfirmed result");
eq(isBooking(m("reported")), false, "reported is not a booking — it has a result");

// An unrecognised status keeps the old behaviour rather than silently
// dropping real results out of the ratings. It warns; it does not vanish.
eq(countsAsPlayed(m("something_new")), true, "unknown status counts, as the old check did");
eq(countsAsPlayed(m(undefined)), true, "a match with no status counts");
eq(isBooking(m(undefined)), false, "a match with no status is not a booking");
eq(countsAsPlayed(undefined), true, "a missing match does not throw");

console.log(fail ? `\nFAILED — ${fail} of ${pass + fail} checks` : `\nPASSED — ${pass}/${pass} checks`);
if (fail) process.exit(1);
