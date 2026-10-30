"use client";
import React, { useEffect, useState } from "react";
import { listMyLeagues, type League } from "@/lib/leagues";
import { sendMessage, startThread } from "@/lib/messages";
import { inviteUrl } from "@/lib/invite";
import { FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, body } from "@/lib/theme";

/**
 * "Invite to Seacourt" on the profile of somebody outside your clubs (Sam,
 * 2026-10-30, after Challenge told him Samuel Truman wasn't in one of his).
 *
 * It sends them a message with the club's invite link — the same
 * ?join=CODE link Run your club hands out, redeemed by the same
 * joinLeague() — so it arrives where they already look, and from a
 * stranger it lands as a message request like any first message. With more
 * than one club you pick which.
 */
export function InviteToClub({ authId, firstName }: { authId: string; firstName: string }) {
  const [clubs, setClubs] = useState<League[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [state, setState] = useState<{ kind: "idle" } | { kind: "busy" } | { kind: "sent"; club: string } | { kind: "error"; msg: string }>({ kind: "idle" });

  useEffect(() => {
    let live = true;
    listMyLeagues().then((ls) => { if (live) setClubs(ls.filter((l) => l.join_code)); }).catch(() => { if (live) setClubs([]); });
    return () => { live = false; };
  }, []);

  if (!clubs || clubs.length === 0) return null;

  const send = async (club: League) => {
    setPicking(false);
    setState({ kind: "busy" });
    try {
      const thread = await startThread(authId);
      await sendMessage(thread, `Come and join ${club.name} on Southwood, then we can play: ${inviteUrl(club.join_code)}`);
      setState({ kind: "sent", club: club.name });
    } catch (e: any) {
      setState({ kind: "error", msg: e?.message || "Couldn't send the invite." });
    }
  };

  const btn: React.CSSProperties = { width: "100%", border: "none", borderRadius: 999, padding: "13px 16px", fontFamily: body, fontWeight: 600, fontSize: 15, cursor: "pointer" };
  const one = clubs.length === 1 ? clubs[0] : null;

  if (state.kind === "sent") {
    return (
      <div style={{ background: FEED_CARD, borderRadius: 14, padding: "12px 14px", marginBottom: 16, fontFamily: body, fontWeight: 500, fontSize: 13.5, color: FEED_TEXT_HI, lineHeight: 1.5 }}>
        Invite to {state.club} sent to {firstName}. It&apos;s in your messages; once they join you can challenge them.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        disabled={state.kind === "busy"}
        onClick={() => (one ? send(one) : setPicking(!picking))}
        style={{ ...btn, background: FEED_LIME, color: FEED_LIME_INK, opacity: state.kind === "busy" ? 0.6 : 1 }}
      >
        {state.kind === "busy" ? "Sending…" : one ? `Invite to ${one.name}` : "Invite to a club"}
      </button>
      {picking && !one && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {clubs.map((c) => (
            <button key={c.id} onClick={() => send(c)} style={{ ...btn, background: FEED_RAISED, color: FEED_TEXT_HI }}>{c.name}</button>
          ))}
        </div>
      )}
      {state.kind === "error" && (
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_MID, marginTop: 8 }}>{state.msg}</div>
      )}
    </div>
  );
}
