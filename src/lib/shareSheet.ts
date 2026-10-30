/**
 * The coach sheet (Sam, 2026-10-30; reworked the same day): a competition,
 * or the club night mixer, as something to pin up or post in the club chat,
 * in the club's current theme, with a small Southwood mark at the foot.
 *
 * TWO OUTPUTS, DIFFERENT JOBS.
 *
 * The A4 PDF is the noticeboard. It must fit ONE page for a division of up
 * to about eight players and fifteen rounds: the header (name, club, format,
 * season, when it was made, the play-by deadline once), the standings, then
 * every fixture in a two- or three-column grid, one line per match, played
 * ones with the score, the winner in bold and a tick. A round is never split
 * across columns or pages. When it does not fit, names shorten to "Charlie
 * H", then the type shrinks; only below the smallest readable size does a
 * second page appear.
 *
 * The WhatsApp pictures are for a phone screen, so they are two portraits
 * rather than one long scroll: the standings, big, and "This round" — the
 * round being played now and the latest results. A sheet with no table (a
 * knockout, the mixer) is one picture of its rounds.
 *
 * Both carry a QR code to the competition in the app ("Scan for the live
 * table", lib/compLink.ts), because a printed table is out of date the day
 * after it goes up. No PDF library: a PDF holding one JPEG per page is a few
 * dozen lines, and a dependency for it would be the bigger risk.
 */
import qrcode from "qrcode-generator";

export interface SheetMatch {
  a: string;
  b: string;
  /** "Court 1" — the mixer's narrow left column. */
  label?: string;
  /** Who won, side A or B, or a draw. Absent: not played. */
  winner?: "A" | "B" | "draw" | null;
  /** "6-3 6-4", side A first. */
  score?: string;
  /** Settled without a match. */
  status?: "walkover" | "void";
  /** When it was played, ms — "latest results" are the newest. */
  date?: number;
}

export interface SheetRound { heading: string; matches: SheetMatch[]; note?: string }

export interface SheetStanding { pos: number; name: string; p: number; w: number; d: number; l: number; pts: number }

export interface Sheet {
  /** "Division 1" */
  title: string;
  /** "Seacourt · Singles league · Winter 2026/27" */
  meta: string;
  /** "Made 30 Oct 2026" */
  generated: string;
  /** "Play by 28 Feb 2027", printed once. */
  deadline?: string;
  standings?: SheetStanding[];
  rounds: SheetRound[];
  /** The QR code's target. None: no code. */
  link?: string;
}

const played = (m: SheetMatch) => !!m.winner || m.status === "walkover";
const open = (m: SheetMatch) => !played(m) && m.status !== "void";

/** "Charlie Henry" → "Charlie H"; pairs shorten each half. */
export function shortName(full: string): string {
  return full.split(" & ").map((part) => {
    const w = part.trim().split(/\s+/);
    return w.length < 2 ? part.trim() : `${w[0]} ${w[w.length - 1][0]}`;
  }).join(" & ");
}

// ---------------------------------------------------------------- drawing

interface Palette { page: string; card: string; raised: string; hi: string; mid: string; accent: string; line: string; win: string }

/** The current theme's colours, read off the page, with Southwood's as the fallback. */
function palette(): Palette {
  const fallback: Palette = { page: "#F8F4EB", card: "#FBF8F1", raised: "#EDE3CF", hi: "#2A2118", mid: "#6E6252", accent: "#B8955A", line: "#E6DCC8", win: "#1E5A38" };
  try {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
    const page = v("--bg-page", fallback.page);
    return {
      page,
      card: v("--bg-card", fallback.card),
      raised: v("--bg-raised", fallback.raised),
      hi: v("--text-hi", fallback.hi),
      mid: v("--text-mid", fallback.mid),
      // Southwood's accent is ink; brass reads better as a rule on paper.
      accent: v("--hero-ring", "") || v("--accent", fallback.accent),
      line: v("--line", fallback.line),
      // The form-dot green, lifted on a dark theme where it would vanish.
      win: isDark(page) ? "#5DBB84" : "#1E5A38",
    };
  } catch {
    return fallback;
  }
}

function isDark(color: string): boolean {
  const m = color.match(/^#([0-9a-f]{6})$/i);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum < 110;
}

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
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function fit(c: CanvasRenderingContext2D, text: string, max: number): string {
  if (c.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && c.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

interface Kit { c: CanvasRenderingContext2D; p: Palette; body: string; display: string; logo: HTMLImageElement | null }

async function kit(W: number, H: number): Promise<Kit & { canvas: HTMLCanvasElement }> {
  const p = palette();
  const body = fontFor("var(--font-body)", "-apple-system, sans-serif");
  const display = fontFor("var(--font-display)", "Georgia, serif");
  try { await (document as any).fonts?.ready; } catch { /* draw anyway */ }
  const logo = await loadImage("/icon-192.png");
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext("2d")!;
  c.textBaseline = "alphabetic";
  return { canvas, c, p, body, display, logo };
}

/** Title, meta line, made / play-by line and a short accent rule. Returns its height. */
function headerHeight(k: number) { return 196 * k; }
function drawHeader(K: Kit, sheet: Sheet, x: number, y: number, w: number, k: number) {
  const { c, p } = K;
  c.textAlign = "left";
  c.fillStyle = p.hi; c.font = `700 ${58 * k}px ${K.display}`;
  c.fillText(fit(c, sheet.title, w), x, y + 56 * k);
  c.fillStyle = p.mid; c.font = `600 ${25 * k}px ${K.body}`;
  c.fillText(fit(c, sheet.meta, w), x, y + 100 * k);
  // Made … · Play by … — the deadline in ink, the one date that matters.
  c.font = `500 ${22 * k}px ${K.body}`;
  let at = x;
  c.fillText(sheet.generated, at, y + 138 * k);
  at += c.measureText(sheet.generated).width;
  if (sheet.deadline) {
    const dot = "   ·   ";
    c.fillText(dot, at, y + 138 * k); at += c.measureText(dot).width;
    c.fillStyle = p.hi; c.font = `700 ${22 * k}px ${K.body}`;
    c.fillText(fit(c, sheet.deadline, x + w - at), at, y + 138 * k);
  }
  c.fillStyle = p.accent; c.fillRect(x, y + 162 * k, 88 * k, 5 * k);
}

/** Logo and name on the left, the QR code and its line on the right. */
function footerHeight(k: number, withQr: boolean) { return (withQr ? 150 : 80) * k; }
function drawFooter(K: Kit, sheet: Sheet, x: number, bottom: number, w: number, k: number) {
  const { c, p } = K;
  const qr = sheet.link ? 118 * k : 0;
  const mid = bottom - (qr ? qr / 2 : 28 * k);
  const icon = 34 * k, gap = 10 * k;
  if (K.logo) {
    c.save(); c.beginPath(); c.roundRect?.(x, mid - icon / 2, icon, icon, 8 * k); c.clip();
    c.drawImage(K.logo, x, mid - icon / 2, icon, icon); c.restore();
  }
  c.textAlign = "left"; c.fillStyle = p.mid; c.font = `600 ${23 * k}px ${K.body}`;
  c.fillText("Southwood", x + (K.logo ? icon + gap : 0), mid + 8 * k);
  if (sheet.link) {
    drawQr(c, sheet.link, x + w - qr, bottom - qr, qr);
    c.textAlign = "right"; c.fillStyle = p.hi; c.font = `600 ${22 * k}px ${K.body}`;
    c.fillText("Scan for the live table", x + w - qr - 16 * k, mid + 8 * k);
  }
}

/** Dark on white with a quiet zone, whatever the theme: phones read that. */
function drawQr(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  const q = qrcode(0, "M");
  q.addData(text); q.make();
  const n = q.getModuleCount();
  const cell = size / (n + 4);
  c.fillStyle = "#fff";
  c.beginPath(); c.roundRect ? c.roundRect(x, y, size, size, size * 0.06) : c.rect(x, y, size, size); c.fill();
  c.fillStyle = "#111";
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
    if (q.isDark(r, col)) c.fillRect(x + (col + 2) * cell, y + (r + 2) * cell, Math.ceil(cell), Math.ceil(cell));
  }
}

/** The standings: Pos, Player, P W D L Pts. Returns its height. */
function tableHeight(rows: number, rh: number) { return rh * 0.9 + rows * rh; }
function drawTable(K: Kit, rows: SheetStanding[], x: number, y: number, w: number, rh: number, size: number) {
  const { c, p } = K;
  const numW = size * 2.1, ptsW = size * 2.6, posW = size * 2.9;
  const nameW = w - posW - 4 * numW - ptsW;
  const cols: Array<{ label: string; at: number; align: CanvasTextAlign }> = [
    { label: "P", at: x + posW + nameW + numW * 0.5, align: "center" },
    { label: "W", at: x + posW + nameW + numW * 1.5, align: "center" },
    { label: "D", at: x + posW + nameW + numW * 2.5, align: "center" },
    { label: "L", at: x + posW + nameW + numW * 3.5, align: "center" },
    { label: "Pts", at: x + w - 10 * (size / 20), align: "right" },
  ];
  const hh = rh * 0.9;
  c.fillStyle = p.raised;
  c.beginPath(); c.roundRect ? c.roundRect(x, y, w, hh, 8 * (size / 20)) : c.rect(x, y, w, hh); c.fill();
  c.fillStyle = p.mid; c.font = `600 ${size * 0.82}px ${K.body}`;
  const hb = y + hh / 2 + size * 0.3;
  c.textAlign = "left"; c.fillText("Pos", x + 10 * (size / 20), hb); c.fillText("Player", x + posW, hb);
  for (const col of cols) { c.textAlign = col.align; c.fillText(col.label, col.at, hb); }

  rows.forEach((r, i) => {
    const top = y + hh + i * rh, base = top + rh / 2 + size * 0.36;
    if (i) { c.fillStyle = p.line; c.fillRect(x, top, w, Math.max(1, size / 20)); }
    c.fillStyle = p.mid; c.font = `600 ${size}px ${K.body}`; c.textAlign = "left";
    c.fillText(String(r.pos), x + 10 * (size / 20), base);
    c.fillStyle = p.hi; c.font = `600 ${size}px ${K.body}`;
    c.fillText(fit(c, r.name, nameW - 10), x + posW, base);
    const vals = [r.p, r.w, r.d, r.l];
    c.font = `500 ${size}px ${K.body}`;
    vals.forEach((v, j) => { c.textAlign = "center"; c.fillText(String(v), cols[j].at, base); });
    c.font = `700 ${size}px ${K.body}`; c.textAlign = "right";
    c.fillText(String(r.pts), cols[4].at, base);
  });
}

/** A small tick, drawn rather than typed, so every phone shows the same one. */
function tick(c: CanvasRenderingContext2D, x: number, base: number, size: number, color: string) {
  const s = size * 0.62, y = base - s * 0.85;
  c.save(); c.strokeStyle = color; c.lineWidth = Math.max(1.5, size * 0.12); c.lineCap = "round"; c.lineJoin = "round";
  c.beginPath(); c.moveTo(x, y + s * 0.55); c.lineTo(x + s * 0.36, y + s * 0.9); c.lineTo(x + s, y + s * 0.1); c.stroke(); c.restore();
}

/**
 * One match on one line: "Charlie H v Oliver B      6-3 6-4 ✓". The
 * winner bold; unplayed plain; called off quiet. `short` uses "Charlie H".
 */
function drawMatch(K: Kit, m: SheetMatch, x: number, base: number, w: number, size: number, short: boolean, labelW: number) {
  const { c, p } = K;
  const nm = (s: string) => (short ? shortName(s) : s);
  if (m.label) {
    c.fillStyle = p.mid; c.font = `600 ${size * 0.86}px ${K.body}`; c.textAlign = "left";
    c.fillText(fit(c, m.label, labelW - 8), x, base);
  }
  x += labelW; w -= labelW;

  // The right-hand end: score and tick, walkover, or called off.
  const right = m.status === "void" ? "Called off" : m.status === "walkover" ? "W/O" : (m.score || "");
  const showTick = played(m);
  const tickW = showTick ? size * 1.15 : 0;
  c.font = `${m.status === "void" ? 500 : 600} ${size * (m.status ? 0.86 : 1)}px ${K.body}`;
  const rightW = right ? c.measureText(right).width + (showTick ? size * 0.35 : 0) : 0;
  if (right) {
    c.fillStyle = m.status === "void" ? p.mid : p.hi; c.textAlign = "right";
    c.fillText(right, x + w - tickW, base);
  }
  if (showTick) tick(c, x + w - size * 0.66, base, size, p.win);

  const room = w - rightW - tickW - (right || showTick ? size * 0.7 : 0);
  const v = " v ";
  const quiet = m.status === "void";
  const weight = (side: "A" | "B") => (m.winner === side ? 700 : 500);
  c.font = `500 ${size}px ${K.body}`;
  const vW = c.measureText(v).width;
  let a = nm(m.a), b = nm(m.b);
  c.font = `${weight("A")} ${size}px ${K.body}`; const aW = c.measureText(a).width;
  c.font = `${weight("B")} ${size}px ${K.body}`; const bW = c.measureText(b).width;
  if (aW + vW + bW > room) {
    const half = (room - vW) / 2;
    c.font = `${weight("A")} ${size}px ${K.body}`; a = fit(c, a, Math.max(half, room - vW - Math.min(bW, half)));
    const aNow = c.measureText(a).width;
    c.font = `${weight("B")} ${size}px ${K.body}`; b = fit(c, b, room - vW - aNow);
  }
  c.textAlign = "left";
  let at = x;
  c.fillStyle = quiet ? p.mid : p.hi;
  c.font = `${weight("A")} ${size}px ${K.body}`; c.fillText(a, at, base); at += c.measureText(a).width;
  c.fillStyle = p.mid; c.font = `500 ${size}px ${K.body}`; c.fillText(v, at, base); at += vW;
  c.fillStyle = quiet ? p.mid : p.hi;
  c.font = `${weight("B")} ${size}px ${K.body}`; c.fillText(b, at, base);
}

/** Do the full names fit a column this wide at this size? */
function fullNamesFit(K: Kit, rounds: SheetRound[], w: number, size: number, labelW: number): boolean {
  const { c } = K;
  for (const r of rounds) for (const m of r.matches) {
    c.font = `700 ${size}px ${K.body}`;
    const names = c.measureText(`${m.a} v ${m.b}`).width;
    c.font = `600 ${size}px ${K.body}`;
    const right = m.score || m.status ? c.measureText(m.status === "void" ? "Called off" : m.status === "walkover" ? "W/O" : m.score!).width + size * 1.6 : played(m) ? size * 1.6 : 0;
    if (names + right > w - labelW) return false;
  }
  return true;
}

const hasLabels = (rounds: SheetRound[]) => rounds.some((r) => r.matches.some((m) => m.label));

// ---------------------------------------------------------------- A4

const A4_W = 1240; // 150 dpi
const A4_H = Math.round(A4_W * Math.SQRT2);

interface GridMetrics { size: number; line: number; head: number; gap: number }
const gridMetrics = (f: number): GridMetrics => ({ size: 21 * f, line: 35 * f, head: 42 * f, gap: 20 * f });
const roundH = (r: SheetRound, g: GridMetrics) => g.head + r.matches.length * g.line + (r.note ? g.line : 0) + g.gap;

/**
 * Rounds into columns of at most `cap` height, in order, whole rounds only.
 * Returns the columns, or null when a round alone is taller than `cap`.
 */
function pack(rounds: SheetRound[], g: GridMetrics, cap: number): SheetRound[][] | null {
  const cols: SheetRound[][] = [[]];
  let h = 0;
  for (const r of rounds) {
    const rh = roundH(r, g);
    if (rh > cap) return null;
    if (h + rh > cap && cols[cols.length - 1].length) { cols.push([]); h = 0; }
    cols[cols.length - 1].push(r); h += rh;
  }
  return cols;
}

/** The shortest column height that still fits every round into `n` columns. */
function balanced(rounds: SheetRound[], g: GridMetrics, n: number, cap: number): { cols: SheetRound[][]; height: number } | null {
  const first = pack(rounds, g, cap);
  if (!first || first.length > n) return null;
  let lo = Math.max(...rounds.map((r) => roundH(r, g)), 1), hi = cap;
  for (let i = 0; i < 24 && hi - lo > 1; i++) {
    const midH = (lo + hi) / 2;
    const t = pack(rounds, g, midH);
    if (t && t.length <= n) hi = midH; else lo = midH;
  }
  const cols = pack(rounds, g, hi)!;
  return { cols, height: Math.max(...cols.map((col) => col.reduce((s, r) => s + roundH(r, g), 0))) };
}

function drawColumn(K: Kit, col: SheetRound[], x: number, y: number, w: number, g: GridMetrics, short: boolean, labelW: number) {
  const { c, p } = K;
  for (const r of col) {
    c.fillStyle = p.hi; c.font = `700 ${g.size * 1.05}px ${K.body}`; c.textAlign = "left";
    c.fillText(fit(c, r.heading, w), x, y + g.head * 0.62);
    c.fillStyle = p.line; c.fillRect(x, y + g.head * 0.82, w, Math.max(1, g.size / 14));
    y += g.head;
    for (const m of r.matches) { drawMatch(K, m, x, y + g.line * 0.66, w, g.size, short, labelW); y += g.line; }
    if (r.note) {
      c.fillStyle = p.mid; c.font = `500 ${g.size * 0.86}px ${K.body}`; c.textAlign = "left";
      c.fillText(fit(c, r.note, w), x, y + g.line * 0.66); y += g.line;
    }
    y += g.gap;
  }
}

/** The A4 sheet: one page whenever it can be made to fit, as a stack of page canvases. */
export async function drawSheetPages(sheet: Sheet): Promise<HTMLCanvasElement[]> {
  const W = A4_W, H = A4_H, M = 70, GAP = 30;
  const probe = await kit(1, 1);
  const withQr = !!sheet.link;
  const labelOf = (g: GridMetrics) => (hasLabels(sheet.rounds) ? g.size * 4.2 : 0);

  // Try each size, two columns before three, full names before short ones;
  // the first that puts everything on one page wins.
  type Plan = { f: number; n: number; short: boolean; cols: SheetRound[][]; g: GridMetrics; rh: number };
  let plan: Plan | null = null;
  for (let f = 1; f >= 0.6 - 1e-9 && !plan; f -= 0.05) {
    const k = f;
    const rh = 40 * f;
    const tableH = sheet.standings?.length ? tableHeight(sheet.standings.length, rh) + 44 * f : 0;
    const room = H - M - headerHeight(k) - tableH - footerHeight(1, withQr) - M * 0.6;
    const g = gridMetrics(f);
    for (const n of [2, 3]) {
      const cw = (W - 2 * M - (n - 1) * GAP) / n;
      const short = !fullNamesFit(probe, sheet.rounds, cw, g.size, labelOf(g));
      const b = balanced(sheet.rounds, g, n, room);
      if (b) { plan = { f, n, short, cols: b.cols, g, rh }; break; }
    }
  }

  const pages: HTMLCanvasElement[] = [];
  const newPage = async () => {
    const K = await kit(W, H);
    K.c.fillStyle = K.p.page; K.c.fillRect(0, 0, W, H);
    drawFooter(K, sheet, M, H - M * 0.6, W - 2 * M, 1);
    pages.push(K.canvas);
    return K;
  };

  if (plan) {
    const K = await newPage();
    drawHeader(K, sheet, M, M, W - 2 * M, plan.f);
    let y = M + headerHeight(plan.f);
    if (sheet.standings?.length) {
      drawTable(K, sheet.standings, M, y, W - 2 * M, plan.rh, 20 * plan.f);
      y += tableHeight(sheet.standings.length, plan.rh) + 44 * plan.f;
    }
    const cw = (W - 2 * M - (plan.n - 1) * GAP) / plan.n;
    plan.cols.forEach((col, i) => drawColumn(K, col, M + i * (cw + GAP), y, cw, plan!.g, plan!.short, labelOf(plan!.g)));
    return pages;
  }

  // Too much for one page even at the smallest size: three columns of short
  // names at that size, page after page, never splitting a round.
  const f = 0.6, g = gridMetrics(f), n = 3, cw = (W - 2 * M - (n - 1) * GAP) / n;
  let K = await newPage();
  drawHeader(K, sheet, M, M, W - 2 * M, f);
  let y = M + headerHeight(f);
  if (sheet.standings?.length) {
    drawTable(K, sheet.standings, M, y, W - 2 * M, 40 * f, 20 * f);
    y += tableHeight(sheet.standings.length, 40 * f) + 44 * f;
  }
  let rest = sheet.rounds.slice();
  while (rest.length) {
    const cap = H - y - footerHeight(1, withQr) - M * 0.6;
    const cols = pack(rest, g, cap) || [[rest[0]]];
    const here = cols.slice(0, n);
    here.forEach((col, i) => drawColumn(K, col, M + i * (cw + GAP), y, cw, g, true, labelOf(g)));
    const used = here.reduce((s, col) => s + col.length, 0);
    rest = rest.slice(used);
    if (rest.length) {
      K = await newPage();
      K.c.fillStyle = K.p.mid; K.c.font = `600 ${22}px ${K.body}`; K.c.textAlign = "left";
      K.c.fillText(`${sheet.title} · continued`, M, M + 24);
      y = M + 56;
    }
  }
  return pages;
}

/** A minimal PDF: one JPEG per A4 page. */
export async function sheetPdf(sheet: Sheet): Promise<Blob> {
  const pages = await drawSheetPages(sheet);
  const jpegs = pages.map((cv) => {
    const bin = atob(cv.toDataURL("image/jpeg", 0.92).split(",")[1]);
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    return bytes;
  });
  return new Blob([buildPdf(jpegs, A4_W, A4_H) as BlobPart], { type: "application/pdf" });
}

/** Exported for the test: page objects, one image each, A4 points. */
export function buildPdf(jpegs: Uint8Array[], imgW: number, imgH: number): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Uint8Array) => { parts.push(b); length += b.length; };
  const text = (t: string) => push(enc.encode(t));
  const obj = (n: number) => { offsets[n] = length; };

  const n = jpegs.length;
  // 1 catalog, 2 pages, then per page: page, content, image.
  const pageObj = (i: number) => 3 + i * 3;
  text("%PDF-1.4\n%âãÏÓ\n");
  obj(1); text("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  obj(2); text(`2 0 obj\n<< /Type /Pages /Count ${n} /Kids [${jpegs.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] >>\nendobj\n`);
  const PW = 595.28, PH = 841.89;
  jpegs.forEach((jpg, i) => {
    const p = pageObj(i), cnt = p + 1, img = p + 2;
    obj(p); text(`${p} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im${i} ${img} 0 R >> >> /Contents ${cnt} 0 R >>\nendobj\n`);
    const stream = `q ${PW} 0 0 ${PH} 0 0 cm /Im${i} Do Q`;
    obj(cnt); text(`${cnt} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
    obj(img); text(`${img} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
    push(jpg); text("\nendstream\nendobj\n");
  });
  const total = 3 + n * 3;
  const xref = length;
  let table = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let k = 1; k < total; k++) table += String(offsets[k]).padStart(10, "0") + " 00000 n \n";
  text(table);
  text(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const b of parts) { out.set(b, at); at += b.length; }
  return out;
}

// ---------------------------------------------------------------- pictures

const IMG_W = 1080, IMG_MIN_H = 1350, IM = 64;

/** Which round is being played: the first with a match still to play. */
export function currentRound(rounds: SheetRound[]): number {
  return rounds.findIndex((r) => r.matches.some(open));
}

/** The newest results, outside the round on show. */
export function latestResults(rounds: SheetRound[], skip: number, count = 5): SheetMatch[] {
  return rounds.flatMap((r, i) => (i === skip ? [] : r.matches.filter((m) => played(m) && m.status !== "walkover")))
    .sort((x, y) => (y.date ?? 0) - (x.date ?? 0))
    .slice(0, count);
}

async function picture(sheet: Sheet, bodyH: number, draw: (K: Kit, y: number) => void): Promise<HTMLCanvasElement> {
  const withQr = !!sheet.link;
  const H = Math.max(IMG_MIN_H, Math.round(IM + headerHeight(1) + bodyH + footerHeight(1, withQr) + IM));
  const K = await kit(IMG_W, H);
  K.c.fillStyle = K.p.page; K.c.fillRect(0, 0, IMG_W, H);
  drawHeader(K, sheet, IM, IM, IMG_W - 2 * IM, 1);
  draw(K, IM + headerHeight(1));
  drawFooter(K, sheet, IM, H - IM, IMG_W - 2 * IM, 1);
  return K.canvas;
}

function sectionTitle(K: Kit, text: string, x: number, y: number) {
  K.c.fillStyle = K.p.hi; K.c.font = `700 ${34}px ${K.body}`; K.c.textAlign = "left";
  K.c.fillText(text, x, y + 40);
}

/**
 * The WhatsApp pictures. With a table: the standings, then "This round".
 * Without one (a knockout, the mixer): one picture of every round.
 */
export async function drawSheetImages(sheet: Sheet): Promise<HTMLCanvasElement[]> {
  const w = IMG_W - 2 * IM;
  const big: GridMetrics = { size: 31, line: 60, head: 64, gap: 28 };
  const probe = await kit(1, 1);
  const labelW = hasLabels(sheet.rounds) ? big.size * 4 : 0;
  const short = !fullNamesFit(probe, sheet.rounds, w, big.size, labelW);

  if (!sheet.standings?.length) {
    const h = sheet.rounds.reduce((s, r) => s + roundH(r, big), 0);
    return [await picture(sheet, h, (K, y) => drawColumn(K, sheet.rounds, IM, y, w, big, short, labelW))];
  }

  const rh = 76;
  const table = await picture(sheet, tableHeight(sheet.standings.length, rh) + 20, (K, y) => drawTable(K, sheet.standings!, IM, y, w, rh, 34));

  const ci = currentRound(sheet.rounds);
  const latest = latestResults(sheet.rounds, ci);
  const nowRound = ci >= 0 ? { ...sheet.rounds[ci], heading: `This round · ${sheet.rounds[ci].heading}` } : null;
  const latestRound: SheetRound | null = latest.length ? { heading: "Latest results", matches: latest } : null;
  const h = (nowRound ? roundH(nowRound, big) : 80) + (latestRound ? roundH(latestRound, big) + 10 : 0);
  const thisRound = await picture(sheet, h, (K, y) => {
    if (nowRound) { drawColumn(K, [nowRound], IM, y, w, big, short, labelW); y += roundH(nowRound, big); }
    else { sectionTitle(K, "Every match played", IM, y); y += 80; }
    if (latestRound) drawColumn(K, [latestRound], IM, y + 10, w, big, short, labelW);
  });
  return [table, thisRound];
}

// ---------------------------------------------------------------- sharing

/** Hand files to the phone's share sheet, or save them. */
async function shareFiles(blobs: Blob[], names: string[], title: string): Promise<"shared" | "saved" | "cancelled"> {
  const files = blobs.map((b, i) => new File([b], names[i], { type: b.type }));
  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files })) {
    try { await nav.share({ files, title }); return "shared"; }
    catch (e: any) { if (e?.name === "AbortError") return "cancelled"; }
  }
  blobs.forEach((blob, i) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = names[i]; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
  return "saved";
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sheet";

export async function shareSheetImages(sheet: Sheet) {
  const canvases = await drawSheetImages(sheet);
  const blobs = await Promise.all(canvases.map((cv) => new Promise<Blob | null>((res) => cv.toBlob(res, "image/png"))));
  if (blobs.some((b) => !b)) throw new Error("Couldn't make the pictures.");
  const names = canvases.length === 2 ? [`${slug(sheet.title)}-table.png`, `${slug(sheet.title)}-this-round.png`] : [`${slug(sheet.title)}.png`];
  return shareFiles(blobs as Blob[], names, sheet.title);
}

export async function shareSheetPdf(sheet: Sheet) {
  return shareFiles([await sheetPdf(sheet)], [`${slug(sheet.title)}.pdf`], sheet.title);
}
