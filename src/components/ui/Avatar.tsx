"use client";
import React, { useState } from "react";
import { AvatarArt, hasAvatarArt } from "@/components/ui/AvatarArt";
// Aliased: the local `body` below is the rendered element, and it shadows a
// bare import of the font token.
import { FEED_TEXT_LOW, PANEL2, body as bodyFont } from "@/lib/theme";

// Pass enlargeable when this Avatar isn't already sitting inside its own
// clickable row (e.g. a profile header) — tapping a real photo then opens
// it full-screen. Left off by default so list rows keep opening the
// profile instead of fighting over the tap.
export function Avatar({ player, size = 34, enlargeable = false }: any) {
  const [open, setOpen] = useState(false);
  if (!player) return null;
  const em = player.avatar;
  const photo = player.avatarUrl;
  const interactive = enlargeable && !!photo;
  const body = (
    // One background for every avatar. It used to fall back to colorFor(id) —
    // a hash of the player id into AV_COLORS, which is orange, purple, pink
    // and pale blue. None of those are Rally colours, nobody chose them, and
    // they were the only thing on the Table that was not in the palette. Sam,
    // 2026-09-22: "nothing else in Rally is orange or purple." Dropped, not
    // re-tinted; an initial does not need a colour to be legible, and the
    // Messages rows have been doing it this way all along.
    <div style={{ width: size, height: size, borderRadius: size / 2, background: PANEL2, display: "grid", placeItems: "center", flexShrink: 0, border: "none", overflow: "hidden" }}>
      {/* The stored avatar is an id, not a glyph. If we have drawn art for
          it, draw that — otherwise the initial.
          
          There used to be a middle branch that rendered the id AS an emoji
          when we had no art for it, on the reasoning that the picker could
          not produce such a value. Retiring the coloured discs produced nine
          of them immediately: 🟣 stopped being drawn art and started being a
          literal purple emoji, which is the OS-drawn glyph §4 says the app no
          longer contains. An id we cannot draw is an id we do not show. */}
      {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : hasAvatarArt(em) ? <AvatarArt id={em} size={size * 0.56} />
        : <span style={{ fontFamily: bodyFont, fontWeight: 500, fontSize: size * 0.38, color: FEED_TEXT_LOW }}>{(player.name || "?").slice(0, 1).toUpperCase()}</span>}
    </div>
  );
  return (
    <>
      {interactive ? (
        <button onClick={(e) => { e.stopPropagation(); setOpen(true); }} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", borderRadius: size / 2 }} aria-label="View full-size photo">{body}</button>
      ) : body}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
          <img src={photo} alt="" style={{ maxWidth: "min(92vw, 480px)", maxHeight: "80vh", borderRadius: 20, objectFit: "contain", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} />
        </div>
      )}
    </>
  );
}
