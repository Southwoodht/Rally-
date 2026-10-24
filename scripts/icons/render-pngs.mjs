import { createRequire } from 'module'; const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright'); import fs from 'fs';
const b = await chromium.launch();
const out = '/tmp/claude-0/icon/out'; fs.mkdirSync(out, { recursive: true });
const jobs = [
  ['icon.svg', [16,32,48,72,96,128,144,152,180,192,384,512,1024]],
  ['icon-maskable.svg', [192,512]],
];
for (const [file, sizes] of jobs) {
  const svg = fs.readFileSync(file, 'utf8');
  for (const s of sizes) {
    const p = await b.newPage({ viewport: { width: s, height: s }, deviceScaleFactor: 1 });
    await p.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body></html>`);
    await p.screenshot({ path: `${out}/${file.replace('.svg','')}-${s}.png`, omitBackground: true });
    await p.close();
  }
}
await b.close(); console.log(fs.readdirSync(out).join(' '));
