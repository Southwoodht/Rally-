"use client";
import React from "react";
import { Trophy, Swords, Plus, Clock, User, Settings as Gear, ChevronLeft, ChevronDown, Check } from "lucide-react";
import { CHALK, LINE, display } from "@/lib/theme";

export function SubHeader({ title, onBack }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
      <button onClick={onBack} style={{ background: "transparent", border: "1px solid " + LINE, borderRadius: 8, padding: 6, color: CHALK, cursor: "pointer", display: "grid", placeItems: "center" }}><ChevronLeft size={18} /></button>
      <h1 style={{ fontFamily: display, fontWeight: 800, color: CHALK, margin: 0, fontSize: 30, textTransform: "uppercase", letterSpacing: -0.5 }}>{title}</h1>
    </div>
  );
}
