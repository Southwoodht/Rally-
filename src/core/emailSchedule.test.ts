// Tests for core/emailSchedule.ts. Plain TypeScript with an assert; relative
// imports (see CLAUDE.md §1).
import { deadlineWarningDue, resultReminderDue } from "./emailSchedule";

let failures = 0;
let checks = 0;
function ok(cond: boolean, what: string) {
  checks++;
  if (!cond) { failures++; console.error(`  FAIL ${what}`); }
}
const H = 3600 * 1000;
const t0 = Date.UTC(2026, 10, 1, 10, 0);
const booked = new Date(t0).toISOString();

ok(!resultReminderDue({ id: "a", booked }, t0 + 20 * H), "not before a day has passed since it ended");
ok(resultReminderDue({ id: "a", booked }, t0 + 26 * H), "a day after a one-hour match ended: due");
ok(!resultReminderDue({ id: "a", booked, durationMinutes: 120 }, t0 + 25.5 * H), "a two-hour booking ends later");
ok(!resultReminderDue({ id: "a", booked, done: true }, t0 + 26 * H), "entered: nothing to remind");
ok(!resultReminderDue({ id: "a", booked, outcome: "void" }, t0 + 26 * H), "voided by an organiser: nothing");
ok(!resultReminderDue({ id: "a", booked }, t0 + 9 * 24 * H), "a week on, it stops");
ok(!resultReminderDue({ id: "a" }, t0 + 26 * H), "never booked: nothing");

const tie = { id: "t", competitionId: "c", playBy: "2026-11-20" };
ok(deadlineWarningDue(tie, "2026-11-13") === 7, "seven days before");
ok(deadlineWarningDue(tie, "2026-11-18") === 2, "two days before");
ok(deadlineWarningDue(tie, "2026-11-15") === null, "other days: nothing");
ok(deadlineWarningDue({ ...tie, done: true }, "2026-11-13") === null, "played: nothing");
ok(deadlineWarningDue({ id: "x", playBy: "2026-11-20" }, "2026-11-13") === null, "not a competition tie: nothing");

if (failures) { console.error(`\nFAILED — ${failures} of ${checks} checks`); process.exit(1); }
console.log(`PASSED — ${checks}/${checks} checks (email schedule)`);
