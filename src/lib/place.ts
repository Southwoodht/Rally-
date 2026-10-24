/**
 * Where you are, once, for a club's pin (schema_club_location.sql).
 *
 * Only ever used to place a CLUB — creating one, or an organiser setting
 * theirs — and to look for clubs near you on the Join screen. Nothing here
 * stores a person's position: the coordinates go to set_league_place() for
 * the club, or straight into a search, and are rounded to two decimals
 * (about a kilometre) before they leave this file.
 */

export interface Spot { lat: number; lng: number }

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The phone's position, rounded; throws a sentence a person can read. */
export function currentSpot(): Promise<Spot> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This browser can't share a location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: round2(pos.coords.latitude), lng: round2(pos.coords.longitude) }),
      (err) => reject(new Error(err.code === 1
        ? "Location is turned off for Southwood. Allow it in your phone's settings, or type the place instead."
        : "Couldn't find where you are. Try again, or type the place instead.")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

/**
 * The town for a spot — "Hayling Island" — from OpenStreetMap's free
 * reverse lookup. Best effort: null when it can't say, and the person types
 * it instead.
 */
export async function placeName(spot: Spot): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&lat=${spot.lat}&lon=${spot.lng}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const j: any = await res.json();
    const a = j?.address || {};
    return a.town || a.city || a.village || a.suburb || a.municipality || a.county || null;
  } catch {
    return null;
  }
}

/** "under 1 km", "3 km", "41 km". Pins are only good to about a kilometre. */
export function distanceLabel(km: number): string {
  return km < 1 ? "under 1 km" : Math.round(km) + " km";
}
