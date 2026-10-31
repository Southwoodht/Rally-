"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Maximize, X } from "lucide-react";
import qrcode from "qrcode-generator";
import { glickoStandings } from "@/core/glicko";
import { countsAsPlayed } from "@/core/matchStatus";
import { fullNameOf, formatMatchDateTime } from "@/lib/format";
import { inviteUrl } from "@/lib/invite";
import { PROVISIONAL_GAMES } from "@/lib/globalTable";
import {
  FEED_CARD, FEED_HAIRLINE, FEED_LIME, FEED_PAGE, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, display, tabular,
} from "@/lib/theme";

/**
 * Clubhouse TV — the club on the big screen (Rallio has a "live board"; Sam,
 * 2026-10-23: "Southwood vs Rallio").
 *
 * Open it on the clubhouse TV's browser, signed in as anybody in the club,
 * and leave it: the table, the latest results and what is coming up, read
 * from the same data and the same glickoStandings as the Table, re-read
 * every minute, with a QR code that takes a phone straight to the club's
 * join link. Nothing on it can be tapped into, so a passer-by can't change
 * anything on a TV left signed in.
 */
const REFRESH_MS = 60_000;

function QR({ text, size }: { text: string; size: number }) {
  const cells = useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { n, d };
  }, [text]);
  // Dark on white with a quiet zone: phones read that reliably whatever the
  // theme, where light-on-dark codes often fail.
  return (
    <svg width={size} height={size} viewBox={`-2 -2 ${cells.n + 4} ${cells.n + 4}`} style={{ background: "#fff", borderRadius: 10, display: "block" }} shapeRendering="crispEdges">
      <path d={cells.d} fill="#111" />
    </svg>
  );
}

export function ClubBoard({ clubName, players, matches, fixtures, doublesMatches, joinCode, onRefresh, onClose }: {
  clubName: string;
  players: any[];
  matches: any[];
  fixtures: any[];
  doublesMatches?: any[];
  joinCode?: string | null;
  /** Re-read the club; called every minute while the board is open. */
  onRefresh: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 15_000);
    const data = setInterval(() => { void onRefresh(); }, REFRESH_MS);
    return () => { clearInterval(clock); clearInterval(data); };
  }, [onRefresh]);

  // A TV that goes to sleep is not a board. Wake Lock where the browser has
  // it; nothing breaks where it doesn't.
  useEffect(() => {
    let lock: any = null;
    const ask = async () => { try { lock = await (navigator as any).wakeLock?.request("screen"); } catch {} };
    void ask();
    const again = () => { if (document.visibilityState === "visible") void ask(); };
    document.addEventListener("visibilitychange", again);
    return () => { document.removeEventListener("visibilitychange", again); try { lock?.release(); } catch {} };
  }, []);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const name = (id: string | null | undefined) => (id && byId.get(id) ? fullNameOf(byId.get(id)) : "Someone");

  // The Table's all-time view: active players seen in the last year, five
  // matches, the ± line.
  const table = useMemo(() => {
    const cutoff = Date.now() - 365 * 86400000;
    const recent = new Set<string>();
    matches.forEach((m) => { if (countsAsPlayed(m) && m.date >= cutoff) { recent.add(m.p1); recent.add(m.p2); } });
    const st = glickoStandings(players, matches, {
      minGames: PROVISIONAL_GAMES,
      eligible: (id) => recent.has(id) && !byId.get(id)?.inactive,
    });
    return Object.keys(st.place).sort((a, b) => st.place[a] - st.place[b]).slice(0, 10)
      .map((id) => ({ id, place: st.place[id], rating: Math.round(st.table.rating[id]) }));
  }, [players, matches, byId]);

  const results = useMemo(() => {
    const singles = matches.filter(countsAsPlayed).map((m) => {
      const draw = m.winner === "draw";
      const w = m.winner === "p2" ? m.p2 : m.p1, l = m.winner === "p2" ? m.p1 : m.p2;
      return { key: "s" + m.id, at: m.date, text: draw ? `${name(m.p1)} drew with ${name(m.p2)}` : `${name(w)} beat ${name(l)}`, score: m.score || "" };
    });
    const doubles = (doublesMatches || []).filter((d) => d.status === undefined || d.status === "confirmed").map((d) => {
      const team = (t: Array<string | null>) => t.map((id) => (id ? (byId.get(id)?.name || "?") : "?")).join(" & ");
      const aWon = d.winner === "A";
      const text = d.winner === "draw" ? `${team(d.teamA)} drew with ${team(d.teamB)}`
        : `${team(aWon ? d.teamA : d.teamB)} beat ${team(aWon ? d.teamB : d.teamA)}`;
      return { key: "d" + d.id, at: d.playedAt, text, score: (d.sets || []).map((s: any) => (aWon || d.winner === "draw" ? `${s.a}-${s.b}` : `${s.b}-${s.a}`)).join(", ") };
    });
    return [...singles, ...doubles].sort((a, b) => b.at - a.at).slice(0, 8);
  }, [matches, doublesMatches, byId]); // eslint-disable-line react-hooks/exhaustive-deps

  const upcoming = useMemo(() => fixtures
    .filter((f) => !f.done && f.booked && new Date(f.booked).getTime() >= now - 2 * 3600_000)
    .sort((a, b) => new Date(a.booked).getTime() - new Date(b.booked).getTime())
    .slice(0, 6), [fixtures, now]);

  const link = joinCode ? inviteUrl(joinCode) : "";
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(now);
  const ago = (t: number) => {
    const m = Math.round((now - t) / 60000);
    if (m < 60) return m <= 1 ? "just now" : `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    if (d < 14) return d === 1 ? "yesterday" : `${d} days ago`;
    return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" }).format(t).replace("Sept", "Sep");
  };

  const panel: React.CSSProperties = { background: FEED_CARD, borderRadius: 22, padding: "clamp(14px, 2vw, 26px)", minWidth: 0 };
  const heading: React.CSSProperties = { fontFamily: body, fontWeight: 600, fontSize: "clamp(17px, 1.8vw, 28px)", color: FEED_TEXT_MID, marginBottom: 10 };
  const row: React.CSSProperties = { display: "flex", alignItems: "baseline", gap: 12, padding: "clamp(6px, 0.8vw, 12px) 0", borderTop: "0.5px solid " + FEED_HAIRLINE };
  const big = "clamp(16px, 1.7vw, 30px)";
  const small = "clamp(13px, 1.1vw, 19px)";

  return (
    <div style={{ position: "fixed", inset: 0, background: FEED_PAGE, zIndex: 140, overflowY: "auto", padding: "calc(env(safe-area-inset-top) + 18px) clamp(14px, 3vw, 48px) 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: "clamp(14px, 2vw, 30px)" }}>
        <div style={{ flex: 1, minWidth: 0, fontFamily: display, fontWeight: 700, fontSize: "clamp(30px, 4.4vw, 76px)", color: FEED_TEXT_HI, textTransform: "uppercase", letterSpacing: "-0.5px", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {clubName}
        </div>
        <span style={{ ...tabular, fontFamily: body, fontSize: "clamp(22px, 2.6vw, 44px)", color: FEED_LIME }}>{clock}</span>
        <button aria-label="Full screen" onClick={() => { try { void document.documentElement.requestFullscreen?.(); } catch {} }} style={{ background: FEED_CARD, border: "none", borderRadius: 12, width: 40, height: 40, display: "grid", placeItems: "center", cursor: "pointer", color: FEED_TEXT_MID }}><Maximize size={18} /></button>
        <button aria-label="Close" onClick={() => { try { if (document.fullscreenElement) void document.exitFullscreen(); } catch {} onClose(); }} style={{ background: FEED_CARD, border: "none", borderRadius: 12, width: 40, height: 40, display: "grid", placeItems: "center", cursor: "pointer", color: FEED_TEXT_MID }}><X size={18} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "clamp(12px, 1.6vw, 26px)", alignItems: "start" }}>
        <div style={panel}>
          <div style={heading}>Club table</div>
          {table.map((r) => (
            <div key={r.id} style={row}>
              <span style={{ ...tabular, fontFamily: body, fontSize: big, color: r.place === 1 ? FEED_LIME : FEED_TEXT_MID, width: "1.6em", flexShrink: 0 }}>{r.place}</span>
              <span style={{ flex: 1, minWidth: 0, fontFamily: body, fontSize: big, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name(r.id)}</span>
              <span style={{ ...tabular, fontFamily: body, fontSize: big, color: FEED_TEXT_HI }}>{r.rating}</span>
            </div>
          ))}
          {!table.length && <div style={{ fontFamily: body, fontSize: small, color: FEED_TEXT_MID }}>Nobody has played enough to be placed yet.</div>}
        </div>

        <div style={panel}>
          <div style={heading}>Latest results</div>
          {results.map((r) => (
            <div key={r.key} style={{ ...row, flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: body, fontSize: big, color: FEED_TEXT_HI, lineHeight: 1.25 }}>{r.text}</span>
              <span style={{ ...tabular, fontFamily: body, fontSize: small, color: FEED_TEXT_LOW }}>{[r.score, ago(r.at)].filter(Boolean).join(" · ")}</span>
            </div>
          ))}
          {!results.length && <div style={{ fontFamily: body, fontSize: small, color: FEED_TEXT_MID }}>No results yet.</div>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(12px, 1.6vw, 26px)" }}>
          <div style={panel}>
            <div style={heading}>Coming up</div>
            {upcoming.map((f) => (
              <div key={f.id} style={{ ...row, flexDirection: "column", gap: 2 }}>
                <span style={{ fontFamily: body, fontSize: big, color: FEED_TEXT_HI, lineHeight: 1.25 }}>{name(f.p1)} v {name(f.p2)}</span>
                <span style={{ ...tabular, fontFamily: body, fontSize: small, color: FEED_TEXT_LOW }}>{formatMatchDateTime(f.booked)}</span>
              </div>
            ))}
            {!upcoming.length && <div style={{ fontFamily: body, fontSize: small, color: FEED_TEXT_MID }}>Nothing booked. Book a match in Southwood and it shows here.</div>}
          </div>
          {link && (
            <div style={{ ...panel, display: "flex", alignItems: "center", gap: "clamp(12px, 1.5vw, 24px)" }}>
              <QR text={link} size={140} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: body, fontWeight: 600, fontSize: big, color: FEED_TEXT_HI }}>Join {clubName}</div>
                <div style={{ fontFamily: body, fontSize: small, color: FEED_TEXT_MID, marginTop: 4, lineHeight: 1.4 }}>Scan with your phone camera, or enter code</div>
                <div style={{ ...tabular, fontFamily: body, fontSize: big, color: FEED_LIME, letterSpacing: 2, marginTop: 4 }}>{joinCode}</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ fontFamily: body, fontSize: 12, color: FEED_TEXT_LOW, marginTop: 16 }}>Updates every minute · Southwood</div>
    </div>
  );
}
