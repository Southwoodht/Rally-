"use client";
import React, { useEffect, useState } from "react";
import { BigBtn, Field } from "@/components/ui/atoms";
import { Club, listMyAdminClubs } from "@/lib/clubs";
import { recordTrophyForPlayer } from "@/lib/trophies";
import { BALL, CLAY, COURT, MUTED, body, input, mono } from "@/lib/theme";

// The mirror image of ClaimTrophyForm. There, a player claims an honour and
// waits for an admin. Here the admin is the one filling it in, for somebody
// who has no account to claim anything with — so there's nobody left to
// review it and it goes on straight away. The club list is deliberately
// only clubs you administer: the whole authority for this comes from that.
export function RecordTrophyForm({ playerId, playerName, onClose, onSubmitted }: any) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [clubId, setClubId] = useState("");
  const [competition, setCompetition] = useState("");
  const [season, setSeason] = useState("");
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const mine = await listMyAdminClubs();
        setClubs(mine);
        if (mine.length) setClubId(mine[0].id);
      } catch {}
      setLoadingClubs(false);
    })();
  }, []);

  const submit = async () => {
    setError("");
    if (!competition.trim()) { setError("What competition was this?"); return; }
    if (!clubId) { setError("Pick a club."); return; }
    setBusy(true);
    try {
      await recordTrophyForPlayer({ clubId, playerId, playerName, competition, season, result, notes });
      onSubmitted && onSubmitted();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Couldn't record that trophy.");
    }
    setBusy(false);
  };

  const who = playerName || "this player";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 95 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "none", padding: "20px 18px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>Record a trophy</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, borderRadius: 10, padding: "4px 10px", fontFamily: mono, fontSize: 12, cursor: "pointer" }}>Close</button>
        </div>
        <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, marginBottom: 16, lineHeight: 1.5 }}>
          {who} hasn't got an account yet, so there's nobody to claim this — you're recording it as the club's administrator and it goes on straight away. It'll be waiting on their profile the day they claim this player.
        </div>

        {!loadingClubs && clubs.length === 0 && (
          <div style={{ fontFamily: body, fontSize: 13, color: CLAY, marginBottom: 16, lineHeight: 1.5 }}>
            You don't administer any clubs, so there's no club to record this under.
          </div>
        )}

        {!loadingClubs && clubs.length > 0 && (
          <>
            <Field label="Club">
              <select value={clubId} onChange={(e) => setClubId(e.target.value)} style={{ ...input, boxSizing: "border-box" as const }}>
                {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Competition"><input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="e.g. Men's Singles" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
            <Field label="Result / position"><input value={result} onChange={(e) => setResult(e.target.value)} placeholder="e.g. Champion, or No. 4" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
            <Field label="Season / year"><input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="e.g. 2019" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
            <Field label="Notes (optional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering about it" style={{ ...input, boxSizing: "border-box" as const }} /></Field>

            {error && <div style={{ fontFamily: body, fontSize: 12.5, color: CLAY, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <BigBtn onClick={submit} disabled={busy} color={BALL}>{busy ? "Recording…" : "Record trophy"}</BigBtn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
