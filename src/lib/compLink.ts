/**
 * "Scan for the live table" — the QR code on a coach sheet opens that
 * competition in the app: https://southwood.app/?club=<league id>&comp=<competition id>.
 *
 * Like an invite link (lib/invite.ts), the ids are stashed in localStorage
 * the moment the page loads and stripped from the address bar, because a
 * signed-out scan goes through sign-in first and a reload must not re-run
 * it. Dashboard opens the club when the person is in it; Competitions opens
 * the competition once its list arrives. A stash older than an hour (long enough to sign up and confirm an email) is
 * ignored, so a scan that led nowhere can't surface days later.
 */

import { publicOrigin } from "@/lib/siteUrl";

const KEY = "rally.openComp";
const FRESH_MS = 60 * 60 * 1000;

interface Pending { club: string; comp: string; at: number }

export function compLink(leagueId: string, compId: string): string {
  return `${publicOrigin()}/?club=${encodeURIComponent(leagueId)}&comp=${encodeURIComponent(compId)}`;
}

/** Read ?club=&comp= off the address bar into the stash. Call once on load. */
export function readCompParam(): void {
  try {
    const url = new URL(window.location.href);
    const club = url.searchParams.get("club"), comp = url.searchParams.get("comp");
    if (!club || !comp) return;
    localStorage.setItem(KEY, JSON.stringify({ club, comp, at: Date.now() } satisfies Pending));
    url.searchParams.delete("club"); url.searchParams.delete("comp");
    window.history.replaceState({}, "", url.toString());
  } catch { /* a malformed url or blocked storage is not worth a crash */ }
}

function read(): Pending | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "null") as Pending | null;
    if (!p || Date.now() - p.at > FRESH_MS) return null;
    return p;
  } catch { return null; }
}

/** The club a scan asked for, if any. */
export function pendingClub(): string | null { return read()?.club ?? null; }

/** The competition a scan asked for, without using it up. */
export function peekPendingComp(): string | null { return read()?.comp ?? null; }

export function clearPendingComp(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
