// Hex board: offset rows (odd rows shifted right half a cell and holding one
// fewer cell), validated four-cluster templates, adjacency, match groups and
// landing snaps. Pure grid logic — geometry/scale lives in world.js.

export const ROW_H = Math.sqrt(3) / 2; // row spacing as a fraction of cell D

export class HexBoard {
  constructor(cols, clusters) {
    this.cols = cols;
    this.cells = new Map(); // "r,c" -> { color, option }
    for (const cl of clusters) {
      for (const [r, c] of cl.cells) {
        if (this.cells.has(`${r},${c}`)) throw new Error(` overlapping cell ${r},${c}`);
        this.cells.set(`${r},${c}`, { color: cl.color, option: cl.option });
      }
    }
    this.clusters = clusters.map((cl) => ({ option: cl.option, cells: cl.cells.slice() }));
  }

  key(r, c) { return `${r},${c}`; }
  get(r, c) { return this.cells.get(this.key(r, c)) || null; }
  has(r, c) { return this.cells.has(this.key(r, c)); }
  set(r, c, v) { this.cells.set(this.key(r, c), v); }
  remove(r, c) { this.cells.delete(this.key(r, c)); }
  entries() { return Array.from(this.cells.entries(), ([k, v]) => { const [r, c] = k.split(',').map(Number); return { r, c, ...v }; }); }

  colSpan(r) { return r % 2 === 0 ? this.cols : this.cols - 1; }

  inGrid(r, c) { return r >= 0 && c >= 0 && c < this.colSpan(r); }

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

// ---- Template generation ------------------------------------------------
// Cell sets found by tools/search-templates.mjs: every packing passes the
// structural rules AND a real-physics reachability audit (each option has a
// comfortable aiming window from the launcher — ≥8 angle steps of 1.5°).
// Inter-cluster gaps keep every landing cell touching at most one option.
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

// Structural validation (rules 1–4). Reachability with real physics is done
// at question setup in game.js; this catches template regressions early.
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
