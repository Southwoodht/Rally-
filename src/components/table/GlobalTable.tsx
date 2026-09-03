"use client";
import React, { useEffect, useState } from "react";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { Empty } from "@/components/ui/atoms";
import { loadGlobalStandings, type GlobalRow } from "@/lib/globalTable";
import { BALL, CHALK, CLAY, LINE, MUTED, PANEL, PANEL2, RADIUS, RADIUS_SM, SOFT_SHADOW, body, mono } from "@/lib/theme";

// A league that nobody created. Every person you can see, ranked on their own
// record wherever they play — see src/lib/globalTable.ts for why that is the
// only honest way to put two leagues in one table.

function Face({ row, size = 34 }: { row: GlobalRow; size?: number }) {
  const common = { width: size, height: size, borderRadius: "50%", flexShrink: 0 } as const;
  if (row.avatarUrl) return <img src={row.avatarUrl} alt="" style={{ ...common, objectFit: "cover" }} />;
  return (
    <span style={{ ...common, display: "grid", placeItems: "center", background: PANEL2, fontSize: size * 0.46 }}>
      {row.avatar || (row.name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

const rec = (w: number, d: number, l: number) => `${w}–${d}–${l}`;

function Row({ row, place, isMe, open, onClick }: any) {
  const r: GlobalRow = row;
  return (
    <div>
      <button
        onClick={onClick}
        style={{
          display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
          background: isMe ? PANEL2 : "transparent", border: "none", padding: "11px 14px", cursor: "pointer",
        }}
      >
        <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 13, color: place ? MUTED : LINE, width: 22, flexShrink: 0 }}>
          {place ? place : "–"}
        </span>
        <Face row={r} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: body, fontWeight: 700, fontSize: 14.5, color: CHALK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.name}{r.last ? " " + r.last : ""}
            </span>
            {r.level && <LevelBadge level={r.level} />}
          </span>
          <span style={{ display: "block", fontFamily: body, fontSize: 11.5, color: MUTED, marginTop: 2 }}>
            {r.provisional ? "Provisional — too few games to place yet" : r.leagues > 1 ? r.leagues + " leagues" : r.claimed ? "1 league" : "not claimed — our leagues only"}
          </span>
        </span>
        <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 13.5, color: CHALK, flexShrink: 0 }}>{rec(r.w, r.d, r.l)}</span>
        <span style={{ fontFamily: body, fontSize: 12, color: BALL, flexShrink: 0 }}>{open ? "▾" : "›"}</span>
      </button>
      {open && (
        <div style={{ background: PANEL2, borderRadius: RADIUS_SM, margin: "0 14px 10px", padding: "10px 12px" }}>
          <Line label="Record, all leagues" value={rec(r.w, r.d, r.l)} />
          <Line
            label="Against their own level or better"
            value={r.qgp ? rec(r.qw, r.qd, r.ql) : "none yet"}
            mutedValue={!r.qgp}
          />
          <Line label="Leagues" value={String(r.leagues)} />
          <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, lineHeight: 1.45, marginTop: 8, borderTop: "1px solid " + LINE, paddingTop: 8 }}>
            {r.claimed
              ? "Ranked on every match they've played, in every league they're in — not just the ones against us."
              : "This player hasn't claimed their profile, so this is only what our leagues have seen of them. Their real record may be very different."}
          </div>
        </div>
      )}
    </div>
  );
}

function Line({ label, value, mutedValue }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 0" }}>
      <span style={{ fontFamily: body, fontSize: 12.5, color: MUTED, flex: 1 }}>{label}</span>
      <span style={{ fontFamily: mutedValue ? body : mono, fontWeight: mutedValue ? 500 : 700, fontSize: 12.5, color: mutedValue ? MUTED : CHALK }}>{value}</span>
    </div>
  );
}

export function GlobalTable({ myAuthId }: { myAuthId?: string | null }) {
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
      <div style={{ ...{ background: PANEL, borderRadius: RADIUS, padding: 20, boxShadow: SOFT_SHADOW }, fontFamily: body, fontSize: 13.5, color: CHALK, lineHeight: 1.5 }}>
        <strong style={{ color: CLAY }}>Global table unavailable.</strong>
        <div style={{ color: MUTED, marginTop: 6 }}>{err}</div>
        <div style={{ color: MUTED, marginTop: 8, fontSize: 12.5 }}>
          If this says the function is missing, the one-off SQL in <span style={{ fontFamily: mono }}>supabase/schema_global_standings.sql</span> hasn&apos;t been run yet.
        </div>
      </div>
    );
  }
  if (!rows) return <Empty msg="Loading the global table…" />;
  if (!rows.length) return <Empty msg="Nobody to rank yet." />;

  // Unrated players sit after the ranked ones and take no place number —
  // without a level there's nothing to anchor them to, and inventing one
  // would undo the point of the table.
  const rated = rows.filter((r) => r.level);
  const unrated = rows.filter((r) => !r.level);

  return (
    <>
      <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, lineHeight: 1.5, marginBottom: 12 }}>
        Everyone you&apos;ve crossed paths with, ranked on their own record in their own leagues — not on the matches they played against us. Level is only a starting assumption: the more someone plays their own level or better, the more their results decide their place and the less their claimed level does.
      </div>
      <div style={{ background: PANEL, borderRadius: RADIUS, boxShadow: SOFT_SHADOW, overflow: "hidden" }}>
        {rated.map((r, i) => (
          <Row key={r.key} row={r} place={i + 1} isMe={!!myAuthId && r.key === myAuthId} open={open === r.key} onClick={() => setOpen(open === r.key ? null : r.key)} />
        ))}
      </div>
      {unrated.length > 0 && (
        <>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: MUTED, margin: "18px 0 6px" }}>No level set</div>
          <div style={{ background: PANEL, borderRadius: RADIUS, boxShadow: SOFT_SHADOW, overflow: "hidden" }}>
            {unrated.map((r) => (
              <Row key={r.key} row={r} place={null} isMe={!!myAuthId && r.key === myAuthId} open={open === r.key} onClick={() => setOpen(open === r.key ? null : r.key)} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
