import { NextResponse } from "next/server";

/**
 * Tennis courts near a point, from OpenStreetMap, for the booking's Where
 * (lib/venues.ts courtsNear).
 *
 * Through our own server rather than the phone straight to Overpass, because
 * the public Overpass server is often busy and turns requests away — Sam's
 * first try from Seacourt's postcode came back with nothing. Here it tries
 * three servers in turn, and the answer is cached for a day at Vercel's edge
 * per rounded spot, so the second search from the same club is instant and
 * costs the map nobody's goodwill.
 *
 * Nothing about the person is sent on: only a point rounded to two decimals
 * (about a kilometre) and a radius. No sign-in needed — it reads a public map.
 */

const SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Math.round(Number(u.searchParams.get("lat")) * 100) / 100;
  const lng = Math.round(Number(u.searchParams.get("lng")) * 100) / 100;
  const km = Math.min(15, Math.max(1, Number(u.searchParams.get("km")) || 8));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "bad point" }, { status: 400 });
  }
  const m = Math.round(km * 1000);
  const query = `[out:json][timeout:20];(nwr["sport"="tennis"](around:${m},${lat},${lng});nwr["leisure"="park"]["name"](around:${m},${lat},${lng}););out center tags 400;`;

  for (const server of SERVERS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(server, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Southwood (southwood.app) court finder" },
        body: "data=" + encodeURIComponent(query),
        signal: ctrl.signal,
        cache: "no-store",
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const j: any = await res.json();
      if (!Array.isArray(j?.elements)) continue;
      return NextResponse.json(
        { elements: j.elements },
        { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
      );
    } catch { /* next server */ }
  }
  return NextResponse.json({ error: "map busy" }, { status: 503 });
}
