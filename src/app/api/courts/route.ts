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

// Vercel stops a function at 10 s unless told otherwise. The servers are
// asked at the same time, the first good answer wins, and each gives up at
// 8 s, so the whole thing fits.
export const maxDuration = 20;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Math.round(Number(u.searchParams.get("lat")) * 100) / 100;
  const lng = Math.round(Number(u.searchParams.get("lng")) * 100) / 100;
  const km = Math.min(15, Math.max(1, Number(u.searchParams.get("km")) || 8));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "bad point" }, { status: 400 });
  }
  const m = Math.round(km * 1000);
  // Courts first, then only the named parks within 300 m OF a court — a far
  // lighter question than every park in the area, which near a city is
  // hundreds of shapes and what made the first version slow.
  const query = `[out:json][timeout:8];nwr["sport"~"tennis"](around:${m},${lat},${lng})->.t;(.t;nwr(around.t:300)["leisure"="park"]["name"];);out center tags 300;`;

  const ask = async (server: string) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(server, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Southwood (southwood.app) court finder" },
        body: "data=" + encodeURIComponent(query),
        signal: ctrl.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error("status " + res.status);
      const j: any = await res.json();
      if (!Array.isArray(j?.elements)) throw new Error("no elements");
      return j.elements;
    } finally {
      clearTimeout(t);
    }
  };

  try {
    const elements = await Promise.any(SERVERS.map(ask));
    return NextResponse.json(
      { elements },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (e: any) {
    // Say why, server by server, so opening this address in a browser
    // tells us what is going wrong (Sam's searches all came back empty).
    const why = (e?.errors || []).map((x: any, i: number) => `${SERVERS[i].split("/")[2]}: ${x?.name === "AbortError" ? "timed out" : x?.message || x}`);
    return NextResponse.json({ error: "map busy", why }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
