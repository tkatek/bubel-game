// World: one logical coordinate system for board, projectile, cannon anchors,
// guide and collisions. Layout maps the world rect into the canvas with a
// single uniform transform (scale + offset); CSS px, world units and backing
// store px are kept distinct. Physics uses swept circle tests, so nothing can
// tunnel regardless of frame rate.

import { HexBoard, ROW_H } from './board.js';
import { ASSETS } from './assets.js';
import { clamp } from './util.js';

export const CELL = 60;            // world units per bubble cell (constant; scale adapts)
export const MIN_ELEVATION = 15;   // degrees above horizontal a shot needs
export const MAX_DEFLECTION = 76;  // max degrees off vertical (documented firing range)

export const MIN_CORRIDOR_D = 2.1;  // aiming corridor, in cell diameters
export const MAX_CORRIDOR_D = 6.5;  // cap so very tall stages don't get absurd flights

export function makeWorld(cols, clusters) {
  const D = CELL;
  const board = new HexBoard(cols, clusters);
  const W = cols * D;

  // Cannon geometry from measured sprite anchors. Socket hole diameter must
  // equal the bubble diameter so the loaded sphere reads correctly.
  const cannonW = D / (2 * ASSETS.cannon.socket.r);
  const cannonH = cannonW * ASSETS.cannon.aspect;
  const boardBottom = 5 * ROW_H * D + D;              // bottom of row 5
  const muzzleY = boardBottom + MIN_CORRIDOR_D * D;   // unobstructed aiming corridor
  const H = muzzleY + (1 - ASSETS.cannon.socket.y) * cannonH;

  const muzzleX = W / 2 + (ASSETS.cannon.socket.x - 0.5) * cannonW;
  const muzzle = { x: muzzleX, y: muzzleY };
  const cannonRect = { x: W / 2 - cannonW / 2, y: H - cannonH, w: cannonW, h: cannonH };

  return {
    cols, D, W, H, board, muzzle, cannonRect, cannonW, cannonH,
    view: { scale: 1, ox: 0, oy: 0, cssW: 0, cssH: 0, dpr: 1 },

    speed: 13 * D,                                    // world units / second
    projectileR: D / 2,

    // Fit this world into a CSS-sized canvas; uniform scale. Vertical slack is
    // anchored to the BOTTOM (cannon sits just above the launcher dock) so a
    // width-limited stage never leaves a dead band above the board.
    setView(cssW, cssH, dpr) {
      const scale = Math.min(cssW / this.W, cssH / this.H);
      this.view = {
        scale, dpr,
        ox: (cssW - this.W * scale) / 2,
        oy: Math.max(0, cssH - this.H * scale),
        cssW, cssH,
      };
    },

    // Adapt the aiming corridor so the world's aspect tracks the stage, then
    // set the view. Only the corridor below the board and the canvas
    // transform change — the board grid, clusters and any in-flight shot keep
    // their world coordinates, so this is safe mid-question and mid-shot.
    fitStage(cssW, cssH, dpr) {
      const below = (1 - ASSETS.cannon.socket.y) * this.cannonH; // cannon under the muzzle
      const desiredH = this.W * cssH / Math.max(1, cssW);
      const corridor = clamp(desiredH - boardBottom - below, MIN_CORRIDOR_D * D, MAX_CORRIDOR_D * D);
      this.H = boardBottom + corridor + below;
      this.muzzle = { x: muzzleX, y: boardBottom + corridor };
      this.cannonRect = { x: this.W / 2 - this.cannonW / 2, y: this.H - this.cannonH, w: this.cannonW, h: this.cannonH };
      this.setView(cssW, cssH, dpr);
    },

    screenToWorld(localX, localY) {
      return { x: (localX - this.view.ox) / this.view.scale, y: (localY - this.view.oy) / this.view.scale };
    },
    worldToScreen(wx, wy) {
      return { x: wx * this.view.scale + this.view.ox, y: wy * this.view.scale + this.view.oy };
    },
  };
}

// Clamp an aim vector to the documented upward firing range. Returns null
// when the gesture points too far down (invalid, shot not consumed).
export function validAim(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  let ux = dx / len, uy = dy / len;
  if (uy >= -Math.sin((MIN_ELEVATION * Math.PI) / 180)) return null; // must aim upward
  const ang = (Math.atan2(-uy, ux) * 180) / Math.PI; // 90 = straight up
  const clamped = clamp(ang, 90 - MAX_DEFLECTION, 90 + MAX_DEFLECTION);
  const rad = (clamped * Math.PI) / 180;
  return { x: Math.cos(rad), y: -Math.sin(rad) };
}

// Earliest event along a ray: side-wall bounce or first bubble/ceiling hit.
// Shared by the real projectile, the aiming guide and board reachability
// checks — identical geometry everywhere.
export function sweepShot(world, from, dir, maxDist) {
  const r = world.projectileR;
  const R = world.D; // combined radii (both are D/2)
  let pos = { x: from.x, y: from.y };
  let v = { x: dir.x, y: dir.y };
  let remaining = maxDist;
  let bounces = 0;                 // wall reflections seen along the way
  const path = [pos];
  for (let hop = 0; hop < 12 && remaining > 1e-6; hop++) {
    let tEvent = Infinity;
    let kind = null;
    // side walls
    if (v.x < -1e-9) { const t = (r - pos.x) / v.x; if (t > 0 && t < tEvent) { tEvent = t; kind = 'wallL'; } }
    else if (v.x > 1e-9) { const t = (world.W - r - pos.x) / v.x; if (t > 0 && t < tEvent) { tEvent = t; kind = 'wallR'; } }
    // ceiling
    if (v.y < -1e-9) { const t = (r - pos.y) / v.y; if (t > 0 && t < tEvent) { tEvent = t; kind = 'ceiling'; } }
    // bubbles: segment–circle sweep
    for (const b of world.board.entries()) {
      const p = world.board.cellCenter(b.r, b.c, world.D);
      const mx = pos.x - p.x, my = pos.y - p.y;
      const bDot = mx * v.x + my * v.y;
      const c = mx * mx + my * my - R * R;
      if (c < 0) continue; // already overlapping — treat as hit next tick by caller
      const disc = bDot * bDot - c;
      if (disc < 0) continue;
      const t = -bDot - Math.sqrt(disc);
      if (t > 1e-6 && t < tEvent) { tEvent = t; kind = 'bubble'; var hit = b; }
    }
    const travel = Math.min(tEvent, remaining);
    if (kind && tEvent <= remaining) {
      pos = { x: pos.x + v.x * travel, y: pos.y + v.y * travel };
      path.push({ ...pos });
      if (kind === 'wallL' || kind === 'wallR') { bounces++; v = { x: -v.x, y: v.y }; continue; }
      const end = { type: kind, point: { ...pos }, path, bounces };
      if (kind === 'bubble') { end.hitCell = { r: hit.r, c: hit.c }; }
      return end;
    }
    pos = { x: pos.x + v.x * travel, y: pos.y + v.y * travel };
    path.push({ ...pos });
    remaining -= travel;
  }
  // `dir` reports the post-bounce heading so the stepped projectile can
  // resume the reflected leg; without it a sub-sweep that ends exhausted
  // after a wall bounce loses the reflection and tunnels through the wall.
  return { type: 'exhausted', point: { ...pos }, path, bounces, dir: { x: v.x, y: v.y } };
}

// Resolve where a finished shot lands on the grid. Returns
// { ok, cell:[r,c], reason } — reason: 'snap' | 'ceiling' | 'stuck' | 'occupied'.
export function resolveLanding(world, event) {
  if (event.type === 'ceiling') {
    const spot = world.board.ceilingCell(event.point.x, world.D);
    if (!spot) return { ok: false, reason: 'occupied' };
    return { ok: true, cell: [spot.r, spot.c], reason: 'ceiling' };
  }
  if (event.type !== 'bubble') return { ok: false, reason: event.type };
  const cand = world.board.emptyNeighborsSorted(event.hitCell.r, event.hitCell.c, event.point, world.D);
  if (!cand.length) return { ok: false, reason: 'stuck' };
  return { ok: true, cell: [cand[0].r, cand[0].c], reason: 'snap' };
}

// Advance a live projectile one physics step. Returns an event when the shot
// ends, else null. Bounded substeps make the outcome frame-rate independent.
export function stepProjectile(world, shot, dt) {
  let remaining = world.speed * dt;
  const stepMax = world.D * 0.25;
  while (remaining > 1e-6) {
    const step = Math.min(stepMax, remaining);
    remaining -= step;
    const ev = sweepShot(world, shot.pos, shot.dir, step);
    shot.trail.push({ ...shot.pos });
    if (shot.trail.length > 24) shot.trail.shift();
    if (ev.bounces) shot.bounces = (shot.bounces || 0) + ev.bounces; // bank-shot stat
    if (ev.type === 'exhausted') {
      shot.pos = ev.point;
      if (ev.dir) shot.dir = ev.dir; // keep wall reflections across sub-sweeps
      continue;
    }
    shot.pos = ev.point;
    return ev;
  }
  return null;
}

// Reachability audit used at question setup: fire a fan of guide shots and
// confirm every option cluster can be matched from real angles.
export function auditReachability(world, options) {
  const hits = new Map(); // option -> count of distinct angles that can land on it
  const perOption = new Map(options.map((o) => [o, 0]));
  for (let deg = 90 - MAX_DEFLECTION; deg <= 90 + MAX_DEFLECTION; deg += 1.5) {
    const rad = (deg * Math.PI) / 180;
    const dir = { x: Math.cos(rad), y: -Math.sin(rad) };
    const ev = sweepShot(world, world.muzzle, dir, world.W * 3);
    if (ev.type !== 'bubble' && ev.type !== 'ceiling') continue;
    const landing = resolveLanding(world, ev);
    if (!landing.ok) continue;
    const [r, c] = landing.cell;
    const opts = new Set();
    for (const [nr, nc] of world.board.neighbors(r, c)) {
      const cell = world.board.get(nr, nc);
      if (cell) opts.add(cell.option);
    }
    if (opts.size === 1) {
      const opt = [...opts][0];
      perOption.set(opt, (perOption.get(opt) || 0) + 1);
    }
  }
  const report = {};
  for (const [opt, n] of perOption) report[opt] = n;
  return report; // every option should be ≥ 3 angle-hits for a comfortable window
}
