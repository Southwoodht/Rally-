"use client";
import React, { useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { LEVELS, SUBS } from "@/core/constants";
import { levelNow, sealTimeline, startIndex } from "@/core/levels";
import { fullNameOf } from "@/lib/format";
import {
  FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED,
  FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, miniInput, tabular,
} from "@/lib/theme";

// Who has no level history, and the means to fix it.
//
// This exists because levelAt returns null for a player with no history and
// every rating then declines to weight their matches at all — which is the
// honest answer, and a useless one at scale. Fourteen of Seacourt's
// twenty-one players are in that state, so two thirds of the league's
// results are being counted flat. This screen is how that gets repaired.
//
// It collects starts only, never ends: see sealTimeline in core/levels.ts.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fmtBoundary = (v: any): string => {
  if (v == null) return "now";
  if (typeof v === "number") return String(v);
  const [y, m] = String(v).split("-").map(Number);
  return m ? MONTHS[m - 1] + " " + y : String(y);
};

const label: React.CSSProperties = {
  fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID,
  textTransform: "uppercase", letterSpacing: 0.8,
};

const field: React.CSSProperties = {
  ...miniInput, fontFamily: body, fontSize: 13.5, background: FEED_RAISED,
  color: FEED_TEXT_HI, border: "none", padding: "9px 10px",
  boxSizing: "border-box" as const,
};

/**
 * Which timeline this card is editing, and whether it may.
 *
 *   own       their row is yours to write — an unclaimed shell, or you
 *   estimate  they have an account and have never set a timeline, so a league
 *             owner or editor may record what they reckon, in its own columns
 *   locked    they have an account and have set their own. Nothing to do here:
 *             an estimate would be inert, and offering the control anyway
 *             would be a button that silently changes nothing.
 */
function PlayerCard({ player, mode, onSave, failure }: { player: any; mode: "own" | "estimate" | "locked"; onSave: (periods: any[]) => void; failure?: string | null }) {
  const hist = (mode === "estimate" ? player.levelEstimateHistory : player.levelHistory) || [];
  const shown = levelNow(player);
  const [cat, setCat] = useState(shown?.cat || "Beginner");
  const [sub, setSub] = useState(shown?.sub || "Medium");
  const [from, setFrom] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    if (!from) return setError("Pick the month it started from.");
    if (hist.some((h: any) => startIndex(h.from) === startIndex(from))) {
      return setError("There's already an entry starting that month.");
    }
    setError(null);
    onSave(sealTimeline([...hist, { cat, sub, from }]));
    setFrom("");
  };

  const remove = (i: number) => onSave(sealTimeline(hist.filter((_: any, x: number) => x !== i)));

  return (
    <SurfaceCard radius={16} pad="14px">
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: hist.length ? 10 : 12 }}>
        <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontWeight: 500, fontSize: 15.5, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {fullNameOf(player)}
        </span>
        <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, flexShrink: 0 }}>
          {shown ? "now " + shown.cat + " · " + shown.sub : "no level set"}
        </span>
      </div>

      {hist.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {sealTimeline(hist).map((h: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: i ? "0.5px solid " + FEED_HAIRLINE : undefined }}>
              <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_TEXT_HI }}>
                {h.cat} · {h.sub}
              </span>
              <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, flexShrink: 0 }}>
                {fmtBoundary(h.from)} – {fmtBoundary(h.to)}
              </span>
              {/* Not on a locked card. The timeline there is theirs, and a
                  delete would go out as an ordinary row save, be refused by
                  RLS, and — since updateRow started checking — come back as an
                  error. An offer that can only fail is worse than no offer. */}
              {mode !== "locked" && (
              <button
                onClick={() => remove(i)}
                aria-label={"Remove " + h.cat + " " + h.sub}
                style={{ background: "transparent", border: "none", padding: "2px 0 2px 4px", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
              >
                <X size={14} color={FEED_TEXT_LOW} strokeWidth={2} />
              </button>
              )}
            </div>
          ))}
        </div>
      )}

      {mode === "locked" ? (
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
          They have set this themselves, so it stands as written. Nothing for
          you to fill in.
        </div>
      ) : (
      <>
      <div style={{ display: "flex", gap: 6 }}>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ ...field, flex: 2, minWidth: 0 }}>
          {LEVELS.map((l: string) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={sub} onChange={(e) => setSub(e.target.value)} style={{ ...field, flex: 1, minWidth: 0 }}>
          {SUBS.map((s: string) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "stretch" }}>
        <input
          type="month"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setError(null); }}
          aria-label="Effective from"
          style={{ ...field, flex: 1, minWidth: 0, colorScheme: "dark" }}
        />
        <button
          onClick={add}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 10, padding: "0 14px", fontFamily: body, fontWeight: 500, fontSize: 13.5, cursor: "pointer", flexShrink: 0 }}
        >
          <Plus size={14} strokeWidth={2.4} />Add
        </button>
      </div>
      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 11.5, color: error ? "#F09595" : FEED_TEXT_MID, marginTop: 6, lineHeight: 1.4 }}>
        {failure || error || (mode === "estimate"
          ? "Your estimate, because they have an account and have set no level. It counts in this league only, never on the global table, and it stops counting the moment they set their own."
          : "Effective from — it runs until the next entry starts.")}
      </div>
      </>
      )}
    </SurfaceCard>
  );
}

export function LevelRepair({ players, setPlayers, meId, onEstimate }: {
  players: any[];
  setPlayers: (np: any[]) => void;
  meId?: string | null;
  onEstimate?: (id: string, level: any, history: any[]) => Promise<void>;
}) {
  const [showDone, setShowDone] = useState(false);
  // Anyone edited in this sitting stays in the working list even though they
  // now have a history. A progression is several entries, and a card that
  // jumps into a collapsed section the moment you add the first one takes
  // the second one with it.
  const [touched, setTouched] = useState<string[]>([]);

  /**
   * Whose save failed, and why — keyed by player.
   *
   * It was one message at the foot of the screen, which is the mistake §4
   * records in as many words: "the filter was correct and its result appeared
   * eight hundred pixels below the tap". Tapping Add on the second card of
   * twenty and having the reason print past the twentieth is that bug with
   * different coordinates. The message belongs on the card that produced it.
   */
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null);

  // Their own timeline if they have one, otherwise an admin estimate — the
  // same precedence the ratings read, so a name leaves this list exactly when
  // its matches start being graded. Counting only own timelines here would
  // show a club as unrepaired after it had been repaired.
  const timelineOf = (p: any) =>
    (p.levelHistory && p.levelHistory.length ? p.levelHistory : p.levelEstimateHistory) || [];

  /**
   * Which card to draw. Note what it does NOT consult: whether this viewer is
   * a league owner or editor.
   *
   * It used to, via canManage, and Sam opened the screen as the owner of
   * Seacourt to find George, Abbie and Jamie all showing "they have set this
   * themselves" — which was false for all three, none of whom has a timeline,
   * and which left him unable to do the one thing he had come to do. The
   * client's idea of his role was wrong; the database's was not.
   *
   * So the client stops guessing. set_player_level_estimate checks owner or
   * editor itself, server side, and raises a sentence meant for a person if
   * the answer is no — which the save path already puts on screen. That is
   * the same rule as the nudge in §5: the limit belongs in the database, and
   * a control disabled by the client is only ever a suggestion about it.
   *
   * "locked" is now reserved for the one case where it is true: they have a
   * timeline of their own, so there is genuinely nothing to fill in.
   */
  const modeOf = (p: any): "own" | "estimate" | "locked" => {
    if (!p.auth_id || p.id === meId) return "own";
    if (p.levelHistory && p.levelHistory.length) return "locked";
    return "estimate";
  };

  /**
   * Three groups, not two — and the third is the fix for a real complaint.
   *
   * Sam filled in a level for George, came back later, and could neither see
   * that it had worked nor do it again. It had worked: George has an account
   * and no timeline of his own, so what was saved was an admin estimate. But
   * an estimate counts as a timeline for grading, so on the next visit George
   * had silently moved into "already recorded" — a collapsed section behind a
   * "show the N" button, which is not a place you find somebody you are
   * looking for.
   *
   * So anything YOU filled in for somebody else gets its own group, always
   * open, sitting between the two. Visible, editable, and obviously yours.
   */
  const { missing, estimated, recorded } = useMemo(() => {
    const active = (players || []).filter((p: any) => !p.inactive);
    const theirOwn = (p: any) => !!(p.levelHistory && p.levelHistory.length);
    const myEstimate = (p: any) => !theirOwn(p) && !!(p.levelEstimateHistory && p.levelEstimateHistory.length);
    return {
      // Touched this sitting stays in the working list even once it has a
      // timeline: a progression is several entries, and a card that jumps out
      // of the list on the first one takes the second one with it.
      missing: active.filter((p: any) => (!timelineOf(p).length) || touched.includes(p.id)),
      estimated: active.filter((p: any) => myEstimate(p) && !touched.includes(p.id)),
      recorded: active.filter((p: any) => theirOwn(p) && !touched.includes(p.id)),
    };
  }, [players, touched, meId]);

  const save = async (id: string, periods: any[]) => {
    const player = players.find((p: any) => p.id === id);
    setTouched((t) => (t.includes(id) ? t : [...t, id]));
    setFailed((f) => (f && f.id === id ? null : f));
    if (player && modeOf(player) === "estimate") {
      // Not through setPlayers. That write is refused by RLS on any row with
      // an auth_id, correctly — an estimate goes to its own columns through
      // its own function. The latest period rides along as the estimated
      // level so one action fills in both, the same way finishing onboarding
      // sets a level from the last entry of your own timeline.
      const last = periods.length ? periods[periods.length - 1] : null;
      try {
        await onEstimate?.(id, last ? { cat: last.cat, sub: last.sub } : null, periods);
      } catch (e: any) {
        setFailed({ id, message: e?.message || "Couldn’t save that estimate." });
      }
      return;
    }
    setPlayers(players.map((p: any) => (p.id === id ? { ...p, levelHistory: periods } : p)));
  };

  const total = missing.length + recorded.length;
  const stillMissing = missing.filter((p: any) => !timelineOf(p).length).length;

  return (
    <div>
      <SurfaceCard radius={18} style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 16, color: FEED_TEXT_HI, marginBottom: 6 }}>
          {stillMissing} of {total} players have no level history
        </div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
          A match is judged on what both players were at the time. With nothing
          recorded there is nothing to judge it against, so those results count
          flat — no win is worth more than any other. Adding a level here
          regrades every past match against it straight away; nothing is
          stored, so it is safe to correct.
        </div>
      </SurfaceCard>

      {stillMissing === 0 && missing.length === 0 ? (
        <SurfaceCard radius={16} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Check size={16} color={FEED_LIME} strokeWidth={2.4} />
            <span style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI }}>Everybody has a history.</span>
          </div>
        </SurfaceCard>
      ) : (
        <>
          <div style={{ ...label, marginBottom: 8 }}>Not recorded</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
            {missing.map((p: any) => (
              <PlayerCard key={p.id} player={p} mode={modeOf(p)} onSave={(periods) => save(p.id, periods)} failure={failed && failed.id === p.id ? failed.message : null} />
            ))}
          </div>
        </>
      )}

      {estimated.length > 0 && (
        <>
          <div style={{ ...label, marginBottom: 8 }}>Your estimates</div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_LOW, lineHeight: 1.5, marginBottom: 10 }}>
            Levels you filled in for people who have an account but have not set
            one. They count in this league, and stop counting the moment that
            person sets their own.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
            {estimated.map((p: any) => (
              <PlayerCard key={p.id} player={p} mode={modeOf(p)} onSave={(periods) => save(p.id, periods)} failure={failed && failed.id === p.id ? failed.message : null} />
            ))}
          </div>
        </>
      )}

      {recorded.length > 0 && (
        <>
          <button
            onClick={() => setShowDone(!showDone)}
            style={{ ...label, background: "transparent", border: "none", padding: "4px 0", cursor: "pointer", display: "block", textAlign: "left" }}
          >
            {showDone ? "Hide" : "Show"} the {recorded.length} already recorded
          </button>
          {showDone && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              {recorded.map((p: any) => (
                <PlayerCard key={p.id} player={p} mode={modeOf(p)} onSave={(periods) => save(p.id, periods)} failure={failed && failed.id === p.id ? failed.message : null} />
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ height: 20 }} />
      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 11.5, color: FEED_TEXT_LOW, lineHeight: 1.5, background: FEED_CARD, borderRadius: 12, padding: 12 }}>
        Only active players are listed. Anyone with an account who has never
        set a level, a league owner or editor can estimate for — they can
        overwrite it any time, it counts in this league only, and it never
        reaches the global table.
      </div>
    </div>
  );
}
