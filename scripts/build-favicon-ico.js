// Pack the 32 and 16 PNGs into a single favicon.ico.
// ICO is a container: 6-byte header, one 16-byte directory entry per image,
// then the payloads. Since Vista the payload may be a PNG verbatim, which is
// why this needs no encoder — the PNGs the browser rendered go in as they are.
const fs = require("fs");
const path = require("path");
const dir = process.argv[2];
const entries = [32, 16].map((s) => ({ s, buf: fs.readFileSync(path.join(dir, "favicon-" + s + ".png")) }));

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);              // reserved
header.writeUInt16LE(1, 2);              // 1 = icon
header.writeUInt16LE(entries.length, 4);

let offset = 6 + 16 * entries.length;
const table = Buffer.concat(entries.map(({ s, buf }) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s === 256 ? 0 : s, 0);    // width  (0 means 256)
  e.writeUInt8(s === 256 ? 0 : s, 1);    // height
  e.writeUInt8(0, 2);                    // palette size — 0 for truecolour
  e.writeUInt8(0, 3);                    // reserved
  e.writeUInt16LE(1, 4);                 // colour planes
  e.writeUInt16LE(32, 6);                // bits per pixel
  e.writeUInt32LE(buf.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += buf.length;
  return e;
}));

fs.writeFileSync(path.join(dir, "favicon.ico"), Buffer.concat([header, table, ...entries.map((e) => e.buf)]));
console.log("favicon.ico " + fs.statSync(path.join(dir, "favicon.ico")).size + " bytes, " + entries.map((e) => e.s).join(" + "));
