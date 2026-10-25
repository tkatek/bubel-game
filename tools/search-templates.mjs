// Search validated cluster packings per board width, scored by real-physics
// reachability (every option needs a comfortable aiming window).
// Pairwise compatibility + DFS: dual-contact and adjacency between clusters
// are pairwise properties, so a slot×slot matrix prunes the whole space.
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
  for (const k of aCells) if (bCells.has(k)) return false;                    // overlap
  const aAdj = neighborSet(cols, a), bAdj = neighborSet(cols, b);
  for (const k of aAdj) if (bCells.has(k)) return false;                      // clusters touch
  for (const k of bAdj) if (aCells.has(k)) return false;
  for (const k of aAdj) if (bAdj.has(k)) return false;                        // shared empty cell
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
    const cands = chosen.length
      ? [...comp[last]].filter((j) => j > last && chosen.every((c) => comp[c].has(j)))
      : null;
    const list = chosen.length ? cands : slots.map((_, j) => j);
    for (const j of list) { chosen.push(j); pick(chosen); chosen.pop(); }
  };
  pick([]);
  return { slots, found };
}

for (const cols of [8, 9, 10, 11, 12]) {
  const { slots, found } = search(cols);
  // heuristic pre-rank: prefer shallower boards, then evaluate physics on top slice
  const ranked = found
    .map((idx) => {
      const cells = idx.map((i) => slots[i]);
      const maxRow = Math.max(...cells.flat().map(([r]) => r));
      return { cells, maxRow };
    })
    .sort((a, b) => a.maxRow - b.maxRow)
    .slice(0, 300);
  let best = null;
  for (const cand of ranked) {
    const clusters = cand.cells.map((cells, i) => ({ option: 'ABCD'[i], cells, color: 'blue' }));
    if (validateClusters(cols, clusters).length) continue; // defensive
    const world = makeWorld(cols, clusters);
    const rep = auditReachability(world, ['A', 'B', 'C', 'D']);
    const min = Math.min(...Object.values(rep));
    const score = min - cand.maxRow;
    if (!best || score > best.score) best = { score, min, rep, clusters, maxRow: cand.maxRow };
    if (best.min >= 12) break; // comfortable window found, stop early
  }
  console.log(`cols=${cols} validPackings=${found.length}${best ? ` evaluatedMin=${best.min} maxRow=${best.maxRow} rep=${JSON.stringify(best.rep)}` : ' NONE'}`);
  if (best) for (const cl of best.clusters) console.log(`    ${cl.option}: ${JSON.stringify(cl.cells)}`);
}
