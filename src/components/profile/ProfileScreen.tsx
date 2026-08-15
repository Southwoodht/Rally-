"use client";
import React from "react";
import { RecordBody } from "@/components/profile/RecordBody";
import { Empty } from "@/components/ui/atoms";
import { MUTED, card, display, miniInput, mono, body} from "@/lib/theme";

export function ProfileScreen({ players, meId, shared, onSetMe, goH2H, goSettings, goEdit }: any) {
  const me = players.find((p) => p.id === meId);
  return (
    <div>
      <div style={{ ...card, marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED }}>Your linked player</span>
          <span style={{ fontFamily: body, fontSize: 13, color: MUTED }}>{me?.name || "No linked profile"}</span>
        </div>
        <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginBottom: 12 }}>Your account stays tied to one player profile. Historical players remain unclaimed until they sign in and confirm their identity.</div>
        {me ? <RecordBody player={me} {...shared} /> : <Empty msg="Add players in Settings first." />}
      </div>
    </div>
  );
}
