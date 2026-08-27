"use client";
import React, { useState } from "react";
import { colorFor } from "@/lib/format";
import { COURT, PANEL2, display } from "@/lib/theme";

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
    <div style={{ width: size, height: size, borderRadius: size / 2, background: photo ? PANEL2 : em ? PANEL2 : colorFor(player.id), display: "grid", placeItems: "center", flexShrink: 0, border: "none", overflow: "hidden" }}>
      {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : em ? <span style={{ fontSize: size * 0.52 }}>{em}</span>
        : <span style={{ fontFamily: display, fontWeight: 800, fontSize: size * 0.46, color: COURT }}>{player.name.slice(0, 1).toUpperCase()}</span>}
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
