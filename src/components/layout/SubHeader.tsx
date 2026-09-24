"use client";
import React from "react";
import { Trophy, Swords, Plus, Clock, User, Settings as Gear, ChevronLeft, ChevronDown, Check } from "lucide-react";
import { CHALK, LINE, display , FEED_RAISED } from "@/lib/theme";

export function SubHeader({ title, onBack }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
      <button onClick={onBack} aria-label="Back" style={{ width: 44, height: 44, background: FEED_RAISED, border: "none", borderRadius: 22, color: CHALK, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}><ChevronLeft size={20} /></button>
      <h1 style={{ fontFamily: display, fontWeight: 800, color: CHALK, margin: 0, fontSize: 32, textTransform: "uppercase", letterSpacing: "-0.5px" }}>{title}</h1>
    </div>
  );
}
