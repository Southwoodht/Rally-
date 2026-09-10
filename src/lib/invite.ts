/**
 * Invite links.
 *
 * There is no invite table and this does not add one. A league already has a
 * six-character join code that works, is already shown to people and is
 * already accepted by `joinLeague()` — so an invite link is that code in a
 * URL rather than a second system that can disagree with the first.
 *
 * What it buys: you can send somebody a link instead of asking them to find
 * the join screen and type WDZDTQ correctly. What it deliberately does not
 * buy: expiry, single use, or knowing who invited whom. Those need a real
 * invites table and a migration, and they are written up in the report rather
 * than half-built here.
 *
 * The code is not a secret in any meaningful sense — it is read out loud in
 * clubhouses — so putting it in a link gives nothing away that the current
 * flow doesn't.
 */

const PENDING_KEY = "rally.pendingJoin";

/** The query parameter an invite link carries. */
export const JOIN_PARAM = "join";

/**
 * A shareable link for a league.
 *
 * Built from the origin the app is actually being served from, so it is the
 * deployed URL in production and localhost only when you are genuinely on
 * localhost. Nothing is hardcoded, which is the failure this was checked for.
 */
export function inviteUrl(code: string): string {
  if (typeof window === "undefined" || !code) return "";
  return `${window.location.origin}/?${JOIN_PARAM}=${encodeURIComponent(code.trim().toUpperCase())}`;
}

/**
 * The code in the current URL, if there is one — and it is removed from the
 * address bar on the way out.
 *
 * Removing it matters: a reload should not re-run a join, and the link is the
 * kind of thing that sits in a browser's history for months.
 */
export function readJoinParam(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get(JOIN_PARAM);
    if (!code) return null;
    url.searchParams.delete(JOIN_PARAM);
    window.history.replaceState({}, "", url.toString());
    return code.trim().toUpperCase();
  } catch {
    return null;
  }
}

/**
 * Hold a code across signing up.
 *
 * Opening an invite while signed out means a trip through sign-up and an
 * email round trip, and the query string does not survive that. Without this
 * the link works for people who already have an account and quietly does
 * nothing for the people it was mostly written for.
 */
export function stashPendingJoin(code: string): void {
  try { window.localStorage.setItem(PENDING_KEY, code); } catch {}
}

export function takePendingJoin(): string | null {
  try {
    const v = window.localStorage.getItem(PENDING_KEY);
    if (v) window.localStorage.removeItem(PENDING_KEY);
    return v;
  } catch {
    return null;
  }
}

/** What to say when a code doesn't resolve. Sam's words. */
export const BAD_INVITE = "This invite doesn't work anymore. Ask for a new one.";
