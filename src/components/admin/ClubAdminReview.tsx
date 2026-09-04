"use client";
import React, { useEffect, useState } from "react";
import { BigBtn, Field } from "@/components/ui/atoms";
import { Club, createClub, joinClubByCode, listMyClubs } from "@/lib/clubs";
import { approveTrophy, listPendingClaims, rejectTrophy, Trophy } from "@/lib/trophies";
import { BALL, CHALK, CLAY, LINE, MUTED, PANEL, PANEL2, body, input, mono } from "@/lib/theme";

const FACT_LABEL: Record<string, string> = { started_playing: "Started playing" };

// A club admin's queue: pending trophy AND legacy-fact claims for the clubs
// they administer — same review, same RLS-enforced approve/reject either way.
// Approve/reject is enforced server-side by RLS (see schema_clubs_trophies.sql)
// — this screen is just the interface to that, not the source of trust.
//
// It's also where a club starts. Until this screen existed as a destination
// in its own right, the only way to become an admin was a side effect of
// claiming a trophy: the claim form offered to create a club if you had
// none. That made the entrance to the whole feature a form about something
// else, and left the menu entry hidden behind being an admin already —
// which nobody could become. So the setup lives here, in the open.
export function ClubAdminReview() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [claims, setClaims] = useState<Record<string, Trophy[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const reload = async () => {
    setLoading(true);
    try {
      const mine = await listMyClubs();
      setClubs(mine);
      const byClub: Record<string, Trophy[]> = {};
      for (const c of mine) {
        if (c.role !== "admin") continue;
        byClub[c.id] = await listPendingClaims(c.id);
      }
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

  const create = async () => {
    setError(""); setNote("");
    if (!newName.trim()) { setError("Give the club a name."); return; }
    setBusy(true);
    try {
      const club = await createClub(newName, newLocation);
      setNewName(""); setNewLocation("");
      setNote("Created " + club.name + ". You're its administrator.");
      await reload();
    } catch (e: any) {
      setError(e?.message || "Couldn't create that club.");
    }
    setBusy(false);
  };

  const join = async () => {
    setError(""); setNote("");
    if (!joinCode.trim()) { setError("Paste the club's code."); return; }
    setBusy(true);
    try {
      const club = await joinClubByCode(joinCode);
      setJoinCode("");
      setNote("You're in " + club.name + ".");
      await reload();
    } catch (e: any) {
      setError(e?.message || "Couldn't join that club.");
    }
    setBusy(false);
  };

  if (loading) return <div style={{ fontFamily: body, fontSize: 14, color: MUTED, padding: "20px 0" }}>Loading…</div>;

  const adminClubs = clubs.filter((c) => c.role === "admin");
  const memberClubs = clubs.filter((c) => c.role !== "admin");

  return (
    <div>
      <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, lineHeight: 1.5, marginBottom: 18 }}>
        A club is who vouches for a trophy. Its administrator approves what players claim, and can record honours
        directly for players who haven't got an account — those wait on the player and transfer the day they claim it.
      </div>

      {adminClubs.length === 0 && (
        <div style={{ background: PANEL, borderRadius: 14, padding: "14px", marginBottom: 20 }}>
          <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: BALL, marginBottom: 8 }}>Set up your club</div>
          <div style={{ fontFamily: body, fontSize: 12.5, color: MUTED, lineHeight: 1.5, marginBottom: 12 }}>
            You don't administer a club yet, so there's nobody to verify a trophy. Creating one makes you its
            administrator — you'll be able to approve claims and record honours for unclaimed players straight away.
          </div>
          <Field label="Club name"><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Seacourt" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
          <Field label="Location (optional)"><input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="e.g. Oxford" style={{ ...input, boxSizing: "border-box" as const }} /></Field>
          <div style={{ display: "flex", gap: 8 }}><BigBtn onClick={create} disabled={busy} color={BALL}>{busy ? "Creating…" : "Create club"}</BigBtn></div>
        </div>
      )}

      {clubs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, marginBottom: 8 }}>Your clubs</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...adminClubs, ...memberClubs].map((c) => (
              <div key={c.id} style={{ background: PANEL, borderRadius: 14, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: body, fontSize: 14.5, color: CHALK, fontWeight: 700 }}>{c.name}</div>
                    {c.location && <div style={{ fontFamily: body, fontSize: 12, color: MUTED }}>{c.location}</div>}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 1, color: c.role === "admin" ? BALL : MUTED, flexShrink: 0 }}>
                    {c.role === "admin" ? "You administer this" : "Member"}
                  </div>
                </div>
                {c.role === "admin" && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid " + LINE, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: body, fontSize: 12, color: MUTED }}>Anyone joining this club types</span>
                    <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: CHALK, letterSpacing: 2 }}>{c.join_code}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: PANEL, borderRadius: 14, padding: "14px", marginBottom: 20 }}>
        <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, marginBottom: 8 }}>Join a club by code</div>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="e.g. K7P2Q9" maxLength={12} style={{ ...input, boxSizing: "border-box" as const, flex: 1, fontFamily: mono, letterSpacing: 2 }} />
          <BigBtn onClick={join} disabled={busy} color={BALL} grow={false}>Join</BigBtn>
        </div>
        <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, marginTop: 8, lineHeight: 1.45 }}>
          Joining makes you a member, never an administrator — so a code that gets passed around can't become a way
          to approve your own claims.
        </div>
      </div>

      {error && <div style={{ fontFamily: body, fontSize: 12.5, color: CLAY, marginBottom: 12 }}>{error}</div>}
      {note && <div style={{ fontFamily: body, fontSize: 12.5, color: BALL, marginBottom: 12 }}>{note}</div>}

      {adminClubs.length > 0 && (
        <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, marginBottom: 8 }}>Claims to review</div>
      )}
      {adminClubs.map((c) => {
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
