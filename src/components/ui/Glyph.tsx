"use client";
import React from "react";
import {
  Award, Bell, CalendarDays, CircleDot, Flame, Handshake, Landmark, Lock,
  Medal, PartyPopper, Pencil, Pin, ScrollText, Search, Target, Trash2, Trophy,
  User, X, Zap,
} from "lucide-react";
import { FEED_TEXT_MID } from "@/lib/theme";

/**
 * One drawn icon for every place the app still carries an emoji in its data.
 *
 * Several icon strings are produced inside `src/core/` — achievements and
 * notifications both label themselves with a character — and core is off
 * limits under this brief, quite reasonably: it is the ratings engine and it
 * should not know what a screen looks like. So the translation happens here,
 * at the point of drawing, and core keeps its strings.
 *
 * That turns out to be the better place for it anyway. The emoji were never
 * really data; they were a rendering decision that had leaked one layer down.
 *
 * Why bother at all: an emoji is drawn by the operating system, not by us. A
 * trophy is gold and glossy on an iPhone, flat and differently-shaped on
 * Android, and something else again on Windows — so the one part of the
 * interface nobody can style is the part sitting in the middle of a card that
 * has been styled very carefully.
 */

const MAP: Record<string, any> = {
  // Achievements (core/achievements.ts)
  "🎉": PartyPopper,
  "🏅": Medal,
  "🎾": CircleDot,
  "🔥": Flame,
  "🤝": Handshake,

  // Notifications (core/notifications.ts) and the bell
  "⏳": Bell,
  "✏️": Pencil,
  "🗑️": Trash2,
  "📌": Pin,
  "👋": Handshake,
  "🏆": Trophy,
  "❌": X,
  "📋": ScrollText,

  // Feed, recaps, legacy
  "⚡": Zap,
  "🎯": Target,
  "🏛️": Landmark,
  "🌎": CircleDot,
  "👑": Award,
  "📊": ScrollText,
  "📅": CalendarDays,
  "⚔️": Target,
  "👤": User,
  "👻": User,
  "🔒": Lock,
  "🥇": Medal,
  "🥈": Medal,
  "🥉": Medal,
  "🔑": Lock,
  "➕": CircleDot,
  "🔍": Search,
};

/**
 * Draws the icon for a legacy glyph string.
 *
 * An unrecognised one renders nothing rather than falling back to a generic
 * shape — a wrong icon is worse than none, and a gap is visible enough to get
 * reported.
 */
export function Glyph({ name, size = 17, color = FEED_TEXT_MID, strokeWidth = 2 }: {
  name?: string | null;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  if (!name) return null;
  const Icon = MAP[name];
  if (!Icon) return null;
  return <Icon size={size} color={color} strokeWidth={strokeWidth} style={{ flexShrink: 0 }} />;
}
