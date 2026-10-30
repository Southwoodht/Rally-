"use client";
import React, { useEffect, useState } from "react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { listLeagueMembers, removeLeagueMember, setLeagueRole, setMemberName, type LeagueMember } from "@/lib/leagues";
import { isOffensiveName, OFFENSIVE_NAME_MESSAGE } from "@/core/nameFilter";
import {
  DOT_LOSS, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body,
} from "@/lib/theme";

// Who is in the league and what they are allowed to do.
//
// Nothing in Rally could change a role before this: createLeague wrote "owner"
// once, joinLeague wrote "member" once, and that was the end of it. Sam asked
// for it directly — "league owner should be able to choose editor" — and it
// matters more than a convenience, because owner-or-editor gates editing other
// people's matches, announcements, fixtures, trophies and level estimates. A
// league whose roles are wrong has all of that shut, for everybody, forever.
//
// Everyone can see the list. Only an owner sees the controls, and the refusal
// is enforced in set_league_role rather than here — the same rule as the nudge
// and the level estimate, and the same reason: the client's idea of your role
// has been wrong twice this month where the database's was right.

const ROLES: Array<{ value: "owner" | "editor" | "member"; label: string; note: string }> = [
  { value: "owner", label: "Owner", note: "Everything, including who else is an owner or editor." },
  { value: "editor", label: "Editor", note: "Run the club — results, fixtures, announcements, levels. Not roles." },
  { value: "member", label: "Member", note: "Play, log your own results, read everything." },
];

export function LeagueMembers({ leagueId, leagueName, onRemoved }: { leagueId: string; leagueName?: string; onRemoved?: () => void }) {
  const [members, setMembers] = useState<LeagueMember[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const load = async () => {
    try { setMembers(await listLeagueMembers(leagueId)); setProblem(null); }
    catch (e: any) { setProblem(e?.message || "Couldn't read the members."); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [leagueId]);

  const iAmOwner = !!members?.some((m) => m.isMe && m.role === "owner");
  const iAmStaff = !!members?.some((m) => m.isMe && (m.role === "owner" || m.role === "editor"));

  // Renaming a member (Sam, 2026-10-30: "Cheesedog4000…" → "Charlie Easey").
  // Owners and editors; an editor can't rename an owner. Sets their account
  // name and their player in this club together (schema_member_rename.sql).
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const rename = async (m: LeagueMember) => {
    const name = newName.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (isOffensiveName(name)) { setFailed({ id: m.userId, message: OFFENSIVE_NAME_MESSAGE }); return; }
    setBusy(m.userId); setFailed(null);
    try {
      await setMemberName(leagueId, m.userId, name);
      setRenaming(null); setNewName("");
      await load();
      onRemoved?.();
    } catch (e: any) {
      setFailed({ id: m.userId, message: e?.message || "Couldn't rename them." });
    }
    setBusy(null);
  };

  const change = async (m: LeagueMember, role: "owner" | "editor" | "member") => {
    setBusy(m.userId); setFailed(null); setOpen(null);
    try {
      await setLeagueRole(leagueId, m.userId, role);
      await load();
    } catch (e: any) {
      setFailed({ id: m.userId, message: e?.message || "Couldn't change that role." });
    }
    setBusy(null);
  };

  // Removing somebody (Sam, 2026-10-24): owners only, never an owner, never
  // yourself. Their results stay on their player record, which is hidden from
  // the Table, so nobody's rating moves.
  const remove = async (m: LeagueMember) => {
    setBusy(m.userId); setFailed(null);
    try {
      await removeLeagueMember(leagueId, m.userId);
      setConfirmRemove(null); setOpen(null);
      await load();
      onRemoved?.();
    } catch (e: any) {
      setFailed({ id: m.userId, message: e?.message || "Couldn't remove them." });
    }
    setBusy(null);
  };

  if (problem) {
    return (
      <SurfaceCard radius={16} pad="14px" style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 }}>{problem}</div>
      </SurfaceCard>
    );
  }
  if (!members) return null;

  return (
    <SurfaceCard radius={16} pad="14px" style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: body, fontWeight: 500, fontSize: 14, color: FEED_TEXT_LOW, letterSpacing: 0, marginBottom: 10 }}>
        Who can do what{leagueName ? " in " + leagueName : ""}
      </div>

      {members.map((m) => (
        <div key={m.userId} style={{ padding: "9px 0", borderTop: "0.5px solid " + FEED_RAISED }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontWeight: 500, fontSize: 14.5, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {m.name}{m.isMe ? " (you)" : ""}
            </span>
            {iAmStaff && !m.isMe && (m.role !== "owner" || iAmOwner) && renaming !== m.userId && (
              <button onClick={() => { setRenaming(m.userId); setNewName(m.name || ""); setFailed(null); }} style={{ flexShrink: 0, background: "none", border: "none", padding: "4px 6px", cursor: "pointer", fontFamily: body, fontWeight: 600, fontSize: 12.5, color: FEED_TEXT_MID }}>
                Rename
              </button>
            )}
            {iAmOwner ? (
              <button
                onClick={() => setOpen(open === m.userId ? null : m.userId)}
                disabled={busy === m.userId}
                style={{
                  flexShrink: 0, fontFamily: body, fontWeight: 600, fontSize: 12.5, padding: "5px 11px",
                  borderRadius: 999, border: "none", cursor: "pointer",
                  background: m.role === "member" ? FEED_RAISED : FEED_LIME,
                  color: m.role === "member" ? FEED_TEXT_MID : FEED_LIME_INK,
                }}
              >
                {m.role === "owner" ? "Owner" : m.role === "editor" ? "Editor" : "Member"}
              </button>
            ) : (
              <span style={{ flexShrink: 0, fontFamily: body, fontWeight: 500, fontSize: 12.5, color: m.role === "member" ? FEED_TEXT_LOW : FEED_LIME }}>
                {m.role === "owner" ? "Owner" : m.role === "editor" ? "Editor" : "Member"}
              </span>
            )}
          </div>

          {renaming === m.userId && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Their real name" autoFocus maxLength={60}
                style={{ flex: 1, minWidth: 0, background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 10, padding: "9px 11px", fontFamily: body, fontSize: 14.5 }} />
              <button onClick={() => rename(m)} disabled={busy === m.userId || !newName.trim()} style={{ flexShrink: 0, background: FEED_LIME, color: FEED_LIME_INK, border: "none", borderRadius: 10, padding: "9px 12px", fontFamily: body, fontWeight: 600, fontSize: 13.5, cursor: "pointer", opacity: newName.trim() ? 1 : 0.5 }}>{busy === m.userId ? "Saving…" : "Save"}</button>
              <button onClick={() => { setRenaming(null); setFailed(null); }} style={{ flexShrink: 0, background: "none", border: "none", padding: "9px 4px", fontFamily: body, fontSize: 13.5, color: FEED_TEXT_MID, cursor: "pointer" }}>Cancel</button>
            </div>
          )}

          {open === m.userId && (
            <div style={{ marginTop: 8 }}>
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => change(m, r.value)}
                  style={{
                    display: "block", width: "100%", textAlign: "left", background: "transparent",
                    border: "none", padding: "8px 0", cursor: "pointer",
                  }}
                >
                  <span style={{ fontFamily: body, fontWeight: 600, fontSize: 13.5, color: r.value === m.role ? FEED_LIME : FEED_TEXT_HI }}>
                    {r.label}{r.value === m.role ? " · current" : ""}
                  </span>
                  <span style={{ display: "block", fontFamily: body, fontWeight: 500, fontSize: 12, color: FEED_TEXT_MID, lineHeight: 1.45, marginTop: 1 }}>
                    {r.note}
                  </span>
                </button>
              ))}
              {/* Two steps, and the confirm says what goes and what stays. */}
              {!m.isMe && m.role !== "owner" && (
                confirmRemove === m.userId ? (
                  <div style={{ marginTop: 6, padding: 12, borderRadius: 12, background: FEED_RAISED }}>
                    <div style={{ fontFamily: body, fontSize: 13.5, color: FEED_TEXT_HI, lineHeight: 1.45, marginBottom: 10 }}>
                      Remove {m.name} from {leagueName || "the club"}? Their results stay, so nobody&apos;s rating changes, and they come off the Table. They can only come back with the join code.
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => remove(m)} disabled={busy === m.userId} style={{ flex: 1, background: DOT_LOSS, color: FEED_LIME_INK, border: "none", borderRadius: 10, padding: "10px 8px", fontFamily: body, fontSize: 14, cursor: "pointer" }}>{busy === m.userId ? "Removing…" : "Remove"}</button>
                      <button onClick={() => setConfirmRemove(null)} style={{ flex: 1, background: "transparent", color: FEED_TEXT_HI, border: "0.5px solid " + FEED_TEXT_LOW, borderRadius: 10, padding: "10px 8px", fontFamily: body, fontSize: 14, cursor: "pointer" }}>Keep</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmRemove(m.userId)} style={{ display: "block", background: "none", border: "none", padding: "8px 0", cursor: "pointer", fontFamily: body, fontSize: 13.5, color: DOT_LOSS }}>
                    Remove from the club
                  </button>
                )
              )}
            </div>
          )}

          {/* On the row that produced it, not at the foot of the screen —
              §4's "eight hundred pixels below the tap". */}
          {failed?.id === m.userId && (
            <div style={{ fontFamily: body, fontWeight: 500, fontSize: 12.5, color: DOT_LOSS, lineHeight: 1.45, marginTop: 6 }}>
              {failed.message}
            </div>
          )}
        </div>
      ))}

      <div style={{ fontFamily: body, fontWeight: 500, fontSize: 11.5, color: FEED_TEXT_LOW, lineHeight: 1.5, marginTop: 12 }}>
        {iAmOwner
          ? "A club always needs an owner, so you cannot step down until somebody else is one. Make them an owner first, then change yourself to editor or member."
          : "Only an owner can change these."}
      </div>
    </SurfaceCard>
  );
}
