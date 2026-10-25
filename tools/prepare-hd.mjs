// Import the HD item pack into the game and right-size all painted artwork.
// Box-resampling with premultiplied alpha so soft painted edges survive
// downscaling without dark halos.
import fs from 'node:fs';
import path from 'node:path';
import { loadRGBA, saveRGBA } from './png.mjs';

const HD_SRC = process.argv[2] || '/tmp/bpe-assets';
const HD_OUT = 'bubble-pop-english/assets/hd';
const OPT = 'bubble-pop-english/assets/images/optimized';

// [srcName, outName, maxEdge] — max edge in px; artwork never displays larger
// than ~2x these sizes in the interface, even at 2x DPR.
const HD_ITEMS = [
  ['owl-teacher-hd.png', 'owl.png', 480],
  ['bubble-red-hd.png', 'bubble-red.png', 320],
  ['bubble-blue-hd.png', 'bubble-blue.png', 320],
  ['bubble-yellow-hd.png', 'bubble-yellow.png', 320],
  ['bubble-green-hd.png', 'bubble-green.png', 320],
  ['pause-button-hd.png', 'pause.png', 256],
  ['book-icon-hd.png', 'book.png', 192],
  ['star-icon-hd.png', 'star.png', 192],
  ['trophy-icon-hd.png', 'trophy.png', 192],
  ['heart-icon-hd.png', 'heart.png', 192],
  ['home-icon-hd.png', 'home.png', 192],
  ['settings-icon-hd.png', 'settings.png', 192],
  ['sound-on-icon-hd.png', 'sound-on.png', 192],
  ['sound-off-icon-hd.png', 'sound-off.png', 192],
  ['clock-icon-hd.png', 'clock.png', 192],
  ['hourglass-icon-hd.png', 'hourglass.png', 192],
  ['question-mark-icon-hd.png', 'question-mark.png', 192],
  ['target-icon-hd.png', 'target.png', 192],
];

// Existing painted panels get the same treatment, rewritten in place.
const PANELS = [
  ['cannon.png', 768],
  ['question-bar-body.png', 1600],
  ['status-panel.png', 512],
  ['powerups-panel.png', 384],
  ['score-container.png', 640],
  ['next-bubble-frame.png', 320],
];

function downscale(img, maxEdge) {
  const { width: sw, height: sh } = img;
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  if (scale >= 1) return img;
  const tw = Math.max(1, Math.round(sw * scale));
  const th = Math.max(1, Math.round(sh * scale));
  const sd = img.data;
  const out = Buffer.alloc(tw * th * 4);
  const fx = sw / tw, fy = sh / th;
  for (let y = 0; y < th; y++) {
    const iy0 = Math.floor(y * fy), iy1 = Math.min(sh, Math.ceil((y + 1) * fy));
    for (let x = 0; x < tw; x++) {
      const ix0 = Math.floor(x * fx), ix1 = Math.min(sw, Math.ceil((x + 1) * fx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = iy0; yy < iy1; yy++) {
        const row = yy * sw;
        for (let xx = ix0; xx < ix1; xx++) {
          const i = (row + xx) * 4;
          const al = sd[i + 3];
          r += sd[i] * al; g += sd[i + 1] * al; b += sd[i + 2] * al; a += al; n++;
        }
      }
      const q = (y * tw + x) * 4;
      if (a > 0) { out[q] = Math.round(r / a); out[q + 1] = Math.round(g / a); out[q + 2] = Math.round(b / a); }
      out[q + 3] = Math.round(a / n);
    }
  }
  return { width: tw, height: th, data: out };
}

function visibleBBox(img, thr = 16) {
  const { width: w, height: h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > thr) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

fs.mkdirSync(HD_OUT, { recursive: true });
const report = [];
for (const [src, out, maxEdge] of HD_ITEMS) {
  const img = downscale(loadRGBA(path.join(HD_SRC, src)), maxEdge);
  saveRGBA(path.join(HD_OUT, out), img);
  const bb = visibleBBox(img);
  report.push({ file: `assets/hd/${out}`, w: img.width, h: img.height,
    vis: { x: +(bb.x0 / img.width).toFixed(4), y: +(bb.y0 / img.height).toFixed(4),
           w: +(bb.w / img.width).toFixed(4), h: +(bb.h / img.height).toFixed(4) } });
  console.log(`hd/${out} ${img.width}x${img.height} ${(fs.statSync(path.join(HD_OUT, out)).size / 1024).toFixed(0)}KB vis ${bb.w}x${bb.h}`);
}
for (const [name, maxEdge] of PANELS) {
  const p = path.join(OPT, name);
  const img = downscale(loadRGBA(p), maxEdge);
  if (img !== undefined && (img.width !== loadRGBA(p).width || true)) {
    saveRGBA(p, img);
    console.log(`optimized/${name} -> ${img.width}x${img.height} ${(fs.statSync(p).size / 1024).toFixed(0)}KB`);
  }
}
fs.writeFileSync(path.join(HD_OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log('HD assets ready; visible-bounds report at assets/hd/report.json');
