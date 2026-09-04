"use client";
import React, { useEffect, useState } from "react";
import { ClaimTrophyForm } from "@/components/profile/ClaimTrophyForm";
import { RecordTrophyForm } from "@/components/profile/RecordTrophyForm";
import { listMyAdminClubs } from "@/lib/clubs";
import { listApprovedTrophiesForPlayer, listMyTrophies, deleteTrophy, Trophy, withdrawTrophyClaim } from "@/lib/trophies";
import { BALL, CHALK, CLAY, LINE, MUTED, PANEL2, body, mono } from "@/lib/theme";

// Verified Trophies are distinct from the Achievements grid above them: an
// Achievement is computed by Rally itself from real match data — nobody
// checks it. A Trophy here has been through a club administrator's
// approve/reject review (see src/lib/trophies.ts) — a player can never
// self-award one, only submit a claim.
//
// A trophy reaches this list two ways. Either the person claimed it against
// their own account, or — for a player row nobody has claimed yet — a club
// admin recorded it directly, because most of a club's history belongs to
// people who have never opened Rally. Both are read by player row here, so
// the day somebody claims that row the recorded ones are simply theirs.
//
// Removal follows the same split. You can take down a trophy of your own,
// approved or not, without asking anyone — nobody else put it there. An
// admin can take down one they recorded. Neither can touch the other's,
// and RLS says so too, so the button is only ever the interface to that.
export function VerifiedTrophies({ player, meId }: any) {
  const isOwn = player.id === meId;
  const unclaimed = !player.auth_id;
  const [approved, setApproved] = useState<Trophy[]>([]);
  const [pending, setPending] = useState<Trophy[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [canRecord, setCanRecord] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const reload = async () => {
    try {
      setApproved((await listApprovedTrophiesForPlayer(player.id, player.auth_id)).filter((t) => t.kind === "trophy"));
      if (isOwn) {
        const mine = await listMyTrophies();
        setPending(mine.filter((t) => t.kind === "trophy" && t.status === "pending"));
      } else {
        setPending([]);
      }
    } catch {}
    setLoaded(true);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [player.id, player.auth_id, isOwn]);

  // Only asked for on an unclaimed row — it's the only place the answer
  // changes anything, and it's a round trip.
  useEffect(() => {
    let live = true;
    if (!unclaimed) { setCanRecord(false); return; }
    (async () => {
      try {
        const admin = await listMyAdminClubs();
        if (live) setCanRecord(admin.length > 0);
      } catch {}
    })();
    return () => { live = false; };
  }, [player.id, unclaimed]);

  if (!loaded) return null;
  if (!isOwn && approved.length === 0 && !canRecord) return null;

  const name = player.name ? player.name + (player.last ? " " + player.last : "") : "";

  const withdraw = async (id: string) => {
    try { await withdrawTrophyClaim(id); reload(); } catch {}
  };

  const remove = async (id: string) => {
    setConfirmRemove(null);
    try { await deleteTrophy(id); reload(); } catch {}
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED }}>Verified trophies</div>
        {isOwn && <button onClick={() => setClaiming(true)} style={{ background: "transparent", border: "none", color: BALL, fontFamily: mono, fontSize: 10.5, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>+ Claim a trophy</button>}
        {!isOwn && canRecord && <button onClick={() => setRecording(true)} style={{ background: "transparent", border: "none", color: BALL, fontFamily: mono, fontSize: 10.5, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>+ Record a trophy</button>}
      </div>
      {approved.length === 0 && pending.length === 0 && (
        <div style={{ fontFamily: body, fontSize: 13, color: MUTED }}>
          {canRecord
            ? "None yet. " + (name || "This player") + " hasn't got an account, so anything they won for your club is yours to record."
            : "None yet."}
        </div>
      )}
      {approved.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: pending.length ? 8 : 0 }}>
          {approved.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, background: PANEL2, border: "1px solid " + BALL, borderRadius: 12, padding: "10px 12px" }}>
              <span style={{ fontSize: 20 }}>🏆</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: body, fontSize: 14, color: CHALK, fontWeight: 700 }}>{t.result ? t.result + " — " : ""}{t.competition}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>{t.clubs?.name || "Club"}{t.season ? " · " + t.season : ""} · {t.claimed_by ? "Verified ✓" : "Recorded by the club ✓"}</div>
              </div>
              {((canRecord && !t.claimed_by) || (isOwn && !!t.claimed_by)) && (
                <button
                  onClick={() => (confirmRemove === t.id ? remove(t.id) : setConfirmRemove(t.id))}
                  onBlur={() => setConfirmRemove((c) => (c === t.id ? null : c))}
                  style={{ background: "transparent", border: "none", color: confirmRemove === t.id ? CLAY : MUTED, borderRadius: 5, padding: "5px 8px", fontFamily: mono, fontSize: 10, cursor: "pointer", textTransform: "uppercase", flexShrink: 0 }}
                >
                  {confirmRemove === t.id ? "Remove it?" : "Remove"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {approved.some((t) => !t.claimed_by) && unclaimed && (
        <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, marginTop: 6, lineHeight: 1.45 }}>
          Recorded against this player rather than an account. {name ? name + " keeps" : "They keep"} these the day they claim this player.
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
      {claiming && <ClaimTrophyForm claimantName={name || undefined} onClose={() => setClaiming(false)} onSubmitted={reload} />}
      {recording && <RecordTrophyForm playerId={player.id} playerName={name || undefined} onClose={() => setRecording(false)} onSubmitted={reload} />}
    </div>
  );
}
