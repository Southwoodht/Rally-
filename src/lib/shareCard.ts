/**
 * "Share my card" (Sam, 2026-10-25): one picture of a profile — photo, name,
 * level, the record, win rate, rating and place, last five, best wins and
 * achievements — drawn on a canvas and handed to the phone's share sheet
 * (WhatsApp, Instagram, Messages), or saved where sharing a file isn't
 * possible.
 *
 * 1080 × 1350, the portrait size every social app shows uncropped. Drawn
 * from exactly what the profile screen shows, never recomputed, so the card
 * and the screen cannot disagree.
 */

export interface ShareCardData {
  name: string;
  photo?: string | null;
  club: string;
  level?: string | null;
  record: { w: number; d: number; l: number };
  winRate: number;
  rankings: Array<{ label: string; value: string }>;
  form: Array<"W" | "D" | "L">;
  bestWins: Array<{ name: string; sub: string }>;
  achievements: { done: string[]; total: number };
}

const W = 1080, H = 1350;
const CREAM = "#F8F4EB", CARD = "#FFFDF8", INK = "#2A2118", MID = "#7A6B58", BRASS = "#B8955A", LINE = "#E6DCC8";
const WIN = "#1E5A38", DRAW = "#8C867C", LOSS = "#A8261E";

/** The app's own fonts, resolved to the names the canvas understands. */
function fontFor(cssVar: string, fallback: string): string {
  try {
    const el = document.createElement("span");
    el.style.fontFamily = cssVar;
    el.style.position = "absolute";
    el.style.visibility = "hidden";
    document.body.appendChild(el);
    const f = getComputedStyle(el).fontFamily;
    el.remove();
    return f || fallback;
  } catch {
    return fallback;
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // A photo from another address must allow this, or the canvas is
    // "tainted" and cannot be shared; without it, initials are drawn.
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function fit(c: CanvasRenderingContext2D, text: string, max: number): string {
  if (c.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && c.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

export async function drawProfileCard(d: ShareCardData): Promise<HTMLCanvasElement> {
  const body = fontFor("var(--font-body)", "-apple-system, sans-serif");
  const display = fontFor("var(--font-display)", "Georgia, serif");
  try { await (document as any).fonts?.ready; } catch { /* draw anyway */ }

  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;

  // Page and card.
  c.fillStyle = CREAM; c.fillRect(0, 0, W, H);
  roundRect(c, 48, 48, W - 96, H - 96, 48); c.fillStyle = CARD; c.fill();
  c.lineWidth = 3; c.strokeStyle = BRASS; roundRect(c, 64, 64, W - 128, H - 128, 38); c.stroke();

  // Brand line.
  c.textBaseline = "alphabetic";
  c.fillStyle = BRASS; c.font = `700 30px ${body}`; c.textAlign = "left";
  c.fillText("SOUTHWOOD", 120, 150);
  c.fillStyle = MID; c.font = `600 30px ${body}`; c.textAlign = "right";
  c.fillText(fit(c, d.club, 520), W - 120, 150);

  // Photo, or initials.
  const cx = 230, cy = 300, r = 110;
  c.save(); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.closePath(); c.fillStyle = "#EDE3CF"; c.fill(); c.clip();
  const img = d.photo ? await loadImage(d.photo) : null;
  if (img) {
    const s = Math.max((r * 2) / img.width, (r * 2) / img.height);
    c.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
  } else {
    c.fillStyle = MID; c.font = `600 80px ${body}`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(d.name.split(" ").map((p) => p[0] || "").join("").slice(0, 2).toUpperCase(), cx, cy + 4);
  }
  c.restore();
  c.lineWidth = 6; c.strokeStyle = INK; c.beginPath(); c.arc(cx, cy, r + 3, 0, Math.PI * 2); c.stroke();

  // Name and level.
  c.textBaseline = "alphabetic"; c.textAlign = "left";
  c.fillStyle = INK; c.font = `700 64px ${display}`;
  c.fillText(fit(c, d.name, W - 120 - 380), 380, 290);
  if (d.level) { c.fillStyle = MID; c.font = `600 32px ${body}`; c.fillText(fit(c, d.level, W - 120 - 380), 380, 345); }

  // The record.
  const cols = [
    { n: d.record.w, label: "won", colour: INK },
    { n: d.record.d, label: "drawn", colour: INK },
    { n: d.record.l, label: "lost", colour: "#A89A86" },
  ];
  cols.forEach((col, i) => {
    const x = 270 + i * 270;
    c.textAlign = "center";
    c.fillStyle = col.colour; c.font = `700 150px ${display}`; c.fillText(String(col.n), x, 600);
    c.fillStyle = MID; c.font = `600 32px ${body}`; c.fillText(col.label, x, 650);
  });

  // Last five.
  if (d.form.length) {
    const dots = d.form.slice(-5), size = 28, gap = 22;
    const total = dots.length * size + (dots.length - 1) * gap;
    let x = W / 2 - total / 2 + size / 2;
    c.fillStyle = MID; c.font = `600 26px ${body}`; c.textAlign = "center"; c.fillText("Last 5", W / 2, 715);
    for (const o of dots) {
      c.fillStyle = o === "W" ? WIN : o === "D" ? DRAW : LOSS;
      c.beginPath(); c.arc(x, 755, size / 2, 0, Math.PI * 2); c.fill();
      x += size + gap;
    }
  }

  // Win rate and the rankings, as tiles.
  const tiles = [{ label: "win rate", value: d.winRate + "%" }, ...d.rankings.slice(0, 2).map((r) => ({ label: r.label.toLowerCase(), value: r.value }))];
  const tw = (W - 240 - (tiles.length - 1) * 24) / tiles.length;
  tiles.forEach((t, i) => {
    const x = 120 + i * (tw + 24);
    roundRect(c, x, 810, tw, 150, 26); c.fillStyle = "#F3ECDD"; c.fill();
    c.textAlign = "center"; c.fillStyle = INK; c.font = `700 50px ${display}`; c.fillText(fit(c, t.value, tw - 30), x + tw / 2, 885);
    c.fillStyle = MID; c.font = `600 26px ${body}`; c.fillText(fit(c, t.label, tw - 30), x + tw / 2, 930);
  });

  // Best wins and achievements, side by side.
  c.textAlign = "left";
  c.strokeStyle = LINE; c.lineWidth = 2; c.beginPath(); c.moveTo(120, 1000); c.lineTo(W - 120, 1000); c.stroke();
  c.fillStyle = INK; c.font = `700 30px ${body}`; c.fillText("Best wins", 120, 1055);
  if (d.bestWins.length) {
    d.bestWins.slice(0, 3).forEach((b, i) => {
      c.fillStyle = INK; c.font = `600 30px ${body}`; c.fillText(fit(c, b.name, 400), 120, 1105 + i * 62);
      c.fillStyle = MID; c.font = `500 22px ${body}`; c.fillText(fit(c, b.sub, 400), 120, 1132 + i * 62);
    });
  } else {
    c.fillStyle = MID; c.font = `500 26px ${body}`; c.fillText("None yet", 120, 1105);
  }
  c.fillStyle = INK; c.font = `700 30px ${body}`; c.fillText(`Achievements · ${d.achievements.done.length} of ${d.achievements.total}`, 590, 1055);
  if (d.achievements.done.length) {
    d.achievements.done.slice(0, 4).forEach((a, i) => {
      c.fillStyle = BRASS; c.beginPath(); c.arc(602, 1096 + i * 44, 8, 0, Math.PI * 2); c.fill();
      c.fillStyle = INK; c.font = `600 27px ${body}`; c.fillText(fit(c, a, 330), 622, 1105 + i * 44);
    });
  } else {
    c.fillStyle = MID; c.font = `500 26px ${body}`; c.fillText("None yet", 590, 1105);
  }

  // Footer.
  c.textAlign = "center"; c.fillStyle = MID; c.font = `500 24px ${body}`;
  c.fillText("Head-to-head rankings for racket sports", W / 2, H - 92);
  return cv;
}

/** Draw the card and hand it to the share sheet, or save it. */
export async function shareProfileCard(d: ShareCardData): Promise<"shared" | "saved" | "cancelled"> {
  const cv = await drawProfileCard(d);
  const blob: Blob | null = await new Promise((res) => cv.toBlob(res, "image/png"));
  if (!blob) throw new Error("Couldn't make the picture.");
  const file = new File([blob], `${d.name.replace(/\s+/g, "-").toLowerCase()}-southwood.png`, { type: "image/png" });
  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title: `${d.name} on Southwood` }); return "shared"; }
    catch (e: any) { if (e?.name === "AbortError") return "cancelled"; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "saved";
}
