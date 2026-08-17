"use client";
import React, { useEffect, useState } from "react";
import { BigBtn, Field } from "@/components/ui/atoms";
import { Club, createClub, listMyClubs } from "@/lib/clubs";
import { submitLegacyFactClaim } from "@/lib/trophies";
import { BALL, CLAY, COURT, LINE, MUTED, input, mono } from "@/lib/theme";

// A much smaller sibling of ClaimTrophyForm — same club-picking flow, same
// review queue, but for a career fact (currently just "started playing")
// rather than a competitive honour.
export function ClaimLegacyFactForm({ claimantName, factType, factValue, label, onClose, onSubmitted }: any) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [clubId, setClubId] = useState("");
  const [addingClub, setAddingClub] = useState(false);
  const [newClubName, setNewClubName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const mine = await listMyClubs();
        setClubs(mine);
        if (mine.length) setClubId(mine[0].id);
        else setAddingClub(true);
      } catch { setAddingClub(true); }
      setLoadingClubs(false);
    })();
  }, []);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      let useClubId = clubId;
      if (addingClub) {
        if (!newClubName.trim()) { setError("Give the club a name."); setBusy(false); return; }
        const club = await createClub(newClubName, "");
        useClubId = club.id;
      }
      if (!useClubId) { setError("Pick a club."); setBusy(false); return; }
      await submitLegacyFactClaim({ clubId: useClubId, claimantName, factType, factValue: String(factValue) });
      onSubmitted && onSubmitted();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Couldn't submit that.");
    }
    setBusy(false);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 95 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "1px solid " + LINE, padding: "20px 18px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>Verify a fact</div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid " + LINE, color: MUTED, borderRadius: 6, padding: "4px 10px", fontFamily: mono, fontSize: 12, cursor: "pointer" }}>Close</button>
        </div>
        <div style={{ fontFamily: mono, fontSize: 12, color: BALL, marginBottom: 16 }}>{label}: {factValue}</div>

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
                <input value={newClubName} onChange={(e) => setNewClubName(e.target.value)} placeholder="Club name" style={{ ...input, boxSizing: "border-box" as const }} />
                {clubs.length > 0 && <button onClick={() => setAddingClub(false)} style={{ background: "transparent", border: "none", color: MUTED, fontFamily: mono, fontSize: 11, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6 }}>Cancel — pick an existing club</button>}
              </>
            )}
          </Field>
        )}

        {error && <div style={{ fontFamily: mono, fontSize: 12, color: CLAY, marginBottom: 12 }}>{error}</div>}
        <BigBtn onClick={submit} disabled={busy} color={BALL}>{busy ? "Submitting…" : "Submit for review"}</BigBtn>
      </div>
    </div>
  );
}
