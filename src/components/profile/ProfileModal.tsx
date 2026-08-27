"use client";
import React from "react";
import { RecordBody } from "@/components/profile/RecordBody";
import { CHALK, COURT, MUTED, body } from "@/lib/theme";

export function ProfileModal({ player, onClose, profileYear, ...shared }: any) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 70 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "none", padding: "20px 18px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 14, color: CHALK }}>Profile</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, borderRadius: 10, padding: "5px 12px", fontFamily: body, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Close</button>
        </div>
        <RecordBody key={player.id + ":" + String(profileYear ?? "all")} player={player} initialYear={profileYear} {...shared} />
      </div>
    </div>
  );
}
