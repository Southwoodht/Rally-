"use client";
import React, { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { LevelGuide } from "@/components/profile/LevelGuide";
import { TimelineEditor } from "@/components/settings/TimelineEditor";
import { LEVELS, SUBS } from "@/core/constants";
import { levelIsEstimated, levelNow, startIndex } from "@/core/levels";
import { fullNameOf } from "@/lib/format";
import {
  DOT_LOSS, FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_OVERLAY, FEED_RAISED,
  FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, NICKS, PANEL, body, miniInput,
} from "@/lib/theme";

/**
 * One player, edited in a sheet.
 *
 * The old Settings screen printed this whole form once per player — surname,
 * age, home ground, nickname, level, sub-level and a timeline link, times
 * every member of the club — so finding one person meant scrolling past
 * twenty forms. The list now shows a row per person and this opens for the
 * one you tapped. The fields and their rules are unchanged.
 *
 * A CLAIMED PLAYER IS THEIRS. Once somebody has an account on the row, their
 * details are shown and not edited (the rule the old screen had too); staff
 * can still mark them not currently playing, which is about the league and
 * not about them.
 *
 * Removing is two taps and says what goes with it, as every destructive thing
 * in Rally does.
 */

interface Props {
  player: any;
  played: number;
  /** Claimed by an account that is not you. */
  locked: boolean;
  onChange: (patch: Record<string, any>) => void;
  onRemove: () => void;
  onClose: () => void;
}

const lbl: React.CSSProperties = {
  fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID,
  textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6,
};
const fld: React.CSSProperties = {
  ...miniInput, fontFamily: body, fontSize: 15, background: FEED_RAISED, color: FEED_TEXT_HI,
  padding: "10px 12px", width: "100%", boxSizing: "border-box",
};

export function PlayerEditSheet({ player: p, played, locked, onChange, onRemove, onClose }: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [timeline, setTimeline] = useState(false);
  const [guide, setGuide] = useState(false);

  const setLevel = (cat: string, sub?: string) => onChange({ level: cat ? { cat, sub: sub || "Medium" } : null });
  const lvl = levelNow(p);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: FEED_OVERLAY, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 97 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: PANEL, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: "18px 16px 34px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Avatar player={p} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: body, fontWeight: 500, fontSize: 18, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullNameOf(p) || "New player"}</div>
            <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 2 }}>
              {played} played{p.auth_id ? " · has an account" : " · no account yet"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: FEED_TEXT_MID, fontFamily: body, fontSize: 14, cursor: "pointer" }}>Done</button>
        </div>

        {locked ? (
          <div style={{ background: FEED_CARD, borderRadius: 14, padding: 14, fontFamily: body, fontSize: 14, color: FEED_TEXT_MID, lineHeight: 1.55, marginBottom: 14 }}>
            <div style={{ color: FEED_TEXT_HI }}>{[p.last, p.age ? p.age + " yrs" : null, p.home].filter(Boolean).join(" · ") || "No extra details set"}</div>
            {lvl && <div>{lvl.cat} · {lvl.sub}{levelIsEstimated(p) ? " — your estimate" : ""}</div>}
            <div style={{ marginTop: 8, fontSize: 12.5 }}>They have an account, so their details are theirs to change.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <label style={{ flex: 1 }}><div style={lbl}>First name</div>
                <input value={p.name || ""} onChange={(e) => onChange({ name: e.target.value })} style={fld} /></label>
              <label style={{ flex: 1 }}><div style={lbl}>Surname</div>
                <input value={p.last || ""} onChange={(e) => onChange({ last: e.target.value })} style={fld} /></label>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <label style={{ flex: 1 }}><div style={lbl}>Age</div>
                <input value={p.age || ""} inputMode="numeric" onChange={(e) => onChange({ age: e.target.value.replace(/[^0-9]/g, "") })} style={fld} /></label>
              <label style={{ flex: 2 }}><div style={lbl}>Home club</div>
                <input value={p.home || ""} onChange={(e) => onChange({ home: e.target.value })} style={fld} /></label>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={lbl}>Level</div>
              <button onClick={() => setGuide(true)} style={{ background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 12.5, cursor: "pointer", padding: 0 }}>What do the levels mean?</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <select value={p.level?.cat || ""} onChange={(e) => setLevel(e.target.value, p.level?.sub)} style={{ ...fld, flex: 2 }}>
                <option value="">No level</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <select value={p.level?.sub || "Medium"} disabled={!p.level} onChange={(e) => setLevel(p.level?.cat, e.target.value)} style={{ ...fld, flex: 1, opacity: p.level ? 1 : 0.4 }}>
                {SUBS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={() => setTimeline(!timeline)} style={{ background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 13, cursor: "pointer", padding: "4px 0 12px" }}>
              {timeline ? "Hide level history" : `Level history${(p.levelHistory || []).length ? ` (${p.levelHistory.length})` : ""} ›`}
            </button>
            {timeline && (
              <div style={{ marginBottom: 12 }}>
                <TimelineEditor
                  player={p}
                  onAdd={(per: any) => onChange({ levelHistory: [...(p.levelHistory || []), per].sort((a: any, b: any) => startIndex(a.from) - startIndex(b.from)) })}
                  onRemove={(i: number) => onChange({ levelHistory: (p.levelHistory || []).filter((_: any, idx: number) => idx !== i) })}
                />
              </div>
            )}

            <div style={lbl}>Nickname</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input value={p.nick || ""} placeholder="Optional" onChange={(e) => onChange({ nick: e.target.value })} style={{ ...fld, flex: 1 }} />
              <button onClick={() => onChange({ nick: NICKS[Math.floor(Math.random() * NICKS.length)] })} style={{ ...fld, width: "auto", color: FEED_LIME, cursor: "pointer" }}>Surprise me</button>
            </div>
          </>
        )}

        {/* About the league, not about them, so staff can set it on anyone. */}
        <button
          onClick={() => onChange({ inactive: !p.inactive })}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: FEED_CARD, border: "none", borderRadius: 14, padding: "13px 14px", cursor: "pointer", marginBottom: 10 }}
        >
          <span style={{ textAlign: "left" }}>
            <span style={{ display: "block", fontFamily: body, fontSize: 15, color: FEED_TEXT_HI }}>Currently playing</span>
            <span style={{ display: "block", fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>Off hides them from the table until they're back. Their results are kept.</span>
          </span>
          <span style={{ width: 44, height: 26, borderRadius: 13, background: p.inactive ? FEED_RAISED : FEED_LIME, position: "relative", flexShrink: 0, marginLeft: 10 }}>
            <span style={{ position: "absolute", top: 3, left: p.inactive ? 3 : 21, width: 20, height: 20, borderRadius: 10, background: p.inactive ? FEED_TEXT_LOW : FEED_LIME_INK }} />
          </span>
        </button>

        {!locked && (
          confirmRemove ? (
            <div style={{ background: FEED_CARD, borderRadius: 14, padding: 14, borderTop: "0.5px solid " + FEED_HAIRLINE }}>
              <div style={{ fontFamily: body, fontSize: 14, color: FEED_TEXT_HI, lineHeight: 1.45, marginBottom: 12 }}>
                Remove {fullNameOf(p) || "this player"}{played ? ` and their ${played} ${played === 1 ? "result" : "results"}` : ""}? This cannot be undone.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={onRemove} style={{ flex: 1, background: DOT_LOSS, color: FEED_LIME_INK, border: "none", borderRadius: 10, padding: "11px 8px", fontFamily: body, fontSize: 14, cursor: "pointer" }}>Remove</button>
                <button onClick={() => setConfirmRemove(false)} style={{ flex: 1, background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 10, padding: "11px 8px", fontFamily: body, fontSize: 14, cursor: "pointer" }}>Keep</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmRemove(true)} style={{ width: "100%", background: "none", border: "none", color: DOT_LOSS, fontFamily: body, fontSize: 14, cursor: "pointer", padding: "10px 0" }}>
              Remove from the league
            </button>
          )
        )}

        {guide && <LevelGuide onClose={() => setGuide(false)} />}
      </div>
    </div>
  );
}
