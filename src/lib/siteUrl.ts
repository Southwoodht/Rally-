/**
 * The address links point at: southwood.app, connected 2026-10-30.
 *
 * Anything that leaves the app — the coach sheet's QR code, an invite link,
 * a link in an email — uses this rather than whatever address the sender
 * happens to be on, so somebody still opening the old rally-sigma-one
 * .vercel.app address never hands that out. Running locally keeps its own
 * address, so a QR printed while testing opens the test server.
 */
export const SITE_URL = "https://southwood.app";

export function publicOrigin(): string {
  if (typeof window === "undefined") return SITE_URL;
  const { hostname, origin } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")) return origin;
  return SITE_URL;
}
