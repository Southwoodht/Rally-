"use client";
import React from "react";
import { shortTier } from "@/lib/format";
import { BALL, COURT, pill } from "@/lib/theme";

export function LevelBadge({ level, small }: any) {
  if (!level) return null;
  return <span style={{ ...pill(BALL, COURT), fontSize: small ? 10 : 11, padding: small ? "2px 8px" : "3px 10px" }}>{shortTier(level)}</span>;
}
