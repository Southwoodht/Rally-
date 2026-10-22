import { NextResponse } from "next/server";
import { formatMatchDateTime } from "@/lib/format";
import { adminClient, appUrl, firstName, fullName, sendOnce } from "@/lib/email/server";
import { bookingEmail, challengeEmail } from "@/lib/email/templates";

/**
 * "Sam has challenged you — Sunday 4pm" and "Match booked", sent the moment a
 * booking is saved (winter brief item 6).
 *
 * The app calls this after its own save has gone through, with the signed-in
 * person's token. Nothing here trusts the request beyond the fixture id: the
 * token says who is asking, the fixture is read fresh from the database, and
 * only somebody IN that fixture — or staff of its club — can cause an email
 * about it. The email goes to the other side, never to the person who booked.
 * The log makes it once per booking time, so saving twice sends nothing new
 * and moving the time sends a fresh one.
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
  const kind = body?.kind === "challenge" ? "challenge" : body?.kind === "booking" ? "booking" : null;
  const fixtureId = typeof body?.fixtureId === "string" ? body.fixtureId : null;
  if (!kind || !fixtureId) return NextResponse.json({ ok: false }, { status: 400 });

  const fx = await db.from("fixtures").select("*").eq("id", fixtureId).maybeSingle();
  const f: any = fx.data;
  if (!f || !f.booked || f.done) return NextResponse.json({ ok: true, sent: 0 });

  const ps = await db.from("players").select("id, name, last, auth_id").in("id", [f.p1, f.p2]);
  const players: any[] = ps.data || [];
  const me = players.find((p) => p.auth_id === callerId);
  if (!me) {
    const staff = await db.from("league_members").select("role").eq("league_id", f.league_id).eq("user_id", callerId).maybeSingle();
    if (!staff.data || !["owner", "editor"].includes(staff.data.role)) return NextResponse.json({ ok: false }, { status: 403 });
  }

  const when = formatMatchDateTime(f.booked);
  const url = appUrl(new URL(req.url).origin);
  let sent = 0;
  for (const p of players) {
    if (!p.auth_id || p.auth_id === callerId) continue;
    const other = players.find((x) => x.id !== p.id);
    const by = me ? firstName(me) : fullName(other);
    const mail = kind === "challenge" ? challengeEmail(by, when, url) : bookingEmail(by, when, url);
    const r = await sendOnce(db, { authId: p.auth_id, kind, ref: `${f.id}:${f.booked}`, ...mail });
    if (r === "sent") sent++;
  }
  return NextResponse.json({ ok: true, sent });
}
