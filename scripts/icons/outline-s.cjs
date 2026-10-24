const opentype = require('opentype.js');
const font = opentype.loadSync('fr-144.ttf');
const size = 84;
const adv = font.getAdvanceWidth('S', size);
const p = font.getPath('S', 43 - adv / 2, 82, size);
const d = p.toPathData(2);
const bb = p.getBoundingBox();
require('fs').writeFileSync('s-path.txt', d);
console.log('adv', adv.toFixed(2), 'bbox', JSON.stringify(bb), 'len', d.length);
