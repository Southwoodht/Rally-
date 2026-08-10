import { D, uid } from "@/lib/format";

export function buildBulk(p1, p2, w, d, l, fromY, toY) {
  const start = fromY ? D(fromY + "-01-01") : Date.now() - 86400000 * 365;
  const end = toY ? D(toY + "-12-31") : Date.now();
  const results: Array<"p1" | "draw" | "p2"> = [];
  for (let i = 0; i < w; i++) results.push("p1");
  for (let i = 0; i < d; i++) results.push("draw");
  for (let i = 0; i < l; i++) results.push("p2");
  const total = results.length;
  const span = Math.max(end - start, 0);
  return results.map((r, i) => ({ id: uid(), date: total > 1 ? Math.round(start + span * (i / (total - 1))) : start, p1, p2, winner: r, score: "", status: "confirmed", reportedBy: null }));
}
