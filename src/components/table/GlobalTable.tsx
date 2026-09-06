"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Info } from "lucide-react";
import { Empty } from "@/components/ui/atoms";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { LEVELS } from "@/core/constants";
import { ratingColumn } from "@/core/rankDisplay";
import { PROVISIONAL_GAMES, loadGlobalStandings, type GlobalRow } from "@/lib/globalTable";
import {
  FEED_BAR, FEED_CARD, FEED_DEEP, FEED_LIME, FEED_LIME_INK, FEED_LIME_INK_2,
  FEED_RAISED, FEED_TEXT_DIM, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, FEED_THEY_LEAD,
  body, tabular, tight,
} from "@/lib/theme";

// A league that nobody created. Every person you can see, ranked on their own
// record wherever they play — see src/lib/globalTable.ts for why that is the
// only honest way to put two leagues in one table.
//
// **Provisional players are not ranked.** They used to hold places in the
// same list while the row said "too few games to place yet", and both of
// those cannot be true: Hugh sat first on three matches and Mike second on
// two, above a man with forty-four. The rating still reads every one of their
// results — nothing about the maths changed — but a place number is a claim
// about where somebody stands, and ten matches is where this app is willing
// to make it. They get their own group with a count instead, so you can see
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
const LEVEL_COLOUR: Record<string, string> = {
  Beginner: "#3E6E56",
  Amateur: "#5B8F72",
  Intermediate: "#8FB86A",
  Advanced: "#BCD65C",
  "Semi-pro": "#D9E84B",
  Pro: "#D9E84B",
};
const NO_LEVEL_COLOUR = FEED_TEXT_DIM;

const label: React.CSSProperties = {
  fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID,
  textTransform: "uppercase", letterSpacing: 0.8,
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
  const claim = !r.claimed ? "unclaimed" : r.leagues > 1 ? r.leagues + " leagues" : "1 league";
  return lv + " · " + claim;
};

/** Never wraps. A wrapped name changes row height and breaks the column. */
const nameStyle: React.CSSProperties = {
  display: "block", fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em",
};

function Face({ row, size = 38, dim }: { row: GlobalRow; size?: number; dim?: boolean }) {
  const common = { width: size, height: size, borderRadius: "50%", flexShrink: 0, opacity: dim ? 0.55 : 1 } as const;
  if (row.avatarUrl) return <img src={row.avatarUrl} alt="" style={{ ...common, objectFit: "cover" }} />;
  return (
    <span style={{ ...common, display: "grid", placeItems: "center", background: FEED_RAISED, fontSize: size * 0.46 }}>
      {row.avatar || (row.name || "?").charAt(0).toUpperCase()}
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
        <span style={{ ...tight(28), fontFamily: body, fontWeight: 500, fontSize: 28, letterSpacing: "-0.035em", color: FEED_TEXT_HI }}>
          Global
        </span>
      </div>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID }}>
          Everyone you&apos;ve played, on their own record
        </span>
        <Info size={13} color={open ? FEED_LIME : FEED_TEXT_MID} strokeWidth={2} style={{ flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.55, marginTop: 10, background: FEED_CARD, borderRadius: 14, padding: 14 }}>
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
        <span style={{ ...tabular, ...tight(22), fontFamily: body, fontWeight: 500, fontSize: 22, color: FEED_TEXT_HI }}>{total}</span>
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
            <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID }}>
              {c.n} {c.label.toLowerCase()}
            </span>
          </span>
        ))}
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
      style={{ background: FEED_LIME, borderRadius: 20, padding: 18, cursor: onOpen ? "pointer" : "default", marginBottom: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Face row={r} size={50} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_LIME_INK_2, textTransform: "uppercase", letterSpacing: 0.6 }}>Top ranked</div>
          <div style={{ ...tight(19), fontFamily: body, fontWeight: 500, fontSize: 19, color: FEED_LIME_INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {nameOf(r)}
          </div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_LIME_INK_2, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {statusOf(r)}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ ...tabular, ...tight(24), fontFamily: body, fontWeight: 500, fontSize: 24, color: FEED_LIME_INK }}>{rec(r)}</div>
          <div style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_LIME_INK_2, marginTop: 2 }}>
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
        <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_MID, width: 20, flexShrink: 0 }}>
          {place}
        </span>
        <Face row={r} size={38} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ ...nameStyle, flex: 1, minWidth: 0 }}>{nameOf(r)}</span>
            {isMe && (
              <span style={{ fontFamily: body, fontWeight: 500, fontSize: 10.5, color: FEED_LIME_INK, background: FEED_LIME, borderRadius: 999, padding: "1px 7px", flexShrink: 0 }}>you</span>
            )}
          </span>
          <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {statusOf(r)}
          </span>
        </span>
        <span style={{ textAlign: "right", flex: "none" }}>
          <span style={{ ...tabular, display: "block", fontFamily: body, fontWeight: 500, fontSize: 14.5, color: FEED_TEXT_HI }}>{rec(r)}</span>
          <span style={{ ...tabular, display: "block", fontFamily: body, fontWeight: 400, fontSize: 11.5, color: FEED_TEXT_LOW, marginTop: 1 }}>{rating}</span>
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
        <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID }}>{rows.length}</span>
      </div>
      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.5, marginBottom: 10 }}>
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
            <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_LOW, width: 20, flexShrink: 0 }}>–</span>
            <Face row={r} size={34} dim />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ ...nameStyle, fontSize: 14.5, color: FEED_TEXT_HI }}>{nameOf(r)}</span>
              <span style={{ ...tabular, display: "block", fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {(r.level?.cat || "No level")}{r.level?.sub ? " · " + String(r.level.sub).toLowerCase() : ""} · {r.gp} played
              </span>
            </span>
            <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 14, color: FEED_TEXT_MID, flex: "none" }}>{rec(r)}</span>
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
          <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_THEY_LEAD }}>Global table unavailable.</div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, marginTop: 6 }}>{err}</div>
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_LOW, lineHeight: 1.5, marginTop: 8 }}>
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

  const openFor = (r: GlobalRow) => {
    const p = onOpenProfile ? resolvePlayer(r.key, players) : null;
    return p && onOpenProfile ? () => onOpenProfile(p.id) : undefined;
  };

  const leader = ranked[0];
  const rest = ranked.slice(1);

  return (
    <>
      <Header onBack={onBack} />
      <Distribution rows={ranked} />
      {leader && <LeaderCard r={leader} rating={display[0]} onOpen={openFor(leader)} />}

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
                place={i + 2}
                rating={display[i + 1]}
                fraction={fractionOf(r.score)}
                isMe={!!myAuthId && r.key === myAuthId}
                onOpen={openFor(r)}
              />
            ))}
          </div>
        </>
      )}

      <ProvisionalGroup rows={provisional} myKey={myAuthId} onOpenFor={openFor} />
    </>
  );
}
