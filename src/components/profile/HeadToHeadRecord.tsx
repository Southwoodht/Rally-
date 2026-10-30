"use client";
import React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { FormBars, type FormBarItem } from "@/components/profile/FormBars";
import { GroupCard, GroupLabel } from "@/components/ui/Grouped";
import { LegacyNote } from "@/components/ui/LegacyNote";
import { SurfaceCard } from "@/components/ui/Surfaces";
import type { OpponentRecord } from "@/components/profile/OpponentRecords";
import { legacyLine } from "@/core/matchStatus";
import { pickNemesis } from "@/core/rivals";
import { fullNameOf } from "@/lib/format";
import { FEED_OVERLAY, PANEL, FEED_LIME, FEED_LOST, FEED_PAD, FEED_PAD_Y, FEED_RADIUS, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, LINE, body, display, tabular } from "@/lib/theme";

/**
 * The head-to-head record IS the profile now (Sam, 2026-10-30): the top
 * card counts PEOPLE — how many opponents you are ahead of, level with and
 * behind — and the lists under it name them, targets first. The match
 * record, place and rating sit small beneath a hairline; win rate, form
 * and streaks moved down to the match history.
 */

export interface Standing { place: string; rating: number | null; rd: number | null }

export type H2HGroup = "ahead" | "level" | "behind";

/** Each count opens a sheet naming those people (Sam:
 *  "if u click the head to heads it shows who they are beating"). */
export function HeadToHeadHero({ ahead, level, behind, self, record, standing, onShow, form, rates }: {
  ahead: number; level: number; behind: number; self: boolean;
  record: { w: number; d: number; l: number };
  standing?: Standing | null;
  onShow?: (group: H2HGroup) => void;
  /** Last 5 and the rates, folded in from the old Matches card (Sam,
   *  2026-10-30: "merge it all with the head to head card under one"). */
  form?: FormBarItem[];
  rates?: { winRate: number; unbeatenRate?: number; currentStreak: number; bestStreak: number };
}) {
  const faced = ahead + level + behind;
  const num = (n: number, colour: string, label: H2HGroup) => {
    const go = onShow && n > 0 ? () => onShow(label) : undefined;
    return (
      <button type="button" onClick={go} disabled={!go} aria-label={go ? `Show the ${n} ${label}` : undefined}
        style={{ textAlign: "center", minWidth: 0, background: "none", border: "none", padding: "2px 4px", cursor: go ? "pointer" : "default", color: "inherit" }}>
        <div style={{ ...tabular, fontFamily: display, fontWeight: 700, fontSize: 50, lineHeight: 1, color: colour }}>{n}</div>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID, marginTop: 6, textDecoration: go ? "underline" : "none", textDecorationColor: FEED_RAISED, textUnderlineOffset: 3 }}>{label}</div>
      </button>
    );
  };
  const dot = <span aria-hidden="true" style={{ fontFamily: display, fontWeight: 700, fontSize: 34, color: FEED_RAISED, lineHeight: 1, marginTop: 6 }}>·</span>;
  // A number in the display face; a word ("Not ranked", "Provisional") in
  // the body face and smaller, so three columns never run into each other.
  const small = (label: string, value: React.ReactNode, isWord = false) => (
    <div style={{ textAlign: "center", minWidth: 0 }}>
      <div style={{ ...tabular, fontFamily: isWord ? body : display, fontWeight: isWord ? 600 : 700, fontSize: isWord ? 14 : 18, lineHeight: "24px", color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      <div style={{ fontFamily: body, fontWeight: 500, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 3 }}>{label}</div>
    </div>
  );
  return (
    <SurfaceCard className="sw-hero" radius={FEED_RADIUS} pad={FEED_PAD_Y + "px " + FEED_PAD + "px"}>
      <div style={{ textAlign: "center", fontFamily: body, fontWeight: 600, fontSize: 13.5, color: FEED_TEXT_MID }}>Head-to-head record</div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 18, marginTop: 14 }}>
        {num(ahead, FEED_LIME, "ahead")}{dot}{num(level, FEED_TEXT_HI, "level")}{dot}{num(behind, FEED_LOST, "behind")}
      </div>
      {faced > 0 && (
        <div style={{ ...tabular, textAlign: "center", fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_MID, marginTop: 14 }}>
          Ahead of {ahead} of the {faced} {faced === 1 ? "player" : "players"} {self ? "you've" : "they've"} faced
        </div>
      )}
      {form && form.length > 0 && (
        <div style={{ borderTop: "1px solid " + LINE, marginTop: 16, paddingTop: 14 }}>
          <FormBars items={form} />
        </div>
      )}
      {rates && (
        <div style={{ borderTop: "1px solid " + LINE, marginTop: 14, paddingTop: 14, display: "grid", gridTemplateColumns: rates.unbeatenRate != null ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 6 }}>
          {small("win rate", rates.winRate + "%")}
          {rates.unbeatenRate != null && small("unbeaten", rates.unbeatenRate + "%")}
          {small("streak", rates.currentStreak)}
          {small("best run", rates.bestStreak)}
        </div>
      )}
      <div style={{ borderTop: "1px solid " + LINE, marginTop: 14, paddingTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {small("matches", `${record.w}–${record.d}–${record.l}`)}
        {small("club", standing?.place || "—", !!standing?.place && !/^\d/.test(standing.place))}
        {small("rating", standing?.rating != null
          ? <>{standing.rating}{standing.rd != null && <span style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_MID }}> ±{standing.rd}</span>}</>
          : "—")}
      </div>
    </SurfaceCard>
  );
}

const recordText = (r: { w: number; d: number; l: number }) => (r.d ? `${r.w}–${r.d}–${r.l}` : `${r.w}–${r.l}`);
const played = (r: OpponentRecord) => r.w + r.d + r.l;

function Row({ r, first, note, onOpen }: { r: OpponentRecord; first: boolean; note?: string; onOpen?: (id: string) => void }) {
  const legacy = r.legacyRecord ? legacyLine(r.legacyRecord) : null;
  const go = onOpen && r.player?.id ? () => onOpen(r.player.id) : undefined;
  const sub = note || r.levelLabel;
  return (
    <div role={go ? "button" : undefined} onClick={go} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderTop: first ? "none" : "1px solid " + LINE, cursor: go ? "pointer" : "default" }}>
      <Avatar player={r.player} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15.5, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullNameOf(r.player)}</div>
        {sub && <div style={{ fontFamily: body, fontWeight: note ? 600 : 500, fontSize: 13, color: note ? FEED_LOST : FEED_TEXT_MID, marginTop: 1 }}>{sub}</div>}
        {legacy && <div style={{ marginTop: 2 }}><LegacyNote text={legacy.charAt(0).toLowerCase() + legacy.slice(1)} /></div>}
      </div>
      {played(r) > 0 && (
        <span style={{ ...tabular, flexShrink: 0, whiteSpace: "nowrap", fontFamily: display, fontWeight: 700, fontSize: 24, color: FEED_TEXT_HI }}>{recordText(r)}</span>
      )}
    </div>
  );
}

function List({ id, title, hint, items, notes, visible, onOpen, onAll }: {
  id: string; title: string; hint?: string; items: OpponentRecord[]; notes?: Record<string, string>;
  visible?: number; onOpen?: (id: string) => void; onAll?: () => void;
}) {
  if (!items.length) return null;
  const shown = visible ? items.slice(0, visible) : items;
  const rest = items.length - shown.length;
  return (
    <div id={id} style={{ marginTop: 18, scrollMarginTop: 72 }}>
      <GroupLabel right={hint ? <span style={{ fontFamily: body, fontWeight: 500, fontSize: 12.5, color: FEED_TEXT_MID }}>{hint}</span> : undefined}>{title} · {items.length}</GroupLabel>
      <GroupCard>
        {shown.map((r, i) => <Row key={r.player?.id || i} r={r} first={i === 0} note={notes?.[r.player?.id]} onOpen={onOpen} />)}
        {rest > 0 && (
          <button onClick={onAll} style={{ display: "block", width: "100%", background: "transparent", border: "none", borderTop: "1px solid " + LINE, padding: "12px 16px", cursor: "pointer", fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_LIME, textAlign: "left" }}>
            See all {items.length}
          </button>
        )}
      </GroupCard>
    </div>
  );
}

/**
 * Behind first — the targets, worst first, the nemesis named — then anyone
 * level, then Ahead, most played first, five and "See all". Every row opens
 * the head-to-head with that player.
 */
const worstFirstOf = (behind: OpponentRecord[]) => [...behind].sort((a, b) => (b.l - b.w) - (a.l - a.w) || played(b) - played(a));
const mostPlayedOf = (lead: OpponentRecord[]) => [...lead].sort((a, b) => played(b) - played(a) || (b.w - b.l) - (a.w - a.l));
const nemesisNotes = (behind: OpponentRecord[]): Record<string, string> => {
  const nem = pickNemesis(behind.filter((r) => r.player?.id).map((r) => ({ id: r.player.id, w: r.w, d: r.d, l: r.l })));
  return nem ? { [nem.id]: "Nemesis" } : {};
};

/**
 * Tap 10 on the hero and the ten people open in a sheet over the profile
 * (Sam, 2026-10-30: "when u click 10 it lists my 10 people and same with my
 * 3"). Same rows and order as the lists under the card; a row opens the
 * head-to-head with that player.
 */
export function HeadToHeadSheet({ group, lead, behind, level, self, onClose, onOpen }: {
  group: H2HGroup; lead: OpponentRecord[]; behind: OpponentRecord[]; level: OpponentRecord[]; self: boolean;
  onClose: () => void; onOpen?: (id: string) => void;
}) {
  const items = group === "ahead" ? mostPlayedOf(lead) : group === "behind" ? worstFirstOf(behind) : level;
  const notes = group === "behind" ? nemesisNotes(behind) : undefined;
  const n = items.length;
  const title = group === "ahead" ? `Ahead of ${n}` : group === "behind" ? `Behind ${n}` : `Level with ${n}`;
  const sub = group === "ahead"
    ? `${n === 1 ? "The player" : "Players"} ${self ? "you have" : "they have"} a winning record against`
    : group === "behind"
      ? `${n === 1 ? "The player" : "Players"} with a winning record against ${self ? "you" : "them"}${self ? " — your targets" : ""}`
      : `Honours even, so far`;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: FEED_OVERLAY, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 125 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: PANEL, width: "100%", maxWidth: 620, maxHeight: "85vh", overflowY: "auto", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: "18px 16px 34px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: display, fontWeight: 700, fontSize: 26, color: group === "behind" ? FEED_LOST : FEED_TEXT_HI }}>{title}</div>
            <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13.5, color: FEED_TEXT_MID, marginTop: 2 }}>{sub}</div>
          </div>
          <button onClick={onClose} style={{ background: FEED_RAISED, border: "none", borderRadius: 999, padding: "8px 14px", fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_TEXT_HI, cursor: "pointer", flexShrink: 0 }}>Done</button>
        </div>
        <div style={{ marginTop: 14 }}>
          <GroupCard>
            {items.map((r, i) => <Row key={r.player?.id || i} r={r} first={i === 0} note={notes?.[r.player?.id]} onOpen={onOpen ? (id) => { onClose(); onOpen(id); } : undefined} />)}
          </GroupCard>
        </div>
      </div>
    </div>
  );
}

export function HeadToHeadLists({ lead, behind, level, self, showAllAhead, onAllAhead, onOpen }: {
  lead: OpponentRecord[]; behind: OpponentRecord[]; level: OpponentRecord[]; self: boolean;
  showAllAhead: boolean; onAllAhead: () => void; onOpen?: (id: string) => void;
}) {
  const worstFirst = worstFirstOf(behind);
  const notes = nemesisNotes(behind);
  const mostPlayed = mostPlayedOf(lead);
  return (
    <>
      <List id="h2h-behind" title="Behind" hint={self ? "your targets" : undefined} items={worstFirst} notes={notes} onOpen={onOpen} />
      <List id="h2h-level" title="Level" items={level} onOpen={onOpen} />
      <List id="h2h-ahead" title="Ahead" items={mostPlayed} visible={showAllAhead ? undefined : 5} onOpen={onOpen} onAll={onAllAhead} />
    </>
  );
}
