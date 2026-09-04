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
  // Anything that isn't "none" is something waiting on you, and that's what
  // the bell's count means. "none" is news you can read or ignore.
  action: "confirm" | "edit" | "none" | "friend" | "review";
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

  // A requested delete goes through on its own after 24 hours, on whichever
  // client happens to be open, and used to do it without telling anybody.
  // That is how two August matches went missing and weren't noticed for three
  // weeks. A match being removed from someone's record is the single most
  // destructive thing the app does on a timer, so it says so — to both
  // sides, including the person who asked, since a mis-tap is exactly the
  // case that needs catching.
  matches.filter((m) => m.deleteRequestedAt && (m.p1 === meId || m.p2 === meId)).forEach((m) => {
    const other = nm(m.p1 === meId ? m.p2 : m.p1);
    const mine = m.deleteRequestedBy === meId;
    const left = m.deleteRequestedAt + 24 * 3600 * 1000 - now;
    const when = left <= 0 ? "any moment now" : left < 3600 * 1000 ? "within the hour" : `in about ${Math.ceil(left / 3600000)}h`;
    out.push({
      id: "del_" + m.id,
      icon: "🗑️",
      text: mine
        ? `You asked to delete your match with ${other} — it goes for good ${when} unless you cancel`
        : `${other} asked to delete your match — it goes for good ${when} unless you say no`,
      date: m.deleteRequestedAt,
      action: "edit",
      matchId: m.id,
    });
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
