"use client";
import React, { useEffect, useState } from "react";
import { BigBtn, Field } from "@/components/ui/atoms";
import { Club, createClub, listMyClubs } from "@/lib/clubs";
import { submitTrophyClaim } from "@/lib/trophies";
import { FEED_OVERLAY, BALL, CHALK, CLAY, COURT, LINE, MUTED, body, input, segmentOption, segmentTrack } from "@/lib/theme";
import { guessFormat, type TrophySide } from "@/core/trophyTimeline";

// Same fix as RecordTrophyForm: iOS sizes a date input itself unless told not to.
const DATE_INPUT: React.CSSProperties = {
  ...input, boxSizing: "border-box", display: "block", width: "100%", minWidth: 0,
  WebkitAppearance: "none", appearance: "none", textAlign: "left",
};

export function ClaimTrophyForm({ claimantName, onClose, onSubmitted }: any) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [clubId, setClubId] = useState("");
  const [addingClub, setAddingClub] = useState(false);
  const [newClubName, setNewClubName] = useState("");
  const [newClubLocation, setNewClubLocation] = useState("");
  const [competition, setCompetition] = useState("");
  const [season, setSeason] = useState("");
  const [wonOn, setWonOn] = useState("");
  // Guessed from the competition's name until somebody taps one, then theirs.
  const [format, setFormat] = useState<TrophySide | null>(null);
  const shownFormat: TrophySide = format ?? guessFormat(competition);
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
      await submitTrophyClaim({ clubId: useClubId, claimantName, competition, season: season.trim() || (wonOn ? wonOn.slice(0, 4) : ""), result, notes, wonOn, format: shownFormat });
      onSubmitted && onSubmitted();
      onClose();
    } catch (e: any) {
      setError(/won_on/.test(String(e?.message || "")) ? "Saving a date needs schema_trophy_won_on.sql running in Supabase first. Clear the date to save it without one." : e?.message || "Couldn't submit that claim.");
    }
    setBusy(false);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: FEED_OVERLAY, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 95 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: 26, borderTopRightRadius: 26, border: "none", padding: "20px 18px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: body, fontSize: 13, letterSpacing: 0, color: MUTED }}>Claim a trophy</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, borderRadius: 10, padding: "4px 10px", fontFamily: body, fontSize: 12, cursor: "pointer" }}>Close</button>
        </div>
        <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginBottom: 16, lineHeight: 1.5 }}>
          This goes to the club's administrator to verify — it won't show as a trophy on your profile until they approve it.
        </div>

        {!loadingClubs && (
          <Field label="Club">
            {!addingClub && clubs.length > 0 && (
              <>
                <select value={clubId} onChange={(e) => setClubId(e.target.value)} style={{ ...input, boxSizing: "border-box" as const, marginBottom: 8 }}>
                  {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => setAddingClub(true)} style={{ background: "transparent", border: "none", color: BALL, fontFamily: body, fontSize: 13, cursor: "pointer", letterSpacing: 0 }}>+ Add a different club</button>
              </>
            )}
            {addingClub && (
              <>
                <input value={newClubName} onChange={(e) => setNewClubName(e.target.value)} placeholder="Club name" style={{ ...input, boxSizing: "border-box" as const, marginBottom: 8 }} />
                <input value={newClubLocation} onChange={(e) => setNewClubLocation(e.target.value)} placeholder="Location (optional)" style={{ ...input, boxSizing: "border-box" as const }} />
                {clubs.length > 0 && <button onClick={() => setAddingClub(false)} style={{ background: "transparent", border: "none", color: MUTED, fontFamily: body, fontSize: 13, cursor: "pointer", letterSpacing: 0, marginTop: 6 }}>Cancel — pick an existing club</button>}
                {clubs.length === 0 && <div style={{ fontFamily: body, fontSize: 12, color: MUTED, marginTop: 6 }}>You'll become this club's administrator, so you can verify claims for it (including this one, and anyone else's later).</div>}
              </>
            )}
          </Field>
        )}

        <Field label="Competition"><input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="e.g. Men's Singles" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
        {/* Which side of the app it shows on — the doubles feed and profile,
            or the singles ones. A badge either way: it never counts in a rating. */}
        <Field label="Singles or doubles">
          <div style={{ ...segmentTrack, marginBottom: 0 }}>
            <button type="button" onClick={() => setFormat("singles")} style={segmentOption(shownFormat === "singles")}>Singles</button>
            <button type="button" onClick={() => setFormat("doubles")} style={segmentOption(shownFormat === "doubles")}>Doubles</button>
          </div>
        </Field>
        <Field label="Result / position"><input value={result} onChange={(e) => setResult(e.target.value)} placeholder="e.g. Champion, or No. 4" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
        <Field label="Season / year"><input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="e.g. 2019" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
        {/* The day puts it in the match history among the run of results that
            led to it; the year alone only puts it under the year. Optional,
            because nobody remembers the date of a 2019 final. */}
        <Field label="Date won (optional)"><input type="date" value={wonOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setWonOn(e.target.value)} style={DATE_INPUT} /></Field>
        <Field label="Notes (optional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything that helps them verify it" style={{ ...input, boxSizing: "border-box" as const }} /></Field>

        {error && <div style={{ fontFamily: body, fontSize: 12, color: CLAY, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <BigBtn onClick={submit} disabled={busy} color={BALL}>{busy ? "Submitting…" : "Submit for review"}</BigBtn>
        </div>
      </div>
    </div>
  );
}
