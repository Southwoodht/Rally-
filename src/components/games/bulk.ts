import { D, uid } from "@/lib/format";

// fromDate/toDate are plain "YYYY-MM-DD" strings from a date input, not
// years — lets someone spread a record across e.g. just March–June instead
// of being forced to claim the whole year.
export function buildBulk(p1, p2, w, d, l, fromDate, toDate) {
  const now = Date.now();
  const start = Math.min(fromDate ? D(fromDate) : now - 86400000 * 365, now);
  // Never generate a match dated after today — a range reaching into "this
  // year" shouldn't be able to invent results for days that haven't
  // happened yet.
  const end = Math.min(toDate ? D(toDate) : now, now);
  const results: Array<"p1" | "draw" | "p2"> = [];
  for (let i = 0; i < w; i++) results.push("p1");
  for (let i = 0; i < d; i++) results.push("draw");
  for (let i = 0; i < l; i++) results.push("p2");
  const total = results.length;
  const span = Math.max(end - start, 0);
  return results.map((r, i) => ({ id: uid(), date: total > 1 ? Math.round(start + span * (i / (total - 1))) : start, p1, p2, winner: r, score: "", status: "confirmed", reportedBy: null }));
}
