import { NextResponse } from "next/server";
import { deadlineWarningDue, resultReminderDue } from "@/core/emailSchedule";
import { londonDay } from "@/core/seasons";
import { formatMatchDate, formatMatchDateTime } from "@/lib/format";
import { adminClient, appUrl, fullName, sendOnce } from "@/lib/email/server";
import { deadlineEmail, resultReminderEmail } from "@/lib/email/templates";

/**
 * The daily email job (vercel.json runs it each morning): result reminders a
 * day after a booked match nobody entered, and the 7- and 2-day warnings
 * before a competition tie's play-by date. Rules in core/emailSchedule.ts.
 *
 * If CRON_SECRET is set in Vercel, Vercel sends it and anything without it is
 * turned away. Without one the job still can't do harm: it only sends emails
 * that are genuinely due, and email_log stops any of them going twice.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ ok: false, reason: "not configured" });

  const now = Date.now();
  const today = londonDay(now);
  const fx = await db.from("fixtures").select("*").eq("done", false);
  if (fx.error) return NextResponse.json({ ok: false, reason: fx.error.message }, { status: 500 });
  const rows = (fx.data || []).map((r: any) => ({
    ...r,
    durationMinutes: r.duration_minutes ?? null,
    competitionId: r.competition_id ?? null,
    playBy: r.play_by ?? null,
  }));

  const due = rows
    .map((f: any) => ({ f, result: resultReminderDue(f, now), deadline: deadlineWarningDue(f, today) }))
    .filter((x: any) => x.result || x.deadline);
  if (!due.length) return NextResponse.json({ ok: true, sent: 0 });

  const ids = Array.from(new Set(due.flatMap((x: any) => [x.f.p1, x.f.p2])));
  const ps = await db.from("players").select("id, name, last, auth_id").in("id", ids);
  const byId = new Map((ps.data || []).map((p: any) => [p.id, p]));
  const compIds = Array.from(new Set(due.map((x: any) => x.f.competitionId).filter(Boolean)));
  const comps = compIds.length ? await db.from("doubles_competitions").select("id, name").in("id", compIds) : { data: [] as any[] };
  const compName = new Map((comps.data || []).map((c: any) => [c.id, c.name]));

  const url = appUrl(new URL(req.url).origin);
  let sent = 0;
  for (const { f, result, deadline } of due as any[]) {
    for (const [meId, oppId] of [[f.p1, f.p2], [f.p2, f.p1]]) {
      const me: any = byId.get(meId);
      if (!me?.auth_id) continue;
      const opp = fullName(byId.get(oppId));
      if (result) {
        const r = await sendOnce(db, { authId: me.auth_id, kind: "result-reminder", ref: `${f.id}:${f.booked}`, ...resultReminderEmail(opp, formatMatchDateTime(f.booked), url) });
        if (r === "sent") sent++;
      }
      if (deadline) {
        const r = await sendOnce(db, { authId: me.auth_id, kind: `deadline-${deadline}`, ref: `${f.id}:${f.playBy}`, ...deadlineEmail(opp, compName.get(f.competitionId) || "your competition", deadline, formatMatchDate(f.playBy), url) });
        if (r === "sent") sent++;
      }
    }
  }
  return NextResponse.json({ ok: true, sent });
}
