"use client";
import React from "react";
import { GroupCard, GroupLabel, GroupRow, RecordPill } from "@/components/ui/Grouped";
import { LegacyNote } from "@/components/ui/LegacyNote";
import { legacyLine } from "@/core/matchStatus";
import { fullNameOf } from "@/lib/format";
import { FEED_LIME, FEED_TEXT_MID, LINE, body, tabular } from "@/lib/theme";

// Who you are ahead of and who is ahead of you, in one place.
//
// Inset-grouped since 2026-10-30 (Sam's polish brief), the same shape as
// Compare: one muted summary line counting PEOPLE, then a "Winning against"
// card and a "Losing against" card, one column. Each row is the opponent in
// bold, their level and overall record as one muted line, and the
// head-to-head as a pill that never wraps. Legacy years sit under that as
// their own line with a laurel — never folded into the record.

export interface OpponentRecord {
  player: any;
  w: number;
  d: number;
  l: number;
  /** How many legacy results against them — the share card's "+4 legacy". */
  legacy?: number;
  /** The same legacy results as a record, for "Led 4 legacy years". */
  legacyRecord?: { w: number; d: number; l: number; claimed: number };
  /** "Intermediate", or undefined when they have not set one. */
  levelLabel?: string;
  /** Their own overall record, for the muted line. */
  overall?: { w: number; d: number; l: number };
}

export interface OpponentRecordsProps {
  lead: OpponentRecord[];
  behind: OpponentRecord[];
  /** Opponents level with them — counted in the summary, not listed. */
  level?: number;
  /** Your own profile: "You lead 8"; anybody else's: "Leads 8". */
  self?: boolean;
  /** Shown per group before the "n more" row. */
  visible?: number;
  onOpen?: (playerId: string) => void;
  onAll?: () => void;
}

const byWins = (a: OpponentRecord, b: OpponentRecord) => b.w - a.w || a.l - b.l;
const byLosses = (a: OpponentRecord, b: OpponentRecord) => b.l - a.l || a.w - b.w;

function Rows({ items, visible, onOpen, onAll }: { items: OpponentRecord[]; visible: number; onOpen?: (id: string) => void; onAll?: () => void }) {
  const shown = items.slice(0, visible);
  const rest = items.length - shown.length;
  return (
    <GroupCard>
      {shown.map((r, i) => {
        const played = r.w + r.d + r.l > 0;
        const sub = [r.levelLabel, r.overall ? `${r.overall.w}–${r.overall.d}–${r.overall.l} overall` : null].filter(Boolean).join(" · ");
        const legacy = r.legacyRecord ? legacyLine(r.legacyRecord) : null;
        return (
          <GroupRow
            key={r.player?.id || i}
            first={i === 0}
            title={fullNameOf(r.player)}
            sub={sub || undefined}
            below={legacy ? <LegacyNote text={legacy} /> : undefined}
            right={played ? <RecordPill>{r.w}–{r.d}–{r.l}</RecordPill> : undefined}
            onClick={onOpen && r.player?.id ? () => onOpen(r.player.id) : undefined}
          />
        );
      })}
      {rest > 0 && (
        <button
          onClick={onAll}
          style={{ display: "block", width: "100%", background: "transparent", border: "none", borderTop: "1px solid " + LINE, padding: "12px 16px", cursor: onAll ? "pointer" : "default", fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_LIME, textAlign: "left" }}
        >
          {rest} more
        </button>
      )}
    </GroupCard>
  );
}

export function OpponentRecords({ lead, behind, level = 0, self = false, visible = 4, onOpen, onAll }: OpponentRecordsProps) {
  const ahead = [...lead].sort(byWins);
  const under = [...behind].sort(byLosses);
  if (!ahead.length && !under.length) return null;

  // People, not matches: "9 – 3" was once read as a match record, so the
  // summary says what it counts in words.
  const summary = [
    "Rivals",
    (self ? "You lead " : "Leads ") + ahead.length,
    (self ? "They lead " : "Trails ") + under.length,
    level ? "Level " + level : null,
  ].filter(Boolean).join(" · ");

  return (
    <div>
      <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13.5, color: FEED_TEXT_MID, padding: "0 4px", marginBottom: 12, ...tabular }}>{summary}</div>
      {ahead.length > 0 && (
        <>
          <GroupLabel>Winning against</GroupLabel>
          <Rows items={ahead} visible={visible} onOpen={onOpen} onAll={onAll} />
        </>
      )}
      {under.length > 0 && (
        <>
          <GroupLabel style={{ marginTop: ahead.length ? 16 : 0 }}>Losing against</GroupLabel>
          <Rows items={under} visible={visible} onOpen={onOpen} onAll={onAll} />
        </>
      )}
    </div>
  );
}
