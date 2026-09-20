"use client";
import React, { useEffect, useState } from "react";
import { SurfaceCard } from "@/components/ui/Surfaces";
import { listLeagueMembers, setLeagueRole, type LeagueMember } from "@/lib/leagues";
import {
  FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body,
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
  { value: "editor", label: "Editor", note: "Run the league — results, fixtures, announcements, levels. Not roles." },
  { value: "member", label: "Member", note: "Play, log your own results, read everything." },
];

export function LeagueMembers({ leagueId, leagueName }: { leagueId: string; leagueName?: string }) {
  const [members, setMembers] = useState<LeagueMember[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    try { setMembers(await listLeagueMembers(leagueId)); setProblem(null); }
    catch (e: any) { setProblem(e?.message || "Couldn't read the members."); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [leagueId]);

  const iAmOwner = !!members?.some((m) => m.isMe && m.role === "owner");

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

  if (problem) {
    return (
      <SurfaceCard radius={16} pad="14px" style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: body, fontWeight: 400, fontSize: 13, color: FEED_TEXT_MID, lineHeight: 1.5 }}>{problem}</div>
      </SurfaceCard>
    );
  }
  if (!members) return null;

  return (
    <SurfaceCard radius={16} pad="14px" style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_LOW, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
        Who can do what{leagueName ? " in " + leagueName : ""}
      </div>

      {members.map((m) => (
        <div key={m.userId} style={{ padding: "9px 0", borderTop: "0.5px solid " + FEED_RAISED }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontWeight: 400, fontSize: 14.5, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {m.name}{m.isMe ? " (you)" : ""}
            </span>
            {iAmOwner ? (
              <button
                onClick={() => setOpen(open === m.userId ? null : m.userId)}
                disabled={busy === m.userId}
                style={{
                  flexShrink: 0, fontFamily: body, fontWeight: 500, fontSize: 12.5, padding: "5px 11px",
                  borderRadius: 999, border: "none", cursor: "pointer",
                  background: m.role === "member" ? FEED_RAISED : FEED_LIME,
                  color: m.role === "member" ? FEED_TEXT_MID : FEED_LIME_INK,
                }}
              >
                {m.role === "owner" ? "Owner" : m.role === "editor" ? "Editor" : "Member"}
              </button>
            ) : (
              <span style={{ flexShrink: 0, fontFamily: body, fontWeight: 400, fontSize: 12.5, color: m.role === "member" ? FEED_TEXT_LOW : FEED_LIME }}>
                {m.role === "owner" ? "Owner" : m.role === "editor" ? "Editor" : "Member"}
              </span>
            )}
          </div>

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
                  <span style={{ fontFamily: body, fontWeight: 500, fontSize: 13.5, color: r.value === m.role ? FEED_LIME : FEED_TEXT_HI }}>
                    {r.label}{r.value === m.role ? " · current" : ""}
                  </span>
                  <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, lineHeight: 1.45, marginTop: 1 }}>
                    {r.note}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* On the row that produced it, not at the foot of the screen —
              §4's "eight hundred pixels below the tap". */}
          {failed?.id === m.userId && (
            <div style={{ fontFamily: body, fontWeight: 400, fontSize: 12.5, color: "#F09595", lineHeight: 1.45, marginTop: 6 }}>
              {failed.message}
            </div>
          )}
        </div>
      ))}

      <div style={{ fontFamily: body, fontWeight: 400, fontSize: 11.5, color: FEED_TEXT_LOW, lineHeight: 1.5, marginTop: 12 }}>
        {iAmOwner
          ? "A league always needs an owner, so you cannot step down until somebody else is one. Make them an owner first, then change yourself to editor or member."
          : "Only an owner can change these."}
      </div>
    </SurfaceCard>
  );
}
