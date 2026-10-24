"use client";
import React, { useState } from "react";
import { StartRecordEditor } from "@/components/settings/StartRecordEditor";
import { Avatar } from "@/components/ui/Avatar";
import { LevelGuide } from "@/components/profile/LevelGuide";
import { TimelineEditor } from "@/components/settings/TimelineEditor";
import { LEVELS, SUBS } from "@/core/constants";
import { levelIsEstimated, levelNow, startIndex } from "@/core/levels";
import { levelForUtr, parseUtr, utrLabel } from "@/core/utr";
import { fullNameOf } from "@/lib/format";
import { OFFENSIVE_NAME_MESSAGE, isOffensiveName } from "@/core/nameFilter";
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
  /**
   * An organiser setting the level (brief item 2): through set_player_level,
   * for anybody in the club — signed up or not — with a dated period added to
   * their history. Absent: this sheet cannot change a level at all.
   */
  onSetLevel?: (level: { cat: string; sub: string } | null) => Promise<void>;
  /** An organiser correcting the history itself (adding or removing a period). */
  onSetHistory?: (history: any[]) => Promise<void>;
  /** An organiser setting the starting rating and carried-in record. Absent: not shown. */
  onSetStart?: (elo: number | null, record: { w: number; d: number; l: number } | null) => Promise<void>;
  /**
   * An owner or editor renaming a player who has an account (Sam, 2026-10-24),
   * through set_player_name. Absent: a claimed name stays theirs.
   */
  onRename?: (name: string, last: string) => Promise<void>;
  /** An organiser setting or clearing their UTR; the level follows from it. */
  onSetUtr?: (utr: number | null) => Promise<void>;
}

const lbl: React.CSSProperties = {
  fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID,
  letterSpacing: 0, marginBottom: 6,
};
const fld: React.CSSProperties = {
  ...miniInput, fontFamily: body, fontSize: 15, background: FEED_RAISED, color: FEED_TEXT_HI,
  padding: "10px 12px", width: "100%", boxSizing: "border-box",
};

export function PlayerEditSheet({ player: p, played, locked, onChange, onRemove, onClose, onSetLevel, onSetHistory, onSetStart, onRename, onSetUtr }: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [timeline, setTimeline] = useState(false);
  const [guide, setGuide] = useState(false);
  const [nameErr, setNameErr] = useState("");
  const [first, setFirst] = useState(p.name || "");
  const [surname, setSurname] = useState(p.last || "");
  const [savingName, setSavingName] = useState(false);
  const [utrText, setUtrText] = useState(p.utr != null ? String(p.utr) : "");
  const [savingUtr, setSavingUtr] = useState(false);
  const utr = parseUtr(utrText);
  const utrChanged = (utr ?? null) !== (p.utr ?? null);
  const utrBad = utrText.trim() !== "" && utr == null;
  const saveUtr = async () => {
    if (!onSetUtr || utrBad) return;
    setSavingUtr(true);
    try { await onSetUtr(utr); } catch { /* the caller has said why */ }
    setSavingUtr(false);
  };

  // A shell's name saves as it is typed, so an offensive one is refused at
  // the keystroke rather than written and then caught.
  const typeName = (patch: { name?: string; last?: string }) => {
    const full = [patch.name ?? p.name, patch.last ?? p.last].filter(Boolean).join(" ");
    if (isOffensiveName(full)) { setNameErr(OFFENSIVE_NAME_MESSAGE); return; }
    setNameErr("");
    onChange(patch);
  };
  const nameChanged = first.trim() !== (p.name || "").trim() || surname.trim() !== (p.last || "").trim();
  const saveName = async () => {
    if (!onRename) return;
    if (!first.trim()) { setNameErr("A first name is needed."); return; }
    if (isOffensiveName(first + " " + surname)) { setNameErr(OFFENSIVE_NAME_MESSAGE); return; }
    setNameErr(""); setSavingName(true);
    try { await onRename(first, surname); } catch { /* the caller has said why */ }
    setSavingName(false);
  };

  const setLevel = (cat: string, sub?: string) => { void onSetLevel?.(cat ? { cat, sub: sub || "Medium" } : null); };
  const lvl = levelNow(p);

  // Level and its history, for organisers only — the database refuses anybody
  // else (schema_levels_organisers.sql). Shown for signed-up players too: an
  // organiser setting levels is the whole point, and the old rule that their
  // details are "theirs to change" no longer covers the level.
  const levelSection = onSetLevel ? (
    <>
      {onSetUtr && (
        <div style={{ marginBottom: 14 }}>
          <div style={lbl}>UTR, if they have one</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={utrText} onChange={(e) => setUtrText(e.target.value)} inputMode="decimal" placeholder="e.g. 3.2" style={{ ...fld, flex: 1 }} />
            <button onClick={saveUtr} disabled={!utrChanged || utrBad || savingUtr} style={{ background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 10, padding: "0 16px", fontFamily: body, fontSize: 14, cursor: "pointer", opacity: !utrChanged || utrBad || savingUtr ? 0.4 : 1 }}>
              {savingUtr ? "Saving…" : "Save"}
            </button>
          </div>
          <div style={{ fontFamily: body, fontSize: 12, color: utrBad ? DOT_LOSS : FEED_TEXT_MID, lineHeight: 1.45, marginTop: 6 }}>
            {utrBad
              ? "A UTR is a number from 1 to 16.5."
              : utr != null
                ? `${utrLabel(utr)} sets their level to ${levelForUtr(utr).cat} · ${levelForUtr(utr).sub}.`
                : "Their stars come from it when it's set. Leave it empty if they haven't got one."}
          </div>
        </div>
      )}
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
      <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_MID, lineHeight: 1.45, marginBottom: 4 }}>
        A change starts from this month in their level history, so their older matches keep the level they had then.
      </div>
      <button onClick={() => setTimeline(!timeline)} style={{ background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 13, cursor: "pointer", padding: "4px 0 12px" }}>
        {timeline ? "Hide level history" : `Level history${(p.levelHistory || []).length ? ` (${p.levelHistory.length})` : ""} ›`}
      </button>
      {timeline && onSetHistory && (
        <div style={{ marginBottom: 12 }}>
          <TimelineEditor
            player={p}
            onAdd={(per: any) => { void onSetHistory([...(p.levelHistory || []), per].sort((a: any, b: any) => startIndex(a.from) - startIndex(b.from))); }}
            onRemove={(i: number) => { void onSetHistory((p.levelHistory || []).filter((_: any, idx: number) => idx !== i)); }}
          />
        </div>
      )}
    </>
  ) : null;

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
            <div style={{ marginTop: 8, fontSize: 12.5 }}>They have an account, so their details are theirs to change{onSetLevel ? " — except their name, level and starting record, which you can set" : ""}.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <label style={{ flex: 1 }}><div style={lbl}>First name</div>
                <input value={p.name || ""} onChange={(e) => typeName({ name: e.target.value })} style={fld} /></label>
              <label style={{ flex: 1 }}><div style={lbl}>Surname</div>
                <input value={p.last || ""} onChange={(e) => typeName({ last: e.target.value })} style={fld} /></label>
            </div>
            {nameErr && <div style={{ fontFamily: body, fontSize: 12.5, color: DOT_LOSS, margin: "-4px 0 12px" }}>{nameErr}</div>}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <label style={{ flex: 1 }}><div style={lbl}>Age</div>
                <input value={p.age || ""} inputMode="numeric" onChange={(e) => onChange({ age: e.target.value.replace(/[^0-9]/g, "") })} style={fld} /></label>
              <label style={{ flex: 2 }}><div style={lbl}>Home club</div>
                <input value={p.home || ""} onChange={(e) => onChange({ home: e.target.value })} style={fld} /></label>
            </div>

            {levelSection}

            <div style={lbl}>Nickname</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input value={p.nick || ""} placeholder="Optional" onChange={(e) => onChange({ nick: e.target.value })} style={{ ...fld, flex: 1 }} />
              <button onClick={() => onChange({ nick: NICKS[Math.floor(Math.random() * NICKS.length)] })} style={{ ...fld, width: "auto", color: FEED_LIME, cursor: "pointer" }}>Surprise me</button>
            </div>
          </>
        )}

        {/* Their name is theirs, except that an owner or editor can correct
            it — the moderation door (schema_moderation.sql). Saved on a tap,
            not per keystroke, because it goes through the database. */}
        {locked && onRename && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <label style={{ flex: 1 }}><div style={lbl}>First name</div>
                <input value={first} onChange={(e) => { setFirst(e.target.value); setNameErr(""); }} style={fld} /></label>
              <label style={{ flex: 1 }}><div style={lbl}>Surname</div>
                <input value={surname} onChange={(e) => { setSurname(e.target.value); setNameErr(""); }} style={fld} /></label>
            </div>
            {nameErr && <div style={{ fontFamily: body, fontSize: 12.5, color: DOT_LOSS, marginBottom: 8 }}>{nameErr}</div>}
            {nameChanged && (
              <button onClick={saveName} disabled={savingName} style={{ width: "100%", background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 10, padding: "11px 8px", fontFamily: body, fontSize: 14, cursor: "pointer", opacity: savingName ? 0.6 : 1 }}>
                {savingName ? "Saving…" : "Save name"}
              </button>
            )}
          </div>
        )}

        {locked && levelSection && <div style={{ marginBottom: 6 }}>{levelSection}</div>}

        {onSetStart && (
          <div style={{ marginBottom: 14 }}>
            <div style={lbl}>Starting rating &amp; record</div>
            <StartRecordEditor key={p.id} player={p} fieldStyle={fld} onSave={onSetStart} />
          </div>
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
              Remove from the club
            </button>
          )
        )}

        {guide && <LevelGuide onClose={() => setGuide(false)} />}
      </div>
    </div>
  );
}
