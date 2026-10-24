const fs = require('fs');
const d = fs.readFileSync('s-path.txt', 'utf8');
const defs = `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F8F4EB"/><stop offset="1" stop-color="#E6DCC8"/></linearGradient>
    <radialGradient id="ball" cx="0.35" cy="0.3" r="0.85"><stop offset="0" stop-color="#E2C98E"/><stop offset="1" stop-color="#B8955A"/></radialGradient>
    <clipPath id="clip"><circle cx="79" cy="73" r="8.5"/></clipPath>
  </defs>`;
const mark = `<rect x="6" y="6" width="88" height="88" rx="18" fill="none" stroke="#B8955A" stroke-width="1.4"/>
  <path d="${d}" fill="#1C2D23"/>
  <circle cx="79" cy="73" r="8.5" fill="url(#ball)"/>
  <g clip-path="url(#clip)" fill="none" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round">
    <path d="M70.5 66.6 Q77.7 73 70.5 79.4"/>
    <path d="M87.5 66.6 Q80.3 73 87.5 79.4"/>
  </g>`;
const head = (title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>${title}</title>\n  `;
const icon = head('Southwood') + defs + `\n  <rect width="100" height="100" fill="url(#bg)"/>\n  ` + mark + `\n</svg>\n`;
// Maskable: the whole mark inside the central 80% safe zone, background full bleed.
const maskable = head('Southwood') + defs + `\n  <rect width="100" height="100" fill="url(#bg)"/>\n  <g transform="translate(10 10) scale(0.8)">\n  ` + mark + `\n  </g>\n</svg>\n`;
fs.writeFileSync('icon.svg', icon);
fs.writeFileSync('icon-maskable.svg', maskable);
console.log('ok', icon.length, maskable.length);
