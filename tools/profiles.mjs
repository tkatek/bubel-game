// Precise profiles: question-bar body top edge, score-settings split, panel corner radii.
import { loadRGBA } from './png.mjs';

function rowProfile(img, thr = 40) {
  const { width, height, data } = img;
  const rows = [];
  for (let y = 0; y < height; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > thr) n++;
    rows.push(n);
  }
  return rows;
}
function colProfile(img, thr = 40) {
  const { width, height, data } = img;
  const cols = [];
  for (let x = 0; x < width; x++) {
    let n = 0;
    for (let y = 0; y < height; y++) if (data[(y * width + x) * 4 + 3] > thr) n++;
    cols.push(n);
  }
  return cols;
}
function summarize(name, prof, step) {
  const max = Math.max(...prof);
  console.log(`${name} (max=${max}) samples every ${step}:`);
  const marks = [];
  for (let i = 0; i < prof.length; i += step) marks.push(`${i}:${prof[i] > max * 0.5 ? 'H' : prof[i] > max * 0.05 ? 'l' : '.'}`);
  console.log(marks.join(' '));
}

const qb = loadRGBA('bubble-pop-english-assets/ui/question-bar-empty.png');
summarize('question-bar rows', rowProfile(qb), 20);
// body top = first row where coverage > 60% width
const rows = rowProfile(qb);
for (let y = 0; y < qb.height; y++) if (rows[y] > qb.width * 0.6) { console.log(`body top edge y=${y}`); break; }

const ss = loadRGBA('bubble-pop-english-assets/ui/score-settings-empty.png');
const cols = colProfile(ss);
const maxC = Math.max(...cols);
// find the gap between container and circle: band of low coverage after high
let gapStart = -1, gapEnd = -1;
for (let x = 800; x < 2100; x++) {
  if (cols[x] < maxC * 0.15 && gapStart < 0) gapStart = x;
  if (gapStart > 0 && cols[x] >= maxC * 0.3) { gapEnd = x; break; }
}
console.log(`score-settings gap: x=${gapStart}..${gapEnd}`);
// circle bounds: right side after gap
let cx0 = gapEnd, cx1 = ss.width;
for (let x = ss.width - 1; x > gapEnd; x--) if (cols[x] > 10) { cx1 = x; break; }
const cRows = rowProfile({ ...ss, width: cx1 - cx0 + 1, data: Buffer.alloc(0) }); // placeholder
// simpler: scan circle region rows directly
let cy0 = -1, cy1 = -1;
for (let y = 0; y < ss.height; y++) {
  let n = 0;
  for (let x = cx0; x <= cx1; x++) if (ss.data[(y * ss.width + x) * 4 + 3] > 40) n++;
  if (n > (cx1 - cx0) * 0.3 && cy0 < 0) cy0 = y;
  if (n > (cx1 - cx0) * 0.3) cy1 = y;
}
console.log(`settings circle: x=${cx0}..${cx1} y=${cy0}..${cy1} (${cx1 - cx0 + 1}x${cy1 - cy0 + 1})`);
// score container: left of gap
let sx1 = gapStart - 1;
for (let x = sx1; x > 0; x--) if (cols[x] < 10) { sx1 = x + 1; break; }
let sy0 = -1, sy1 = -1;
for (let y = 0; y < ss.height; y++) {
  let n = 0;
  for (let x = 0; x <= sx1; x++) if (ss.data[(y * ss.width + x) * 4 + 3] > 40) n++;
  if (n > sx1 * 0.3 && sy0 < 0) sy0 = y;
  if (n > sx1 * 0.3) sy1 = y;
}
console.log(`score container: x=0..${sx1} y=${sy0}..${sy1} (${sx1 + 1}x${sy1 - sy0 + 1})`);

// corner radius estimate of status panel (rounded rect): scan top edge row of bbox
const st = loadRGBA('bubble-pop-english-assets/ui/status-panel-empty.png');
const bb = { x0: 41, y0: 201, x1: 982, y1: 1337 };
const y = bb.y0 + 2;
let firstX = -1;
for (let x = bb.x0; x <= bb.x1; x++) if (st.data[(y * st.width + x) * 4 + 3] > 40) { firstX = x; break; }
console.log(`status panel: at y=y0+2 first opaque x=${firstX} (offset ${firstX - bb.x0} from left edge)`);
