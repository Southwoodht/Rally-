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
  /** Head to head against named players: the ones you lead, and the ones
   *  who lead you (Sam: "winning records vs, then name players, then
   *  losing"). Best first in each. */
  beats: H2H[];
  losesTo: H2H[];
  /** "Seacourt Men's Singles · Champion · 2019". */
  trophies: string[];
  achievements: { done: string[]; total: number };
}

export interface H2H { name: string; w: number; d: number; l: number }

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
  const cx = 210, cy = 290, r = 96;
  c.save(); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.closePath(); c.fillStyle = "#EDE3CF"; c.fill(); c.clip();
  const img = d.photo ? await loadImage(d.photo) : null;
  if (img) {
    const s = Math.max((r * 2) / img.width, (r * 2) / img.height);
    c.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
  } else {
    c.fillStyle = MID; c.font = `600 72px ${body}`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(d.name.split(" ").map((p) => p[0] || "").join("").slice(0, 2).toUpperCase(), cx, cy + 4);
  }
  c.restore();
  c.lineWidth = 6; c.strokeStyle = BRASS; c.beginPath(); c.arc(cx, cy, r + 3, 0, Math.PI * 2); c.stroke();

  // Name and level.
  c.textBaseline = "alphabetic"; c.textAlign = "left";
  c.fillStyle = INK; c.font = `700 62px ${display}`;
  c.fillText(fit(c, d.name, W - 120 - 350), 350, 280);
  if (d.level) { c.fillStyle = MID; c.font = `600 30px ${body}`; c.fillText(fit(c, d.level, W - 120 - 350), 350, 332); }

  // The record, and the win percentage beside it — the two numbers a
  // show-off card is for.
  const cols = [
    { n: d.record.w, label: "won", colour: WIN },
    { n: d.record.d, label: "drawn", colour: INK },
    { n: d.record.l, label: "lost", colour: LOSS },
  ];
  cols.forEach((col, i) => {
    const x = 195 + i * 190;
    c.textAlign = "center";
    c.fillStyle = col.colour; c.font = `700 120px ${display}`; c.fillText(String(col.n), x, 530);
    c.fillStyle = MID; c.font = `600 28px ${body}`; c.fillText(col.label, x, 572);
  });
  roundRect(c, 700, 420, 260, 170, 28); c.fillStyle = BRASS; c.fill();
  c.textAlign = "center"; c.fillStyle = "#FFFDF8"; c.font = `700 92px ${display}`; c.fillText(d.winRate + "%", 830, 530);
  c.font = `600 26px ${body}`; c.fillText("win rate", 830, 570);

  // Rankings and the last five, one line.
  const bits = d.rankings.slice(0, 2).map((x) => `${x.label} ${x.value}`);
  c.textAlign = "left"; c.fillStyle = INK; c.font = `600 28px ${body}`;
  c.fillText(fit(c, bits.join("   ·   "), 560), 120, 650);
  if (d.form.length) {
    const dots = d.form.slice(-5), size = 24, gap = 14;
    let x = W - 120 - (dots.length * size + (dots.length - 1) * gap) + size / 2;
    c.textAlign = "right"; c.fillStyle = MID; c.font = `600 24px ${body}`;
    c.fillText("Last 5", x - size / 2 - 14, 650);
    for (const o of dots) {
      c.fillStyle = o === "W" ? WIN : o === "D" ? DRAW : LOSS;
      c.beginPath(); c.arc(x, 641, size / 2, 0, Math.PI * 2); c.fill();
      x += size + gap;
    }
  }

  // Head to head: who you have the better of, and who has the better of you.
  const line = (y: number) => { c.strokeStyle = LINE; c.lineWidth = 2; c.beginPath(); c.moveTo(120, y); c.lineTo(W - 120, y); c.stroke(); };
  line(690);
  const rec = (h: H2H) => h.d ? `${h.w}–${h.d}–${h.l}` : `${h.w}–${h.l}`;
  const column = (x: number, title: string, colour: string, rows: H2H[], empty: string) => {
    c.textAlign = "left"; c.fillStyle = colour; c.font = `700 30px ${body}`; c.fillText(title, x, 745);
    if (!rows.length) { c.fillStyle = MID; c.font = `500 26px ${body}`; c.fillText(empty, x, 795); return; }
    rows.slice(0, 5).forEach((h, i) => {
      const y = 797 + i * 50;
      c.textAlign = "right"; c.fillStyle = colour; c.font = `700 30px ${body}`;
      const score = rec(h);
      c.fillText(score, x + 380, y);
      const sw = c.measureText(score).width;
      c.textAlign = "left"; c.fillStyle = INK; c.font = `600 28px ${body}`;
      c.fillText(fit(c, h.name, 380 - sw - 18), x, y);
    });
  };
  column(120, "Winning records", WIN, d.beats, "None yet");
  column(580, "Losing records", LOSS, d.losesTo, "Nobody has the better of them");

  // Trophies, or achievements when there are none.
  line(1060);
  c.textAlign = "left";
  if (d.trophies.length) {
    c.fillStyle = INK; c.font = `700 30px ${body}`; c.fillText(`Trophies · ${d.trophies.length}`, 120, 1112);
    d.trophies.slice(0, 3).forEach((t, i) => {
      const y = 1160 + i * 44;
      drawCup(c, 132, y - 10, BRASS);
      c.fillStyle = INK; c.font = `600 27px ${body}`; c.fillText(fit(c, t, W - 120 - 160), 160, y);
    });
  } else {
    c.fillStyle = INK; c.font = `700 30px ${body}`;
    c.fillText(`Achievements · ${d.achievements.done.length} of ${d.achievements.total}`, 120, 1112);
    d.achievements.done.slice(0, 4).forEach((a, i) => {
      const x = 120 + (i % 2) * 420, y = 1160 + Math.floor(i / 2) * 44;
      c.fillStyle = BRASS; c.beginPath(); c.arc(x + 10, y - 9, 8, 0, Math.PI * 2); c.fill();
      c.fillStyle = INK; c.font = `600 27px ${body}`; c.fillText(fit(c, a, 380), x + 30, y);
    });
  }

  // Footer.
  c.textAlign = "center"; c.fillStyle = MID; c.font = `500 22px ${body}`;
  c.fillText("southwood.app", W / 2, H - 84);
  return cv;
}

/** A small cup, drawn rather than an emoji, so it matches the app. */
function drawCup(c: CanvasRenderingContext2D, x: number, y: number, colour: string) {
  c.save(); c.fillStyle = colour; c.strokeStyle = colour; c.lineWidth = 3;
  c.beginPath(); c.moveTo(x - 11, y - 12); c.lineTo(x + 11, y - 12); c.quadraticCurveTo(x + 10, y + 4, x, y + 5); c.quadraticCurveTo(x - 10, y + 4, x - 11, y - 12); c.fill();
  c.beginPath(); c.arc(x - 12, y - 6, 5, Math.PI * 0.5, Math.PI * 1.5); c.stroke();
  c.beginPath(); c.arc(x + 12, y - 6, 5, Math.PI * 1.5, Math.PI * 0.5); c.stroke();
  c.fillRect(x - 2, y + 4, 4, 6); c.fillRect(x - 8, y + 10, 16, 4);
  c.restore();
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
