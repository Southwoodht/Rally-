"use client";
import React, { useState } from "react";
import { Loader2, MapPin, Search as SearchIcon } from "lucide-react";
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
    // Name the place straight away, so the spinner says where it is looking.
    setNear(where ? where.trim() : "you");
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

  const chip: React.CSSProperties = { background: FEED_RAISED, border: "none", borderRadius: 999, padding: "8px 14px", color: FEED_TEXT_HI, fontFamily: body, fontWeight: 600, fontSize: 13.5, cursor: "pointer" };
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
            {/* The choices as small buttons, not loose text that reads as a
                sentence (Sam: "a bit messy"). */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "6px 0 16px" }}>
              {near !== "you" && <button onClick={() => void lookNear()} style={chip}>Near me</button>}
              {text.trim() && <button onClick={() => pick({ name: text.trim() })} style={chip}>Use &ldquo;{text.trim()}&rdquo;</button>}
              {value && <button onClick={() => pick(null)} style={{ ...chip, color: FEED_TEXT_MID }}>No venue</button>}
            </div>

            {/* Your own club first, always — even before it has a pin, when
                no search could find it. */}
            {home?.name && (
              <button onClick={() => pick(home)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: "none", padding: "4px 2px 14px", cursor: "pointer", textAlign: "left" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{home.name}</span>
                  <span style={{ display: "block", fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 2 }}>{[home.place, "Your club"].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            )}

            {/* Searching is unmistakable: a spinner, the place, and grey rows
                where the answers will be — never the last answer sitting
                there looking finished. */}
            {busy ? (
              <div aria-live="polite">
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 2px", borderTop: "0.5px solid " + FEED_HAIRLINE }}>
                  <Loader2 size={18} color={FEED_TEXT_HI} className="sw-spin" />
                  <span style={{ fontFamily: body, fontWeight: 600, fontSize: 14.5, color: FEED_TEXT_HI }}>
                    Finding courts near {near === "you" ? "you" : near}…
                  </span>
                </div>
                {[0, 1, 2].map((k) => (
                  <div key={k} style={{ padding: "12px 2px", borderTop: "0.5px solid " + FEED_HAIRLINE }}>
                    <div style={{ height: 14, width: ["62%", "48%", "55%"][k], borderRadius: 7, background: FEED_RAISED }} />
                    <div style={{ height: 10, width: "30%", borderRadius: 5, background: FEED_RAISED, marginTop: 8, opacity: 0.7 }} />
                  </div>
                ))}
              </div>
            ) : hits && (
              <>
                <div style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: FEED_TEXT_MID, padding: "12px 2px 4px", borderTop: "0.5px solid " + FEED_HAIRLINE }}>
                  {(() => { const n = hits.filter((h) => !(home?.name && h.club && h.name === home.name)).length; return n ? `${n} ${n === 1 ? "place" : "places"} near ${near}` : `Near ${near}`; })()}
                </div>
                {hits.filter((h) => !(home?.name && h.club && h.name === home.name)).map((h, i) => (
                  <button key={h.name + i} onClick={() => pick({ name: h.name, place: h.place, lat: h.lat, lng: h.lng, url: h.url, club: h.club, members: h.members })} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: "none", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : "none", padding: "12px 2px", cursor: "pointer", textAlign: "left" }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</span>
                      <span style={{ display: "block", fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 2 }}>
                        {[distanceLabel(h.km), h.place, h.club ? "On Southwood" : h.members ? "Members only" : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                ))}
              </>
            )}
            {note && !busy && (
              <div style={{ fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, padding: "8px 2px" }}>
                {note}{" "}
                <button onClick={() => void lookNear(near === "you" ? undefined : text || near)} style={{ background: "none", border: "none", padding: 0, color: FEED_TEXT_HI, fontFamily: body, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>Try again</button>
              </div>
            )}

            {/* The map misses some clubs (Sam: "missed a couple"). Say what to
                do rather than leave it at that. */}
            {hits && !busy && (
              <div style={{ background: FEED_RAISED, borderRadius: 14, padding: "12px 14px", marginTop: 14 }}>
                <div style={{ fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_TEXT_HI }}>Missing a club?</div>
                <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.5, marginTop: 3 }}>
                  Type its name in the box above and tap Use. Or find it on the map first:
                </div>
                <a href={`https://www.google.com/maps/search/${encodeURIComponent("tennis club near " + (near === "you" ? "me" : near))}`} target="_blank" rel="noopener noreferrer" style={{ ...chip, display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, textDecoration: "none", background: PANEL }}>
                  <MapPin size={14} /> Look on Google Maps
                </a>
              </div>
            )}
            <div style={{ fontFamily: body, fontSize: 11.5, color: FEED_TEXT_LOW, marginTop: 14, lineHeight: 1.5 }}>
              Courts from OpenStreetMap. Your location is only used for this search and isn&apos;t saved.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
