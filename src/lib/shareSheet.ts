/**
 * The coach sheet (Sam, 2026-10-30): any competition, or the club night
 * mixer, as something to pin up or post in the club chat — a portrait
 * picture for WhatsApp and a clean A4 PDF — with the title, the date and
 * every fixture or court, in the club's current theme, and a small Southwood
 * mark at the foot.
 *
 * One layout, two outputs. The picture is a single tall image, as long as
 * the night needs. The PDF is the same layout cut into A4 pages, never mid
 * row, each with its own footer. No PDF library: a PDF that holds one JPEG
 * per page is a few dozen lines, and adding a dependency for it would be
 * the bigger risk.
 */

export interface SheetRow {
  /** "Court 1", "Round 2" — the narrow left column. Optional. */
  label?: string;
  /** The line that matters: "Sam & Charlie v Zaach & Adrian". */
  main: string;
  /** Quieter, under it: "Play by 12 Nov", "Won by Sam 6-4". */
  sub?: string;
}

export interface SheetSection { heading: string; rows: SheetRow[]; note?: string }

export interface Sheet {
  title: string;
  /** "Thursday 30 October 2026 · Seacourt" */
  subtitle: string;
  sections: SheetSection[];
}

interface Palette { page: string; card: string; raised: string; hi: string; mid: string; accent: string; line: string }

/** The current theme's colours, read off the page, with Southwood's as the fallback. */
function palette(): Palette {
  const fallback: Palette = { page: "#F8F4EB", card: "#FBF8F1", raised: "#EDE3CF", hi: "#2A2118", mid: "#6E6252", accent: "#B8955A", line: "#E6DCC8" };
  try {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
    return {
      page: v("--bg-page", fallback.page),
      card: v("--bg-card", fallback.card),
      raised: v("--bg-raised", fallback.raised),
      hi: v("--text-hi", fallback.hi),
      mid: v("--text-mid", fallback.mid),
      // Southwood's accent is ink; brass reads better as a rule on paper.
      accent: v("--hero-ring", "") || v("--accent", fallback.accent),
      line: v("--line", fallback.line),
    };
  } catch {
    return fallback;
  }
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

/**
 * Lays the sheet out and draws it. `pageH` set: A4 pages of that height,
 * stacked in one canvas, breaking only between rows. Unset: one tall image.
 * Returns the canvas and, for pages, how many there are.
 */
async function render(sheet: Sheet, W: number, pageH: number | null): Promise<{ canvas: HTMLCanvasElement; pages: number }> {
  const p = palette();
  const body = fontFor("var(--font-body)", "-apple-system, sans-serif");
  const display = fontFor("var(--font-display)", "Georgia, serif");
  try { await (document as any).fonts?.ready; } catch { /* draw anyway */ }
  const logo = await loadImage("/icon-192.png");

  const s = W / 1080; // every size below is for a 1080-wide sheet
  const M = 72 * s, FOOT = 110 * s, HEAD = 250 * s;
  const ROW = 78 * s, ROW_SUB = 108 * s, SEC_HEAD = 76 * s, SEC_GAP = 34 * s, NOTE = 52 * s;

  // Layout first, so the canvas can be sized before anything is drawn.
  type Item = { kind: "head" | "row" | "note"; y: number; h: number; si: number; ri?: number };
  const items: Item[] = [];
  let y = M + HEAD;
  let page = 0;
  const top = (pg: number) => (pageH ? pg * pageH : 0) + M + (pg === 0 ? HEAD : 40 * s);
  const bottom = (pg: number) => (pageH ? (pg + 1) * pageH - FOOT : Infinity);
  const place = (h: number, keepWith = 0) => {
    if (pageH && y + h + keepWith > bottom(page)) { page++; y = top(page); }
    const at = y; y += h; return at;
  };
  sheet.sections.forEach((sec, si) => {
    const firstRowH = sec.rows[0] ? (sec.rows[0].sub ? ROW_SUB : ROW) : 0;
    items.push({ kind: "head", y: place(SEC_HEAD, firstRowH), h: SEC_HEAD, si });
    sec.rows.forEach((r, ri) => { const h = r.sub ? ROW_SUB : ROW; items.push({ kind: "row", y: place(h), h, si, ri }); });
    if (sec.note) items.push({ kind: "note", y: place(NOTE), h: NOTE, si });
    y += SEC_GAP;
  });
  const pages = pageH ? page + 1 : 1;
  const H = pageH ? pages * pageH : Math.max(Math.round(W * 1.25), Math.round(y + FOOT + M * 0.5));

  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;
  c.textBaseline = "alphabetic";

  const footer = (pg: number) => {
    const fy = (pageH ? (pg + 1) * pageH : H) - 56 * s;
    c.textAlign = "center"; c.fillStyle = p.mid; c.font = `600 ${24 * s}px ${body}`;
    const word = "Southwood";
    const tw = c.measureText(word).width;
    const icon = 34 * s, gap = 10 * s;
    const startX = W / 2 - (icon + gap + tw) / 2;
    if (logo) {
      c.save(); c.beginPath(); c.roundRect?.(startX, fy - icon + 6 * s, icon, icon, 8 * s); c.clip();
      c.drawImage(logo, startX, fy - icon + 6 * s, icon, icon); c.restore();
    }
    c.textAlign = "left"; c.fillText(word, startX + (logo ? icon + gap : 0), fy);
    if (pageH && pages > 1) { c.textAlign = "right"; c.font = `500 ${20 * s}px ${body}`; c.fillText(`${pg + 1} of ${pages}`, W - M, fy); }
  };

  for (let pg = 0; pg < pages; pg++) {
    const y0 = pageH ? pg * pageH : 0, h = pageH || H;
    c.fillStyle = p.page; c.fillRect(0, y0, W, h);
    footer(pg);
  }

  // Title block, on the first page only.
  c.textAlign = "left";
  c.fillStyle = p.hi; c.font = `700 ${64 * s}px ${display}`;
  c.fillText(fit(c, sheet.title, W - 2 * M), M, M + 70 * s);
  c.fillStyle = p.mid; c.font = `600 ${28 * s}px ${body}`;
  c.fillText(fit(c, sheet.subtitle, W - 2 * M), M, M + 122 * s);
  c.fillStyle = p.accent; c.fillRect(M, M + 158 * s, 96 * s, 6 * s);

  const labelW = sheet.sections.some((sec) => sec.rows.some((r) => r.label)) ? 170 * s : 0;
  for (const it of items) {
    const sec = sheet.sections[it.si];
    if (it.kind === "head") {
      c.fillStyle = p.hi; c.font = `700 ${34 * s}px ${body}`; c.textAlign = "left";
      c.fillText(fit(c, sec.heading, W - 2 * M), M, it.y + 46 * s);
      c.fillStyle = p.line; c.fillRect(M, it.y + it.h - 6 * s, W - 2 * M, 2 * s);
    } else if (it.kind === "note") {
      c.fillStyle = p.mid; c.font = `500 ${24 * s}px ${body}`; c.textAlign = "left";
      c.fillText(fit(c, sec.note!, W - 2 * M), M, it.y + 36 * s);
    } else {
      const r = sec.rows[it.ri!];
      const base = it.y + (r.sub ? 44 : 50) * s;
      if (r.label) {
        c.fillStyle = p.mid; c.font = `600 ${24 * s}px ${body}`; c.textAlign = "left";
        c.fillText(fit(c, r.label, labelW - 16 * s), M, base);
      }
      c.fillStyle = p.hi; c.font = `600 ${30 * s}px ${body}`; c.textAlign = "left";
      c.fillText(fit(c, r.main, W - 2 * M - labelW), M + labelW, base);
      if (r.sub) {
        c.fillStyle = p.mid; c.font = `500 ${23 * s}px ${body}`;
        c.fillText(fit(c, r.sub, W - 2 * M - labelW), M + labelW, base + 36 * s);
      }
    }
  }
  return { canvas: cv, pages };
}

/** The portrait picture: 1080 wide, as tall as it needs. */
export async function drawSheetImage(sheet: Sheet): Promise<HTMLCanvasElement> {
  return (await render(sheet, 1080, null)).canvas;
}

const A4_W = 1240; // 150 dpi
const A4_H = Math.round(A4_W * Math.SQRT2);

/** A4 pages, as one stacked canvas (exported for previews and tests). */
export async function drawSheetPages(sheet: Sheet): Promise<{ canvas: HTMLCanvasElement; pages: number; pageH: number }> {
  const r = await render(sheet, A4_W, A4_H);
  return { ...r, pageH: A4_H };
}

/** A minimal PDF: one JPEG per A4 page. */
export async function sheetPdf(sheet: Sheet): Promise<Blob> {
  const { canvas, pages, pageH } = await drawSheetPages(sheet);
  const jpegs: Uint8Array[] = [];
  for (let i = 0; i < pages; i++) {
    const slice = document.createElement("canvas");
    slice.width = A4_W; slice.height = pageH;
    slice.getContext("2d")!.drawImage(canvas, 0, i * pageH, A4_W, pageH, 0, 0, A4_W, pageH);
    const b64 = slice.toDataURL("image/jpeg", 0.9).split(",")[1];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    jpegs.push(bytes);
  }
  return new Blob([buildPdf(jpegs, A4_W, pageH) as BlobPart], { type: "application/pdf" });
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

/** Hand a file to the phone's share sheet, or save it. */
async function shareFile(blob: Blob, name: string, title: string): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], name, { type: blob.type });
  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title }); return "shared"; }
    catch (e: any) { if (e?.name === "AbortError") return "cancelled"; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "saved";
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sheet";

export async function shareSheetImage(sheet: Sheet) {
  const cv = await drawSheetImage(sheet);
  const blob: Blob | null = await new Promise((res) => cv.toBlob(res, "image/png"));
  if (!blob) throw new Error("Couldn't make the picture.");
  return shareFile(blob, `${slug(sheet.title)}.png`, sheet.title);
}

export async function shareSheetPdf(sheet: Sheet) {
  return shareFile(await sheetPdf(sheet), `${slug(sheet.title)}.pdf`, sheet.title);
}
