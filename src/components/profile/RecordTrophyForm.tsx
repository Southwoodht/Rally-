"use client";
import React, { useEffect, useState } from "react";
import { BigBtn, Field } from "@/components/ui/atoms";
import { Club, listMyAdminClubs } from "@/lib/clubs";
import { recordTrophyForPlayer } from "@/lib/trophies";
import { FEED_OVERLAY, BALL, CLAY, COURT, MUTED, body, input } from "@/lib/theme";

// The mirror image of ClaimTrophyForm. There, a player claims an honour and
// waits for an admin. Here the admin is the one filling it in — the admin IS
// the review, so it goes on straight away. The club list is deliberately
// only clubs you administer: the whole authority for this comes from that.
//
// Since 2026-10-14 (schema_trophies_award_any.sql) that is anybody in a league
// the admin is in, not only players with no account: Sam was handing Zaach a
// trophy he had just won and the app made Zaach claim it himself. The player
// can take an admin-awarded trophy off their own profile, which is the check
// that replaced "no account".
export function RecordTrophyForm({ playerId, playerName, hasAccount, onClose, onSubmitted }: any) {
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
      // RLS refusing the insert is the one failure with a known cause: the
      // database hasn't had schema_trophies_award_any.sql, which is what lets
      // an admin award a player who has an account. Say that, not "violates
      // row-level security policy".
      const msg = String(e?.message || "");
      setError(/row-level security/i.test(msg)
        ? (hasAccount
          ? "The database isn't set up to award trophies to players with an account yet — it needs schema_trophies_award_any.sql running in Supabase."
          : "The database refused that. Check you administer the club and are in this player's league.")
        : msg || "Couldn't record that trophy.");
    }
    setBusy(false);
  };

  const who = playerName || "this player";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: FEED_OVERLAY, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 95 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: 26, borderTopRightRadius: 26, border: "none", padding: "20px 18px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: body, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: MUTED }}>Give a trophy</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, borderRadius: 10, padding: "4px 10px", fontFamily: body, fontSize: 12, cursor: "pointer" }}>Close</button>
        </div>
        <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, marginBottom: 16, lineHeight: 1.5 }}>
          {hasAccount
            ? <>You're awarding this as the club's administrator, so it goes on {who}'s profile straight away. They can take it off their own profile if it's wrong.</>
            : <>{who} hasn't got an account yet — you're recording it as the club's administrator and it goes on straight away. It'll be waiting on their profile the day they claim this player.</>}
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
              <BigBtn onClick={submit} disabled={busy} color={BALL}>{busy ? "Saving…" : "Give trophy"}</BigBtn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
