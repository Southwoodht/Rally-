"use client";
import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SurfaceCard, SurfaceTile } from "@/components/ui/Surfaces";
import { GRADE_LABEL } from "@/core/matchGrade";
import {
  MIN_FOR_RATE, overTimeSentence, shareSentence, theirs, winsFromSentence,
  MIN_YEARS_FOR_CHART, YOU, type MatchQuality, type Record3, type Voice,
} from "@/core/matchQuality";
import { fullNameOf } from "@/lib/format";
import {
  FEED_DEEP, FEED_LIME, FEED_LIME_DIVIDER, FEED_LIME_INK, FEED_LIME_INK_2, FEED_RAISED,
  FEED_TEXT_DIM, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, tabular, tight,
} from "@/lib/theme";

// Who you have actually been playing.
//
// The screen exists to put one contrast in front of you: your record against
// people at your level or above, beside your record against people below. A
// win rate on its own cannot say which of those it came from, and most
// players' two halves look nothing like each other.
//
// Every number here arrives finished from core/matchQuality. Nothing on this
// file counts anything.

const OPPONENTS_SHOWN = 8;

const label: React.CSSProperties = {
  fontFamily: body, fontWeight: 400, fontSize: 11, color: FEED_TEXT_MID,
  textTransform: "uppercase", letterSpacing: 0.8,
};

const recordStr = (r: Record3) => (r.d > 0 ? `${r.w}–${r.d}–${r.l}` : `${r.w}–${r.l}`);
const played = (r: Record3) => r.w + r.d + r.l;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ ...label, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

/** (a) The verdict. */
function Verdict({ q, v }: { q: MatchQuality; v: Voice }) {
  const at = played(q.atOrAbove), below = played(q.below), unknown = played(q.unknown);
  // The bar is every match, not just the gradeable ones. It used to be
  // at + below, which silently excluded anything ungraded — so the two
  // segments filled the whole bar while describing a fraction of the
  // matches, and on this roster that fraction is small.
  const total = at + below + unknown;
  return (
    <div style={{ background: FEED_LIME, borderRadius: 18, padding: 18 }}>
      <div style={{ ...tight(20), fontFamily: body, fontWeight: 500, fontSize: 20, color: FEED_LIME_INK }}>
        {q.verdict || "Not enough to judge"}
      </div>
      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_LIME_INK_2, lineHeight: 1.45, marginTop: 6 }}>
        {shareSentence(q, v)}
      </div>

      {total > 0 && (
        <>
          {/* Three segments now, and they account for every match. The
              first two are inks because the bar sits on lime and a green
              would vanish; the third is the raised green precisely because
              it should read as a different kind of thing — not a worse
              opponent, an unknown one. */}
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginTop: 16, background: FEED_LIME_DIVIDER }}>
            <div style={{ width: (at / total) * 100 + "%", background: FEED_LIME_INK }} />
            <div style={{ width: (below / total) * 100 + "%", background: FEED_LIME_INK_2, opacity: 0.35 }} />
            <div style={{ width: (unknown / total) * 100 + "%", background: FEED_RAISED }} />
          </div>
          <div style={{ ...tabular, display: "flex", justifyContent: "space-between", gap: 8, fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_LIME_INK_2, marginTop: 6 }}>
            <span>{at} at or above</span>
            <span>{below} below</span>
            {unknown > 0 && <span>{unknown} unknown level</span>}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * (b) The two halves of the schedule, and who is in each.
 *
 * **Lime is the strong half, not the loud half.** It was on "Below"
 * originally, to make the imbalance jump out — but lime means "good" on every
 * other screen in this app, so on this one it was quietly congratulating you
 * for the easy games. Sam read it and could not say why it was there, which
 * is the tell. The contrast is still made, by the verdict bar above and by
 * the two records sitting side by side; it does not need the accent colour
 * pointing at the wrong half to land.
 *
 * Either tile opens the players it counted. A number you cannot look inside
 * is a number you have to take on trust.
 */
function Tiles({ q, v, onOpenPlayer }: { q: MatchQuality; v: Voice; onOpenPlayer?: (id: string) => void }) {
  const [open, setOpen] = useState<null | "above" | "below">(null);

  const tile = (key: "above" | "below", title: string, r: Record3, lime: boolean) => {
    const n = played(r);
    const rate = n >= MIN_FOR_RATE ? Math.round(((r.w + r.d * 0.5) / n) * 100) + "% won" : n ? "too few to judge" : "none yet";
    const on = open === key;
    return (
      <button
        onClick={() => setOpen(on ? null : key)}
        aria-expanded={on}
        style={{
          background: lime ? FEED_LIME : FEED_DEEP, borderRadius: 16, padding: 14, minWidth: 0,
          border: "1.5px solid " + (on ? (lime ? FEED_LIME_INK_2 : FEED_LIME) : "transparent"),
          textAlign: "left", cursor: "pointer", width: "100%", boxSizing: "border-box",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: lime ? FEED_LIME_INK_2 : FEED_TEXT_LOW }}>{title}</span>
          <ChevronDown
            size={12}
            color={lime ? FEED_LIME_INK_2 : FEED_TEXT_LOW}
            strokeWidth={2}
            style={{ flexShrink: 0, transform: on ? "rotate(180deg)" : undefined }}
          />
        </span>
        <span style={{ ...tabular, ...tight(24), display: "block", fontFamily: body, fontWeight: 500, fontSize: 24, color: lime ? FEED_LIME_INK : FEED_TEXT_HI, marginTop: 4 }}>
          {n ? recordStr(r) : "–"}
        </span>
        <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 12.5, color: lime ? FEED_LIME_INK_2 : FEED_TEXT_MID, marginTop: 3 }}>{rate}</span>
      </button>
    );
  };

  // Ungraded opponents belong to neither half — no level, no side.
  const inHalf = (want: "above" | "below") =>
    q.opponents.filter((o) => o.gap != null && (want === "above" ? o.gap >= 0 : o.gap < 0));

  const list = open ? inHalf(open) : [];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {tile("above", "At or above", q.atOrAbove, true)}
        {tile("below", "Below", q.below, false)}
      </div>

      {open && (
        <SurfaceCard radius={16} style={{ marginTop: 10 }}>
          <div style={{ ...label, marginBottom: 10 }}>
            {open === "above" ? "At " + theirs(v) + " level or above" : "Below " + theirs(v) + " level"} · {list.length}
          </div>
          {list.length === 0 ? (
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID }}>
              Nobody yet.
            </div>
          ) : list.map((o, i) => (
            <button
              key={o.player.id}
              onClick={onOpenPlayer ? () => onOpenPlayer(o.player.id) : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent",
                border: "none", padding: i ? "9px 0 0" : 0, cursor: onOpenPlayer ? "pointer" : "default", textAlign: "left",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: body, fontWeight: 500, fontSize: 14.5, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {fullNameOf(o.player)}
                </span>
                <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, marginTop: 1 }}>
                  {o.cat ? o.cat + " · " + o.phrase : "No level recorded"}
                </span>
              </span>
              <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_HI, flexShrink: 0 }}>
                {recordStr(o.record)}
              </span>
            </button>
          ))}
          {q.ungraded > 0 && (
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 11.5, color: FEED_TEXT_LOW, lineHeight: 1.5, marginTop: 12 }}>
              {q.ungraded} {q.ungraded === 1 ? "match is" : "matches are"} in neither half — no level was recorded for those opponents at the time.
            </div>
          )}
        </SurfaceCard>
      )}
    </div>
  );
}

/** (c) One row per level faced, hardest first. */
function ByLevel({ q, v }: { q: MatchQuality; v: Voice }) {
  const most = Math.max(...q.byLevel.map((r) => r.matches), 1);
  return (
    <SurfaceCard radius={16}>
      {q.byLevel.map((r, i) => (
        <div
          key={r.cat}
          style={{
            marginTop: i ? 10 : 0,
            background: r.isMine ? FEED_RAISED : undefined,
            borderRadius: r.isMine ? 12 : undefined,
            padding: r.isMine ? 10 : undefined,
            margin: r.isMine ? (i ? "10px -4px 0" : "0 -4px") : undefined,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_HI }}>{r.cat}</span>
            {r.isMine && (
              <span style={{ fontFamily: body, fontWeight: 400, fontSize: 10.5, color: FEED_LIME_INK, background: FEED_LIME, borderRadius: 999, padding: "1px 7px" }}>
                {theirs(v)} level
              </span>
            )}
            <span style={{ flex: 1 }} />
            <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_HI }}>{recordStr(r.record)}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: FEED_DEEP, overflow: "hidden", marginTop: 7 }}>
            <div style={{ width: (r.matches / most) * 100 + "%", height: "100%", background: r.gap >= 0 ? FEED_LIME : FEED_TEXT_LOW }} />
          </div>
          <div style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, marginTop: 5 }}>
            {r.matches} match{r.matches === 1 ? "" : "es"} · {r.winRate == null ? "not enough to judge" : r.winRate + "% won"}
          </div>
        </div>
      ))}
    </SurfaceCard>
  );
}

/** (d) Where the wins come from. */
function WinsFrom({ q, v }: { q: MatchQuality; v: Voice }) {
  const { above, at, below } = q.winsFrom;
  const total = above + at + below;
  if (!total) return null;
  const rows: Array<[string, number, string]> = [
    ["Above " + theirs(v) + " level", above, FEED_LIME],
    ["At " + theirs(v) + " level", at, FEED_TEXT_LOW],
    ["Below " + theirs(v) + " level", below, FEED_TEXT_MID],
  ];
  return (
    <SurfaceCard radius={16}>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: FEED_DEEP }}>
        {rows.map(([name, n, colour]) => n > 0 && <div key={name} style={{ width: (n / total) * 100 + "%", background: colour }} />)}
      </div>
      <div style={{ marginTop: 12 }}>
        {rows.map(([name, n, colour]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: colour, flexShrink: 0 }} />
            <span style={{ flex: 1, fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_TEXT_HI }}>{name}</span>
            <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_HI }}>{n}</span>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.45, marginTop: 8 }}>
        {winsFromSentence(q, v)}
      </div>
    </SurfaceCard>
  );
}

/** (e) Every opponent, hardest first. */
function Opponents({ q, onOpen }: { q: MatchQuality; onOpen?: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? q.opponents : q.opponents.slice(0, OPPONENTS_SHOWN);
  const rest = q.opponents.length - shown.length;
  return (
    <SurfaceCard radius={16}>
      {shown.map((o, i) => (
        <button
          key={o.player.id}
          onClick={onOpen ? () => onOpen(o.player.id) : undefined}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent",
            border: "none", padding: i ? "10px 0 0" : 0, cursor: onOpen ? "pointer" : "default", textAlign: "left",
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: body, fontWeight: 500, fontSize: 14.5, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {fullNameOf(o.player)}
            </span>
            <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, marginTop: 1 }}>
              {o.cat ? o.cat + " · " + o.phrase : "No level recorded"}
            </span>
          </span>
          <span style={{ textAlign: "right", flexShrink: 0 }}>
            <span style={{ ...tabular, display: "block", fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_HI }}>
              {recordStr(o.record)}
            </span>
            <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 11.5, color: FEED_TEXT_LOW, marginTop: 1 }}>
              {o.lastGrade ? GRADE_LABEL[o.lastGrade] : "Not graded"}
            </span>
          </span>
        </button>
      ))}
      {rest > 0 && (
        <button
          onClick={() => setAll(true)}
          style={{ background: "transparent", border: "none", padding: "12px 0 0", cursor: "pointer", fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_LIME, display: "block", textAlign: "left" }}
        >
          {rest} more
        </button>
      )}
    </SurfaceCard>
  );
}

/** (f) The share at your level or above, year by year. */
function OverTime({ q, v }: { q: MatchQuality; v: Voice }) {
  const years = q.overTime;
  if (years.length < MIN_YEARS_FOR_CHART) return null;
  const summary = overTimeSentence(years, v);
  const last = years[years.length - 1];
  return (
    <Section title="Over time">
      <SurfaceCard radius={16}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 96 }}>
          {years.map((y) => {
            const isLast = y.year === last.year;
            // A year nobody could grade and a year that was 0% are different
            // facts and must not draw the same bar. The ungraded year gets
            // an empty track and a dimmed label; a real zero gets a stub
            // sitting in that same track, so the two read apart.
            const ungraded = y.share == null;
            const h = ungraded ? 0 : Math.max(3, (y.share as number) / 100 * 74);
            return (
              <div key={y.year} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                {isLast && !ungraded && (
                  <span style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 10.5, color: FEED_LIME_INK, background: FEED_LIME, borderRadius: 999, padding: "1px 6px" }}>
                    {y.share}%
                  </span>
                )}
                <span style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                  <span style={{ position: "relative", width: "100%", height: 74, borderRadius: 4, background: FEED_DEEP, display: "block" }}>
                    {!ungraded && (
                      <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: h, borderRadius: 4, background: isLast ? FEED_LIME : FEED_TEXT_LOW, display: "block" }} />
                    )}
                  </span>
                </span>
                <span style={{ ...tabular, fontFamily: body, fontWeight: 400, fontSize: 10.5, color: ungraded ? FEED_TEXT_DIM : FEED_TEXT_MID }}>
                  {String(y.year).slice(2)}
                </span>
              </div>
            );
          })}
        </div>
        {years.some((y) => y.share == null) && (
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 11.5, color: FEED_TEXT_LOW, marginTop: 10 }}>
            A dimmed year is one with nothing gradeable in it.
          </div>
        )}
        {summary && (
          <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, lineHeight: 1.45, marginTop: 12 }}>{summary}</div>
        )}
      </SurfaceCard>
    </Section>
  );
}

export function QualityMode({ q, v = YOU, onOpenPlayer }: { q: MatchQuality; v?: Voice; onOpenPlayer?: (id: string) => void }) {
  if (!q.total) {
    return (
      <SurfaceCard radius={18}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, marginBottom: 6 }}>No matches yet.</div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
          {v.self ? "Log a result and this fills in." : "Nothing to judge yet."}
        </div>
      </SurfaceCard>
    );
  }

  return (
    <div>
      <Verdict q={q} v={v} />
      <div style={{ marginTop: 12 }}><Tiles q={q} v={v} onOpenPlayer={onOpenPlayer} /></div>
      {q.byLevel.length > 0 && <Section title="By level"><ByLevel q={q} v={v} /></Section>}
      {q.winsFrom.above + q.winsFrom.at + q.winsFrom.below > 0 && (
        <Section title={"Where " + (v.self ? "your" : v.name + "'s") + " wins come from"}><WinsFrom q={q} v={v} /></Section>
      )}
      {q.opponents.length > 0 && <Section title="Every opponent"><Opponents q={q} onOpen={onOpenPlayer} /></Section>}
      <OverTime q={q} v={v} />
      <SurfaceTile style={{ marginTop: 20 }}>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, lineHeight: 1.5 }}>
          Levels are compared by category, never by sub-level. Level is
          self-declared, and ranking Intermediate/High above Intermediate/Medium
          would be arithmetic performed on a guess.
        </div>
      </SurfaceTile>
    </div>
  );
}
