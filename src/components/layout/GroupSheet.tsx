"use client";
import React, { useState } from "react";
import { Trophy, Swords, Plus, Clock, User, Settings as Gear, ChevronLeft, ChevronDown, Check } from "lucide-react";
import { BigBtn } from "@/components/ui/atoms";
import { BALL, CHALK, CLAY, COURT, LINE, MUTED, PANEL2, body, display, input, mono } from "@/lib/theme";

export function GroupSheet({ groups, currentId, onSwitch, onAdd, onDelete, onClose }: any) {
  const [name, setName] = useState("");
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 90 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "1px solid " + LINE, padding: "20px 18px 40px" }}>
        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>Your leagues</div>
        {groups.map((g) => {
          const on = g.id === currentId;
          return (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderTop: "1px solid " + LINE }}>
              <button onClick={() => onSwitch(g.id)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", background: on ? BALL : PANEL2, border: "1px solid " + LINE }}>{on && <Check size={14} color={COURT} strokeWidth={3} />}</span>
                <span style={{ fontFamily: display, fontSize: 20, fontWeight: 700, color: CHALK, textTransform: "uppercase", letterSpacing: -0.3 }}>{g.name}</span>
              </button>
              {groups.length > 1 && <button onClick={() => onDelete(g.id)} style={{ fontFamily: mono, fontSize: 10, color: CLAY, background: "transparent", border: "1px solid " + LINE, borderRadius: 5, padding: "4px 8px", cursor: "pointer", textTransform: "uppercase" }}>Delete</button>}
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New league name…" onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { onAdd(name.trim()); setName(""); } }} style={{ ...input, marginBottom: 0, boxSizing: "border-box" as const }} />
          <BigBtn onClick={() => { if (name.trim()) { onAdd(name.trim()); setName(""); } }} color={BALL} grow={false}>Create</BigBtn>
        </div>
        <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 10 }}>Each league keeps its own players, results and rankings — your mates and your work crew stay totally separate.</div>
      </div>
    </div>
  );
}
