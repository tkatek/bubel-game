// Copy supplied originals unchanged; produce trimmed/cropped optimized versions.
import fs from 'node:fs';
import path from 'node:path';
import { loadRGBA, saveRGBA } from './png.mjs';

const SRC = 'bubble-pop-english-assets';
const ORIG = 'bubble-pop-english/assets/images/original';
const OPT = 'bubble-pop-english/assets/images/optimized';

const copies = [
  ['backgrounds/background-desktop.png', 'background-desktop.png'],
  ['backgrounds/background-mobile.png', 'background-mobile.png'],
  ['sprites/cannon.png', 'cannon.png'],
  ['ui/question-bar-empty.png', 'question-bar-empty.png'],
  ['ui/status-panel-empty.png', 'status-panel-empty.png'],
  ['ui/powerups-panel-empty.png', 'powerups-panel-empty.png'],
  ['ui/score-settings-empty.png', 'score-settings-empty.png'],
  ['ui/next-bubble-frame-empty.png', 'next-bubble-frame-empty.png'],
];
for (const [src, name] of copies) {
  const to = path.join(ORIG, name);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(SRC, src), to);
}

// name -> [x0, y0, x1, y1] crop windows (inclusive), measured by tools/analyze-assets.mjs
const crops = {
  'cannon.png': [42, 106, 1211, 1140],
  'question-bar.png': [29, 0, 2142, 501],        // full banner incl. hanging posts
  'question-bar-body.png': [29, 192, 2142, 505], // body only, posts removed
  'status-panel.png': [41, 201, 982, 1337],
  'powerups-panel.png': [96, 84, 790, 1727],
  'score-container.png': [93, 135, 1678, 554],
  'settings-button.png': [1687, 153, 2087, 544],
  'next-bubble-frame.png': [166, 180, 1086, 1037],
};
for (const [name, [x0, y0, x1, y1]] of Object.entries(crops)) {
  const srcName = copies.find(([, n]) => n.startsWith(name.split('-')[0]) || name.startsWith('question-bar') && n.startsWith('question-bar'))?.[1]
    ?? (name.includes('question-bar') ? 'question-bar-empty.png'
      : name.includes('score') ? 'score-settings-empty.png'
      : name.includes('settings') ? 'score-settings-empty.png'
      : name.replace('.png', '') + '.png');
  const img = loadRGBA(path.join(ORIG, srcName));
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    img.data.copy(out, y * w * 4, ((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + w) * 4);
  }
  const to = path.join(OPT, name);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  saveRGBA(to, { width: w, height: h, data: out });
  // verify round-trip
  const check = loadRGBA(to);
  console.log(`${name}: ${w}x${h} (${(fs.statSync(to).size / 1024).toFixed(0)} KB) roundtrip=${check.width === w && check.height === h ? 'OK' : 'FAIL'}`);
}
console.log('assets ready');
