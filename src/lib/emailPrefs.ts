import { supabase, withSupabaseTimeout } from "@/lib/supabase";

/**
 * The client half of emails (the server half is lib/email/server.ts).
 *
 * notifyFixture is fire-and-forget on purpose: an email is a courtesy on top
 * of a booking that has already saved, so it never holds the screen up and a
 * failure never reaches the person who booked. The server decides who, if
 * anybody, is emailed.
 */
export async function notifyFixture(kind: "challenge" | "booking", fixtureId: string): Promise<void> {
  try {
    if (!supabase) return;
    const s: any = await withSupabaseTimeout(supabase.auth.getSession(), { data: { session: null } } as any);
    const token = s?.data?.session?.access_token;
    if (!token) return;
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind, fixtureId }),
    });
  } catch { /* a courtesy, never an error */ }
}

/** Whether my emails are on. Null when it can't be read (schema_email.sql not run, or offline). */
export async function loadEmailsOn(): Promise<boolean | null> {
  if (!supabase) return null;
  const u: any = await withSupabaseTimeout(supabase.auth.getUser(), { data: { user: null } } as any);
  const uid = u?.data?.user?.id;
  if (!uid) return null;
  const r: any = await withSupabaseTimeout(supabase.from("profiles").select("email_opt_out").eq("id", uid).maybeSingle(), { data: null, error: { message: "timed out" } } as any);
  if (r?.error || !r?.data) return null;
  return !r.data.email_opt_out;
}

export async function saveEmailsOn(on: boolean): Promise<void> {
  if (!supabase) throw new Error("Not connected.");
  const u: any = await withSupabaseTimeout(supabase.auth.getUser(), { data: { user: null } } as any);
  const uid = u?.data?.user?.id;
  if (!uid) throw new Error("You need to be logged in.");
  const r: any = await withSupabaseTimeout(supabase.from("profiles").update({ email_opt_out: !on }).eq("id", uid).select("id"), { data: null, error: { message: "Timed out." } } as any);
  if (r?.error) throw new Error(/email_opt_out/.test(String(r.error.message)) ? "Email settings aren't switched on yet — supabase/schema_email.sql hasn't been run." : String(r.error.message || "Couldn't save that."));
  if (!r?.data?.length) throw new Error("Couldn't save that.");
}
