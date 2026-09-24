"use client";
import React, { useState } from "react";
import { initialsOf } from "@/lib/format";
import { FEED_OVERLAY, FEED_TEXT_LOW, PANEL2, body as bodyFont } from "@/lib/theme";

// A face, and only when there is one.
//
// Sam, 2026-09-23: "avatars i dont know if we need." He was right to ask.
// Almost nobody had uploaded a photo, so nearly every avatar in the app was a
// letter in a circle sitting immediately to the left of the name beginning
// with that letter — a 38px column carrying no information at all. The drawn
// icon set was no better: a flame tells you somebody picked a flame.
//
// So: a photo renders, and nothing else does.
//
// **The box is still reserved.** An avatar that collapses when absent would
// leave every row without a photo starting 50px left of the rows with one,
// and a ranked table whose left edge zigzags looks broken in a way the blank
// space does not. It also means the column costs nothing to fill in later —
// somebody uploading a photo changes their row and no one else's.
//
// The quiet second effect is the point: a mostly-empty column is a standing
// invitation to add a photo, where a letter in a circle looks finished.
//
// What went with it: the initial fallback, the drawn icon fallback, and the
// AvatarPicker that chose those icons — a picker that sets something nothing
// renders is worse than no picker. `players.avatar` is still stored and still
// read by AvatarArt, so restoring any of this is putting three lines back,
// not redrawing anything.

export function Avatar({ player, size = 34, enlargeable = false }: any) {
  const [open, setOpen] = useState(false);
  if (!player) return null;
  const photo = player.avatarUrl;

  // No photo: their initials. Two letters, because one is the problem this
  // app already has a rule about — Charlie Henry and Charlie Easey are both
  // "C" and are emphatically not the same person.
  if (!photo) {
    return (
      <span
        aria-hidden="true"
        style={{
          width: size, height: size, borderRadius: size / 2, flexShrink: 0,
          display: "inline-grid", placeItems: "center", background: PANEL2,
          fontFamily: bodyFont, fontWeight: 500, fontSize: size * 0.34,
          letterSpacing: 0.3, color: FEED_TEXT_LOW,
        }}
      >
        {initialsOf(player)}
      </span>
    );
  }

  const body = (
    <div style={{ width: size, height: size, borderRadius: size / 2, display: "grid", placeItems: "center", flexShrink: 0, border: "none", overflow: "hidden" }}>
      <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );

  return (
    <>
      {enlargeable ? (
        <button onClick={(e) => { e.stopPropagation(); setOpen(true); }} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", borderRadius: size / 2 }} aria-label="View full-size photo">{body}</button>
      ) : body}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: FEED_OVERLAY, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
          <img src={photo} alt="" style={{ maxWidth: "min(92vw, 480px)", maxHeight: "80vh", borderRadius: 20, objectFit: "contain", boxShadow: "0 20px 60px var(--shadow-strong)" }} />
        </div>
      )}
    </>
  );
}
