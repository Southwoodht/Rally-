/**
 * Where a booked match is played (schema_fixture_venue.sql).
 *
 * Sam, 2026-10-24: "like LTA Rally does — location of the match, then it
 * says the nearest clubs". So "Where" lists real places to play near you:
 * Southwood clubs first (clubs_near), then every tennis court OpenStreetMap
 * knows about — clubs, leisure centres and park courts — from its free
 * Overpass API, worldwide.
 *
 * A park's courts are usually mapped without a name of their own, so an
 * unnamed court takes the name of the park it sits in ("Hayling Park
 * courts"), and only falls back to "Tennis courts" when there is no park.
 *
 * The phone's position is used for the search and dropped; what is saved on
 * the booking is the VENUE — a public place — never the person.
 */

import { clubsNear } from "@/lib/leagues";
import type { Spot } from "@/lib/place";

export interface Venue {
  name: string;
  /** The town, or a short "Hayling Island" style line, when known. */
  place?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** The venue's own website, where OpenStreetMap has one. */
  url?: string | null;
  /** A Southwood club, rather than a court from the map. */
  club?: boolean;
  /** Marked private on the map (members only). */
  members?: boolean;
}

export interface VenueHit extends Venue { km: number }

const R = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
export function kmBetween(a: Spot, b: Spot): number {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** "Seacourt · Hayling Island" — the one way a venue is written. */
export function venueLabel(v: Venue | null | undefined): string {
  if (!v || !v.name) return "";
  return v.place && !v.name.toLowerCase().includes(v.place.toLowerCase()) ? `${v.name} · ${v.place}` : v.name;
}

/** Directions, in whatever maps app the phone opens. */
export function mapsUrl(v: Venue): string {
  return v.lat != null && v.lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueLabel(v))}`;
}

/**
 * Tennis courts from OpenStreetMap within `km` of a spot, nearest first,
 * merged so one club's eight mapped courts are one row.
 */
export async function courtsNear(spot: Spot, km = 6): Promise<VenueHit[]> {
  // Our own /api/courts first (several map servers, cached a day); the
  // public server straight from the phone only if that route isn't there.
  // Never longer than 15 s in all: a spinner that never ends is worse than
  // "try again".
  const within = <T,>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error("slow")), ms))]);
  let j: any = null;
  try {
    const res = await within(fetch(`/api/courts?lat=${spot.lat}&lng=${spot.lng}&km=${km}`), 15000);
    if (res.ok) j = await res.json();
  } catch { /* fall through */ }
  if (!j?.elements) throw new Error("The court map didn't answer. Try again, or type the place.");
  const pos = (e: any): Spot | null =>
    e.lat != null ? { lat: e.lat, lng: e.lon } : e.center ? { lat: e.center.lat, lng: e.center.lon } : null;

  const parks: Array<{ name: string; at: Spot }> = [];
  const courts: Array<{ tags: any; at: Spot }> = [];
  for (const e of j.elements || []) {
    const at = pos(e);
    if (!at) continue;
    const t = e.tags || {};
    if (t.leisure === "park" && !String(t.sport || "").includes("tennis")) { if (t.name) parks.push({ name: t.name, at }); continue; }
    courts.push({ tags: t, at });
  }

  const nearestPark = (at: Spot) => {
    let best: { name: string; d: number } | null = null;
    for (const p of parks) {
      const d = kmBetween(at, p.at);
      if (d <= 0.4 && (!best || d < best.d)) best = { name: p.name, d };
    }
    return best?.name ?? null;
  };

  const venues: Array<Venue & { at: Spot }> = [];
  for (const c of courts) {
    const t = c.tags;
    const park = t.name ? null : nearestPark(c.at);
    const name = t.name || (park ? `${park} courts` : "Tennis courts");
    // One row per place: the same name within 400 m, or any court within
    // 120 m of another, is the same venue.
    const same = venues.find((v) => (v.name === name && kmBetween(v.at, c.at) < 0.4) || kmBetween(v.at, c.at) < 0.12);
    if (same) {
      // A named club or centre beats a bare court for the row's name.
      if (t.name && (same.name === "Tennis courts" || same.name.endsWith(" courts"))) same.name = t.name;
      same.url = same.url || t.website || t["contact:website"] || null;
      continue;
    }
    venues.push({
      name,
      place: t["addr:city"] || t["addr:town"] || t["addr:village"] || null,
      lat: round4(c.at.lat), lng: round4(c.at.lng),
      url: t.website || t["contact:website"] || null,
      members: t.access === "private" || t.access === "members",
      at: c.at,
    });
  }

  return venues
    .map(({ at, ...v }) => ({ ...v, km: kmBetween(spot, at) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 20);
}

/** Southwood clubs and mapped courts near a spot, clubs first. */
export async function venuesNear(spot: Spot): Promise<{ hits: VenueHit[]; note: string | null }> {
  const [clubs, courts] = await Promise.allSettled([clubsNear(spot, 15), courtsNear(spot, 6)]);
  const hits: VenueHit[] = [];
  if (clubs.status === "fulfilled") {
    for (const c of clubs.value) hits.push({ name: c.name, place: c.location, km: c.km, club: true });
  }
  if (courts.status === "fulfilled") {
    // A club already listed from Southwood is not listed again from the map.
    const taken = new Set(hits.map((h) => h.name.toLowerCase()));
    for (const v of courts.value) if (!taken.has(v.name.toLowerCase())) hits.push(v);
  }
  const note = courts.status === "rejected"
    ? "The court map didn't answer, so only Southwood clubs are shown. Try again in a moment."
    : !hits.length ? "No courts found within 6 km. Search a town, or type the place." : null;
  return { hits, note };
}

/** A town or postcode to a spot, for "search somewhere else". */
export async function findTown(text: string): Promise<{ spot: Spot; label: string } | null> {
  const q = text.trim();
  if (!q) return null;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const j: any[] = await res.json();
    if (!j.length) return null;
    return { spot: { lat: Number(j[0].lat), lng: Number(j[0].lon) }, label: String(j[0].display_name || q).split(",")[0] };
  } catch {
    return null;
  }
}
