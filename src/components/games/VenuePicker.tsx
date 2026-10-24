"use client";
import React, { useState } from "react";
import { MapPin, Search as SearchIcon } from "lucide-react";
import { currentSpot, distanceLabel } from "@/lib/place";
import { findTown, venueLabel, venuesNear, type Venue, type VenueHit } from "@/lib/venues";
import {
  FEED_HAIRLINE, FEED_OVERLAY, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, PANEL, body, miniInput,
} from "@/lib/theme";

/**
 * "Where" on a booking (lib/venues.ts). Shows the choice — the club you are
 * booking in, until somebody changes it — and opens a sheet of places to
 * play: near you on opening, or near a town you search, Southwood clubs
 * first, then courts from the map. "Somewhere else" takes whatever is typed.
 */
export function VenuePicker({ value, onChange, home }: { value: Venue | null; onChange: (v: Venue | null) => void; home?: Venue | null }) {
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<VenueHit[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [near, setNear] = useState("you");

  const lookNear = async (where?: string) => {
    setBusy(true); setNote(null); setHits(null);
    try {
      let spot;
      if (where) {
        const town = await findTown(where);
        if (!town) { setNote(`Couldn't find "${where}". Try a town or a postcode.`); setBusy(false); return; }
        spot = town.spot; setNear(town.label);
      } else {
        spot = await currentSpot(); setNear("you");
      }
      const r = await venuesNear(spot);
      setHits(r.hits); setNote(r.note);
    } catch (e: any) {
      setNote(e?.message || "Couldn't look for courts.");
    }
    setBusy(false);
  };

  const openSheet = () => { setOpen(true); if (!hits) void lookNear(); };
  const pick = (v: Venue | null) => { onChange(v); setOpen(false); };

  const fld: React.CSSProperties = { ...miniInput, fontFamily: body, fontSize: 15, background: FEED_RAISED, color: FEED_TEXT_HI, padding: "10px 12px", boxSizing: "border-box" };

  return (
    <>
      <button onClick={openSheet} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: FEED_RAISED, border: "none", borderRadius: 12, padding: "11px 12px", cursor: "pointer", textAlign: "left" }}>
        <MapPin size={17} color={FEED_TEXT_MID} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 15, color: value ? FEED_TEXT_HI : FEED_TEXT_LOW, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {value ? venueLabel(value) : "Pick a court near you"}
        </span>
        <span style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, flexShrink: 0 }}>Change</span>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: FEED_OVERLAY, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 130 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: PANEL, width: "100%", maxWidth: 620, maxHeight: "86vh", overflowY: "auto", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: "18px 16px 34px", boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: body, fontWeight: 600, fontSize: 17, color: FEED_TEXT_HI }}>Where are you playing?</span>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: FEED_TEXT_MID, fontFamily: body, fontSize: 14, cursor: "pointer" }}>Close</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) void lookNear(text); }} placeholder="A town, postcode or court" style={{ ...fld, flex: 1 }} />
              <button disabled={busy || !text.trim()} onClick={() => void lookNear(text)} aria-label="Search" style={{ ...fld, flex: "0 0 auto", width: 46, display: "grid", placeItems: "center", cursor: "pointer", opacity: busy || !text.trim() ? 0.5 : 1 }}>
                <SearchIcon size={17} color={FEED_TEXT_HI} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 14, margin: "4px 2px 12px" }}>
              {near !== "you" && <button onClick={() => void lookNear()} style={{ background: "none", border: "none", padding: 0, color: FEED_TEXT_HI, fontFamily: body, fontSize: 13, cursor: "pointer" }}>Near me instead</button>}
              {text.trim() && <button onClick={() => pick({ name: text.trim() })} style={{ background: "none", border: "none", padding: 0, color: FEED_TEXT_HI, fontFamily: body, fontSize: 13, cursor: "pointer" }}>Use &ldquo;{text.trim()}&rdquo; as typed</button>}
              {value && <button onClick={() => pick(null)} style={{ background: "none", border: "none", padding: 0, color: FEED_TEXT_MID, fontFamily: body, fontSize: 13, cursor: "pointer" }}>No venue</button>}
            </div>

            <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, margin: "0 2px 6px" }}>
              {busy ? "Looking for courts…" : hits ? `Near ${near}` : ""}
            </div>
            {/* Your own club first, always — even before it has a pin, when
                no search could find it. */}
            {home?.name && (
              <button onClick={() => pick(home)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: "none", padding: "12px 2px", cursor: "pointer", textAlign: "left" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{home.name}</span>
                  <span style={{ display: "block", fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 2 }}>{[home.place, "Your club"].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            )}
            {(hits || []).filter((h) => !(home?.name && h.club && h.name === home.name)).map((h, i) => (
              <button key={h.name + i} onClick={() => pick({ name: h.name, place: h.place, lat: h.lat, lng: h.lng, url: h.url, club: h.club, members: h.members })} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: "none", borderTop: i || home?.name ? "0.5px solid " + FEED_HAIRLINE : "none", padding: "12px 2px", cursor: "pointer", textAlign: "left" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</span>
                  <span style={{ display: "block", fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 2 }}>
                    {[distanceLabel(h.km), h.place, h.club ? "On Southwood" : h.members ? "Members only" : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            ))}
            {note && <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, padding: "8px 2px" }}>{note}</div>}
            <div style={{ fontFamily: body, fontSize: 11.5, color: FEED_TEXT_LOW, marginTop: 14, lineHeight: 1.5 }}>
              Courts from OpenStreetMap. Your location is only used for this search and isn&apos;t saved.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
