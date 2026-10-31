/*
 * Builds the iOS home-screen launch images in public/splash/ (Sam,
 * 2026-10-31): cream #F8F4EB, the S mark centred at 22% of the screen's
 * width — exactly where the in-app cover (#sw-splash) and LoadingScreen draw
 * it, so opening the app shows one still picture from tap to Home.
 *
 *   node scripts/build-splash.cjs
 *
 * Needs Playwright (pre-installed in the cloud sessions). Reads the mark
 * from src/lib/splashMark.ts by text, so there is one drawing, not two.
 * The device list is also what layout.tsx links — keep them in step
 * (src/lib/splashDevices.json is the shared list).
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "src/lib/splashMark.ts"), "utf8");
const pick = (name) => src.match(new RegExp(`export const ${name} = "([^"]+)"`))[1];
const pickTpl = (name) => src.match(new RegExp("export const " + name + " = `([^`]+)`"))[1];
const S_PATH = pick("S_PATH"), VIEWBOX = pick("MARK_VIEWBOX"), INK = pick("MARK_INK"), BG = pick("MARK_BG");
const DEFS = pickTpl("BALL_DEFS"), BALL = pickTpl("BALL_SVG");
const devices = JSON.parse(fs.readFileSync(path.join(root, "src/lib/splashDevices.json"), "utf8"));

(async () => {
  const out = path.join(root, "public/splash");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  for (const d of devices) {
    const page = await browser.newPage({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: d.r });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:${BG};width:100vw;height:100vh;display:grid;place-items:center">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" style="width:min(22vw,160px);height:auto;display:block"><defs>${DEFS}</defs><path fill="${INK}" d="${S_PATH}"/>${BALL}</svg></body></html>`);
    const file = `splash-${d.w * d.r}x${d.h * d.r}.png`;
    await page.screenshot({ path: path.join(out, file) });
    await page.close();
    console.log(file, d.name);
  }
  await browser.close();
})();
