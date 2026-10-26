// Find diverse, fully-validated cluster packings per board width for the
// difficulty upgrade. Adapted from search-templates.mjs: exhaustive DFS over
// mutually-compatible 4-cluster packings, then physics-audit the best
// candidates and print a diverse shortlist to bake into js/board.js.
import { validateClusters } from '../bubble-pop-english/js/board.js';
import { makeWorld, auditReachability } from '../bubble-pop-english/js/world.js';

const SHAPES = [
  [[0, 0], [0, 1], [1, 0]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [1, -1], [1, 0]],
  [[0, 0], [0, 1], [0, 2]],
];

function slotsFor(cols, maxRow) {
  const slots = [];
  for (let r = 0; r <= maxRow - 1; r++)
    for (let c = 0; c < cols; c++)
      for (const sh of SHAPES) {
        const cells = sh.map(([dr, dc]) => [r + dr, c + dc]);
        if (cells.every(([rr, cc]) => rr >= 0 && rr <= maxRow && cc >= 0 && cc < (rr % 2 === 0 ? cols : cols - 1)))
          slots.push(cells);
      }
  return slots;
}

function neighborSet(cols, cells) {
  const occ = new Set(cells.map((x) => x.join(',')));
  const out = new Set();
  for (const [r, c] of cells) {
    const even = r % 2 === 0;
    const cand = even
      ? [[r, c - 1], [r, c + 1], [r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]]
      : [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]];
    for (const [nr, nc] of cand) {
      if (nr < 0 || nc < 0 || nc >= (nr % 2 === 0 ? cols : cols - 1)) continue;
      const k = `${nr},${nc}`;
      if (!occ.has(k)) out.add(k);
    }
  }
  return out;
}

function compatible(cols, a, b) {
  const aCells = new Set(a.map((x) => x.join(',')));
  const bCells = new Set(b.map((x) => x.join(',')));
  for (const k of aCells) if (bCells.has(k)) return false;
  const aAdj = neighborSet(cols, a), bAdj = neighborSet(cols, b);
  for (const k of aAdj) if (bCells.has(k)) return false;
  for (const k of bAdj) if (aCells.has(k)) return false;
  for (const k of aAdj) if (bAdj.has(k)) return false;
  return true;
}

function search(cols) {
  const slots = slotsFor(cols, 5);
  const n = slots.length;
  const comp = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (compatible(cols, slots[i], slots[j])) { comp[i].add(j); comp[j].add(i); }
  }
  const found = [];
  const pick = (chosen) => {
    if (chosen.length === 4) { found.push(chosen.slice()); return; }
    const last = chosen.length ? chosen[chosen.length - 1] : -1;
    const list = chosen.length
      ? [...comp[last]].filter((j) => j > last && chosen.every((c) => comp[c].has(j)))
      : slots.map((_, j) => j);
    for (const j of list) { chosen.push(j); pick(chosen); chosen.pop(); }
  };
  pick([]);
  return { slots, found };
}

// Cheap diversity signature: sorted cell list.
const sig = (cells) => cells.flat().map((p) => p.join(',')).sort().join(';');

for (const cols of [8, 9, 10, 11, 12]) {
  const { slots, found } = search(cols);
  const seen = new Set();
  const cands = [];
  for (const idx of found) {
    const cells = idx.map((i) => slots[i]);
    const key = sig(cells);
    if (seen.has(key)) continue;
    seen.add(key);
    const maxRow = Math.max(...cells.flat().map(([r]) => r));
    cands.push({ cells, maxRow });
  }
  cands.sort((a, b) => a.maxRow - b.maxRow);
  const passing = [];
  for (const cand of cands.slice(0, 400)) {
    const clusters = cand.cells.map((cells, i) => ({ option: 'ABCD'[i], cells, color: 'blue' }));
    if (validateClusters(cols, clusters).length) continue;
    const world = makeWorld(cols, clusters);
    const rep = auditReachability(world, ['A', 'B', 'C', 'D']);
    const min = Math.min(...Object.values(rep));
    if (min < 8) continue; // comfortable base window; obstacles tighten later
    passing.push({ cells: cand.cells, min, maxRow: cand.maxRow, rep });
    if (passing.length >= 40) break;
  }
  // Greedy diverse pick: prefer different maxRow and horizontal spread.
  const picked = [];
  for (const cand of passing) {
    if (picked.length >= 4) break;
    const tooSimilar = picked.some((p) => {
      const a = new Set(p.cells.flat().map((x) => x.join(',')));
      let shared = 0;
      for (const cell of cand.cells.flat()) if (a.has(cell.join(','))) shared++;
      return shared >= 3 || (p.maxRow === cand.maxRow && picked.length && cand.maxRow <= 3);
    });
    if (!tooSimilar) picked.push(cand);
  }
  console.log(`\n// cols=${cols} — ${passing.length} passing candidates`);
  for (const p of picked) {
    console.log(`  { min:${p.min}, maxRow:${p.maxRow}, rep:${JSON.stringify(p.rep)} }`);
    for (const cl of ['A', 'B', 'C', 'D'].map((o, i) => ({ o, cells: p.cells[i] })))
      console.log(`    ${cl.o}: ${JSON.stringify(cl.cells)}`);
  }
}
