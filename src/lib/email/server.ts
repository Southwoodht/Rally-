import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * Email, server side only (winter brief item 6).
 *
 * Two secrets, both set by Sam in Vercel and never in the repo:
 *   RESEND_API_KEY             sends the mail (southwood.app, verified in Resend)
 *   SUPABASE_SERVICE_ROLE_KEY  reads email addresses and every club's fixtures
 *
 * The service-role client bypasses RLS entirely, so it lives only in this
 * file and the two API routes, and every route checks for itself who is
 * allowed to cause what.
 */

export const FROM = "Southwood <noreply@southwood.app>";

let admin: SupabaseClient | null | undefined;
export function adminClient(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  admin = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return admin;
}

/** Where links in an email point: southwood.app, never the address the
 *  request came in on (an old vercel.app tab would otherwise send those).
 *  NEXT_PUBLIC_APP_URL overrides it, for testing. */
export function appUrl(_fallbackOrigin?: string): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return SITE_URL;
}

/**
 * One account's address, if they want email. Null when they have none, have
 * turned emails off, or the opt-out column isn't there yet (schema_email.sql
 * not run) — in which case nothing is sent at all, because the log it needs
 * isn't there either.
 */
export async function recipientFor(db: SupabaseClient, authId: string): Promise<string | null> {
  const prof = await db.from("profiles").select("email_opt_out").eq("id", authId).maybeSingle();
  if (prof.error || prof.data?.email_opt_out) return null;
  const u = await db.auth.admin.getUserById(authId);
  return u.data?.user?.email || null;
}

/**
 * Send once. The log row goes in first, under a unique (recipient, kind, ref):
 * a second attempt finds it and stops, so a double-tap or a re-run of the
 * daily job cannot email anybody twice. If the send itself then fails, the row
 * is taken back out so the next attempt can try again.
 */
export async function sendOnce(
  db: SupabaseClient,
  m: { authId: string; kind: string; ref: string; subject: string; html: string; text: string },
): Promise<"sent" | "already" | "skipped" | "failed"> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "skipped";
  const to = await recipientFor(db, m.authId);
  if (!to) return "skipped";
  const claim = await db.from("email_log").insert({ recipient: m.authId, kind: m.kind, ref: m.ref }).select("id").maybeSingle();
  if (claim.error) return (claim.error as any).code === "23505" ? "already" : "skipped";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject: m.subject, html: m.html, text: m.text }),
  });
  if (!res.ok) {
    console.error("Resend refused an email", res.status, await res.text().catch(() => ""));
    if (claim.data?.id) await db.from("email_log").delete().eq("id", claim.data.id);
    return "failed";
  }
  return "sent";
}

export const fullName = (p: any) => [p?.name, p?.last].map((x: any) => String(x ?? "").trim()).filter(Boolean).join(" ") || "Someone";
export const firstName = (p: any) => String(p?.name ?? "").trim() || "Someone";
