// Canvas renderer. One transform per frame (dpr × world scale + letterbox
// offset) — never accumulated. Sprites are cached at cell size × dpr and
// rebuilt only when the view scale changes. Draw order (back → front):
// cluster glows → board bubbles → answer labels → fallers → aim guide →
// loaded bubble → cannon → projectile → particles → debug overlay.

import { ASSETS, BUBBLE_COLORS, COLOR_HEX } from './assets.js';
import { drawInsideLabel, drawTagLabel } from './labels.js';
import { sweepShot, resolveLanding } from './world.js';
import { clamp } from './util.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.spriteCache = new Map();     // key: `${color}:${px}` -> canvas
    this.cannonSprite = null;         // key px
    this.particles = [];
    this.fallers = [];                // bubbles dropping after support loss
    this.recoil = 0;                  // seconds remaining
    this.badgePulse = 0;
    this.debug = null;                // set by debug overlay module
  }

  bumpRecoil() { this.recoil = 0.14; }

  spawnPopBurst(cells, color) {
    for (const p of cells) {
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 4;
        this.particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, life: 0.55, t: 0, color });
      }
    }
    if (this.particles.length > 260) this.particles.splice(0, this.particles.length - 260);
  }

  // Bubbles that lost support: spawned by game.js after an atomic grid
  // update, animated here with simple gravity until they leave the world.
  spawnFallers(fallers) {
    this.fallers.push(...fallers);
    if (this.fallers.length > 80) this.fallers.splice(0, this.fallers.length - 80);
  }

  // Board was rebuilt (new question / restore) — drop stale effects.
  clearTransient() {
    this.fallers.length = 0;
    this.particles.length = 0;
  }

  bubbleSprite(color, px) {
    const key = `${color}:${px}`;
    let c = this.spriteCache.get(key);
    if (c) return c;
    const img = this.images.bubble(color);
    const meta = ASSETS.bubbles[color];
    const d = Math.max(2, Math.round(px));
    c = document.createElement('canvas');
    c.width = d; c.height = d;
    const g = c.getContext('2d');
    const sx = meta.vis.x * img.naturalWidth, sy = meta.vis.y * img.naturalHeight;
    const sw = meta.vis.w * img.naturalWidth, sh = meta.vis.h * img.naturalHeight;
    g.drawImage(img, sx, sy, sw, sh, 0, 0, d, d);
    this.spriteCache.set(key, c);
    return c;
  }

  rainbowSprite(px) {
    const key = `rainbow:${px}`;
    let c = this.spriteCache.get(key);
    if (c) return c;
    const d = Math.max(2, Math.round(px));
    c = document.createElement('canvas');
    c.width = d; c.height = d;
    const g = c.getContext('2d');
    const r = d / 2;
    for (const col of BUBBLE_COLORS) {
      g.save();
      g.beginPath();
      g.moveTo(r, r);
      g.arc(r, r, r, 0, Math.PI * 2);
      g.clip();
      // draw each colour bubble into one quadrant band
      const img = this.images.bubble(col);
      const m = ASSETS.bubbles[col];
      g.drawImage(img, m.vis.x * img.naturalWidth, m.vis.y * img.naturalHeight,
        m.vis.w * img.naturalWidth, m.vis.h * img.naturalHeight, 0, 0, d, d);
      g.restore();
      break; // base layer
    }
    // rainbow rim
    const seg = Math.PI / 4;
    for (let i = 0; i < 8; i++) {
      g.fillStyle = [COLOR_HEX.red, COLOR_HEX.yellow, COLOR_HEX.green, COLOR_HEX.blue][i % 4];
      g.beginPath();
      g.arc(r, r, r, i * seg, (i + 1) * seg);
      g.arc(r, r, r * 0.8, (i + 1) * seg, i * seg, true);
      g.closePath();
      g.fill();
    }
    this.spriteCache.set(key, c);
    return c;
  }

  cannonSpriteFor(px) {
    const d = Math.max(2, Math.round(px));
    if (this.cannonSprite && this.cannonSprite.width === d) return this.cannonSprite;
    const c = document.createElement('canvas');
    c.width = d; c.height = Math.max(2, Math.round(d * ASSETS.cannon.aspect));
    c.getContext('2d').drawImage(this.images.cannon(), 0, 0, c.width, c.height);
    this.cannonSprite = c;
    return c;
  }

  // images: asset map from preloadCritical()
  setImages(images) { this.images = images; }

  resize(cssW, cssH, dpr) {
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
  }

  draw(game, dt, now) {
    const { ctx, canvas } = this;
    const world = game.world;
    if (!world) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    const v = world.view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(v.dpr * v.scale, 0, 0, v.dpr * v.scale, v.ox * v.dpr, v.oy * v.dpr);

    const px = world.D * v.scale * v.dpr; // bubble pixel size
    this.recoil = Math.max(0, this.recoil - dt);
    this.badgePulse = now;

    this.drawBoard(game, world, px);
    this.drawFallers(world, dt, px);
    this.drawGuide(game, world);
    this.drawLoaded(game, world, px);
    this.drawCannon(game, world, px);
    this.drawProjectile(game, world, px);
    this.drawParticles(world, dt);

    if (this.debug) this.debug.draw(ctx, game, world);
  }

  drawBoard(game, world, px) {
    const D = world.D;
    const ctx = this.ctx;
    const S = world.view.scale * world.view.dpr;   // device px per world unit
    const snap = (v) => Math.round(v * S) / S;     // crisp label edges on HiDPI
    const layouts = world.labels;
    const answerClusters = layouts
      ? world.board.clusters.filter((cl) => cl.option != null && layouts.has(cl.option))
      : [];

    // pass 1: soft halo under each intact answer cluster — groups the three
    // bubbles into one readable unit without touching collision geometry
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    for (const cl of answerClusters) {
      if (!cl.cells.every(([r, c]) => world.board.has(r, c))) continue;
      for (const [r, c] of cl.cells) {
        const p = world.board.cellCenter(r, c, D);
        ctx.beginPath();
        ctx.arc(p.x, p.y, D * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // pass 2: bubbles (labels never render per-bubble — one label per cluster)
    for (const b of world.board.entries()) {
      const p = world.board.cellCenter(b.r, b.c, D);
      const spr = this.bubbleSprite(b.color, px);
      ctx.drawImage(spr, p.x - D / 2, p.y - D / 2, D, D);
    }

    // pass 3: one label per answer cluster, drawn above every bubble so an
    // attached tag stays legible over the field. Labels vanish with their
    // cluster when it pops.
    for (const cl of answerClusters) {
      const lay = layouts.get(cl.option);
      if (!world.board.has(lay.cell[0], lay.cell[1])) continue;
      if (lay.mode === 'inside') drawInsideLabel(ctx, lay, snap);
      else drawTagLabel(ctx, lay, snap);
    }
  }

  // Falling bubbles: gravity-driven, slight sideways drift, drawn between
  // the board and the aim guide so they pass in front of what remains.
  drawFallers(world, dt, px) {
    if (!this.fallers.length) return;
    const ctx = this.ctx;
    const G = 46 * world.D; // world units / s² — tuned to read as a drop
    for (let i = this.fallers.length - 1; i >= 0; i--) {
      const f = this.fallers[i];
      f.t += dt;
      f.vy += G * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.y > world.H + world.D) { this.fallers.splice(i, 1); continue; }
      const spr = this.bubbleSprite(f.color, px);
      ctx.save();
      ctx.globalAlpha = clamp(1.6 - f.t, 0.25, 1);
      ctx.translate(f.x, f.y);
      ctx.rotate(Math.sin(f.t * 6 + f.x) * 0.12);
      ctx.drawImage(spr, -world.D / 2, -world.D / 2, world.D, world.D);
      ctx.restore();
    }
  }

  drawGuide(game, world) {
    if (game.state.phase !== 'AIMING' || game.state.suspended || !game.aim) return;
    const ctx = this.ctx;
    const boost = game.state.aimBoost;
    const ev = sweepShot(world, world.muzzle, game.aim, world.W * (boost ? 3 : 1.6));
    const dots = [];
    const stepLen = world.D * (boost ? 0.55 : 0.8);
    for (let i = 1; i < ev.path.length; i++) {
      const a = ev.path[i - 1], b = ev.path[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let s = stepLen; s < len; s += stepLen) {
        dots.push({ x: a.x + ((b.x - a.x) * s) / len, y: a.y + ((b.y - a.y) * s) / len });
      }
    }
    ctx.save();
    for (let i = 0; i < dots.length; i++) {
      const t = i / dots.length;
      ctx.globalAlpha = (boost ? 0.85 : 0.55) * (0.35 + 0.65 * t);
      ctx.fillStyle = boost ? '#ffe9a3' : '#ffffff';
      ctx.beginPath();
      ctx.arc(dots[i].x, dots[i].y, world.D * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (ev.type === 'bubble' || ev.type === 'ceiling') {
      const landing = resolveLanding(world, ev);
      if (landing.ok) {
        const p = world.board.cellCenter(landing.cell[0], landing.cell[1], world.D);
        const pulse = 1 + 0.1 * Math.sin(this.badgePulse / 130);
        ctx.lineWidth = world.D * 0.07;
        ctx.strokeStyle = boost ? '#ffce3c' : 'rgba(255,255,255,0.9)';
        ctx.setLineDash([world.D * 0.12, world.D * 0.12]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, world.D * 0.42 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  drawLoaded(game, world, px) {
    if (game.state.phase !== 'AIMING') return;
    const ctx = this.ctx;
    const spr = game.state.rainbowArmed ? this.rainbowSprite(px) : this.bubbleSprite(game.state.loadedColor, px);
    const k = this.recoil > 0 ? 1 - 0.18 * (this.recoil / 0.14) : 1;
    const d = world.D * k;
    ctx.drawImage(spr, world.muzzle.x - d / 2, world.muzzle.y - d / 2, d, d);
  }

  drawCannon(game, world) {
    const ctx = this.ctx;
    const spr = this.cannonSpriteFor(world.cannonW * world.view.scale * world.view.dpr);
    let ox = 0, oy = 0;
    if (this.recoil > 0 && game.aim) {
      const k = this.recoil / 0.14;
      ox = -game.aim.x * world.D * 0.16 * k;
      oy = -game.aim.y * world.D * 0.16 * k;
    }
    ctx.drawImage(spr, world.cannonRect.x + ox, world.cannonRect.y + oy, world.cannonRect.w, world.cannonRect.h);
  }

  drawProjectile(game, world, px) {
    const shot = game.state.shot;
    if (!shot) return;
    const ctx = this.ctx;
    // subtle trail
    ctx.save();
    for (let i = 0; i < shot.trail.length; i++) {
      const t = shot.trail[i];
      ctx.globalAlpha = (i / shot.trail.length) * 0.3;
      ctx.fillStyle = COLOR_HEX[shot.color] || '#fff';
      ctx.beginPath(); ctx.arc(t.x, t.y, world.D * 0.18, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    const spr = shot.rainbow ? this.rainbowSprite(px) : this.bubbleSprite(shot.color, px);
    ctx.drawImage(spr, shot.pos.x - world.D / 2, shot.pos.y - world.D / 2, world.D, world.D);
  }

  drawParticles(world, dt) {
    const ctx = this.ctx;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.t += dt;
      if (p.t >= p.life) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt * world.D * 0.8;
      p.y += p.vy * dt * world.D * 0.8 + 0.55;
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = k;
      ctx.fillStyle = COLOR_HEX[p.color] || '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, world.D * 0.09 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
