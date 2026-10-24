"use client";
import React from "react";
import { FEED_LIME, FEED_LIME_INK, display } from "@/lib/theme";

/**
 * A club's circle: its logo when an organiser has set one
 * (schema_club_logo.sql), otherwise the first letter of its name, as before.
 */
export function ClubMark({ club, size = 54 }: { club: { name?: string; logo_url?: string | null }; size?: number }) {
  if (club?.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={club.logo_url} alt="" width={size} height={size}
        style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0, objectFit: "cover", background: "#fff", boxShadow: "0 0 0 1px rgba(42,33,24,0.10)" }} />
    );
  }
  return (
    <span style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0, display: "grid", placeItems: "center", background: FEED_LIME, color: FEED_LIME_INK, fontFamily: display, fontWeight: 700, fontSize: Math.round(size * 0.48) }}>
      {(club?.name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}
