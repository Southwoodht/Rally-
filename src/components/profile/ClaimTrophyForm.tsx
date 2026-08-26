"use client";
import React, { useEffect, useState } from "react";
import { BigBtn, Field } from "@/components/ui/atoms";
import { Club, createClub, listMyClubs } from "@/lib/clubs";
import { submitTrophyClaim } from "@/lib/trophies";
import { BALL, CHALK, CLAY, COURT, LINE, MUTED, body, input, mono } from "@/lib/theme";

export function ClaimTrophyForm({ claimantName, onClose, onSubmitted }: any) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [clubId, setClubId] = useState("");
  const [addingClub, setAddingClub] = useState(false);
  const [newClubName, setNewClubName] = useState("");
  const [newClubLocation, setNewClubLocation] = useState("");
  const [competition, setCompetition] = useState("");
  const [season, setSeason] = useState("");
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const mine = await listMyClubs();
        setClubs(mine);
        if (mine.length) setClubId(mine[0].id);
        else setAddingClub(true);
      } catch {
        setAddingClub(true);
      }
      setLoadingClubs(false);
    })();
  }, []);

  const submit = async () => {
    setError("");
    if (!competition.trim()) { setError("What competition was this?"); return; }
    setBusy(true);
    try {
      let useClubId = clubId;
      if (addingClub) {
        if (!newClubName.trim()) { setError("Give the club a name."); setBusy(false); return; }
        const club = await createClub(newClubName, newClubLocation);
        useClubId = club.id;
      }
      if (!useClubId) { setError("Pick a club."); setBusy(false); return; }
      await submitTrophyClaim({ clubId: useClubId, claimantName, competition, season, result, notes });
      onSubmitted && onSubmitted();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Couldn't submit that claim.");
    }
    setBusy(false);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 95 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "none", padding: "20px 18px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>Claim a trophy</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, borderRadius: 10, padding: "4px 10px", fontFamily: mono, fontSize: 12, cursor: "pointer" }}>Close</button>
        </div>
        <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, marginBottom: 16, lineHeight: 1.5 }}>
          This goes to the club's administrator to verify — it won't show as a trophy on your profile until they approve it.
        </div>

        {!loadingClubs && (
          <Field label="Club">
            {!addingClub && clubs.length > 0 && (
              <>
                <select value={clubId} onChange={(e) => setClubId(e.target.value)} style={{ ...input, boxSizing: "border-box" as const, marginBottom: 8 }}>
                  {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => setAddingClub(true)} style={{ background: "transparent", border: "none", color: BALL, fontFamily: mono, fontSize: 11, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>+ Add a different club</button>
              </>
            )}
            {addingClub && (
              <>
                <input value={newClubName} onChange={(e) => setNewClubName(e.target.value)} placeholder="Club name" style={{ ...input, boxSizing: "border-box" as const, marginBottom: 8 }} />
                <input value={newClubLocation} onChange={(e) => setNewClubLocation(e.target.value)} placeholder="Location (optional)" style={{ ...input, boxSizing: "border-box" as const }} />
                {clubs.length > 0 && <button onClick={() => setAddingClub(false)} style={{ background: "transparent", border: "none", color: MUTED, fontFamily: mono, fontSize: 11, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6 }}>Cancel — pick an existing club</button>}
                {clubs.length === 0 && <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, marginTop: 6 }}>You'll become this club's administrator, so you can verify claims for it (including this one, and anyone else's later).</div>}
              </>
            )}
          </Field>
        )}

        <Field label="Competition"><input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="e.g. Men's Singles" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
        <Field label="Result / position"><input value={result} onChange={(e) => setResult(e.target.value)} placeholder="e.g. Champion, or No. 4" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
        <Field label="Season / year"><input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="e.g. 2019" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
        <Field label="Notes (optional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything that helps them verify it" style={{ ...input, boxSizing: "border-box" as const }} /></Field>

        {error && <div style={{ fontFamily: body, fontSize: 12.5, color: CLAY, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <BigBtn onClick={submit} disabled={busy} color={BALL}>{busy ? "Submitting…" : "Submit for review"}</BigBtn>
        </div>
      </div>
    </div>
  );
}
