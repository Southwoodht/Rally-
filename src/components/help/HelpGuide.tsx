"use client";
import React, { useState } from "react";
import { BALL, CHALK, LINE, MUTED, PANEL2, body, display, mono } from "@/lib/theme";

interface Point { label: string; text: string; }
interface Sect { id: string; icon: string; title: string; points: Point[]; }

const SECTIONS: Sect[] = [
  {
    id: "basics", icon: "🎾", title: "Rally basics",
    points: [
      { label: "What Rally is", text: "Rally tracks head-to-head results for racket sports and turns them into rankings, records and a shared history for your group." },
      { label: "Players, matches and records", text: "Every match is one result between two players — a win, a loss, or a draw. Once confirmed, it counts toward both players' record, rating and rankings. Nothing is entered twice." },
    ],
  },
  {
    id: "rankings", icon: "📊", title: "Rankings",
    points: [
      { label: "Official", text: "The headline table. Built from the average strength of your wins, your win rate, and how much you play. Beating strong players matters far more than piling up easy ones." },
      { label: "ELO", text: "A pure skill rating, starting at 0. Beating someone stronger than you earns a lot; losing to someone stronger costs almost nothing." },
      { label: "Record", text: "Your win rate (a draw counts as half), nudged by opponent strength and how much you've played." },
      { label: "Form", text: "Just your last 5 results — shows who's hot right now, regardless of overall record." },
      { label: "Win %", text: "The rawest number — wins divided by games played, no adjustment for opponent strength." },
      { label: "Active vs Legacy", text: "Active only shows players who've played in the last 12 months, so current form isn't crowded out by someone who was great years ago but has stopped playing. Legacy shows a player's whole career instead, ranked by matches played." },
    ],
  },
  {
    id: "compare", icon: "⚔️", title: "Compare",
    points: [
      { label: "Pick any two players", text: "Works even if they've never played each other — Rally still has a view based on form, level and history against others." },
      { label: "The numbers", text: "ELO, Official, Record and Form are shown side by side, with the higher value highlighted for each." },
      { label: "Winning / Losing records", text: "Who each player has a winning or losing head-to-head against — tap through to see the actual matches." },
      { label: "Head-to-head", text: "The real matches between the two players you've selected." },
      { label: "Rally AI prediction", text: "A percentage chance based on ELO, head-to-head, recent form and level, with the reasoning shown underneath. It's a model, not a promise — and it says so when two players haven't played enough for it to be confident." },
    ],
  },
  {
    id: "recording", icon: "🎾", title: "Recording a match",
    points: [
      { label: "Existing player", text: "Pick from anyone already in your league." },
      { label: "Creating a new player", text: "If they're not in Rally yet, add them on the spot from the same screen." },
      { label: "Real account vs shell", text: "A \"shell\" player doesn't have their own Rally login yet — you're keeping their record on their behalf. A \"real account\" player has signed up themselves." },
      { label: "Winner, score, date", text: "Pick who won (or draw), and optionally add the score and the date it was actually played." },
      { label: "Notes, venue, photos", text: "All optional — a quick note, where you played, or a photo, shown on that match's detail page." },
      { label: "Confirmation", text: "Covered in full under Data / confirmation below." },
    ],
  },
  {
    id: "profiles", icon: "👤", title: "Profiles",
    points: [
      { label: "Record", text: "Won / drawn / lost and win rate, filterable by year." },
      { label: "Match history", text: "Every confirmed match, tap any one for its full detail." },
      { label: "Legacy", text: "A separate career view — see the Legacy section below." },
      { label: "Achievements", text: "Automatic milestones — see Achievements vs Trophies below." },
      { label: "Official trophies", text: "Real, verified honours — also covered below." },
    ],
  },
  {
    id: "achievements", icon: "🏆", title: "Achievements vs Trophies",
    points: [
      { label: "Achievements", text: "Automatically earned Rally milestones — first win, win streaks, matches played. Rally computes these itself from your real results; nobody has to approve them, and nobody can invent one that didn't happen." },
      { label: "Trophies", text: "Official competitive honours — verified or awarded by a club or league administrator. A player can submit a claim (e.g. \"2019 — Club Champion\") but it only becomes a trophy on their profile once an administrator approves it. A player can never award one to themselves." },
    ],
  },
  {
    id: "club", icon: "🏛️", title: "Club / League",
    points: [
      { label: "What a league is", text: "A group of players tracking results together, joined with a code — anything from a couple of mates to a full club." },
      { label: "Friends vs League", text: "The same system works for a casual friend group or a more formal club — nothing changes structurally, just how many people are in it." },
      { label: "Club administrator", text: "Manages the club and reviews trophy claims — a separate role from being a player, and not something every member has." },
      { label: "Official rankings", text: "Computed the same way regardless of league size — see the Rankings section above." },
    ],
  },
  {
    id: "shells", icon: "👻", title: "Shell players",
    points: [
      { label: "Why they exist", text: "So you can log real history against someone before they've joined Rally themselves — their record isn't lost while they haven't signed up yet." },
      { label: "Claiming", text: "If that person joins Rally later, they can be offered their existing shell profile to claim as their own — but only with their explicit confirmation. Rally never matches this automatically just because the names look similar." },
    ],
  },
  {
    id: "legacy", icon: "🏛️", title: "Legacy",
    points: [
      { label: "What it shows", text: "A player's whole career rather than just current form — total matches, career span, best wins ranked with a reason why, and how they've done against stronger and weaker opponents over time, not just this year." },
      { label: "Verified vs reported", text: "Career facts are labeled honestly — anything Rally can prove from real matches is \"Rally verified\"; anything a player has stated themselves (like when they actually started playing) is labeled \"player reported\" unless a club has verified it." },
    ],
  },
  {
    id: "confirmation", icon: "🔒", title: "Data / confirmation",
    points: [
      { label: "Why it exists", text: "So one player can never unilaterally rewrite a match involving someone else. A shell opponent (no account) confirms automatically since there's nobody to check with. A real account gets 24 hours to agree or dispute before it's confirmed automatically." },
      { label: "If it's disputed", text: "The match is removed rather than forced through — nothing incorrect becomes official just because one side logged it first." },
    ],
  },
];

function Section({ s, open, onToggle }: { s: Sect; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderTop: "1px solid " + LINE }}>
      <button onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent", border: "none", padding: "14px 2px", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
        <span style={{ flex: 1, fontFamily: display, fontSize: 18, fontWeight: 700, color: CHALK, textTransform: "uppercase", letterSpacing: -0.2 }}>{s.title}</span>
        <span style={{ fontFamily: mono, fontSize: 12, color: BALL, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div style={{ paddingBottom: 16 }}>
          {s.points.map((p) => (
            <div key={p.label} style={{ background: PANEL2, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: BALL, marginBottom: 4 }}>{p.label}</div>
              <div style={{ fontFamily: body, fontSize: 13, color: CHALK, lineHeight: 1.5 }}>{p.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HelpGuide() {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div>
      <div style={{ fontFamily: body, fontSize: 13, color: MUTED, marginBottom: 6, lineHeight: 1.5 }}>
        A quick guide to how Rally works. Tap a section to open it.
      </div>
      {SECTIONS.map((s) => (
        <Section key={s.id} s={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} />
      ))}
    </div>
  );
}
