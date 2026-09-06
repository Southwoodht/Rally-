"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { Globe } from "@/components/ui/Globe";
import { Empty } from "@/components/ui/atoms";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { LEVELS } from "@/core/constants";
import { loadGlobalStandings, type GlobalRow } from "@/lib/globalTable";
import {
  FEED_CARD, FEED_DEEP, FEED_HAIRLINE, FEED_LIME, FEED_RAISED, FEED_TEXT_DIM,
  FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, FEED_THEY_LEAD, body, tabular,
} from "@/lib/theme";

// A league that nobody created. Every person you can see, ranked on their own
// record wherever they play — see src/lib/globalTable.ts for why that is the
// only honest way to put two leagues in one table.

// Podium colours. Deliberately their own three values and not the difficulty
// vocabulary in core/difficulty.ts, which also owns a gold and a silver: that
// palette means "how hard was this opponent" and reusing it here would have
// one colour saying two different things on two screens. Not brand tokens
// either — first, second and third are the same three colours everywhere.
const PODIUM = ["#e3c14e", "#c3cad1", "#c07a45"];

const label: React.CSSProperties = {
  fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID,
  textTransform: "uppercase", letterSpacing: 0.8,
};

function Face({ row, size = 34, ring }: { row: GlobalRow; size?: number; ring?: string }) {
  const common = {
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    boxShadow: ring ? "0 0 0 2px " + ring : undefined,
  } as const;
  if (row.avatarUrl) return <img src={row.avatarUrl} alt="" style={{ ...common, objectFit: "cover" }} />;
  return (
    <span style={{ ...common, display: "grid", placeItems: "center", background: FEED_RAISED, fontSize: size * 0.46 }}>
      {row.avatar || (row.name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

const rec = (w: number, d: number, l: number) => `${w}–${d}–${l}`;

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

function Row({ row, place, isMe, open, onToggle, onOpenProfile, last }: any) {
  const r: GlobalRow = row;
  const podium = place <= 3 ? PODIUM[place - 1] : null;
  // A podium place held on a handful of matches is drawn lighter than one
  // held on a career. It is still first; it is just not as certain, and the
  // eye should get that before the caption does.
  const thin = !!r.provisional;

  return (
    <div
      style={{
        borderLeft: podium ? "3px solid " + podium : "3px solid transparent",
        opacity: thin && podium ? 0.82 : 1,
        borderBottom: last || open ? undefined : "0.5px solid " + FEED_HAIRLINE,
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch", background: isMe ? FEED_RAISED : "transparent" }}>
        <button
          onClick={onOpenProfile || onToggle}
          style={{
            display: "flex", alignItems: "center", gap: 11, flex: 1, minWidth: 0, textAlign: "left",
            background: "transparent", border: "none", padding: "12px 4px 12px 12px", cursor: "pointer",
          }}
        >
          <span
            style={{
              ...tabular, fontFamily: body, fontWeight: 500, fontSize: podium ? 16 : 14,
              color: podium || (place ? FEED_TEXT_MID : FEED_TEXT_DIM),
              width: 22, flexShrink: 0, opacity: thin ? 0.7 : 1,
            }}
          >
            {place ? place : "–"}
          </span>
          <Face row={r} ring={podium || undefined} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
                {r.name}{r.last ? " " + r.last : ""}
              </span>
              {r.level && <LevelBadge level={r.level} tiny />}
            </span>
            <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, marginTop: 2 }}>
              {r.provisional ? "Provisional — " + r.gp + (r.gp === 1 ? " match" : " matches") : r.leagues > 1 ? r.leagues + " leagues" : r.claimed ? "1 league" : "not claimed — our leagues only"}
            </span>
          </span>
          <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 14.5, color: FEED_TEXT_HI, flexShrink: 0 }}>{rec(r.w, r.d, r.l)}</span>
        </button>
        {/* Drawn, not typed. A "›" is punctuation whose shape the font
            decides; every other arrow in the app is an icon. */}
        <button
          onClick={onToggle}
          aria-label={open ? "Hide details" : "Show details"}
          style={{ background: "transparent", border: "none", padding: "0 12px 0 8px", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
        >
          {open
            ? <ChevronDown size={16} color={FEED_LIME} strokeWidth={2} />
            : <ChevronRight size={16} color={FEED_LIME} strokeWidth={2} />}
        </button>
      </div>
      {open && (
        <div style={{ background: FEED_DEEP, borderRadius: 12, margin: "0 12px 12px", padding: "12px 14px" }}>
          <Line label="Record, all leagues" value={rec(r.w, r.d, r.l)} />
          <Line
            label="Against their own level or better"
            value={r.qgp ? rec(r.qw, r.qd, r.ql) : "none yet"}
            mutedValue={!r.qgp}
          />
          <Line label="Leagues" value={String(r.leagues)} />
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, lineHeight: 1.5, marginTop: 10, borderTop: "0.5px solid " + FEED_RAISED, paddingTop: 10 }}>
            {r.claimed
              ? "Ranked on every match they've played, in every league they're in — not just the ones against us."
              : "This player hasn't claimed their profile, so this is only what our leagues have seen of them. Their real record may be very different."}
          </div>
          {!onOpenProfile && (
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, lineHeight: 1.5, marginTop: 6 }}>
              They don&apos;t play in this league, so there&apos;s no profile here to open — this is everything we can see of them.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Line({ label: text, value, mutedValue }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
      <span style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, flex: 1 }}>{text}</span>
      <span style={{ ...(mutedValue ? {} : tabular), fontFamily: body, fontWeight: mutedValue ? 400 : 500, fontSize: 13, color: mutedValue ? FEED_TEXT_LOW : FEED_TEXT_HI }}>{value}</span>
    </div>
  );
}

// Who's actually in here, by claimed level. Worth stating rather than leaving
// someone to count the badges: a table of twenty is a different thing
// depending on whether it's twenty beginners or four pros and sixteen
// beginners, and the place numbers alone don't say which.
function Makeup({ rows }: { rows: GlobalRow[] }) {
  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    let none = 0;
    for (const r of rows) {
      if (!r.level) { none++; continue; }
      by[r.level.cat] = (by[r.level.cat] || 0) + 1;
    }
    const out = LEVELS.filter((c) => by[c]).map((c) => ({ label: c, n: by[c] }));
    if (none) out.push({ label: "no level set", n: none });
    return out;
  }, [rows]);

  if (!counts.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
      {counts.map((c) => (
        <span key={c.label} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: FEED_CARD, borderRadius: 999, padding: "5px 11px" }}>
          <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 12.5, color: FEED_LIME }}>{c.n}</span>
          <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID }}>{c.label}</span>
        </span>
      ))}
    </div>
  );
}

export function GlobalTable({ myAuthId, players, onOpenProfile }: { myAuthId?: string | null; players?: any[]; onOpenProfile?: (id: string) => void }) {
  const [rows, setRows] = useState<GlobalRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadGlobalStandings()
      .then((r) => { if (alive) { setRows(r); setErr(null); } })
      .catch((e) => { if (alive) setErr(e?.message || "Could not load the global table."); });
    return () => { alive = false; };
  }, []);

  if (err) {
    return (
      <SurfaceCard radius={18}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_THEY_LEAD }}>Global table unavailable.</div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5, marginTop: 6 }}>{err}</div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_LOW, lineHeight: 1.5, marginTop: 8 }}>
          If this says the function is missing, the one-off SQL in supabase/schema_global_standings.sql hasn&apos;t been run yet.
        </div>
      </SurfaceCard>
    );
  }
  if (!rows) return <Empty msg="Loading the global table…" />;
  if (!rows.length) return <Empty msg="Nobody to rank yet." />;

  return <GlobalStandingsList rows={rows} myAuthId={myAuthId} players={players} onOpenProfile={onOpenProfile} open={open} setOpen={setOpen} />;
}

// One table, everybody in it. Unrated players used to be listed underneath
// in their own block with no place number, which sounds neutral and isn't: it
// put a 6-3-10 record below a 0-0-1 one. Somebody who hasn't set a level is
// placed on their record like anyone else, and their row still shows no level
// badge, so nothing presents them as having claimed one.
export function GlobalStandingsList({
  rows, myAuthId, players, onOpenProfile, open, setOpen,
}: {
  rows: GlobalRow[];
  myAuthId?: string | null;
  players?: any[];
  onOpenProfile?: (id: string) => void;
  open?: string | null;
  setOpen?: (k: string | null) => void;
}) {
  const [ownOpen, setOwnOpen] = useState<string | null>(null);
  const openKey = open !== undefined ? open : ownOpen;
  const toggle = setOpen || setOwnOpen;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
        <Globe size={20} />
        <span style={label}>Everyone, everywhere</span>
        <span style={{ flex: 1 }} />
        <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_HI }}>{rows.length}</span>
        <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID }}>ranked</span>
      </div>
      <Makeup rows={rows} />
      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.55, marginBottom: 14 }}>
        Everyone you&apos;ve crossed paths with, ranked on their own record in their own leagues — not on the matches they played against us. Level is only a starting assumption: the more someone plays their own level or better, the more their results decide their place and the less their claimed level does. Nobody has to set a level to be ranked — without one we simply assume the middle and let the results talk.
      </div>
      <SurfaceCard radius={18} pad={0} clip>
        {rows.map((r, i) => {
          const p = onOpenProfile ? resolvePlayer(r.key, players) : null;
          return (
            <Row
              key={r.key}
              row={r}
              place={i + 1}
              isMe={!!myAuthId && r.key === myAuthId}
              open={openKey === r.key}
              last={i === rows.length - 1}
              onToggle={() => toggle(openKey === r.key ? null : r.key)}
              onOpenProfile={p && onOpenProfile ? () => onOpenProfile(p.id) : null}
            />
          );
        })}
      </SurfaceCard>
    </>
  );
}
