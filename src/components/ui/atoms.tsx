"use client";
import React from "react";
import { BALL, CHALK, COURT, LINE, MUTED, PANEL, PANEL2, RADIUS_SM, body, display, input, mono } from "@/lib/theme";

export function Stat({ n, label, c, onClick, active }: any) {
  const style: any = { flex: 1, background: active ? PANEL2 : PANEL, borderRadius: RADIUS_SM, padding: "13px 8px", textAlign: "center", boxShadow: active ? "0 0 0 1.5px " + BALL + " inset" : "none" };
  const content = (
    <>
      <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: c }}>{n}</div>
      <div style={{ fontFamily: body, fontWeight: 600, fontSize: 11, color: MUTED, marginTop: 2 }}>{label}{onClick ? <span style={{ color: BALL }}> {active ? "▾" : "›"}</span> : null}</div>
    </>
  );
  if (onClick) return <button onClick={onClick} style={{ ...style, cursor: "pointer" }}>{content}</button>;
  return <div style={style}>{content}</div>;
}

export function StreakTile({ n, label, c, active, onClick }: any) {
  return <button onClick={onClick} style={{ flex: 1, background: active ? PANEL2 : PANEL, borderRadius: RADIUS_SM, padding: "13px 8px", textAlign: "center", boxShadow: active ? "0 0 0 1.5px " + BALL + " inset" : "none", cursor: "pointer" }}><div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: c }}>{n}</div><div style={{ fontFamily: body, fontWeight: 600, fontSize: 11, color: MUTED, marginTop: 2 }}>{label} <span style={{ color: BALL }}>{active ? "▾" : "›"}</span></div></button>;
}

// A segment inside an iOS-style recessed track (see theme.segmentTrack) — also
// used standalone as a soft filled/outline toggle where there's no shared track.
export function Toggle({ on, onClick, label, icon, emphasize, big }: any) {
  return <button onClick={onClick} style={{ flex: big ? 1.3 : 1, fontFamily: body, fontSize: big ? 13.5 : 13, padding: big ? "10px 8px" : "9px 8px", borderRadius: RADIUS_SM - 2, cursor: "pointer", border: "none", background: on ? BALL : "transparent", color: on ? COURT : emphasize ? BALL : MUTED, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "background 0.15s ease, color 0.15s ease" }}>{icon ? icon + " " : ""}{label}</button>;
}

export function Tally({ name, n, lead }: any) {
  return <div style={{ textAlign: "center" }}><div style={{ fontFamily: mono, fontSize: 34, fontWeight: 700, color: lead ? BALL : CHALK }}>{n}</div><div style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: MUTED }}>{name}</div></div>;
}

export function Select({ value, onChange, players, exclude, placeholder = "Select…" }: any) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...input, boxSizing: "border-box" as const }}><option value="">{placeholder}</option>{players.filter((p) => p.id !== exclude).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>;
}

export const Field = ({ label, children }: any) => <div style={{ marginBottom: 16 }}><div style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: MUTED, marginBottom: 7 }}>{label}</div>{children}</div>;

export const BigBtn = ({ children, onClick, disabled, color, grow = true }: any) => <button onClick={onClick} disabled={disabled} style={{ flex: grow ? 1 : "none", fontFamily: body, fontWeight: 600, fontSize: 15, padding: "13px 16px", borderRadius: RADIUS_SM, cursor: disabled ? "not-allowed" : "pointer", border: "none", background: disabled ? "#2a5545" : color, color: COURT, opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{children}</button>;

export const Empty = ({ msg }: any) => <div style={{ fontFamily: body, color: MUTED, fontSize: 14, textAlign: "center", padding: "36px 12px" }}>{msg}</div>;
