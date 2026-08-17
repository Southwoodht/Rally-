import { computeAchievements } from "@/core/achievements";

// In-app only — no push, no persisted read/unread state. Two tiers:
// "needs action" is always live (it's just filtering matches, so it can
// never go stale or drift from reality), "recent" is a 7-day rolling window
// over things that already carry their own real timestamp, so nothing new
// has to be logged or kept in sync to support this.
const RECENT_WINDOW_MS = 7 * 86400000;

export interface Notification {
  id: string;
  icon: string;
  text: string;
  date: number;
  action: "confirm" | "edit" | "none";
  matchId?: string;
}

export function computeLocalNotifications(meId: string, players: any[], matches: any[], posts: any[], nameOf: (id: string) => string): Notification[] {
  const out: Notification[] = [];
  const now = Date.now();
  const nm = (id: string) => { const p = players.find((x) => x.id === id); return p ? p.name + (p.last ? " " + p.last : "") : nameOf(id); };

  matches.filter((m) => m.status === "pending" && (m.p1 === meId || m.p2 === meId) && m.reportedBy !== meId).forEach((m) => {
    const other = nm(m.p1 === meId ? m.p2 : m.p1);
    out.push({ id: "confirm_" + m.id, icon: "⏳", text: `${other} logged a result — confirm or dispute it`, date: m.loggedAt || m.date, action: "confirm", matchId: m.id });
  });

  matches.filter((m) => m.pendingEdit && m.pendingEdit.proposedBy !== meId && (m.p1 === meId || m.p2 === meId)).forEach((m) => {
    const proposer = nm(m.pendingEdit.proposedBy);
    out.push({ id: "edit_" + m.id, icon: "✏️", text: `${proposer} proposed a change to your match — review it`, date: m.pendingEdit.proposedAt || now, action: "edit", matchId: m.id });
  });

  const myAchievements = computeAchievements(meId, matches);
  myAchievements.filter((a) => a.achieved && a.date && now - a.date <= RECENT_WINDOW_MS).forEach((a) => {
    out.push({ id: "ach_" + a.id, icon: a.icon, text: `Achievement unlocked: ${a.label}`, date: a.date!, action: "none" });
  });

  (posts || []).filter((p) => p.isAnnouncement && p.by !== meId && now - p.date <= RECENT_WINDOW_MS).forEach((p) => {
    out.push({ id: "ann_" + p.id, icon: "📌", text: `${nm(p.by)}: ${p.text}`, date: p.date, action: "none" });
  });

  players.filter((p) => p.auth_id && p.claimedAt && p.id !== meId && now - p.claimedAt <= RECENT_WINDOW_MS).forEach((p) => {
    out.push({ id: "claim_" + p.id, icon: "🤝", text: `${p.name}${p.last ? " " + p.last : ""} claimed their profile`, date: p.claimedAt, action: "none" });
  });

  return out.sort((a, b) => b.date - a.date);
}
