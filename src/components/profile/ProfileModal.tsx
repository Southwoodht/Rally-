"use client";
import React from "react";
import { ProfileContainer } from "@/components/profile/ProfileContainer";
import { CHALK, COURT, MUTED, body } from "@/lib/theme";

// The same profile, read by somebody else. viewer="other" is the whole
// difference: no settings, no linked player, no Edit on a result that isn't
// yours, and the lime card answers "how do I do against them" instead of
// "who is one place above me" — which is their business, not the reader's.
export function ProfileModal({ player, onClose, profileYear, ...shared }: any) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 70 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "none", padding: "20px 18px 40px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, borderRadius: 10, padding: "5px 12px", fontFamily: body, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Close</button>
        </div>
        <ProfileContainer
          key={player.id + ":" + String(profileYear ?? "all")}
          {...shared}
          player={player}
          viewer={shared?.meId === player.id ? "self" : "other"}
        />
      </div>
    </div>
  );
}
