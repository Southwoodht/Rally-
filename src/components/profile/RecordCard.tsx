"use client";
import React from "react";
import { FormBars, type FormBarItem } from "@/components/profile/FormBars";
import { StatNumeral, SurfaceCard } from "@/components/ui/Surfaces";
import { FEED_LIME, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, body, tabular } from "@/lib/theme";

// The record, the form and where you stand, as one card.
//
// The three numbers are one unit rather than three tiles, because 28-6-10 is
// a single fact read left to right and splitting it into boxes makes the
// reader reassemble it. Colour does the separating instead: wins lime, draws
// bright, losses quiet.
//
// Presentational. Every number arrives finished.

const RULE = "0.5px solid " + FEED_RAISED;
const DASH = "#2F5B47";

export interface RankingRow {
  label: string;
  /** "2nd of 20". */
  value: string;
  /** "provisional", "top 10%" — sits under the value, quietly. */
  qualifier?: string;
  /** The league's own ranking is the one that matters most on this screen. */
  emphasis?: boolean;
}

export type OutcomeFilter = "W" | "D" | "L" | null;

export interface RecordCardProps {
  record: { w: number; d: number; l: number };
  /** Tapping a tally filters the match list below to those results. The old
   *  profile did this and it is the obvious question to ask of a number:
   *  28 what, exactly? */
  onFilter?: (outcome: OutcomeFilter) => void;
  activeFilter?: OutcomeFilter;
  form?: FormBarItem[];
  /** 0-100, already rounded. */
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  rankings?: RankingRow[];
}

const label: React.CSSProperties = { fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID };

function Tally({ n, colour, caption, onClick, active }: { n: number; colour: string; caption: string; onClick?: () => void; active?: boolean }) {
  const inner = (
    <>
      <div style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 46, lineHeight: 1, letterSpacing: "-0.05em", color: colour }}>{n}</div>
      <div style={{ ...label, marginTop: 6, color: active ? colour : FEED_TEXT_MID }}>{caption}</div>
    </>
  );
  if (!onClick) return <div style={{ textAlign: "center" }}>{inner}</div>;
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "center", background: "transparent", border: "none", padding: "0 4px 4px",
        cursor: "pointer", borderBottom: "2px solid " + (active ? colour : "transparent"),
      }}
    >
      {inner}
    </button>
  );
}

export function RecordCard({ record, form, winRate, currentStreak, bestStreak, rankings, onFilter, activeFilter }: RecordCardProps) {
  const tap = (o: Exclude<OutcomeFilter, null>) =>
    onFilter ? () => onFilter(activeFilter === o ? null : o) : undefined;
  return (
    <SurfaceCard radius={18} pad="18px 16px">
      {/* a — the record */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 10 }}>
        <Tally n={record.w} colour={FEED_LIME} caption="won" onClick={tap("W")} active={activeFilter === "W"} />
        <span style={{ fontFamily: body, fontWeight: 400, fontSize: 34, lineHeight: "46px", color: DASH }}>–</span>
        <Tally n={record.d} colour={FEED_TEXT_HI} caption="drawn" onClick={tap("D")} active={activeFilter === "D"} />
        <span style={{ fontFamily: body, fontWeight: 400, fontSize: 34, lineHeight: "46px", color: DASH }}>–</span>
        <Tally n={record.l} colour={FEED_TEXT_MID} caption="lost" onClick={tap("L")} active={activeFilter === "L"} />
      </div>

      {/* b — form */}
      {form && form.length > 0 && (
        <div style={{ borderTop: RULE, marginTop: 16, paddingTop: 14 }}>
          <FormBars items={form} />
        </div>
      )}

      {/* c — the three that need no explaining */}
      <div style={{ borderTop: RULE, marginTop: 14, paddingTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div style={{ textAlign: "center" }}>
          <StatNumeral size={20} tone="hi">{winRate}%</StatNumeral>
          <div style={{ ...label, marginTop: 3 }}>win rate</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <StatNumeral size={20} tone="lime">{currentStreak}</StatNumeral>
          <div style={{ ...label, marginTop: 3 }}>current streak</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <StatNumeral size={20} tone="hi">{bestStreak}</StatNumeral>
          <div style={{ ...label, marginTop: 3 }}>best streak</div>
        </div>
      </div>

      {/* d — where you stand, in every table that has an opinion */}
      {rankings && rankings.length > 0 && (
        <div style={{ borderTop: RULE, marginTop: 14, paddingTop: 6 }}>
          {rankings.map((r) => (
            <div key={r.label} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "8px 0" }}>
              <span style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, flexShrink: 0 }}>{r.label}</span>
              <span style={{ textAlign: "right", minWidth: 0 }}>
                <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: r.emphasis ? 16 : 15, color: r.emphasis ? FEED_LIME : FEED_TEXT_HI }}>{r.value}</span>
                {r.qualifier && (
                  <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, marginLeft: 6 }}>{r.qualifier}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}
