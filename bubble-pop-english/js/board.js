// Hex board: offset rows (odd rows shifted right half a cell and holding one
// fewer cell), answer-cluster layouts, neutral puzzle fields, adjacency,
// match groups, support (falling) and landing snaps. Pure grid logic —
// geometry/scale lives in world.js, physics validation lives in solver.js.
//
// Board model (documented in docs/board-mechanics.md):
//   answer bubbles  — four 3-cell clusters, all in the loaded colour, each
//                     carrying one option id. They are support anchors: they
//                     never fall, so a chain reaction can never silently
//                     remove a question target.
//   neutral bubbles — coloured obstacles in the other three colours, placed
//                     as connected same-colour groups of 3+ so every group is
//                     clearable with one accurate shot. They fall when they
//                     lose their support path to the ceiling/answer anchors.

import { BUBBLE_COLORS } from './assets.js';

export const ROW_H = Math.sqrt(3) / 2; // row spacing as a fraction of cell D
export const MAX_ROW = 5;              // deepest grid row (muzzle sits below)

export class HexBoard {
  constructor(cols, clusters) {
    this.cols = cols;
    this.cells = new Map(); // "r,c" -> { color, option }
    for (const cl of clusters) {
      for (const [r, c] of cl.cells) {
        if (this.cells.has(`${r},${c}`)) throw new Error(` overlapping cell ${r},${c}`);
        this.cells.set(`${r},${c}`, { color: cl.color, option: cl.option ?? null });
      }
    }
    this.clusters = clusters.map((cl) => ({ option: cl.option ?? null, cells: cl.cells.slice(), color: cl.color }));
  }

  key(r, c) { return `${r},${c}`; }
  get(r, c) { return this.cells.get(this.key(r, c)) || null; }
  has(r, c) { return this.cells.has(this.key(r, c)); }
  set(r, c, v) { this.cells.set(this.key(r, c), v); }
  remove(r, c) { this.cells.delete(this.key(r, c)); }
  entries() { return Array.from(this.cells.entries(), ([k, v]) => { const [r, c] = k.split(',').map(Number); return { r, c, ...v }; }); }

  clone() {
    const copy = new HexBoard(this.cols, []);
    copy.cells = new Map();
    for (const [k, v] of this.cells) copy.cells.set(k, { ...v });
    copy.clusters = this.clusters.map((cl) => ({ ...cl, cells: cl.cells.slice() }));
    return copy;
  }

  colSpan(r) { return r % 2 === 0 ? this.cols : this.cols - 1; }

  inGrid(r, c) { return r >= 0 && r <= MAX_ROW && c >= 0 && c < this.colSpan(r); }

  neighbors(r, c) {
    const even = r % 2 === 0;
    const cand = even
      ? [[r, c - 1], [r, c + 1], [r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]]
      : [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]];
    return cand.filter(([rr, cc]) => this.inGrid(rr, cc));
  }

  // World-space centre of a cell for cell diameter D.
  cellCenter(r, c, D) {
    const x = (r % 2 === 0 ? c + 0.5 : c + 1) * D;
    const y = r * ROW_H * D + D / 2;
    return { x, y };
  }

  // Flood-fill the connected same-colour group containing (r,c).
  groupAt(r, c) {
    const start = this.get(r, c);
    if (!start) return [];
    const seen = new Set([this.key(r, c)]);
    const stack = [[r, c]];
    const out = [];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      out.push([cr, cc]);
      for (const [nr, nc] of this.neighbors(cr, cc)) {
        const k = this.key(nr, nc);
        const cell = this.get(nr, nc);
        if (!seen.has(k) && cell && cell.color === start.color) { seen.add(k); stack.push([nr, nc]); }
      }
    }
    return out;
  }

  // Maximal connected same-colour neutral (option-free) groups, size ≥ 1.
  neutralGroups() {
    const seen = new Set();
    const groups = [];
    for (const k of this.cells.keys()) {
      if (seen.has(k) || this.cells.get(k).option != null) continue;
      const [r, c] = k.split(',').map(Number);
      const group = this.groupAt(r, c);
      for (const [gr, gc] of group) seen.add(this.key(gr, gc));
      groups.push({ color: this.cells.get(k).color, cells: group });
    }
    return groups;
  }

  // Support anchors: every occupied row-0 cell plus every answer bubble.
  // Answer clusters are anchored by design, so popping neutral support can
  // never drop a question target (docs/board-mechanics.md).
  isAnchor(r, c) {
    const cell = this.get(r, c);
    return !!cell && (r === 0 || cell.option != null);
  }

  // Occupied cells with no support path to an anchor — these fall.
  unsupported() {
    const seen = new Set();
    const stack = [];
    for (const [k, cell] of this.cells) {
      const [r] = k.split(',').map(Number);
      if (r === 0 || cell.option != null) { seen.add(k); stack.push(k); }
    }
    while (stack.length) {
      const [r, c] = stack.pop().split(',').map(Number);
      for (const [nr, nc] of this.neighbors(r, c)) {
        const k = this.key(nr, nc);
        if (!seen.has(k) && this.has(nr, nc)) { seen.add(k); stack.push(k); }
      }
    }
    const out = [];
    for (const [k, cell] of this.cells) {
      if (!seen.has(k)) { const [r, c] = k.split(',').map(Number); out.push({ r, c, ...cell }); }
    }
    return out;
  }

  // Atomically drop unsupported cells; returns the removed cell data.
  dropUnsupported() {
    const falling = this.unsupported();
    for (const f of falling) this.remove(f.r, f.c);
    return falling;
  }

  // Empty in-grid neighbours of a cell, nearest-first to a reference point.
  emptyNeighborsSorted(r, c, ref, D) {
    return this.neighbors(r, c)
      .filter(([nr, nc]) => !this.has(nr, nc))
      .map(([nr, nc]) => { const p = this.cellCenter(nr, nc, D); return { r: nr, c: nc, d: (p.x - ref.x) ** 2 + (p.y - ref.y) ** 2 }; })
      .sort((a, b) => a.d - b.d);
  }

  // Ceiling landing: nearest free cell in the first rows to an x position.
  ceilingCell(x, D) {
    let best = null;
    for (let r = 0; r <= 1; r++) {
      for (let c = 0; c < this.colSpan(r); c++) {
        if (this.has(r, c)) continue;
        const p = this.cellCenter(r, c, D);
        const d = (p.x - x) ** 2 + (p.y) ** 2 * 0.15;
        if (!best || d < best.d) best = { r, c, d, p };
      }
    }
    return best;
  }
}

// ---- Legacy four-cluster templates (search-templates.mjs output) ----------
// Kept as the guaranteed fallback layout family; every packing passes the
// structural rules AND the real-physics reachability audit.
const TEMPLATES = {
  8:  [[[0, 0], [0, 1], [0, 2]], [[0, 5], [0, 6], [0, 7]], [[3, 0], [3, 1], [4, 0]], [[3, 5], [3, 6], [4, 6]]],
  9:  [[[0, 0], [0, 1], [1, 0]], [[0, 4], [0, 5], [1, 4]], [[2, 7], [2, 8], [3, 7]], [[4, 0], [4, 1], [4, 2]]],
  10: [[[0, 0], [0, 1], [1, 0]], [[0, 4], [0, 5], [1, 5]], [[0, 8], [0, 9], [1, 8]], [[4, 0], [4, 1], [4, 2]]],
  11: [[[0, 0], [0, 1], [1, 0]], [[0, 4], [1, 3], [1, 4]], [[0, 7], [0, 8], [0, 9]], [[3, 7], [3, 8], [3, 9]]],
  12: [[[0, 0], [0, 1], [1, 0]], [[0, 4], [0, 5], [1, 4]], [[0, 8], [0, 9], [0, 10]], [[3, 8], [3, 9], [3, 10]]],
};

const mirrorCell = (cols) => ([r, c]) => [r, r % 2 === 0 ? cols - 1 - c : cols - 2 - c];

export function buildClusters(cols, options, color, rng) {
  const base = TEMPLATES[cols] || TEMPLATES[11];
  const mirror = rng() < 0.5;
  const m = mirror ? mirrorCell(cols) : (x) => x;
  const slots = base.map((cells, i) => ({ option: options[i], cells: cells.map(m) }));
  // Randomise which option sits in which slot.
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [slots[i].option, slots[j].option] = [slots[j].option, slots[i].option];
  }
  return slots.map((s) => ({ option: s.option, cells: s.cells, color }));
}

// Legacy structural validation for the four-cluster templates (rules 1–4).
export function validateClusters(cols, clusters) {
  const errors = [];
  const board = new HexBoard(cols, clusters); // throws on overlap
  const all = clusters.flatMap((cl) => cl.cells.map(([r, c]) => ({ r, c, opt: cl.option })));
  for (const cl of clusters) {
    if (cl.cells.length !== 3) errors.push(`cluster ${cl.option}: ${cl.cells.length} cells (need 3)`);
    // connectivity
    const set = new Set(cl.cells.map(([r, c]) => `${r},${c}`));
    const seen = new Set([cl.cells[0].join(',')]);
    const stack = [cl.cells[0]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      for (const [nr, nc] of board.neighbors(cr, cc)) {
        if (set.has(`${nr},${nc}`) && !seen.has(`${nr},${nc}`)) { seen.add(`${nr},${nc}`); stack.push([nr, nc]); }
      }
    }
    if (seen.size !== 3) errors.push(`cluster ${cl.option}: not fully connected`);
  }
  // inter-cluster adjacency + shared empty-cell contact
  const optAt = (r, c) => { const cell = board.get(r, c); return cell ? cell.option : null; };
  for (const { r, c } of all) {
    for (const [nr, nc] of board.neighbors(r, c)) {
      const o = optAt(nr, nc);
      const own = optAt(r, c);
      if (o && o !== own) errors.push(`clusters ${own}/${o} touch at ${r},${c}–${nr},${nc}`);
    }
  }
  for (let r = 0; r <= 6; r++) {
    for (let c = 0; c < board.colSpan(r); c++) {
      if (board.has(r, c)) continue;
      const opts = new Set(board.neighbors(r, c).map(([nr, nc]) => optAt(nr, nc)).filter(Boolean));
      if (opts.size > 1) errors.push(`empty ${r},${c} touches ${[...opts].join('+')}`);
    }
  }
  return errors;
}

// ---- Puzzle board generation ----------------------------------------------
//
// Cluster layouts are picked procedurally from a small shape alphabet with a
// zoned placement pass (left / centre-left / centre-right / right), then
// checked with the same pairwise compatibility the template search used: no
// overlap, no adjacency between clusters, and no empty cell touching two
// clusters (a shot landing there could never tell which answer was chosen).
// A curated fallback family (TEMPLATES above) is used when the procedural
// pass cannot place four clusters.

const SHAPES = [
  [[0, 0], [0, 1], [1, 0]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, -1], [1, 0]],
];

// Anchor rows a cluster may start at: 0 = ceiling row, 2/3 = hanging mid
// board (answer bubbles are support anchors, so these are stable).
const ANCHOR_ROWS = [0, 0, 2, 3];

function clusterSlots(cols) {
  const slots = [];
  for (const r0 of ANCHOR_ROWS) {
    for (let c = 0; c < cols; c++) {
      for (const sh of SHAPES) {
        const cells = sh.map(([dr, dc]) => [r0 + dr, c + dc]);
        if (cells.every(([rr, cc]) => rr >= 0 && rr <= MAX_ROW && cc >= 0 && cc < (rr % 2 === 0 ? cols : cols - 1))) {
          const meanCol = cells.reduce((s, [, cc]) => s + cc, 0) / cells.length;
          slots.push({ cells, zone: Math.min(3, Math.floor((meanCol / cols) * 4)), top: r0 === 0 });
        }
      }
    }
  }
  return slots;
}

function slotCompatible(cols, a, b) {
  const aCells = new Set(a.cells.map((x) => x.join(',')));
  const bCells = new Set(b.cells.map((x) => x.join(',')));
  const neigh = (cells) => {
    const occ = cells;
    const out = new Set();
    for (const key of occ) {
      const [r, c] = key.split(',').map(Number);
      const even = r % 2 === 0;
      const cand = even
        ? [[r, c - 1], [r, c + 1], [r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]]
        : [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]];
      for (const [nr, nc] of cand) {
        if (nr < 0 || nr > MAX_ROW || nc < 0 || nc >= (nr % 2 === 0 ? cols : cols - 1)) continue;
        out.add(`${nr},${nc}`);
      }
    }
    return out;
  };
  const aAdj = neigh(aCells), bAdj = neigh(bCells);
  for (const k of aAdj) if (bCells.has(k)) return false;   // clusters touch
  for (const k of bAdj) if (aCells.has(k)) return false;
  for (const k of aAdj) if (bAdj.has(k)) return false;     // shared empty cell
  return true;
}

// Pick four mutually-compatible cluster slots, one per horizontal zone where
// possible, mixing ceiling-anchored and hanging placements. Falls back to the
// curated TEMPLATES family when no procedural packing fits.
export function pickClusterLayout(cols, rng) {
  const slots = clusterSlots(cols);
  for (let attempt = 0; attempt < 60; attempt++) {
    const byZone = new Map([0, 1, 2, 3].map((z) => [z, slots.filter((s) => s.zone === z)]));
    const chosen = [];
    for (const z of [0, 3, 1, 2]) {
      const pool = byZone.get(z).filter((s) => chosen.every((ch) => slotCompatible(cols, ch, s)));
      if (!pool.length) break;
      chosen.push(pool[Math.floor(rng() * pool.length)]);
    }
    if (chosen.length === 4 && chosen.every((ch) => chosen.every((o) => o === ch || slotCompatible(cols, ch, o)))) {
      return chosen.map((s) => s.cells);
    }
  }
  const base = TEMPLATES[cols] || TEMPLATES[11];
  const mirror = rng() < 0.5;
  const m = mirror ? mirrorCell(cols) : (x) => x;
  return base.map((cells) => cells.map(m));
}

// Density targets per difficulty tier (total bubbles on the board).
export function densityTargets(level, cols) {
  const tier = level <= 5 ? 0 : level <= 10 ? 1 : 2;
  const desktop = [[20, 28], [28, 38], [35, 46]][tier];
  const narrow = { 8: [18, 30], 9: [22, 34], 10: [24, 40] };
  const range = narrow[cols] || desktop;
  // phone boards never exceed the desktop tier maximum
  const lo = tier === 0 ? range[0] : Math.max(range[0], desktop[0] - 4);
  const hi = Math.min(range[1], desktop[1]);
  return { lo, hi, tier };
}

// Build a full puzzle board: four answer clusters in `loadedColor` plus a
// neutral obstacle field in the other three colours. Deterministic in
// (cols, level, options order, loadedColor, seed). `obstacleBudget`
// (LEVEL_CONFIG) is a floor on neutral cells — density windows from the
// task targets stay authoritative. Returns null when a reasonable board
// cannot be built for this seed (caller reseeds / falls back to the curated
// layout family).
export function buildPuzzleBoard({ cols, level, options, loadedColor, seed, obstacleBudget = 0 }) {
  if (options.length !== 4) return null;
  const rng = mulberry32(seed);
  const neutralColors = BUBBLE_COLORS.filter((c) => c !== loadedColor);
  if (neutralColors.length < 3) return null;

  const layout = pickClusterLayout(cols, rng);
  const clusters = layout.map((cells, i) => ({ option: options[i], cells, color: loadedColor, kind: 'answer' }));
  for (let i = clusters.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [clusters[i].option, clusters[j].option] = [clusters[j].option, clusters[i].option];
  }

  const board = new HexBoard(cols, clusters);
  const { lo, hi } = densityTargets(level, cols);
  const maxNeutral = Math.max(0, hi - 12);
  const wantNeutral = Math.min(maxNeutral, Math.max(Math.round((lo + Math.min(hi, lo + 8)) / 2) - 12, Math.min(obstacleBudget, maxNeutral)));

  // Cluster-adjacency limit: a placed neutral may touch at most one cluster,
  // so popping it can never expose a cell that bridges two answers.
  const clusterTouchLimit = (r, c) => {
    let n = 0;
    for (const [nr, nc] of board.neighbors(r, c)) {
      const cell = board.get(nr, nc);
      if (cell && cell.option != null) n++;
    }
    return n;
  };

  const placed = [];
  let placedCells = 0;
  let guard = 0;
  while (placedCells < wantNeutral && guard++ < 80) {
    const color = neutralColors[placed.length % 3 === 0 ? Math.floor(rng() * 3) : (guard + placed.length) % 3];
    const size = 3 + Math.floor(rng() * 3); // 3–5: matchable with one shot
    const bias = rng();                     // 0 = pillar-ish, 1 = bank/row-ish
    // Seeds: free cells hanging from anchors or already-placed neutrals.
    const seeds = [];
    for (let r = 0; r <= MAX_ROW; r++) {
      for (let c = 0; c < board.colSpan(r); c++) {
        if (board.has(r, c) || clusterTouchLimit(r, c) > 1) continue;
        const supported = r === 0 || board.neighbors(r, c).some(([nr, nc]) => board.has(nr, nc));
        if (supported) seeds.push([r, c]);
      }
    }
    if (!seeds.length) break;
    for (let tries = 0; tries < 24; tries++) {
      const group = [];
      const start = seeds[Math.floor(rng() * seeds.length)];
      if (board.has(start[0], start[1])) continue;
      group.push(start);
      let cur = start;
      let ok = true;
      for (let s = 1; s < size; s++) {
        const cand = board.neighbors(cur[0], cur[1]).filter(([nr, nc]) => {
          if (board.has(nr, nc) || group.some(([gr, gc]) => gr === nr && gc === nc)) return false;
          if (clusterTouchLimit(nr, nc) > 1) return false;
          // keep the group connected & supportable: neighbour of group or anchor row
          return true;
        });
        if (!cand.length) { ok = false; break; }
        cand.sort((a, b) => (bias < 0.5 ? a[0] - b[0] : Math.abs(a[1] - cur[1]) - Math.abs(b[1] - cur[1])));
        cur = cand[Math.floor(rng() * Math.min(2, cand.length))];
        group.push(cur);
      }
      if (!ok || group.length < 3) continue;
      // support check on the real board
      for (const [r, c] of group) board.set(r, c, { color, option: null });
      const unsupported = board.unsupported().filter((u) => group.some(([gr, gc]) => gr === u.r && gc === u.c));
      if (unsupported.length) {
        for (const [r, c] of group) board.remove(r, c);
        continue;
      }
      placed.push({ color, cells: group });
      placedCells += group.length;
      break;
    }
  }

  const neutralGroups = board.neutralGroups();
  const total = board.cells.size;
  // Reject boards that miss the density window by a wide margin — the caller
  // reseeds; the curated fallback covers pathological seeds.
  if (total < lo - 2 || total > hi + 4) return null;
  if (neutralGroups.some((g) => g.cells.length < 3)) return null;
  if (board.unsupported().length) return null;

  return {
    clusters: [...clusters, ...placed.map((g) => ({ option: null, cells: g.cells, color: g.color, kind: 'neutral' }))],
    answerClusters: clusters,
    neutralGroups,
    total,
    targets: { lo, hi },
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Full structural validation of a finished puzzle board (cells come from
// HexBoard.entries() or the generator). Complements the physics gate in
// solver.js — this catches structural regressions early and cheaply.
export function validateBoard(cols, cells, opts = {}) {
  const errors = [];
  const board = new HexBoard(cols, []);
  const clusters = new Map(); // option -> cells[]
  for (const cell of cells) {
    const k = board.key(cell.r, cell.c);
    if (board.has(cell.r, cell.c)) { errors.push(`overlap at ${k}`); continue; }
    if (!board.inGrid(cell.r, cell.c)) { errors.push(`out of grid ${k}`); continue; }
    board.set(cell.r, cell.c, { color: cell.color, option: cell.option ?? null });
    if (cell.option != null) {
      if (!clusters.has(cell.option)) clusters.set(cell.option, []);
      clusters.get(cell.option).push([cell.r, cell.c]);
    }
  }
  // answer clusters: exactly 3 connected cells each
  for (const [opt, clCells] of clusters) {
    if (clCells.length !== 3) { errors.push(`cluster ${opt}: ${clCells.length} cells`); continue; }
    const set = new Set(clCells.map((x) => x.join(',')));
    const seen = new Set([clCells[0].join(',')]);
    const stack = [clCells[0]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      for (const [nr, nc] of board.neighbors(cr, cc)) {
        if (set.has(`${nr},${nc}`) && !seen.has(`${nr},${nc}`)) { seen.add(`${nr},${nc}`); stack.push([nr, nc]); }
      }
    }
    if (seen.size !== 3) errors.push(`cluster ${opt}: not connected`);
  }
  if (clusters.size !== 4) errors.push(`expected 4 answer clusters, got ${clusters.size}`);
  // no cell may touch two different clusters (landing ambiguity)
  for (let r = 0; r <= MAX_ROW; r++) {
    for (let c = 0; c < board.colSpan(r); c++) {
      const opts = new Set(board.neighbors(r, c).map(([nr, nc]) => board.get(nr, nc)).filter((x) => x && x.option != null).map((x) => x.option));
      if (opts.size > 1) errors.push(`cell ${r},${c} touches clusters ${[...opts].join('+')}`);
    }
  }
  // support: everything anchored at load
  const falling = board.unsupported();
  if (falling.length) errors.push(`${falling.length} unsupported cells at load: ${falling.slice(0, 4).map((f) => `${f.r},${f.c}`).join(' ')}`);
  // neutral groups matchable (≥3) and never in the answer colour
  for (const g of board.neutralGroups()) {
    if (g.cells.length < 3) errors.push(`neutral group ${g.color} at ${g.cells[0]} has ${g.cells.length} cells (<3)`);
    if (opts.loadedColor && g.color === opts.loadedColor) errors.push(`neutral group uses answer colour ${g.color}`);
  }
  // density window
  if (opts.lo != null && board.cells.size < opts.lo - 2) errors.push(`density ${board.cells.size} < ${opts.lo - 2}`);
  if (opts.hi != null && board.cells.size > opts.hi + 4) errors.push(`density ${board.cells.size} > ${opts.hi + 4}`);
  return errors;
}

// Ammunition queue: deterministic per question. Alternates the loaded colour
// (always a winning shot — the solver guarantees a direct pop for the correct
// cluster) with colours that match real neutral groups on the board, so every
// entry has a defined useful outcome. Tail entries stay on the answer colour.
export function buildAmmunitionQueue({ neutralGroups, loadedColor, seed }) {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const usable = [...new Set(neutralGroups.filter((g) => g.cells.length >= 3).map((g) => g.color))]
    .filter((c) => c !== loadedColor);
  const queue = [];
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0 || !usable.length) queue.push(loadedColor);
    else queue.push(usable[Math.floor(rng() * usable.length)]);
  }
  for (let i = 0; i < 4; i++) queue.push(loadedColor); // never runs dry of winning shots
  return queue;
}
