"use client";
import React, { useState } from "react";
import { SurfaceCard, SurfaceTile } from "@/components/ui/Surfaces";
import { GRADE_LABEL } from "@/core/matchGrade";
import {
  MIN_FOR_RATE, overTimeSentence, shareSentence, winsFromSentence,
  MIN_YEARS_FOR_CHART, type MatchQuality, type Record3,
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
function Verdict({ q }: { q: MatchQuality }) {
  const at = played(q.atOrAbove), below = played(q.below);
  const total = at + below;
  return (
    <div style={{ background: FEED_LIME, borderRadius: 18, padding: 18 }}>
      <div style={{ ...tight(20), fontFamily: body, fontWeight: 500, fontSize: 20, color: FEED_LIME_INK }}>
        {q.verdict || "Not enough to judge"}
      </div>
      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13.5, color: FEED_LIME_INK_2, lineHeight: 1.45, marginTop: 6 }}>
        {shareSentence(q)}
      </div>

      {total > 0 && (
        <>
          {/* Two segments, and the bar is the sentence again in one glance.
              It is drawn on the lime card so both segments are inks, not
              colours — a green bar on lime would be invisible. */}
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginTop: 16, background: FEED_LIME_DIVIDER }}>
            <div style={{ width: (at / total) * 100 + "%", background: FEED_LIME_INK }} />
            <div style={{ width: (below / total) * 100 + "%", background: FEED_LIME_INK_2, opacity: 0.35 }} />
          </div>
          <div style={{ ...tabular, display: "flex", justifyContent: "space-between", fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_LIME_INK_2, marginTop: 6 }}>
            <span>{at} at or above</span>
            <span>{below} below</span>
          </div>
        </>
      )}
    </div>
  );
}

/** (b) The two tiles. The contrast is the point of the whole screen. */
function Tiles({ q }: { q: MatchQuality }) {
  const tile = (title: string, r: Record3, lime: boolean) => {
    const n = played(r);
    const rate = n >= MIN_FOR_RATE ? Math.round(((r.w + r.d * 0.5) / n) * 100) + "% won" : n ? "too few to judge" : "none yet";
    return (
      <div style={{ background: lime ? FEED_LIME : FEED_DEEP, borderRadius: 16, padding: 14, minWidth: 0 }}>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: lime ? FEED_LIME_INK_2 : FEED_TEXT_LOW }}>{title}</div>
        <div style={{ ...tabular, ...tight(24), fontFamily: body, fontWeight: 500, fontSize: 24, color: lime ? FEED_LIME_INK : FEED_TEXT_HI, marginTop: 4 }}>
          {n ? recordStr(r) : "–"}
        </div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: lime ? FEED_LIME_INK_2 : FEED_TEXT_MID, marginTop: 3 }}>{rate}</div>
      </div>
    );
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {tile("At or above", q.atOrAbove, false)}
      {tile("Below", q.below, true)}
    </div>
  );
}

/** (c) One row per level faced, hardest first. */
function ByLevel({ q }: { q: MatchQuality }) {
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
                your level
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
function WinsFrom({ q }: { q: MatchQuality }) {
  const { above, at, below } = q.winsFrom;
  const total = above + at + below;
  if (!total) return null;
  const rows: Array<[string, number, string]> = [
    ["Above your level", above, FEED_LIME],
    ["At your level", at, FEED_TEXT_LOW],
    ["Below your level", below, FEED_TEXT_MID],
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
        {winsFromSentence(q)}
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
function OverTime({ q }: { q: MatchQuality }) {
  const years = q.overTime;
  if (years.length < MIN_YEARS_FOR_CHART) return null;
  const summary = overTimeSentence(years);
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

export function QualityMode({ q, onOpenPlayer }: { q: MatchQuality; onOpenPlayer?: (id: string) => void }) {
  if (!q.total) {
    return (
      <SurfaceCard radius={18}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 15, color: FEED_TEXT_HI, marginBottom: 6 }}>No matches yet.</div>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 }}>
          Log a result and this fills in.
        </div>
      </SurfaceCard>
    );
  }

  return (
    <div>
      <Verdict q={q} />
      <div style={{ marginTop: 12 }}><Tiles q={q} /></div>
      {q.byLevel.length > 0 && <Section title="By level"><ByLevel q={q} /></Section>}
      {q.winsFrom.above + q.winsFrom.at + q.winsFrom.below > 0 && (
        <Section title="Where your wins come from"><WinsFrom q={q} /></Section>
      )}
      {q.opponents.length > 0 && <Section title="Every opponent"><Opponents q={q} onOpen={onOpenPlayer} /></Section>}
      <OverTime q={q} />
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
