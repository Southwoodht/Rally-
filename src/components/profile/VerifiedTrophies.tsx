"use client";
import React, { useEffect, useState } from "react";
import { ClaimTrophyForm } from "@/components/profile/ClaimTrophyForm";
import { listApprovedTrophiesFor, listMyTrophies, Trophy, withdrawTrophyClaim } from "@/lib/trophies";
import { BALL, CHALK, LINE, MUTED, PANEL2, body, mono } from "@/lib/theme";

// Verified Trophies are distinct from the Achievements grid above them: an
// Achievement is computed by Rally itself from real match data — nobody
// checks it. A Trophy here has been through a club administrator's
// approve/reject review (see src/lib/trophies.ts) — a player can never
// self-award one, only submit a claim.
export function VerifiedTrophies({ player, meId }: any) {
  const isOwn = player.id === meId;
  const [approved, setApproved] = useState<Trophy[]>([]);
  const [pending, setPending] = useState<Trophy[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const reload = async () => {
    if (!player.auth_id) { setLoaded(true); return; }
    try {
      if (isOwn) {
        const mine = (await listMyTrophies()).filter((t) => t.kind === "trophy");
        setApproved(mine.filter((t) => t.status === "approved"));
        setPending(mine.filter((t) => t.status === "pending"));
      } else {
        setApproved((await listApprovedTrophiesFor(player.auth_id)).filter((t) => t.kind === "trophy"));
      }
    } catch {}
    setLoaded(true);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [player.id, player.auth_id, isOwn]);

  if (!player.auth_id) return null;
  if (!loaded) return null;
  if (!isOwn && approved.length === 0) return null;

  const withdraw = async (id: string) => {
    try { await withdrawTrophyClaim(id); reload(); } catch {}
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED }}>Verified trophies</div>
        {isOwn && <button onClick={() => setClaiming(true)} style={{ background: "transparent", border: "none", color: BALL, fontFamily: mono, fontSize: 10.5, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>+ Claim a trophy</button>}
      </div>
      {approved.length === 0 && pending.length === 0 && (
        <div style={{ fontFamily: body, fontSize: 13, color: MUTED }}>None yet.</div>
      )}
      {approved.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: pending.length ? 8 : 0 }}>
          {approved.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, background: PANEL2, border: "1px solid " + BALL, borderRadius: 12, padding: "10px 12px" }}>
              <span style={{ fontSize: 20 }}>🏆</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: body, fontSize: 14, color: CHALK, fontWeight: 700 }}>{t.result ? t.result + " — " : ""}{t.competition}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>{t.clubs?.name || "Club"}{t.season ? " · " + t.season : ""} · Verified ✓</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {isOwn && pending.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pending.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "1px dashed " + LINE, borderRadius: 12, padding: "10px 12px" }}>
              <span style={{ fontSize: 20, opacity: 0.5 }}>🏆</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: body, fontSize: 14, color: CHALK }}>{t.result ? t.result + " — " : ""}{t.competition}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>{t.clubs?.name || "Club"}{t.season ? " · " + t.season : ""} · Pending review</div>
              </div>
              <button onClick={() => withdraw(t.id)} style={{ background: "transparent", border: "none", color: MUTED, borderRadius: 5, padding: "5px 8px", fontFamily: mono, fontSize: 10, cursor: "pointer", textTransform: "uppercase", flexShrink: 0 }}>Withdraw</button>
            </div>
          ))}
        </div>
      )}
      {claiming && <ClaimTrophyForm claimantName={player.name ? player.name + (player.last ? " " + player.last : "") : undefined} onClose={() => setClaiming(false)} onSubmitted={reload} />}
    </div>
  );
}
