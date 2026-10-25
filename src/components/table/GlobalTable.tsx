"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Info } from "lucide-react";
import { Empty } from "@/components/ui/atoms";
import { initialsOf } from "@/lib/format";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { LEVELS } from "@/core/constants";
import { ratingColumn } from "@/core/rankDisplay";
import { PROVISIONAL_GAMES, loadGlobalStandings, type GlobalRow } from "@/lib/globalTable";
import { FEED_BAR, FEED_CARD, FEED_DEEP, FEED_HERO, FEED_LIME, FEED_LIME_INK, FEED_LIME_INK_2, FEED_ON_HERO, FEED_RADIUS, FEED_RAISED, FEED_TEXT_DIM, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, FEED_THEY_LEAD, LEVEL_RAMP, body, tabular, tight } from "@/lib/theme";

// A league that nobody created. Every person you can see, ranked on their own
// record wherever they play — see src/lib/globalTable.ts for why that is the
// only honest way to put two leagues in one table.
//
// **Provisional players are not ranked.** They used to hold places in the
// same list while the row said "too few games to place yet", and both of
// those cannot be true: Hugh sat first on three matches and Mike second on
// two, above a man with forty-four. The rating still reads every one of their
// results — nothing about the maths changed — but a place number is a claim
// about where somebody stands, and PROVISIONAL_GAMES is where this app is
// willing to make it. They get their own group with a count instead, so you can see
// how close they are to being placed.

/**
 * The population bar's colours, light to dark by level.
 *
 * Their own five values, not the difficulty vocabulary in core/difficulty.ts
 * and not the brand palette: this is one continuous scale where the only
 * meaning is "further along", and a scale needs to be read as a scale. Only
 * the top of it lands on the brand lime, which is where the strongest players
 * are and where the eye should finish.
 */
// Six steps from the quietest surface to the accent, out of LEVEL_RAMP so a
// theme can re-tune the whole ladder in one block. The old ramp climbed to
// lime; this one climbs to gold, and Semi-pro and Pro still share the top
// step for the reason the comment above gives.
const LEVEL_COLOUR: Record<string, string> = {
  Beginner: LEVEL_RAMP[0],
  Amateur: LEVEL_RAMP[1],
  Intermediate: LEVEL_RAMP[2],
  Advanced: LEVEL_RAMP[3],
  "Semi-pro": LEVEL_RAMP[4],
  Pro: LEVEL_RAMP[5],
};
const NO_LEVEL_COLOUR = FEED_TEXT_DIM;

const label: React.CSSProperties = {
  fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID,
  letterSpacing: 0,
};

const rec = (r: { w: number; d: number; l: number }) => (r.d > 0 ? `${r.w}–${r.d}–${r.l}` : `${r.w}–${r.l}`);
const winRate = (r: GlobalRow) => (r.gp ? Math.round(((r.w + r.d * 0.5) / r.gp) * 100) : null);

/** Full name, always. Surnames are load-bearing — two Charlies, three Henrys. */
const nameOf = (r: GlobalRow) => r.name + (r.last ? " " + r.last : "");

/**
 * One subtitle format for every row, because three formats on one list makes
 * the reader work out which question each row is answering.
 */
const statusOf = (r: GlobalRow) => {
  const lv = r.level?.cat || "No level";
  const claim = !r.claimed ? "unclaimed" : r.leagues > 1 ? r.leagues + " clubs" : "1 club";
  return lv + " · " + claim;
};

/** Never wraps. A wrapped name changes row height and breaks the column. */
const nameStyle: React.CSSProperties = {
  display: "block", fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em",
};

// The Global table draws its own face rather than using ui/Avatar, because a
// global row is not a player row — it is an aggregate keyed by account.
//
// Which is why the avatar cleanup missed it. Avatar.tsx stopped rendering a
// stored id AS an emoji weeks ago; this component still did, so Zaach's 🟣
// went on showing as an operating-system purple circle on Global and Sam
// reported it as unfixed. It was: on the other screen.
//
// Same treatment as ui/Avatar and the Messages rows now — drawn art where we
// have it, an initial otherwise, one background for every face. If the two
// ever need to differ, they need to differ ON PURPOSE, and a comment.
function Face({ row, size = 38, dim }: { row: GlobalRow; size?: number; dim?: boolean }) {
  const common = { width: size, height: size, borderRadius: "50%", flexShrink: 0, opacity: dim ? 0.55 : 1 } as const;
  if (row.avatarUrl) return <img src={row.avatarUrl} alt="" style={{ ...common, objectFit: "cover" }} />;
  // Initials otherwise — the same rule as ui/Avatar, stated twice because
  // this table draws its own face from an aggregate row rather than a player
  // row. If one of them changes, the other has to.
  return (
    <span
      aria-hidden="true"
      style={{
        ...common, display: "inline-grid", placeItems: "center", background: FEED_RAISED,
        fontFamily: body, fontWeight: 600, fontSize: size * 0.34, letterSpacing: 0.3, color: FEED_TEXT_LOW,
      }}
    >
      {initialsOf(row.name)}
    </span>
  );
}

// A global row is keyed by auth id, or by "p:<player id>" for somebody who
// has never claimed an account. Either can point at a player in the league
// you're looking at — and if it does, we can open their real profile rather
// than the summary. If it doesn't, they're someone from a league we can only
// see the outside of, and there is no profile to open.
function resolvePlayer(key: string, players: any[] | undefined) {
  if (!players || !players.length) return null;
  if (key.startsWith("p:")) return players.find((p) => p.id === key.slice(2)) || null;
  return players.find((p) => p.auth_id === key) || null;
}

/** (2) The header. The explainer lives behind the info icon. */
function Header({ onBack }: { onBack?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {onBack && (
          <button onClick={onBack} aria-label="Back" style={{ background: "transparent", border: "none", padding: "0 4px 0 0", cursor: "pointer", display: "grid", placeItems: "center" }}>
            <ChevronLeft size={22} color={FEED_LIME} strokeWidth={2} />
          </button>
        )}
        <span style={{ ...tight(28), fontFamily: body, fontWeight: 600, fontSize: 28, letterSpacing: "-0.035em", color: FEED_TEXT_HI }}>
          Global
        </span>
      </div>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_MID }}>
          Everyone you&apos;ve played, on their own record
        </span>
        <Info size={13} color={open ? FEED_LIME : FEED_TEXT_MID} strokeWidth={2} style={{ flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.55, marginTop: 10, background: FEED_CARD, borderRadius: 14, padding: 14 }}>
          Everyone you&apos;ve crossed paths with, ranked on their own record in their own leagues — not on the matches they played against us. Level is only a starting assumption: the more someone plays their own level or better, the more their results decide their place and the less their claimed level does. Nobody has to set a level to be ranked — without one we simply assume the middle and let the results talk.
        </div>
      )}
    </div>
  );
}

/** (3) Who is actually in here, as one bar rather than five chips. */
function Distribution({ rows }: { rows: GlobalRow[] }) {
  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    let none = 0;
    for (const r of rows) {
      if (!r.level?.cat) { none++; continue; }
      by[r.level.cat] = (by[r.level.cat] || 0) + 1;
    }
    const out = LEVELS.filter((c: string) => by[c]).map((c: string) => ({ label: c, n: by[c], colour: LEVEL_COLOUR[c] || NO_LEVEL_COLOUR }));
    if (none) out.push({ label: "no level set", n: none, colour: NO_LEVEL_COLOUR });
    return out;
  }, [rows]);

  if (!counts.length) return null;
  const total = counts.reduce((s, c) => s + c.n, 0);

  return (
    <SurfaceCard radius={18} style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={label}>Ranked players</span>
        <span style={{ ...tabular, ...tight(22), fontFamily: body, fontWeight: 600, fontSize: 22, color: FEED_TEXT_HI }}>{total}</span>
      </div>
      {/* One bar, so the shape of the population is a shape. Five separate
          chips read as tappable filters when they are statistics, and they
          hid that beginners are more than half of everybody. */}
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: FEED_DEEP, marginTop: 12 }}>
        {counts.map((c) => <div key={c.label} style={{ flex: c.n, background: c.colour }} />)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10 }}>
        {counts.map((c) => (
          <span key={c.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c.colour, flexShrink: 0 }} />
            <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 11, color: FEED_TEXT_MID }}>
              {c.n} {c.label.toLowerCase()}
            </span>
          </span>
        ))}
      </div>
    </SurfaceCard>
  );
}

/** A drawn globe, in the accent, for the world card. */
function Globe({ size = 92 }: { size?: number }) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try { setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { /* animate */ }
  }, []);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ flexShrink: 0 }}>
      <g fill="none" stroke={FEED_LIME} strokeWidth="2.2" strokeLinecap="round">
        <circle cx="50" cy="50" r="40" />
        {/* The meridians sweep across once when the page opens — the globe
            turns half a revolution and settles, rather than spinning on a
            screen somebody is reading. SVG's own animation, so it looks
            the same on every phone; reduced motion skips it. */}
        <ellipse cx="50" cy="50" rx="16" ry="40">
          {!reduced && <animate attributeName="rx" values="40;0;16" keyTimes="0;0.6;1" dur="2.4s" fill="freeze" />}
        </ellipse>
        <ellipse cx="50" cy="50" rx="31" ry="40" opacity="0.55">
          {!reduced && <animate attributeName="rx" values="12;40;31" keyTimes="0;0.45;1" dur="2.4s" fill="freeze" />}
        </ellipse>
        <line x1="10" y1="50" x2="90" y2="50" />
        <path d="M16 30 Q50 38 84 30" opacity="0.7" />
        <path d="M16 70 Q50 62 84 70" opacity="0.7" />
      </g>
      {/* A ball in orbit. */}
      <circle cx="82" cy="20" r="7" fill={FEED_LIME} />
    </svg>
  );
}

/** The top of the screen: how many people, how many clubs, a globe. */
function WorldCard({ rows }: { rows: GlobalRow[] }) {
  const clubs = rows.reduce((m, r) => Math.max(m, r.leagues || 0), 0);
  const multi = rows.filter((r) => (r.leagues || 0) > 1).length;
  return (
    <SurfaceCard radius={22} pad="18px 18px" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...tabular, ...tight(40), fontFamily: body, fontWeight: 700, fontSize: 40, color: FEED_TEXT_HI, lineHeight: 1 }}>{rows.length}</div>
        <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, marginTop: 6 }}>players ranked worldwide</div>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 3, lineHeight: 1.45 }}>
          Everyone you&apos;ve played, and everyone they&apos;ve played{multi ? ` · ${multi} play in ${clubs > 2 ? "several" : "two"} clubs` : ""}
        </div>
      </div>
      <Globe />
    </SurfaceCard>
  );
}

const MEDAL = ["#B8955A", "#A7A9AC", "#A97142"];

/** The top three: first in the middle and highest, gold, silver, bronze. */
function Podium({ rows, ratings, myAuthId, openFor }: { rows: GlobalRow[]; ratings: string[]; myAuthId?: string | null; openFor: (r: GlobalRow) => (() => void) | undefined }) {
  const order = rows.length >= 3 ? [1, 0, 2] : rows.length === 2 ? [1, 0] : [0];
  // First highest, second next, third lowest (Sam: third sat above second).
  const lift = [26, 12, 0];
  return (
    <SurfaceCard radius={22} pad="16px 10px 14px" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 6 }}>
        {order.map((i) => {
          const r = rows[i];
          const first = i === 0;
          const size = first ? 72 : 56;
          return (
            <div key={r.key} onClick={openFor(r)} style={{ flex: 1, minWidth: 0, textAlign: "center", cursor: openFor(r) ? "pointer" : "default", paddingBottom: lift[i] }}>
              <div style={{ position: "relative", width: size + 8, height: size + 8, margin: "0 auto" }}>
                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${MEDAL[i]}`, boxSizing: "border-box" }} />
                <span style={{ position: "absolute", inset: 4 }}><Face row={r} size={size} /></span>
                <span style={{ ...tabular, position: "absolute", right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, background: MEDAL[i], color: "#fff", fontFamily: body, fontWeight: 700, fontSize: 13, display: "grid", placeItems: "center", boxShadow: "0 0 0 2px var(--bg-card, #fff)" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: body, fontWeight: 700, fontSize: first ? 15.5 : 14, color: FEED_TEXT_HI, marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 2px" }}>
                {r.name}{r.last ? " " + r.last.charAt(0) + "." : ""}
              </div>
              {!!myAuthId && r.key === myAuthId && <div style={{ fontFamily: body, fontWeight: 600, fontSize: 10.5, color: FEED_LIME_INK, background: FEED_LIME, borderRadius: 999, padding: "1px 7px", display: "inline-block", marginTop: 3 }}>you</div>}
              <div style={{ ...tabular, fontFamily: body, fontWeight: 700, fontSize: first ? 20 : 17, color: FEED_TEXT_HI, marginTop: 4 }}>{ratings[i]}</div>
              <div style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 11.5, color: FEED_TEXT_MID }}>{rec(r)}</div>
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}

/** (4) The leader, on the accent card. */
function LeaderCard({ r, rating, onOpen }: { r: GlobalRow; rating: string; onOpen?: () => void }) {
  const pct = winRate(r);
  return (
    <div
      onClick={onOpen}
      style={{ background: FEED_HERO, color: FEED_ON_HERO, borderRadius: FEED_RADIUS, padding: 18, cursor: onOpen ? "pointer" : "default", marginBottom: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Face row={r} size={50} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_LIME_INK_2, letterSpacing: 0 }}>Top ranked</div>
          <div style={{ ...tight(19), fontFamily: body, fontWeight: 600, fontSize: 19, color: FEED_LIME_INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {nameOf(r)}
          </div>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 12.5, color: FEED_LIME_INK_2, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {statusOf(r)}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ ...tabular, ...tight(24), fontFamily: body, fontWeight: 600, fontSize: 24, color: FEED_LIME_INK }}>{rec(r)}</div>
          <div style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_LIME_INK_2, marginTop: 2 }}>
            {pct === null ? "—" : pct + "% won"} · {rating}
          </div>
        </div>
      </div>
    </div>
  );
}

/** (5) A ranked row, with the rating drawn behind it. */
function Row({ r, place, rating, fraction, isMe, onOpen }: any) {
  return (
    <div
      onClick={onOpen}
      style={{
        position: "relative", background: FEED_CARD, borderRadius: 14, overflow: "hidden",
        border: isMe ? "1.5px solid " + FEED_LIME : "1.5px solid transparent",
        cursor: onOpen ? "pointer" : "default",
      }}
    >
      {/* The bar is the rating, scaled from the lowest on screen to the
          highest — see the Table's barFraction for why not from zero. */}
      <div style={{ position: "absolute", inset: 0, width: fraction * 100 + "%", background: FEED_BAR, pointerEvents: "none" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 11, padding: "11px 13px" }}>
        <span style={{ ...tabular, fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_TEXT_MID, width: 20, flexShrink: 0 }}>
          {place}
        </span>
        <Face row={r} size={38} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ ...nameStyle, flex: 1, minWidth: 0 }}>{nameOf(r)}</span>
            {isMe && (
              <span style={{ fontFamily: body, fontWeight: 600, fontSize: 10.5, color: FEED_LIME_INK, background: FEED_LIME, borderRadius: 999, padding: "1px 7px", flexShrink: 0 }}>you</span>
            )}
          </span>
          <span style={{ display: "block", fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_MID, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {statusOf(r)}
          </span>
        </span>
        <span style={{ textAlign: "right", flex: "none" }}>
          <span style={{ ...tabular, display: "block", fontFamily: body, fontWeight: 600, fontSize: 14.5, color: FEED_TEXT_HI }}>{rec(r)}</span>
          <span style={{ ...tabular, display: "block", fontFamily: body, fontWeight: 500, fontSize: 11.5, color: FEED_TEXT_LOW, marginTop: 1 }}>{rating}</span>
        </span>
      </div>
    </div>
  );
}

/** (7) Everybody the app will not put a number on yet. */
function ProvisionalGroup({ rows, myKey, onOpenFor }: { rows: GlobalRow[]; myKey?: string | null; onOpenFor: (r: GlobalRow) => (() => void) | undefined }) {
  if (!rows.length) return null;
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={label}>Provisional</span>
        <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_MID }}>{rows.length}</span>
      </div>
      <div style={{ fontFamily: body, fontWeight: 500, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.5, marginBottom: 10 }}>
        Their results count towards everyone else&apos;s rating, but {PROVISIONAL_GAMES} matches
        are needed before we put a number on where they stand.
      </div>
      <SurfaceCard radius={16} pad={0} clip>
        {rows.map((r, i) => (
          <button
            key={r.key}
            onClick={onOpenFor(r)}
            style={{
              display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
              background: r.key === myKey ? FEED_RAISED : "transparent", border: "none",
              padding: "11px 13px", cursor: onOpenFor(r) ? "pointer" : "default",
              borderTop: i ? "0.5px solid " + FEED_RAISED : "none",
            }}
          >
            <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_LOW, width: 20, flexShrink: 0 }}>–</span>
            <Face row={r} size={34} dim />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ ...nameStyle, fontSize: 14.5, color: FEED_TEXT_HI }}>{nameOf(r)}</span>
              <span style={{ ...tabular, display: "block", fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_MID, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {(r.level?.cat || "No level")}{r.level?.sub ? " · " + String(r.level.sub).toLowerCase() : ""} · {r.gp} played
              </span>
            </span>
            <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_MID, flex: "none" }}>{rec(r)}</span>
          </button>
        ))}
      </SurfaceCard>
    </div>
  );
}

export function GlobalTable({ myAuthId, players, onOpenProfile, onBack }: {
  myAuthId?: string | null;
  players?: any[];
  onOpenProfile?: (id: string) => void;
  onBack?: () => void;
}) {
  const [rows, setRows] = useState<GlobalRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadGlobalStandings()
      .then((r) => { if (alive) { setRows(r); setErr(null); } })
      .catch((e) => { if (alive) setErr(e?.message || "Could not load the global table."); });
    return () => { alive = false; };
  }, []);

  if (err) {
    return (
      <>
        <Header onBack={onBack} />
        <SurfaceCard radius={18}>
          <div style={{ fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_THEY_LEAD }}>Global table unavailable.</div>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, marginTop: 6 }}>{err}</div>
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 12.5, color: FEED_TEXT_LOW, lineHeight: 1.5, marginTop: 8 }}>
            If this says the function is missing, the one-off SQL in supabase/schema_global_standings.sql hasn&apos;t been run yet.
          </div>
        </SurfaceCard>
      </>
    );
  }
  if (!rows) return <><Header onBack={onBack} /><Empty msg="Loading the global table…" /></>;
  if (!rows.length) return <><Header onBack={onBack} /><Empty msg="Nobody to rank yet." /></>;

  return <GlobalStandingsList rows={rows} myAuthId={myAuthId} players={players} onOpenProfile={onOpenProfile} onBack={onBack} />;
}

export function GlobalStandingsList({ rows, myAuthId, players, onOpenProfile, onBack }: {
  rows: GlobalRow[];
  myAuthId?: string | null;
  players?: any[];
  onOpenProfile?: (id: string) => void;
  onBack?: () => void;
}) {
  // (1) The split. Order is untouched — this only decides who gets a number.
  const ranked = rows.filter((r) => !r.provisional);
  const provisional = rows.filter((r) => r.provisional);

  // The rating is what orders this table, so it is drawn rather than left to
  // be inferred from a W–D–L that does not imply it. Same column formatting
  // as the Table: whole numbers until two neighbours would print the same.
  const display = ratingColumn(ranked.map((r) => r.score));
  const scores = ranked.map((r) => r.score).filter((v) => Number.isFinite(v));
  const min = scores.length ? Math.min(...scores) : 0;
  const max = scores.length ? Math.max(...scores) : 1;
  const fractionOf = (v: number) => (!Number.isFinite(v) || max <= min ? 0 : Math.max(0, Math.min(1, (v - min) / (max - min))));

  // A photo the global row lacks but your club has — your own, most often
  // (Sam's row showed initials). The club's row for the same account or
  // player supplies it.
  const withFace = (r: GlobalRow): GlobalRow => (r.avatarUrl ? r : { ...r, avatarUrl: resolvePlayer(r.key, players)?.avatarUrl ?? null });

  const openFor = (r: GlobalRow) => {
    const p = onOpenProfile ? resolvePlayer(r.key, players) : null;
    return p && onOpenProfile ? () => onOpenProfile(p.id) : undefined;
  };

  // The top three on a podium, everyone else below.
  const podium = ranked.slice(0, 3).map(withFace);
  const rest = ranked.slice(3).map(withFace);

  return (
    <>
      <Header onBack={onBack} />
      <WorldCard rows={ranked} />
      {podium.length > 0 && <Podium rows={podium} ratings={display.slice(0, 3)} myAuthId={myAuthId} openFor={openFor} />}

      {rest.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={label}>Ranked</span>
            {/* (8) Name the metric. The order follows this column, not the
                records beside it. */}
            <span style={label}>Rating</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rest.map((r, i) => (
              <Row
                key={r.key}
                r={r}
                place={i + 4}
                rating={display[i + 3]}
                fraction={fractionOf(r.score)}
                isMe={!!myAuthId && r.key === myAuthId}
                onOpen={openFor(r)}
              />
            ))}
          </div>
        </>
      )}

      <ProvisionalGroup rows={provisional.map(withFace)} myKey={myAuthId} onOpenFor={openFor} />
      <div style={{ marginTop: 16 }}><Distribution rows={ranked} /></div>
    </>
  );
}
