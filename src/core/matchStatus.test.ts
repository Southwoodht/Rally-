import { CONFIRM_WINDOW_MS, countsAsPlayed, hasResult, isAgreed, isBooking, isDisputed, isLegacy, isLegacyClaimed, isShortMatch, isUnconfirmedResult, legacyLine, legacyNeedsAgreement } from "./matchStatus";

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

// A result counts from the moment somebody logs it. This reversed on
// 2026-09-10 — measured first: zero pending matches existed in production,
// so nothing moved on the day.
eq(countsAsPlayed(m("confirmed")), true, "confirmed counts, as it always has");
eq(countsAsPlayed(m("pending")), true, "an unconfirmed result counts too");
eq(isUnconfirmedResult(m("pending")), true, "pending is an unconfirmed result");
eq(hasResult(m("pending")), true, "pending has a result, it just isn't agreed");

// Counting a result and flagging that nobody has agreed it are different
// questions, and the split is what stops a pending match being listed twice
// on a screen that shows agreed and unagreed side by side.
eq(isAgreed(m("confirmed")), true, "confirmed is agreed");
eq(isAgreed(m("pending")), false, "pending is NOT agreed, even though it counts");
eq(isAgreed(m("reported")), false, "nor is reported");
eq(isAgreed(m("scheduled")), false, "nor is a booking");

// `reported` is the booking flow's name for `pending`. Same state, so the
// rename can happen without a data migration and without a gap where one of
// them is unrecognised.
eq(countsAsPlayed(m("reported")), true, "reported behaves as pending");
eq(isUnconfirmedResult(m("reported")), true, "reported is an unconfirmed result");
eq(isBooking(m("reported")), false, "reported is not a booking — it has a result");

// An unrecognised status keeps the old behaviour rather than silently
// dropping real results out of the ratings. It warns; it does not vanish.
eq(countsAsPlayed(m("something_new")), true, "unknown status counts, as the old check did");
eq(countsAsPlayed(m(undefined)), true, "a match with no status counts");
eq(isBooking(m(undefined)), false, "a match with no status is not a booking");
eq(countsAsPlayed(undefined), true, "a missing match does not throw");

// Winter Phase 2 (2026-10-21).
eq(countsAsPlayed(m("disputed")), false, "a disputed result counts for nothing until an organiser decides");
eq(isDisputed(m("disputed")), true, "and says it is disputed");
eq(isUnconfirmedResult(m("disputed")), false, "and is not swept up by the auto-confirm");
eq(countsAsPlayed(m("short")), false, "a short match is never counted");
eq(isShortMatch(m("short")), true, "and is recognised as one");
eq(countsAsPlayed(m("legacy")), false, "a legacy result counts for nothing");
eq(hasResult(m("legacy")), false, "and is not a result anything rates");
eq(isLegacy(m("legacy")), true, "but is recognised as legacy");
eq(hasResult(m("short")), false, "nor listed with the results a number counts");
// A claimed legacy result (Sam, 2026-10-30): legacy in every way, still a claim.
eq(countsAsPlayed(m("legacy_claimed")), false, "a claimed legacy result counts for nothing");
eq(isLegacy(m("legacy_claimed")), true, "it is still a legacy result");
eq(isLegacyClaimed(m("legacy_claimed")), true, "marked as a claim");
eq(isLegacyClaimed(m("legacy")), false, "an agreed one is not");
eq(isUnconfirmedResult(m("legacy_claimed")), false, "and the 48-hour sweep never settles it");
eq(hasResult(m("legacy_claimed")), false, "nor is it listed with the results a number counts");
const shell = { id: "s" }, acct = { id: "x", auth_id: "u1" }, me = { id: "me", auth_id: "u0" };
eq(legacyNeedsAgreement(me, shell, "me"), false, "against a shell: nobody to agree");
eq(legacyNeedsAgreement(me, acct, "me"), true, "against an account: they agree");
eq(legacyNeedsAgreement(acct, shell, "org"), true, "an organiser logging for others: the account holder agrees");
eq(legacyLine({ w: 4, d: 0, l: 0 }), "Led 4 legacy years", "led every year");
eq(legacyLine({ w: 3, d: 0, l: 1 }), "Led 3 of 4 legacy years", "led most");
eq(legacyLine({ w: 0, d: 0, l: 2 }), "Trailed 2 legacy years", "trailed");
eq(legacyLine({ w: 1, d: 0, l: 1 }), "Level over 2 legacy years", "level");
eq(legacyLine({ w: 1, d: 0, l: 0 }), "Led 1 legacy year", "singular");
eq(legacyLine({ w: 4, d: 0, l: 0, claimed: 1 }), "Led 4 legacy years · 1 claimed", "a claim is named");
eq(legacyLine({ w: 0, d: 0, l: 0 }), null, "no legacy, no line");
eq(CONFIRM_WINDOW_MS, 48 * 3600 * 1000, "results wait 48 hours for the opponent");

console.log(fail ? `\nFAILED — ${fail} of ${pass + fail} checks` : `\nPASSED — ${pass}/${pass} checks`);
if (fail) process.exit(1);
