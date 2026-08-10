"use client";
import React from "react";
import { BALL, CHALK, COURT, LINE, MUTED, PANEL, PANEL2, body, display, input, mono } from "@/lib/theme";

export function Stat({ n, label, c }: any) {
  return <div style={{ flex: 1, background: PANEL2, borderRadius: 10, padding: "12px 8px", textAlign: "center", border: "1px solid " + LINE }}><div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: c }}>{n}</div><div style={{ fontFamily: mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: MUTED, marginTop: 2 }}>{label}</div></div>;
}

export function StreakTile({ n, label, c, active, onClick }: any) {
  return <button onClick={onClick} style={{ flex: 1, background: active ? PANEL : PANEL2, borderRadius: 10, padding: "12px 8px", textAlign: "center", border: "1px solid " + (active ? BALL : LINE), cursor: "pointer" }}><div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: c }}>{n}</div><div style={{ fontFamily: mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: MUTED, marginTop: 2 }}>{label} <span style={{ color: BALL }}>{active ? "▾" : "›"}</span></div></button>;
}

export function Toggle({ on, onClick, label }: any) {
  return <button onClick={onClick} style={{ flex: 1, fontFamily: mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, padding: "10px 6px", borderRadius: 8, cursor: "pointer", border: "1px solid " + (on ? BALL : LINE), background: on ? BALL : "transparent", color: on ? COURT : MUTED, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</button>;
}

export function Tally({ name, n, lead }: any) {
  return <div style={{ textAlign: "center" }}><div style={{ fontFamily: mono, fontSize: 34, fontWeight: 700, color: lead ? BALL : CHALK }}>{n}</div><div style={{ fontFamily: display, fontSize: 13, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{name}</div></div>;
}

export function Select({ value, onChange, players, exclude, placeholder = "Select…" }: any) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...input, boxSizing: "border-box" as const }}><option value="">{placeholder}</option>{players.filter((p) => p.id !== exclude).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>;
}

export const Field = ({ label, children }: any) => <div style={{ marginBottom: 16 }}><div style={{ fontFamily: mono, fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>{children}</div>;

export const BigBtn = ({ children, onClick, disabled, color, grow = true }: any) => <button onClick={onClick} disabled={disabled} style={{ flex: grow ? 1 : "none", fontFamily: display, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, fontSize: 14, padding: "12px 14px", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", border: "none", background: disabled ? "#2a5545" : color, color: COURT, opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{children}</button>;

export const Empty = ({ msg }: any) => <div style={{ fontFamily: body, color: MUTED, fontSize: 14, textAlign: "center", padding: "36px 12px" }}>{msg}</div>;
