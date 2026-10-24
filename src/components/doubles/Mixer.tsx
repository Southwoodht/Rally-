"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Minus, Plus, Shuffle } from "lucide-react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { mixerRounds, partnerRepeats, type MixerCourt } from "@/core/doubles/mixer";
import { fullNameOf } from "@/lib/format";
import {
  FEED_HAIRLINE, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, tabular,
} from "@/lib/theme";

/**
 * Club night — the doubles Mixer (core/doubles/mixer.ts).
 *
 * Tick who is here, set courts and rounds, and it deals the night: new
 * partners every round, sit-outs shared, close games. "Log" on a court opens
 * the doubles result with the four already seated, so a mixer game is an
 * ordinary doubles result in every table and rating — nothing new is stored.
 *
 * The night is kept on this phone (localStorage, per club): who is here, the
 * seed and which courts are logged, so closing the app mid-session does not
 * reshuffle the courts under people's feet. Losing it costs nothing worse
 * than a fresh shuffle.
 */
type Night = { here: string[]; courts: number; rounds: number; seed: number; logged: string[]; dealt: boolean };
const FRESH: Night = { here: [], courts: 2, rounds: 6, seed: 1, logged: [], dealt: false };

export function Mixer({ leagueId, players, rating, onLog, onBack }: {
  leagueId: string;
  players: any[];
  /** Doubles rating, for balancing the pairs; unknown players sit at the middle. */
  rating: (id: string) => number;
  /** Open the result form for one court; resolves true once it is saved. */
  onLog: (court: MixerCourt) => Promise<boolean>;
  onBack: () => void;
}) {
  const storeKey = "rally.mixer." + leagueId;
  const [night, setNight] = useState<Night>(() => {
    try { const raw = localStorage.getItem(storeKey); if (raw) return { ...FRESH, ...JSON.parse(raw) }; } catch {}
    return FRESH;
  });
  useEffect(() => { try { localStorage.setItem(storeKey, JSON.stringify(night)); } catch {} }, [night, storeKey]);
  const set = (patch: Partial<Night>) => setNight((n) => ({ ...n, ...patch }));

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const roster = useMemo(
    () => players.filter((p) => !p.inactive).sort((a, b) => fullNameOf(a).localeCompare(fullNameOf(b))),
    [players],
  );
  const here = night.here.filter((id) => byId.has(id));
  const maxCourts = Math.max(1, Math.floor(here.length / 4));
  const courts = Math.min(night.courts, maxCourts);
  const rounds = useMemo(
    () => (night.dealt ? mixerRounds(here, { courts, rounds: night.rounds, rating, seed: night.seed }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [night.dealt, here.join(), courts, night.rounds, night.seed],
  );
  const short = (id: string) => {
    const p = byId.get(id);
    if (!p) return "?";
    const last = (p.last || "").trim();
    return (p.name || "").trim() + (last ? " " + last[0] : "");
  };

  const pill = (on: boolean): React.CSSProperties => ({
    background: on ? FEED_LIME : FEED_RAISED, color: on ? FEED_LIME_INK : FEED_TEXT_HI, border: "none", borderRadius: 999,
    padding: "9px 14px", fontFamily: body, fontSize: 14.5, cursor: "pointer",
  });
  const stepBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 10, border: "none", background: FEED_RAISED, color: FEED_TEXT_HI, display: "grid", placeItems: "center", cursor: "pointer" };
  const note: React.CSSProperties = { fontFamily: body, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 };
  const stepper = (labelText: string, value: number, min: number, max: number, onChange: (n: number) => void) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ ...note, flex: 1, fontSize: 15, color: FEED_TEXT_HI }}>{labelText}</span>
      <button aria-label={"Fewer " + labelText.toLowerCase()} disabled={value <= min} onClick={() => onChange(value - 1)} style={{ ...stepBtn, opacity: value <= min ? 0.4 : 1 }}><Minus size={16} /></button>
      <span style={{ ...tabular, fontFamily: body, fontSize: 17, color: FEED_TEXT_HI, minWidth: 22, textAlign: "center" }}>{value}</span>
      <button aria-label={"More " + labelText.toLowerCase()} disabled={value >= max} onClick={() => onChange(value + 1)} style={{ ...stepBtn, opacity: value >= max ? 0.4 : 1 }}><Plus size={16} /></button>
    </div>
  );

  const header = (
    <button onClick={night.dealt ? () => set({ dealt: false }) : onBack} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: FEED_LIME, fontFamily: body, fontSize: 14, cursor: "pointer", padding: "0 0 10px" }}>
      <ChevronLeft size={16} /> {night.dealt ? "Who's here" : "Fixtures"}
    </button>
  );

  if (!night.dealt) {
    const toggle = (id: string) => set({ here: here.includes(id) ? here.filter((x) => x !== id) : [...here, id], logged: [] });
    return (
      <div>
        {header}
        <div style={{ fontFamily: body, fontWeight: 600, fontSize: 22, color: FEED_TEXT_HI }}>Club night mixer</div>
        <div style={{ ...note, marginTop: 4, marginBottom: 14 }}>
          Tick who&apos;s here. Southwood deals the courts: a new partner every round, sitting out shared fairly, and close games. Results go in as normal doubles.
        </div>
        <SurfaceCard radius={16} pad="14px 14px">
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <span style={{ ...note, flex: 1, color: FEED_TEXT_HI, fontSize: 15 }}>Here tonight · <span style={tabular}>{here.length}</span></span>
            {here.length > 0 && <button onClick={() => set({ here: [] })} style={{ background: "none", border: "none", color: FEED_TEXT_MID, fontFamily: body, fontSize: 13, cursor: "pointer" }}>Clear</button>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {roster.map((p) => (
              <button key={p.id} onClick={() => toggle(p.id)} style={pill(here.includes(p.id))}>{fullNameOf(p)}</button>
            ))}
          </div>
        </SurfaceCard>
        <SurfaceCard radius={16} pad="14px 14px" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {stepper("Courts", courts, 1, maxCourts, (n) => set({ courts: n }))}
            {/* Four a court: say why + stops, rather than leaving a dead
                button (Sam: "it says 1 court?"). */}
            {courts >= maxCourts && (
              <div style={{ ...note, marginTop: -4 }}>
                {here.length < 4 ? "Four players to a court." : `${here.length} players fill ${maxCourts} ${maxCourts === 1 ? "court" : "courts"} — tick ${(maxCourts + 1) * 4 - here.length} more for another.`}
              </div>
            )}
            {stepper("Rounds", night.rounds, 1, 12, (n) => set({ rounds: n }))}
          </div>
        </SurfaceCard>
        <button
          disabled={here.length < 4}
          onClick={() => set({ dealt: true, seed: Math.floor(Math.random() * 1e9), logged: [] })}
          style={{ marginTop: 14, width: "100%", background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 999, padding: "13px 16px", fontFamily: body, fontWeight: 600, fontSize: 16, cursor: here.length < 4 ? "default" : "pointer", opacity: here.length < 4 ? 0.5 : 1 }}
        >
          {here.length < 4 ? `Pick ${4 - here.length} more` : "Deal the courts"}
        </button>
      </div>
    );
  }

  const sitting = here.length - courts * 4;
  const repeats = partnerRepeats(rounds);
  return (
    <div>
      {header}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
        <div style={{ flex: 1, fontFamily: body, fontWeight: 600, fontSize: 22, color: FEED_TEXT_HI }}>Tonight&apos;s courts</div>
        <button onClick={() => set({ seed: Math.floor(Math.random() * 1e9), logged: [] })} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 999, padding: "8px 14px", fontFamily: body, fontSize: 14, cursor: "pointer" }}>
          <Shuffle size={15} /> Shuffle
        </button>
      </div>
      <div style={{ ...note, marginTop: 4, marginBottom: 12 }}>
        {here.length} players · {courts} {courts === 1 ? "court" : "courts"} · {rounds.length} rounds
        {sitting > 0 ? ` · ${sitting} sit${sitting === 1 ? "s" : ""} out each round` : ""}
        {" · "}{repeats === 0 ? "a new partner every round" : `${repeats} repeat ${repeats === 1 ? "partner" : "partners"}`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rounds.map((r, ri) => (
          <SurfaceCard key={ri} radius={16} pad="12px 14px">
            <div style={{ fontFamily: body, fontWeight: 600, fontSize: 16, color: FEED_TEXT_HI, marginBottom: 2 }}>Round {ri + 1}</div>
            {r.courts.map((c, ci) => {
              const id = `${ri}:${ci}`;
              const done = night.logged.includes(id);
              return (
                <div key={ci} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: ci ? "0.5px solid " + FEED_HAIRLINE : "none" }}>
                  <span style={{ ...note, width: 52, flexShrink: 0, color: FEED_TEXT_LOW }}>Court {ci + 1}</span>
                  <div style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: 14.5, color: FEED_TEXT_HI, lineHeight: 1.35 }}>
                    <div>{short(c.a[0])} &amp; {short(c.a[1])}</div>
                    <div style={{ color: FEED_TEXT_MID, fontSize: 12.5 }}>v</div>
                    <div>{short(c.b[0])} &amp; {short(c.b[1])}</div>
                  </div>
                  {done ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, ...note, flexShrink: 0 }}><Check size={15} color={FEED_LIME} /> Logged</span>
                  ) : (
                    <button
                      onClick={async () => { if (await onLog(c)) setNight((n) => ({ ...n, logged: [...n.logged, id] })); }}
                      style={{ background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 999, padding: "8px 14px", fontFamily: body, fontSize: 14, cursor: "pointer", flexShrink: 0 }}
                    >
                      Log
                    </button>
                  )}
                </div>
              );
            })}
            {r.out.length > 0 && <div style={{ ...note, marginTop: 4 }}>Sitting out: {r.out.map(short).join(", ")}</div>}
          </SurfaceCard>
        ))}
      </div>
      <div style={{ ...note, marginTop: 12 }}>Shuffle deals a fresh rotation. Results already logged are saved either way.</div>
    </div>
  );
}
