import { loadRGBA } from './png.mjs';
function holes(img, minArea) {
  const { width, height, data } = img;
  const seen = new Uint8Array(width * height);
  const blobs = [];
  const stack = [];
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || data[start * 4 + 3] > 40) continue;
    stack.length = 0; stack.push(start); seen[start] = 1;
    let area = 0, x0 = width, y0 = height, x1 = -1, y1 = -1, sx = 0, sy = 0, border = false;
    while (stack.length) {
      const idx = stack.pop();
      const x = idx % width, y = (idx / width) | 0;
      area++; sx += x; sy += y;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) border = true;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && !seen[idx - 1] && data[(idx - 1) * 4 + 3] <= 40) { seen[idx - 1] = 1; stack.push(idx - 1); }
      if (x < width - 1 && !seen[idx + 1] && data[(idx + 1) * 4 + 3] <= 40) { seen[idx + 1] = 1; stack.push(idx + 1); }
      if (y > 0 && !seen[idx - width] && data[(idx - width) * 4 + 3] <= 40) { seen[idx - width] = 1; stack.push(idx - width); }
      if (y < height - 1 && !seen[idx + width] && data[(idx + width) * 4 + 3] <= 40) { seen[idx + width] = 1; stack.push(idx + width); }
    }
    if (area >= minArea && !border) blobs.push({ area, cx: sx / area, cy: sy / area, w: x1 - x0 + 1, h: y1 - y0 + 1, rEq: Math.sqrt(area / Math.PI) });
  }
  blobs.sort((a, b) => b.area - a.area);
  return blobs;
}
for (const f of ['bubble-pop-english/assets/images/optimized/cannon.png', 'bubble-pop-english/assets/images/optimized/next-bubble-frame.png']) {
  const img = loadRGBA(f);
  const hs = holes(img, img.width * img.height * 0.0004).slice(0, 3);
  console.log(f, img.width + 'x' + img.height);
  for (const h of hs) console.log(`  hole cx=${h.cx.toFixed(1)} cy=${h.cy.toFixed(1)} (frac ${h.cx / img.width.toFixed ? (h.cx / img.width).toFixed(4) : ''},${(h.cy / img.height).toFixed(4)}) rEq=${h.rEq.toFixed(1)} fracW=${(h.rEq / img.width).toFixed(4)}`);
}
