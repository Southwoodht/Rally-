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
  /** Wins and draws over played; null hides it. */
  unbeatenRate?: number | null;
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

export interface H2H { name: string; w: number; d: number; l: number; /** legacy results, beside the record */ legacy?: number }

const W = 1080;
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

  // Every name on both lists (Sam: "it doesn't show my full list"), so the
  // card grows past 1350 when the lists need it, up to a phone-story 1920.
  const ROW = 46, MAX_ROWS = 12;
  const rows = Math.min(MAX_ROWS, Math.max(1, d.beats.length, d.losesTo.length));
  const top = 902 + (rows - 1) * ROW + 44;
  // Everything the heading counts is listed (a review: "6 of 9 but only
  // lists 4 looks like a bug"), up to a cap, then "+N more" on its own line.
  const TROPHY_CAP = 6, ACH_CAP = 12;
  const trophyRows = Math.min(TROPHY_CAP, d.trophies.length) + (d.trophies.length > TROPHY_CAP ? 1 : 0);
  const achRows = Math.ceil(Math.min(ACH_CAP, d.achievements.done.length) / 2) + (d.achievements.done.length > ACH_CAP ? 1 : 0);
  const lower = Math.max(1, d.trophies.length ? trophyRows : achRows);
  const H = Math.max(1350, top + 98 + (lower - 1) * 42 + 60 + 84);
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

  // Name, level and the last five under it.
  c.textBaseline = "alphabetic"; c.textAlign = "left";
  c.fillStyle = INK; c.font = `700 62px ${display}`;
  c.fillText(fit(c, d.name, W - 120 - 350), 350, 270);
  if (d.level) { c.fillStyle = MID; c.font = `600 30px ${body}`; c.fillText(fit(c, d.level, W - 120 - 350), 350, 320); }
  if (d.form.length) {
    const dots = d.form.slice(-5), size = 22, gap = 12;
    c.fillStyle = MID; c.font = `600 24px ${body}`; c.fillText("Last 5", 350, 372);
    let x = 350 + c.measureText("Last 5").width + 18 + size / 2;
    for (const o of dots) {
      c.fillStyle = o === "W" ? WIN : o === "D" ? DRAW : LOSS;
      c.beginPath(); c.arc(x, 364, size / 2, 0, Math.PI * 2); c.fill();
      x += size + gap;
    }
  }

  // The record, and the win percentage beside it.
  const cols = [
    { n: d.record.w, label: "won", colour: WIN },
    { n: d.record.d, label: "drawn", colour: INK },
    { n: d.record.l, label: "lost", colour: LOSS },
  ];
  cols.forEach((col, i) => {
    const x = 195 + i * 190;
    c.textAlign = "center";
    c.fillStyle = col.colour; c.font = `700 120px ${display}`; c.fillText(String(col.n), x, 540);
    c.fillStyle = MID; c.font = `600 28px ${body}`; c.fillText(col.label, x, 582);
  });
  roundRect(c, 690, 430, 270, 170, 28); c.fillStyle = BRASS; c.fill();
  c.fillStyle = "#FFFDF8";
  if (d.unbeatenRate != null) {
    // Two lines: won, then unbeaten (Sam: "my unbeaten would look better").
    const pair = (n: number, label: string, y: number) => {
      c.textAlign = "left"; c.font = `700 54px ${display}`; c.fillText(n + "%", 712, y);
      const w = c.measureText(n + "%").width;
      c.font = `600 23px ${body}`; c.fillText(label, 712 + w + 10, y - 6);
    };
    pair(d.winRate, "won", 500);
    c.globalAlpha = 0.35; c.fillRect(716, 516, 218, 2); c.globalAlpha = 1;
    pair(d.unbeatenRate, "unbeaten", 582);
  } else {
    c.textAlign = "center"; c.font = `700 92px ${display}`; c.fillText(d.winRate + "%", 825, 540);
    c.font = `600 26px ${body}`; c.fillText("win rate", 825, 580);
  }

  // Three tiles: head to head (people you have the better of, against
  // people who have the better of you — Sam's "10–3"), then the rankings.
  const tiles: Array<{ label: string; draw: (cx: number, y: number) => void }> = [{
    label: "head to head",
    draw: (cx, y) => {
      c.font = `700 52px ${display}`;
      const a = String(d.beats.length), dash = "–", b2 = String(d.losesTo.length);
      const wa = c.measureText(a).width, wd = c.measureText(dash).width, wb = c.measureText(b2).width;
      let x = cx - (wa + wd + wb) / 2;
      c.textAlign = "left";
      c.fillStyle = WIN; c.fillText(a, x, y); x += wa;
      c.fillStyle = INK; c.fillText(dash, x, y); x += wd;
      c.fillStyle = LOSS; c.fillText(b2, x, y);
    },
  }, ...d.rankings.slice(0, 2).map((r) => ({
    label: r.label,
    draw: (cx: number, y: number) => {
      // Shrinks to fit ("2nd of 6 ranked") before it would cut a word.
      c.textAlign = "center"; c.fillStyle = INK;
      let size = 44;
      do { c.font = `700 ${size}px ${display}`; size -= 2; } while (size > 26 && c.measureText(r.value).width > tw - 28);
      c.fillText(fit(c, r.value, tw - 28), cx, y);
    },
  }))];
  const tw = (W - 240 - (tiles.length - 1) * 24) / tiles.length;
  tiles.forEach((t, i) => {
    const x = 120 + i * (tw + 24);
    roundRect(c, x, 635, tw, 130, 26); c.fillStyle = "#F3ECDD"; c.fill();
    t.draw(x + tw / 2, 702);
    c.textAlign = "center"; c.fillStyle = MID; c.font = `600 24px ${body}`; c.fillText(fit(c, t.label, tw - 30), x + tw / 2, 742);
  });

  // Everybody, by name: the better of, and the worse of.
  const line = (y: number) => { c.strokeStyle = LINE; c.lineWidth = 2; c.beginPath(); c.moveTo(120, y); c.lineTo(W - 120, y); c.stroke(); };
  line(800);
  const rated = (h: H2H) => (h.d ? `${h.w}–${h.d}–${h.l}` : `${h.w}–${h.l}`);
  const rec = (h: H2H) => {
    const has = h.w + h.d + h.l > 0;
    if (!h.legacy) return rated(h);
    return has ? `${rated(h)} +${h.legacy} legacy` : `${h.legacy} legacy`;
  };
  const column = (x: number, title: string, colour: string, list: H2H[], empty: string) => {
    c.textAlign = "left"; c.fillStyle = colour; c.font = `700 30px ${body}`; c.fillText(`${title} · ${list.length}`, x, 852);
    if (!list.length) { c.fillStyle = MID; c.font = `500 26px ${body}`; c.fillText(empty, x, 902); return; }
    const shown = list.length > rows ? list.slice(0, rows - 1) : list;
    shown.forEach((h, i) => {
      const y = 902 + i * ROW;
      c.textAlign = "right"; c.fillStyle = colour; c.font = `700 28px ${body}`;
      const score = rec(h);
      c.fillText(score, x + 380, y);
      const sw = c.measureText(score).width;
      c.textAlign = "left"; c.fillStyle = INK; c.font = `600 27px ${body}`;
      c.fillText(fit(c, h.name, 380 - sw - 16), x, y);
    });
    if (shown.length < list.length) {
      c.textAlign = "left"; c.fillStyle = MID; c.font = `600 25px ${body}`;
      c.fillText(`and ${list.length - shown.length} more`, x, 902 + shown.length * ROW);
    }
  };
  column(120, "Winning records", WIN, d.beats, "None yet");
  column(580, "Losing records", LOSS, d.losesTo, "Nobody, yet");

  // Trophies, or achievements when there are none.
  line(top);
  c.textAlign = "left";
  if (d.trophies.length) {
    c.fillStyle = INK; c.font = `700 30px ${body}`; c.fillText(`Trophies · ${d.trophies.length}`, 120, top + 52);
    d.trophies.slice(0, TROPHY_CAP).forEach((t, i) => {
      const y = top + 98 + i * 42;
      drawCup(c, 132, y - 10, BRASS);
      c.fillStyle = INK; c.font = `600 27px ${body}`; c.fillText(fit(c, t, W - 120 - 160), 160, y);
    });
    if (d.trophies.length > TROPHY_CAP) {
      c.fillStyle = MID; c.font = `600 25px ${body}`;
      c.fillText(`+${d.trophies.length - TROPHY_CAP} more`, 160, top + 98 + TROPHY_CAP * 42);
    }
  } else {
    c.fillStyle = INK; c.font = `700 30px ${body}`;
    c.fillText(`Achievements · ${d.achievements.done.length} of ${d.achievements.total}`, 120, top + 52);
    d.achievements.done.slice(0, ACH_CAP).forEach((a, i) => {
      const x = 120 + (i % 2) * 420, y = top + 98 + Math.floor(i / 2) * 42;
      c.fillStyle = BRASS; c.beginPath(); c.arc(x + 10, y - 9, 8, 0, Math.PI * 2); c.fill();
      c.fillStyle = INK; c.font = `600 27px ${body}`; c.fillText(fit(c, a, 380), x + 30, y);
    });
    if (d.achievements.done.length > ACH_CAP) {
      c.fillStyle = MID; c.font = `600 25px ${body}`;
      c.fillText(`+${d.achievements.done.length - ACH_CAP} more`, 150, top + 98 + (ACH_CAP / 2) * 42);
    }
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
