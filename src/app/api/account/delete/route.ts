import { NextResponse } from "next/server";
import { adminClient } from "@/lib/email/server";
import { FORMER_PLAYER_NAME } from "@/lib/format";

/**
 * Delete my account (Sam, 2026-10-24).
 *
 * The person goes; their results stay. Every match is also somebody else's
 * match, so deleting results would move other people's ratings — instead the
 * player rows they owned are renamed "Former player", lose their photo and
 * details, are marked not playing, and are never offered on the claim screen.
 *
 * It needs the service role, because only that can delete a login, and it
 * trusts nothing in the request but the caller's own token: the account
 * deleted is always the caller's.
 *
 * THE DATABASE WOULD TAKE A CLUB WITH ITS CREATOR. leagues.created_by (and
 * clubs.created_by) are `on delete cascade`, so deleting a creator's login
 * deletes their club, its players and every result in it. So before anything
 * is written: every club they created passes to another owner (Sam's choice),
 * and if any club has no other owner the whole request is refused, naming it,
 * with nothing changed. The hand-over is undone if the delete then fails.
 *
 * Two columns point at a login with no ON DELETE rule (matches.nudged_by,
 * trophies.verified_by) and would block the delete, so they are cleared. A
 * trophy they claimed moves onto their player row rather than vanishing with
 * the login.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const db = adminClient();
  if (!db) return NextResponse.json({ ok: false, message: "Account deletion isn't set up on this server yet." }, { status: 503 });

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const who = token ? await db.auth.getUser(token) : null;
  const uid = who?.data?.user?.id;
  if (!uid) return NextResponse.json({ ok: false, message: "Please sign in again." }, { status: 401 });

  const fail = (message: string, status = 500) => NextResponse.json({ ok: false, message }, { status });

  // 1. Clubs they created, and who takes each one. Nothing is written yet.
  const created = await db.from("leagues").select("id, name").eq("created_by", uid);
  if (created.error) return fail("Couldn't check your clubs. Nothing was deleted.");
  const handOver: Array<{ id: string; name: string; to: string }> = [];
  for (const l of created.data || []) {
    const owners = await db.from("league_members").select("user_id, joined_at")
      .eq("league_id", l.id).eq("role", "owner").neq("user_id", uid).order("joined_at", { ascending: true }).limit(1);
    const to = owners.data?.[0]?.user_id;
    if (!to) {
      return fail(`You created ${l.name}. Make someone else an owner first (Run your club → Who helps run it), then delete your account. Nothing was deleted.`, 409);
    }
    handOver.push({ id: l.id, name: l.name, to });
  }
  // The older clubs table (trophies). Missing table: nothing to hand over.
  const clubHandOver: Array<{ id: string; to: string }> = [];
  const clubs = await db.from("clubs").select("id, name").eq("created_by", uid);
  for (const c of clubs.error ? [] : clubs.data || []) {
    const admins = await db.from("club_members").select("user_id, joined_at")
      .eq("club_id", c.id).eq("role", "admin").neq("user_id", uid).order("joined_at", { ascending: true }).limit(1);
    const to = admins.data?.[0]?.user_id;
    if (!to) return fail(`You set up the trophy club ${c.name}, and nobody else runs it. Ask Southwood to move it before deleting your account. Nothing was deleted.`, 409);
    clubHandOver.push({ id: c.id, to });
  }

  // 2. Their player rows, remembered before the login goes (auth_id is
  //    `on delete set null`, so afterwards nothing would say which they were).
  const mine = await db.from("players").select("id").eq("auth_id", uid);
  if (mine.error) return fail("Couldn't read your player record. Nothing was deleted.");
  const playerIds: string[] = (mine.data || []).map((r: any) => r.id);

  // 3. Clear what would block the delete, and keep their honours.
  await db.from("matches").update({ nudged_by: null }).eq("nudged_by", uid);
  await db.from("trophies").update({ verified_by: null }).eq("verified_by", uid);
  if (playerIds.length) {
    await db.from("trophies").update({ player_id: playerIds[0] }).eq("claimed_by", uid).is("player_id", null);
  }
  await db.from("trophies").update({ claimed_by: null }).eq("claimed_by", uid).not("player_id", "is", null);

  // 4. Hand the clubs over, then delete the login. Undo the hand-over if the
  //    delete fails, so a refusal changes nothing that matters.
  for (const h of handOver) await db.from("leagues").update({ created_by: h.to }).eq("id", h.id);
  for (const h of clubHandOver) await db.from("clubs").update({ created_by: h.to }).eq("id", h.id);
  const del = await db.auth.admin.deleteUser(uid);
  if (del.error) {
    for (const h of handOver) await db.from("leagues").update({ created_by: uid }).eq("id", h.id);
    for (const h of clubHandOver) await db.from("clubs").update({ created_by: uid }).eq("id", h.id);
    return fail("Couldn't delete your account just now. Nothing was deleted — please try again.");
  }

  // 5. The results stay; the person goes.
  if (playerIds.length) {
    await db.from("players").update({
      name: FORMER_PLAYER_NAME, last: null, nick: null, age: null, home: null,
      avatar: null, avatar_url: null, inactive: true, claimed_at: null,
    }).in("id", playerIds);
  }

  return NextResponse.json({ ok: true, clubsHandedOver: handOver.map((h) => h.name) });
}
