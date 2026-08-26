"use client";
import React, { useEffect, useState } from "react";
import { Club, listMyAdminClubs } from "@/lib/clubs";
import { approveTrophy, listPendingClaims, rejectTrophy, Trophy } from "@/lib/trophies";
import { BALL, CHALK, CLAY, LINE, MUTED, PANEL, PANEL2, body, mono } from "@/lib/theme";

const FACT_LABEL: Record<string, string> = { started_playing: "Started playing" };

// A club admin's queue: pending trophy AND legacy-fact claims for the clubs
// they administer — same review, same RLS-enforced approve/reject either way.
// Approve/reject is enforced server-side by RLS (see schema_clubs_trophies.sql)
// — this screen is just the interface to that, not the source of trust.
export function ClubAdminReview() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [claims, setClaims] = useState<Record<string, Trophy[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const mine = await listMyAdminClubs();
      setClubs(mine);
      const byClub: Record<string, Trophy[]> = {};
      for (const c of mine) byClub[c.id] = await listPendingClaims(c.id);
      setClaims(byClub);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const act = async (id: string, fn: (id: string) => Promise<void>) => {
    setBusyId(id);
    try { await fn(id); await reload(); } catch {}
    setBusyId(null);
  };

  if (loading) return <div style={{ fontFamily: body, fontSize: 14, color: MUTED, padding: "20px 0" }}>Loading…</div>;
  if (clubs.length === 0) return <div style={{ fontFamily: body, fontSize: 14, color: MUTED, padding: "20px 0" }}>You don't administer any clubs.</div>;

  return (
    <div>
      {clubs.map((c) => {
        const pending = claims[c.id] || [];
        return (
          <div key={c.id} style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, marginBottom: 8 }}>{c.name}</div>
            {pending.length === 0 ? (
              <div style={{ fontFamily: body, fontSize: 13, color: MUTED, background: PANEL, border: "none", borderRadius: 14, padding: "14px" }}>No pending claims.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pending.map((t) => (
                  <div key={t.id} style={{ background: PANEL, border: "none", borderRadius: 14, padding: "12px 14px" }}>
                    <div style={{ fontFamily: mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: BALL, marginBottom: 4 }}>{t.kind === "legacy_fact" ? "Legacy fact" : "Trophy claim"}</div>
                    <div style={{ fontFamily: body, fontSize: 14, color: CHALK, fontWeight: 700 }}>
                      {t.kind === "legacy_fact" ? `${FACT_LABEL[t.fact_type || ""] || t.fact_type}: ${t.fact_value}` : `${t.result ? t.result + " — " : ""}${t.competition}`}
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>
                      {t.claimant_name || "Unnamed player"}{t.season ? " · " + t.season : ""}
                    </div>
                    {t.notes && <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, marginTop: 6, lineHeight: 1.4 }}>{t.notes}</div>}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button disabled={busyId === t.id} onClick={() => act(t.id, approveTrophy)} style={{ flex: 1, fontFamily: mono, fontSize: 11, textTransform: "uppercase", fontWeight: 700, padding: "8px 10px", borderRadius: 10, cursor: "pointer", border: "none", background: BALL, color: "#15352a" }}>Approve</button>
                      <button disabled={busyId === t.id} onClick={() => act(t.id, rejectTrophy)} style={{ flex: 1, fontFamily: mono, fontSize: 11, textTransform: "uppercase", fontWeight: 700, padding: "8px 10px", borderRadius: 10, cursor: "pointer", border: "1px solid " + CLAY, background: "transparent", color: CLAY }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
