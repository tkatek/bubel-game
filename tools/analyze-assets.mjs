// Asset inspection: alpha bounding boxes, connected components (artwork blobs
// and interior transparent holes), coarse ASCII maps, cannon socket metrics.
import { loadRGBA } from './png.mjs';
import path from 'node:path';

const ROOT = 'bubble-pop-english-assets';
const FILES = [
  ['backgrounds/background-desktop.png', false],
  ['backgrounds/background-mobile.png', false],
  ['sprites/cannon.png', true],
  ['ui/question-bar-empty.png', true],
  ['ui/status-panel-empty.png', true],
  ['ui/powerups-panel-empty.png', true],
  ['ui/score-settings-empty.png', true],
  ['ui/next-bubble-frame-empty.png', true],
];

function alphaBBox(img, thr = 10) {
  const { width, height, data } = img;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > thr) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// 4-connected components of a predicate over pixels; returns blobs sorted by area desc.
function components(img, pred, minArea) {
  const { width, height, data } = img;
  const seen = new Uint8Array(width * height);
  const blobs = [];
  const stack = [];
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || !pred(data, start * 4)) continue;
    stack.length = 0; stack.push(start); seen[start] = 1;
    let area = 0, x0 = width, y0 = height, x1 = -1, y1 = -1, sx = 0, sy = 0;
    while (stack.length) {
      const idx = stack.pop();
      const x = idx % width, y = (idx / width) | 0;
      area++; sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && !seen[idx - 1] && pred(data, (idx - 1) * 4)) { seen[idx - 1] = 1; stack.push(idx - 1); }
      if (x < width - 1 && !seen[idx + 1] && pred(data, (idx + 1) * 4)) { seen[idx + 1] = 1; stack.push(idx + 1); }
      if (y > 0 && !seen[idx - width] && pred(data, (idx - width) * 4)) { seen[idx - width] = 1; stack.push(idx - width); }
      if (y < height - 1 && !seen[idx + width] && pred(data, (idx + width) * 4)) { seen[idx + width] = 1; stack.push(idx + width); }
    }
    if (area >= minArea) blobs.push({ area, x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: sx / area, cy: sy / area });
  }
  blobs.sort((a, b) => b.area - a.area);
  return blobs;
}

function asciiMap(img, cols = 76, mode = 'alpha') {
  const { width, height, data } = img;
  const rows = Math.max(1, Math.round((cols * height / width) / 2)); // chars are ~2x tall
  const lines = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c * width / cols), x1 = Math.floor((c + 1) * width / cols);
      const y0 = Math.floor(r * height / rows), y1 = Math.floor((r + 1) * height / rows);
      let n = 0, hit = 0, sum = 0;
      for (let y = y0; y < Math.max(y0 + 1, y1); y++) for (let x = x0; x < Math.max(x0 + 1, x1); x++) {
        const q = (y * width + x) * 4;
        n++;
        const a = data[q + 3];
        if (a > 40) { hit++; sum += (data[q] + data[q + 1] + data[q + 2]) / 3; }
      }
      const cover = hit / n;
      if (mode === 'alpha') {
        line += cover > 0.85 ? '#' : cover > 0.4 ? '+' : cover > 0.05 ? '.' : ' ';
      } else {
        if (cover < 0.4) line += ' ';
        else { const lum = sum / hit; line += lum < 60 ? '@' : lum < 120 ? '%' : lum < 180 ? '*' : lum < 230 ? '-' : ' '; }
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
}

for (const [rel, detailed] of FILES) {
  const img = loadRGBA(path.join(ROOT, rel));
  console.log('='.repeat(90));
  console.log(`${rel}  ${img.width}x${img.height}`);
  const bb = alphaBBox(img);
  console.log(`alpha bbox: ${JSON.stringify(bb)}  (fractions: x=${(bb.x0 / img.width).toFixed(3)}..${(bb.x1 / img.width).toFixed(3)} y=${(bb.y0 / img.height).toFixed(3)}..${(bb.y1 / img.height).toFixed(3)})`);
  if (!detailed) continue;
  const opaque = components(img, (d, q) => d[q + 3] > 40, Math.round(img.width * img.height * 0.0004));
  console.log(`opaque blobs (top 6):`);
  for (const b of opaque.slice(0, 6)) {
    console.log(`  area=${(b.area / 1000).toFixed(1)}k bbox=(${b.x0},${b.y0})-(${b.x1},${b.y1}) ${b.w}x${b.h} centroid=(${b.cx.toFixed(0)},${b.cy.toFixed(0)}) frac=(${(b.cx / img.width).toFixed(3)},${(b.cy / img.height).toFixed(3)})`);
  }
  // transparent holes: fully-enclosed transparent regions (approx: transparent blobs not touching border)
  const holes = components(img, (d, q) => d[q + 3] <= 40, Math.round(img.width * img.height * 0.0004))
    .filter(b => b.x0 > 0 && b.y0 > 0 && b.x1 < img.width - 1 && b.y1 < img.height - 1);
  console.log(`interior transparent holes (top 8):`);
  for (const b of holes.slice(0, 8)) {
    console.log(`  area=${(b.area / 1000).toFixed(1)}k bbox=(${b.x0},${b.y0})-(${b.x1},${b.y1}) ${b.w}x${b.h} centroid=(${b.cx.toFixed(0)},${b.cy.toFixed(0)}) frac=(${(b.cx / img.width).toFixed(3)},${(b.cy / img.height).toFixed(3)})`);
  }
  console.log('--- alpha map ---');
  console.log(asciiMap(img));
  if (rel.includes('cannon')) {
    // socket = largest interior transparent hole
    const s = holes[0];
    if (s) {
      const rEq = Math.sqrt(s.area / Math.PI);
      console.log(`SOCKET: center=(${s.cx.toFixed(1)},${s.cy.toFixed(1)}) frac=(${(s.cx / img.width).toFixed(4)},${(s.cy / img.height).toFixed(4)}) rEq=${rEq.toFixed(1)} fracW=${(rEq / img.width).toFixed(4)} bbox w/h=${s.w}x${s.h}`);
    }
  }
}
