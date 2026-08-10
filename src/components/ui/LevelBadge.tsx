"use client";
import React from "react";
import { shortTier } from "@/lib/format";
import { BALL, LINE, mono } from "@/lib/theme";

export function LevelBadge({ level, small }: any) {
  if (!level) return null;
  return <span style={{ fontFamily: mono, fontSize: small ? 9 : 10, letterSpacing: 0.5, textTransform: "uppercase", color: BALL, border: "1px solid " + LINE, borderRadius: 4, padding: small ? "1px 5px" : "2px 7px", whiteSpace: "nowrap" }}>{shortTier(level)}</span>;
}
