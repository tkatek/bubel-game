// Answer label text-layout system. One label per answer cluster, chosen by
// measuring real text metrics (never string length):
//   short   → centred inside the cluster's designated bubble (frosted plate,
//             dark navy text), comfortable padding;
//   medium  → compact two-line inside label at a slightly smaller size;
//   long    → rounded blue-and-gold label attached to the cluster (2–3 lines,
//             light text) placed at a measured anchor that keeps clear of the
//             other answer labels, the other clusters and the play bounds.
// Layouts are pure read-only geometry stored on world.labels — collision
// circles, projectile sweeps and the physical cell grid never see them.
// Text is drawn as vectors through the dpr-scaled canvas transform, so it
// stays sharp on high-density screens; nothing is baked into the bubble PNGs.

const FONT_STACK = "'Trebuchet MS', 'Segoe UI', Verdana, 'Helvetica Neue', system-ui, sans-serif";

export const LABEL_NAVY = '#0c2547';      // dark text on light bubbles
export const LABEL_BLUE = '#11418f';      // attached label fill
export const LABEL_GOLD = '#ffce3c';      // attached label border (game accent)
export const LABEL_TEXT = '#ffffff';      // light text on dark labels

const INK_MIN_CSS_PX = 11;   // readable floor for text inside a bubble (CSS px)
const TAG_MIN_CSS_PX = 12;   // readable floor for attached labels (CSS px)

let measCtx = null;
function measurer() {
  if (!measCtx) {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    measCtx = c.getContext('2d');
  }
  return measCtx;
}

function setFont(ctx, size) {
  ctx.font = `700 ${size}px ${FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// The cluster bubble that carries the inside label: the cell touching the
// most siblings (the middle of a row, the corner of an L), tie-broken by
// closeness to the cluster centroid. Purely visual — never a hitbox.
export function designateLabelCell(cells, board) {
  const set = new Set(cells.map(([r, c]) => `${r},${c}`));
  const cx = cells.reduce((s, [r, c]) => s + c, 0) / cells.length;
  const cy = cells.reduce((s, [r]) => s + r, 0) / cells.length;
  let best = cells[0], bestScore = -Infinity;
  for (const cell of cells) {
    const deg = board.neighbors(cell[0], cell[1]).filter(([r, c]) => set.has(`${r},${c}`)).length;
    const score = deg * 10 - (Math.hypot(cell[1] - cx, cell[0] - cy));
    if (score > bestScore) { bestScore = score; best = cell; }
  }
  return best;
}

// ---- text fitting ---------------------------------------------------------

function wrapGreedy(ctx, text, maxW) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = w; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function wrapBalanced2(ctx, text, maxW) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  let best = null, bestSpread = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width;
    if (wa > maxW || wb > maxW) continue;
    const spread = Math.abs(wa - wb);
    if (spread < bestSpread) { bestSpread = spread; best = [a, b]; }
  }
  return best;
}

  // Case 1+2: inside the designated bubble. Returns geometry or null when the
// text cannot fit at the readable floor (caller falls through to a tag).
function fitInside(ctx, text, D, minSize) {
  const maxW = D * 0.74;
  for (let s = D * 0.27; s >= minSize - 1e-6; s -= 0.5) {
    setFont(ctx, s);
    if (ctx.measureText(text).width <= maxW) {
      return { lines: [text], size: s, lineH: s * 1.16, textW: ctx.measureText(text).width };
    }
  }
  // two-line probe at the floor size: if the split does not fit there, no
  // larger size will either
  setFont(ctx, minSize);
  const pair = wrapBalanced2(ctx, text, maxW);
  if (pair) {
    for (let s = D * 0.225; s >= minSize - 1e-6; s -= 0.5) {
      setFont(ctx, s);
      const a = ctx.measureText(pair[0]).width, b = ctx.measureText(pair[1]).width;
      if (a <= maxW && b <= maxW) {
        return { lines: pair, size: s, lineH: s * 1.18, textW: Math.max(a, b) };
      }
    }
  }
  return null;
}

// Case 3: attached label. Largest size ≥ floor whose greedy wrap fits ≤3
// lines; if none does, the floor size with width grown to the longest word —
// words are never clipped, shrunk below the floor or hidden.
function fitTag(ctx, text, D, minSize, maxW) {
  for (let s = D * 0.21; s >= minSize - 1e-6; s -= 0.5) {
    setFont(ctx, s);
    const lines = wrapGreedy(ctx, text, maxW);
    if (lines.length <= 3) {
      return { lines, size: s, lineH: s * 1.2, textW: Math.max(...lines.map((l) => ctx.measureText(l).width)) };
    }
  }
  setFont(ctx, minSize);
  const longest = Math.max(...text.split(/\s+/).filter(Boolean).map((w) => ctx.measureText(w).width));
  const lines = wrapGreedy(ctx, text, Math.max(maxW, longest));
  return { lines, size: minSize, lineH: minSize * 1.2, textW: Math.max(...lines.map((l) => ctx.measureText(l).width)) };
}

// ---- layout ----------------------------------------------------------------

const rectsOverlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function rectTouchesCircle(rect, c, r) {
  const nx = Math.max(rect.x, Math.min(c.x, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(c.y, rect.y + rect.h));
  return (nx - c.x) ** 2 + (ny - c.y) ** 2 < r * r;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, rr); return; }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Compute the label layout for every answer cluster of the current question.
 * world: { D, W, H, board, view } with view already set.
 * textOf(optionId) → answer text. dpr: device pixel ratio (for pixel-snapping
 * and size floors). Returns { layouts: Map, infeasible: string[], overlapFree }.
 */
export function computeLabelLayouts(world, textOf, dpr) {
  const { D, W, board } = world;
  const scale = world.view.scale || 1;
  const dprSafe = dpr || 1;
  const S = Math.max(0.25, scale * dprSafe);            // device px per world unit
  const snap = (v) => Math.round(v * S) / S;            // crisp rects/edges on HiDPI
  const minInside = INK_MIN_CSS_PX / scale;             // CSS px → world units
  const minTag = TAG_MIN_CSS_PX / scale;
  const meas = measurer();

  // Answer clusters only — neutral obstacle bubbles carry no label. Ordered
  // top-left first so upper clusters claim the premium anchor spots.
  const answerClusters = board.clusters
    .filter((cl) => cl.option != null)
    .map((cl) => ({ ...cl, cell: designateLabelCell(cl.cells, board) }))
    .sort((a, b) => {
      const pa = board.cellCenter(a.cell[0], a.cell[1], D);
      const pb = board.cellCenter(b.cell[0], b.cell[1], D);
      return pa.y - pb.y || pa.x - pb.x;
    });

  const layouts = new Map();
  const infeasible = [];
  const reserved = [];                                  // label rects claimed so far
  let overlapFree = true;

  for (const cl of answerClusters) {
    const text = String(textOf(cl.option) || '').trim();
    const center = board.cellCenter(cl.cell[0], cl.cell[1], D);
    const cellRect = { x: center.x - D / 2, y: center.y - D / 2, w: D, h: D };

    const inside = fitInside(meas, text, D, minInside);
    if (inside) {
      layouts.set(cl.option, {
        option: cl.option, cell: cl.cell, mode: 'inside',
        lines: inside.lines, size: inside.size, lineH: inside.lineH,
        center, plate: insidePlate(inside, center, D, snap),
      });
      reserved.push(cellRect);                          // keep tags clear of the word bubble
      continue;
    }

    const tag = placeTag(meas, text, world, cl, center, reserved, minTag, snap);
    layouts.set(cl.option, {
      option: cl.option, cell: cl.cell, mode: 'tag',
      lines: tag.lines, size: tag.size, lineH: tag.lineH,
      rect: tag.rect, tail: tag.tail,
    });
    reserved.push(tag.rect);
    if (tag.overlapped) { overlapFree = false; infeasible.push(cl.option); }
  }

  return { layouts, infeasible, overlapFree };
}

function insidePlate(inside, center, D, snap) {
  const w = Math.min(D * 0.86, inside.textW + D * 0.24);
  const h = inside.lines.length * inside.lineH + D * 0.14;
  return { x: snap(center.x - w / 2), y: snap(center.y - h / 2), w: snap(w), h: snap(h) };
}

// Anchor a rounded tag around the cluster without covering other answer
// labels, other clusters, or leaving the playable board area.
function placeTag(meas, text, world, cl, anchor, reserved, minSize, snap) {
  const { D, W, board } = world;
  const maxW = Math.min(W * 0.62, D * 4.4);
  const fit = fitTag(meas, text, D, minSize, maxW);
  const padX = D * 0.19, padY = D * 0.14;
  const w = fit.textW + padX * 2 + D * 0.1;             // + border breathing room
  const h = fit.lines.length * fit.lineH + padY * 2 + D * 0.1;

  // Cluster bounds (cell centres ± D/2) plus the deepest occupied row of the
  // board — labels may lean into the aim corridor a little, never pile up in
  // front of the cannon lane.
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  const own = new Set(cl.cells.map(([r, c]) => `${r},${c}`));
  const others = [];
  let occupiedBottom = -Infinity;
  for (const b of board.entries()) {
    const p = board.cellCenter(b.r, b.c, D);
    if (own.has(`${b.r},${b.c}`)) {
      bx0 = Math.min(bx0, p.x - D / 2); by0 = Math.min(by0, p.y - D / 2);
      bx1 = Math.max(bx1, p.x + D / 2); by1 = Math.max(by1, p.y + D / 2);
    } else {
      others.push(p);
    }
    occupiedBottom = Math.max(occupiedBottom, p.y + D / 2);
  }
  const bbox = { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 };

  const margin = D * 0.12;
  const maxY = occupiedBottom + D * 1.4;                // stay out of the aim corridor
  const gaps = [D * 0.3, D * 0.9, D * 1.55];
  const dirs = [[0, -1], [-1, 0], [1, 0], [-1, -1], [1, -1], [0, 1], [-1, 1], [1, 1]];

  const candidates = [];
  for (const dir of dirs) {
    for (const gap of gaps) {
      let rx, ry;
      rx = dir[0] < 0 ? bbox.x - gap - w : dir[0] > 0 ? bbox.x + bbox.w + gap : anchor.x - w / 2;
      ry = dir[1] < 0 ? bbox.y - gap - h : dir[1] > 0 ? bbox.y + bbox.h + gap : anchor.y - h / 2;
      const rect = { x: rx, y: ry, w, h };
      const out = rx < margin || ry < margin || rx + w > W - margin || ry + h > maxY;
      const hitsLabels = reserved.filter((r2) => rectsOverlap(rect, r2)).length;
      const hitsCells = others.filter((p) => rectTouchesCircle(rect, p, D * 0.58)).length;
      const corridor = ry + h > occupiedBottom + D * 0.2 ? 1 : 0;
      candidates.push({ rect, cost: hitsLabels * 12 + hitsCells * 6 + corridor * 3 + gap / D + (dir[1] > 0 ? 0.4 : 0), blocked: out || hitsLabels > 0 || hitsCells > 0 });
    }
  }
  candidates.sort((a, b) => (a.blocked - b.blocked) || (a.cost - b.cost));
  const pick = candidates[0];

  const rect = { x: snap(pick.rect.x), y: snap(pick.rect.y), w: snap(w), h: snap(h) };
  return {
    lines: fit.lines, size: fit.size, lineH: fit.lineH, rect,
    tail: tailFor(rect, anchor, D),
    overlapped: pick.blocked,
  };
}

// Small triangle keeping the tag visually attached to its cluster bubble.
function tailFor(rect, anchor, D) {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const dx = anchor.x - cx, dy = anchor.y - cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  // where the centre→anchor ray exits the rect
  let tEdge = Infinity;
  if (ux > 1e-9) tEdge = Math.min(tEdge, (rect.x + rect.w - cx) / ux);
  if (ux < -1e-9) tEdge = Math.min(tEdge, (rect.x - cx) / ux);
  if (uy > 1e-9) tEdge = Math.min(tEdge, (rect.y + rect.h - cy) / uy);
  if (uy < -1e-9) tEdge = Math.min(tEdge, (rect.y - cy) / uy);
  const base = { x: cx + ux * tEdge, y: cy + uy * tEdge };
  // reach toward the bubble rim, but always keep a visible nub
  const tailLen = Math.max(D * 0.16, Math.min(len - tEdge, D * 0.5));
  const apex = { x: base.x + ux * tailLen, y: base.y + uy * tailLen };
  const px = -uy, py = ux;                              // perpendicular
  const hw = D * 0.15;
  return {
    a: { x: base.x + px * hw, y: base.y + py * hw },
    b: { x: base.x - px * hw, y: base.y - py * hw },
    apex,
  };
}

// ---- drawing ---------------------------------------------------------------

function drawLines(ctx, lay, color, snap) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${lay.size}px ${FONT_STACK}`;
  const n = lay.lines.length;
  const y0 = lay.center ? lay.center.y : lay.rect.y + lay.rect.h / 2;
  lay.lines.forEach((line, i) => {
    const y = snap(y0 + (i - (n - 1) / 2) * lay.lineH + lay.size * 0.06);
    ctx.fillText(line, lay.center ? lay.center.x : lay.rect.x + lay.rect.w / 2, y);
  });
  ctx.restore();
}

// Frosted plate + dark navy text, centred on the designated bubble.
export function drawInsideLabel(ctx, lay, snap) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.44)';
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, lay.center ? 1.6 : 2);
  roundRectPath(ctx, lay.plate.x, lay.plate.y, lay.plate.w, lay.plate.h, lay.plate.h / 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  drawLines(ctx, lay, LABEL_NAVY, snap);
}

// Rounded blue-and-gold tag with a light tail welded to its cluster bubble.
export function drawTagLabel(ctx, lay, snap) {
  const { rect, tail } = lay;
  ctx.save();
  // body
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(rect.h / 2, 14));
  ctx.fillStyle = LABEL_BLUE;
  ctx.fill();
  ctx.strokeStyle = LABEL_GOLD;
  ctx.lineWidth = Math.max(1.25, 2.6);
  ctx.stroke();
  if (tail) {
    // tail fill covers the border seam, then only its outer edges are stroked
    ctx.beginPath();
    ctx.moveTo(tail.a.x, tail.a.y);
    ctx.lineTo(tail.apex.x, tail.apex.y);
    ctx.lineTo(tail.b.x, tail.b.y);
    ctx.closePath();
    ctx.fillStyle = LABEL_BLUE;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tail.a.x, tail.a.y);
    ctx.lineTo(tail.apex.x, tail.apex.y);
    ctx.lineTo(tail.b.x, tail.b.y);
    ctx.strokeStyle = LABEL_GOLD;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
  drawLines(ctx, lay, LABEL_TEXT, snap);
}
