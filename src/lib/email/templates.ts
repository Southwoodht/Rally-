/**
 * The words of every email, in one place. Plain and short: a person reads
 * these on a phone between other things, the same as the app (CLAUDE.md §4).
 * Every email says how to turn emails off — the brief asks for it, and an
 * email nobody can stop is spam.
 */

export interface Email { subject: string; html: string; text: string }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

function wrap(lines: string[], cta: { label: string; url: string }): Email & { subject: "" } {
  const body = lines.map((l) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#15352a">${esc(l)}</p>`).join("");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f2e9;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px">
<div style="font-size:13px;color:#6b7c74;margin-bottom:16px">Southwood</div>
${body}
<a href="${cta.url}" style="display:inline-block;background:#15352a;color:#f5f2e9;text-decoration:none;padding:12px 18px;border-radius:12px;font-size:15px">${esc(cta.label)}</a>
<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#6b7c74">You get these because you play on Southwood. Turn them off in the app: Profile → menu → Edit my profile → Emails.</p>
</div></body></html>`;
  const text = `${lines.join("\n\n")}\n\n${cta.label}: ${cta.url}\n\nTurn these emails off in the app: Profile → menu → Edit my profile → Emails.`;
  return { subject: "", html, text };
}

// `where` is the booking's venue (fixtures.venue), when it has one.
export function challengeEmail(from: string, when: string, url: string, where?: string | null): Email {
  const at = where ? ` at ${where}` : "";
  return { ...wrap([`${from} has challenged you for a game — ${when}${at}.`, "Open Southwood to see it, or to move or cancel it."], { label: "Open Southwood", url }), subject: `${from} has challenged you for a game — ${when}` };
}

export function bookingEmail(by: string, when: string, url: string, where?: string | null): Email {
  const at = where ? ` at ${where}` : "";
  return { ...wrap([`${by} has booked your match — ${when}${at}.`, "If that doesn't work for you, you can change it in Southwood."], { label: "See the booking", url }), subject: `Match booked — ${when}` };
}

export function resultReminderEmail(opponent: string, when: string, url: string): Email {
  return { ...wrap([`How did it go against ${opponent}?`, `Your match on ${when} hasn't got a result yet. It takes ten seconds, and the table can't count it until somebody enters it.`], { label: "Enter the result", url }), subject: `How did it go against ${opponent}?` };
}

export function deadlineEmail(opponent: string, competition: string, days: 7 | 2, playBy: string, url: string): Email {
  const left = days === 7 ? "a week" : "two days";
  return { ...wrap([`You have ${left} left to play ${opponent} in ${competition}.`, `The play-by date is ${playBy}. Book it now so it doesn't run out.`], { label: "Book the match", url }), subject: `${left[0].toUpperCase() + left.slice(1)} left to play ${opponent}` };
}
