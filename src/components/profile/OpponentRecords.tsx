"use client";
import React from "react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { fullNameOf } from "@/lib/format";
import {
  FEED_CARD, FEED_LIME, FEED_LOSS, FEED_TEXT_HI, FEED_TEXT_MID, FEED_THEY_LEAD,
  FEED_THEY_LEAD_DIM, body, tabular,
} from "@/lib/theme";

// Who you are ahead of and who is ahead of you, in one place.
//
// This replaces three sections — "Winning records", "Losing records" and
// "Opponent quality" — which were three answers to one question, laid out as
// though they were different subjects. Splitting a single fact across three
// headings makes the reader do the joining.

export interface OpponentRecord {
  player: any;
  w: number;
  d: number;
  l: number;
  /** "Intermediate", or undefined when they have not set one. */
  levelLabel?: string;
}

export interface OpponentRecordsProps {
  lead: OpponentRecord[];
  behind: OpponentRecord[];
  /** Shown per group before the "n more" row. */
  visible?: number;
  onOpen?: (playerId: string) => void;
  onAll?: () => void;
}

const byWins = (a: OpponentRecord, b: OpponentRecord) => b.w - a.w || a.l - b.l;

function Row({ r, accent, recordColour, onOpen, last }: any) {
  return (
    <button
      onClick={onOpen && r.player?.id ? () => onOpen(r.player.id) : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
        background: "transparent", border: "none", borderLeft: "3px solid " + accent,
        // Square, deliberately: a rounded left edge on a 3px marker reads as
        // a stray dot rather than as the edge of the row it belongs to.
        borderRadius: 0,
        padding: "11px 14px", cursor: onOpen ? "pointer" : "default",
        boxShadow: last ? undefined : "inset 0 -0.5px 0 " + FEED_LOSS,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {fullNameOf(r.player)}
        </span>
        {r.levelLabel && (
          <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, marginTop: 1 }}>{r.levelLabel}</span>
        )}
      </span>
      <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 15, color: recordColour, flexShrink: 0 }}>
        {r.w}–{r.d}–{r.l}
      </span>
    </button>
  );
}

function Group({ title, items, accent, recordColour, visible, onOpen, onAll }: any) {
  if (!items.length) return null;
  const shown = items.slice(0, visible);
  const rest = items.length - shown.length;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 11, color: accent, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
        {title} · {items.length}
      </div>
      <SurfaceCard radius={14} pad={0} clip>
        {shown.map((r: OpponentRecord, i: number) => (
          <Row key={r.player?.id || i} r={r} accent={accent} recordColour={recordColour} onOpen={onOpen} last={i === shown.length - 1 && rest === 0} />
        ))}
        {rest > 0 && (
          <button
            onClick={onAll}
            style={{ display: "block", width: "100%", background: "transparent", border: "none", padding: "11px 14px", cursor: onAll ? "pointer" : "default", fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, textAlign: "center" }}
          >
            {rest} more
          </button>
        )}
      </SurfaceCard>
    </div>
  );
}

export function OpponentRecords({ lead, behind, visible = 4, onOpen, onAll }: OpponentRecordsProps) {
  const ahead = [...lead].sort(byWins);
  const under = [...behind].sort(byWins);
  if (!ahead.length && !under.length) return null;

  return (
    <div>
      <SurfaceCard radius={18}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10 }}>
          <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 32, lineHeight: 1, color: FEED_LIME }}>{ahead.length}</span>
          <span style={{ fontFamily: body, fontWeight: 400, fontSize: 26, color: FEED_LOSS }}>–</span>
          <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 32, lineHeight: 1, color: FEED_THEY_LEAD }}>{under.length}</span>
        </div>
        {/* Required, not decorative. Without it "9 – 3" is read as a match
            record, which it emphatically is not — it counts people, not
            games, and the two numbers would be wrong by an order of
            magnitude if taken the other way. */}
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, textAlign: "center", marginTop: 8, lineHeight: 1.4 }}>
          Opponents you lead — opponents who lead you
        </div>
        {(ahead.length > 0 || under.length > 0) && (
          <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginTop: 12 }} role="img" aria-label={`${ahead.length} opponents you lead, ${under.length} who lead you`}>
            {ahead.length > 0 && <span style={{ flex: ahead.length, background: FEED_LIME }} />}
            {under.length > 0 && <span style={{ flex: under.length, background: FEED_THEY_LEAD_DIM }} />}
          </div>
        )}
      </SurfaceCard>

      <Group title="You lead" items={ahead} accent={FEED_LIME} recordColour={FEED_TEXT_HI} visible={visible} onOpen={onOpen} onAll={onAll} />
      <Group title="They lead" items={under} accent={FEED_THEY_LEAD_DIM} recordColour={FEED_THEY_LEAD} visible={visible} onOpen={onOpen} onAll={onAll} />
    </div>
  );
}
