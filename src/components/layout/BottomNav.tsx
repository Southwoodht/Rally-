"use client";
import React from "react";
import { Trophy, Swords, Plus, Clock, User, Settings as Gear, ChevronLeft, ChevronDown, Check } from "lucide-react";
import { BALL, COURT, LINE, MUTED, PANEL, display, mono } from "@/lib/theme";

export function BottomNav({ tab, setTab }: any) {
  const active = (tab === "h2h" || tab === "settings" || tab === "myprofile") ? "profile" : tab;
  const item = (key, Icon, label) => {
    const on = active === key;
    return (
      <button onClick={() => setTab(key)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "transparent", border: "none", cursor: "pointer", padding: "8px 0", color: on ? BALL : MUTED }}>
        <Icon size={21} strokeWidth={on ? 2.4 : 1.8} /><span style={{ fontFamily: mono, fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</span>
      </button>
    );
  };
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: PANEL, borderTop: "none", display: "flex", alignItems: "center", maxWidth: 620, margin: "0 auto", paddingBottom: "env(safe-area-inset-bottom)", zIndex: 55 }}>
      {item("ladder", Trophy, "Table")}
      {item("h2h", Swords, "Compare")}
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <button onClick={() => setTab("add")} style={{ width: 54, height: 54, borderRadius: 27, background: BALL, color: COURT, border: "4px solid " + COURT, display: "grid", placeItems: "center", cursor: "pointer", marginTop: -18, boxShadow: "0 6px 16px rgba(0,0,0,.35)" }}><Plus size={26} strokeWidth={2.6} /></button>
      </div>
      {item("history", Clock, "Games")}
      {item("profile", User, "Profile")}
    </nav>
  );
}
