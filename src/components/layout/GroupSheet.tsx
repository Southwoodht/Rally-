"use client";
import React, { useState } from "react";
import { Trophy, Swords, Plus, Clock, User, Settings as Gear, ChevronLeft, ChevronDown, Check } from "lucide-react";
import { BigBtn } from "@/components/ui/atoms";
import { BALL, CHALK, CLAY, COURT, MUTED, PANEL2, body, input, listCard, listRow } from "@/lib/theme";

export function GroupSheet({ groups, currentId, onSwitch, onAdd, onDelete, onClose }: any) {
  const [name, setName] = useState("");
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 90 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, borderTopLeftRadius: 24, borderTopRightRadius: 24, border: "none", padding: "20px 18px 40px", boxShadow: "0 -8px 30px rgba(0,0,0,0.35)" }}>
        <div style={{ fontFamily: body, fontWeight: 700, fontSize: 16, color: CHALK, marginBottom: 14 }}>Your leagues</div>
        <div style={listCard}>
          {groups.map((g) => {
            const on = g.id === currentId;
            return (
              <div key={g.id} style={{ ...listRow, cursor: "default" }}>
                <button onClick={() => onSwitch(g.id)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 10, display: "grid", placeItems: "center", background: on ? BALL : PANEL2, border: "none" }}>{on && <Check size={14} color={COURT} strokeWidth={3} />}</span>
                  <span style={{ fontFamily: body, fontSize: 16, fontWeight: 700, color: CHALK }}>{g.name}</span>
                </button>
                {groups.length > 1 && <button onClick={() => onDelete(g.id)} style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: CLAY, background: "transparent", border: "none", borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}>Delete</button>}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New league name…" onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { onAdd(name.trim()); setName(""); } }} style={{ ...input, marginBottom: 0, boxSizing: "border-box" as const }} />
          <BigBtn onClick={() => { if (name.trim()) { onAdd(name.trim()); setName(""); } }} color={BALL} grow={false}>Create</BigBtn>
        </div>
        <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 10 }}>Each league keeps its own players, results and rankings — your mates and your work crew stay totally separate.</div>
      </div>
    </div>
  );
}
