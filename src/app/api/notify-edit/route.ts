import { NextResponse } from "next/server";
import { formatMatchDate } from "@/lib/format";
import { describeResult } from "@/lib/matchEditText";
import { adminClient, appUrl, fullName, sendOnce } from "@/lib/email/server";
import { resultEditedEmail } from "@/lib/email/templates";

/**
 * "Sam, an organiser of your club, corrected your result against Will."
 *
 * Sent after an organiser's correction is saved (lib/matchEdits.ts). Trusts
 * nothing but the log row's id: the token says who is asking, the row is read
 * fresh, and only the organiser who wrote it — still staff of that club — can
 * cause the email. Both players are told, except the organiser themselves if
 * they happen to be one of them. Once per log row.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const db = adminClient();
  if (!db) return NextResponse.json({ ok: false, reason: "not configured" }, { status: 200 });

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const who = token ? await db.auth.getUser(token) : null;
  const callerId = who?.data?.user?.id;
  if (!callerId) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const editId = typeof body?.editId === "string" ? body.editId : null;
  if (!editId) return NextResponse.json({ ok: false }, { status: 400 });

  const er = await db.from("match_edits").select("*").eq("id", editId).maybeSingle();
  const e: any = er.data;
  if (!e || e.edited_by !== callerId) return NextResponse.json({ ok: false }, { status: 403 });
  const staff = await db.from("league_members").select("role").eq("league_id", e.league_id).eq("user_id", callerId).maybeSingle();
  if (!staff.data || !["owner", "editor"].includes((staff.data as any).role)) return NextResponse.json({ ok: false }, { status: 403 });

  const ps = await db.from("players").select("id, name, last, auth_id").in("id", [e.p1, e.p2]);
  const players: any[] = ps.data || [];
  const prof = await db.from("profiles").select("display_name").eq("id", callerId).maybeSingle();
  const by = (prof.data as any)?.display_name || "An organiser";
  const url = appUrl(new URL(req.url).origin);
  let sent = 0;
  for (const p of players) {
    if (!p.auth_id || p.auth_id === callerId) continue;
    const side = p.id === e.p1 ? "p1" : "p2";
    const other = players.find((x) => x.id !== p.id);
    const before = describeResult(e.before, side, formatMatchDate);
    const after = describeResult(e.action === "delete" ? null : e.after, side, formatMatchDate);
    const mail = resultEditedEmail(by, other ? fullName(other) : "your opponent", before, after, url);
    const r = await sendOnce(db, { authId: p.auth_id, kind: "result_edited", ref: e.id, ...mail });
    if (r === "sent") sent++;
  }
  return NextResponse.json({ ok: true, sent });
}
