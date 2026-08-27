// "This time last year you beat X 6-4" — only ever surfaces a match that
// genuinely happened close to today's date in a past year. No fabricated
// memories: if nothing falls within the window, there's simply no memory
// to show that day.

const DAY = 86400000;
const WINDOW_DAYS = 3;

export interface Memory {
  date: number;
  text: string;
}

export function findMemory(playerId: string, matches: any[], nameOf: (id: string) => string): Memory | null {
  const now = new Date();
  const candidates = (matches || []).filter((m) => (m.p1 === playerId || m.p2 === playerId) && m.status !== "pending");
  if (!candidates.length) return null;

  for (let yearsBack = 1; yearsBack <= 10; yearsBack++) {
    const target = new Date(now.getFullYear() - yearsBack, now.getMonth(), now.getDate()).getTime();
    const inWindow = candidates
      .filter((m) => Math.abs(m.date - target) <= WINDOW_DAYS * DAY)
      .sort((a, b) => Math.abs(a.date - target) - Math.abs(b.date - target));
    if (!inWindow.length) continue;

    const m = inWindow[0];
    const oppId = m.p1 === playerId ? m.p2 : m.p1;
    const oppName = nameOf(oppId);
    const iWon = (m.winner === "p1" && m.p1 === playerId) || (m.winner === "p2" && m.p2 === playerId);
    const verb = m.winner === "draw" ? "drew with" : iWon ? "beat" : "lost to";
    const when = yearsBack === 1 ? "This time last year" : `${yearsBack} years ago, around now`;
    return { date: m.date, text: `${when}, you ${verb} ${oppName}${m.score ? " " + m.score : ""}.` };
  }
  return null;
}
