"use client";
import React, { useEffect, useState } from "react";
import { ClaimLegacyFactForm } from "@/components/profile/ClaimLegacyFactForm";
import { Avatar } from "@/components/ui/Avatar";
import { Stat } from "@/components/ui/atoms";
import { computeLegacyProfile } from "@/core/legacy";
import { fmtDate } from "@/lib/format";
import { listMyTrophies, Trophy } from "@/lib/trophies";
import { BALL, CHALK, CLAY, COURT, MUTED, PANEL2, body, mono } from "@/lib/theme";

const SPLIT_LABEL: Record<string, string> = { higher: "Against higher-rated players", similar: "Against similar-level players", lower: "Against lower-rated players" };

export function LegacyProfile({ player, players, matches, meId, nameOf, onClose, onOpenMatch }: any) {
  const legacy = computeLegacyProfile(player.id, players, matches);
  const nm = (id: string) => { const p = (players || []).find((x: any) => x.id === id); return p?.name ? p.name + (p.last ? " " + p.last : "") : nameOf(id); };
  // The onboarding "when did you start playing?" year is a player-reported
  // fact — it can predate Rally's own records entirely. Never conflated with
  // firstYear below, which is only ever what Rally actually has a match for.
  const reportedStart: number | null = player.levelHistory?.[0]?.from ?? null;
  const isOwn = player.id === meId;
  const [startClaim, setStartClaim] = useState<Trophy | null>(null);
  const [claiming, setClaiming] = useState(false);

  const reloadStartClaim = async () => {
    if (!isOwn || !player.auth_id) return;
    try {
      const mine = await listMyTrophies();
      const latest = mine.find((t) => t.kind === "legacy_fact" && t.fact_type === "started_playing" && t.status !== "rejected");
      setStartClaim(latest || null);
    } catch {}
  };
  useEffect(() => { reloadStartClaim(); /* eslint-disable-next-line */ }, [player.id, player.auth_id, isOwn]);

  const Row = ({ label, children }: any) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "9px 0", borderTop: "none", gap: 12 }}>
      <span style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: MUTED }}>{label}</span>
      <span style={{ fontFamily: body, fontSize: 14, color: CHALK, textAlign: "right" }}>{children}</span>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 70 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "none", padding: "20px 18px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: body, fontWeight: 700, fontSize: 14, color: BALL }}>🏛️ Rally Legacy</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, borderRadius: 10, padding: "5px 12px", fontFamily: body, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Close</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Avatar player={player} size={48} />
          <div>
            <h2 style={{ fontFamily: body, fontSize: 24, fontWeight: 800, color: CHALK, margin: 0 }}>{player.name}{player.last ? " " + player.last : ""}</h2>
            {legacy.firstYear != null && <div style={{ fontFamily: mono, fontSize: 12, color: MUTED, marginTop: 3 }}>{legacy.firstYear}–{legacy.lastYear}{legacy.activeThisYear ? <span style={{ color: BALL }}> · active</span> : null}</div>}
          </div>
        </div>

        {legacy.matches === 0 ? (
          <div style={{ fontFamily: body, fontSize: 14, color: MUTED, padding: "20px 0" }}>No recorded matches yet.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              <Stat n={legacy.record.w} label="Won" c={BALL} />
              <Stat n={legacy.record.d} label="Drawn" c={MUTED} />
              <Stat n={legacy.record.l} label="Lost" c={CLAY} />
              <Stat n={legacy.winPct == null ? "–" : Math.round(legacy.winPct * 100) + "%"} label="Win rate" c={BALL} />
            </div>
            <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: MUTED, marginBottom: 6, marginTop: 4 }}>Career</div>
            <Row label="Span">{legacy.firstYear} – {legacy.lastYear}</Row>
            <Row label="Matches recorded">{legacy.matches} <span style={{ color: MUTED, fontFamily: mono, fontSize: 10 }}>· Rally verified</span></Row>
            <Row label="Pace">~{legacy.matchesPerYear} matches/year</Row>
            {reportedStart != null && reportedStart !== legacy.firstYear && (
              <Row label="Started playing">
                {reportedStart}{" "}
                {startClaim?.status === "approved" ? (
                  <span style={{ color: BALL, fontFamily: mono, fontSize: 10 }}>· verified by {startClaim.clubs?.name || "club"} ✓</span>
                ) : startClaim?.status === "pending" ? (
                  <span style={{ color: MUTED, fontFamily: mono, fontSize: 10 }}>· pending club verification</span>
                ) : (
                  <span style={{ color: MUTED, fontFamily: mono, fontSize: 10 }}>
                    · player reported
                    {isOwn && player.auth_id && <button onClick={() => setClaiming(true)} style={{ marginLeft: 6, background: "transparent", border: "none", color: BALL, fontFamily: mono, fontSize: 10, cursor: "pointer", textTransform: "uppercase" }}>Verify</button>}
                  </span>
                )}
              </Row>
            )}

            {legacy.timeline.length > 1 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: MUTED, marginBottom: 8 }}>🌎 Career highlights</div>
                {legacy.timeline.map((t, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "5px 0" }}>
                    <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: BALL, width: 42, flexShrink: 0 }}>{t.year}</span>
                    <span style={{ fontFamily: body, fontSize: 13, color: CHALK }}>{t.label}</span>
                  </div>
                ))}
              </div>
            )}

            {legacy.bestWins.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: MUTED, marginBottom: 8 }}>👑 Best wins</div>
                {legacy.bestWins.map((w, i) => (
                  <button key={i} onClick={() => onOpenMatch && onOpenMatch(w.match.id)} disabled={!onOpenMatch} style={{ display: "block", width: "100%", background: PANEL2, border: "none", borderRadius: 12, padding: "10px 12px", marginBottom: 6, cursor: onOpenMatch ? "pointer" : "default", textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: BALL }}>{i + 1}.</span>
                      <span style={{ fontFamily: body, fontSize: 14, color: CHALK, fontWeight: 700 }}>{nm(w.oid)}</span>
                      <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 11, color: MUTED }}>{new Date(w.match.date).getFullYear()}</span>
                    </div>
                    <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, marginTop: 3 }}>{w.reason}</div>
                  </button>
                ))}
              </div>
            )}

            {legacy.splits.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: MUTED, marginBottom: 8 }}>📊 Playing profile</div>
                {legacy.splits.map((s) => {
                  const pct = s.n ? Math.round(((s.w + s.d * 0.5) / s.n) * 100) : 0;
                  return (
                    <div key={s.label} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: body, fontSize: 13, color: CHALK, marginBottom: 4 }}>
                        <span>{SPLIT_LABEL[s.label]}</span>
                        <span style={{ fontFamily: mono, fontWeight: 700, color: BALL }}>{pct}%</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: PANEL2, overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", background: BALL }} /></div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: MUTED, marginTop: 3 }}>{s.w}-{s.d}-{s.l} · {s.n} match{s.n === 1 ? "" : "es"}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {legacy.topOpponents.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: MUTED, marginBottom: 8 }}>Most played</div>
                {legacy.topOpponents.map((o) => (
                  <div key={o.oid} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontFamily: body, fontSize: 13, color: CHALK }}>
                    <span>{nm(o.oid)}</span>
                    <span style={{ fontFamily: mono, fontSize: 12, color: MUTED }}>{o.w}-{o.d}-{o.l} · {o.matches} match{o.matches === 1 ? "" : "es"}</span>
                  </div>
                ))}
              </div>
            )}

            {legacy.yearlyRecord.length > 1 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontFamily: body, fontWeight: 700, fontSize: 13, color: MUTED, marginBottom: 8 }}>By year</div>
                {legacy.yearlyRecord.map((y) => (
                  <div key={y.year} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                    <span style={{ fontFamily: mono, fontSize: 12, color: MUTED, width: 42, flexShrink: 0 }}>{y.year}</span>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: PANEL2, overflow: "hidden" }}><div style={{ width: Math.round(y.winPct * 100) + "%", height: "100%", background: BALL }} /></div>
                    <span style={{ fontFamily: mono, fontSize: 11, color: CHALK, width: 80, textAlign: "right", flexShrink: 0 }}>{y.w}-{y.d}-{y.l} · {Math.round(y.winPct * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {claiming && reportedStart != null && (
        <ClaimLegacyFactForm
          claimantName={player.name ? player.name + (player.last ? " " + player.last : "") : undefined}
          factType="started_playing"
          factValue={reportedStart}
          label="Started playing"
          onClose={() => setClaiming(false)}
          onSubmitted={reloadStartClaim}
        />
      )}
    </div>
  );
}
