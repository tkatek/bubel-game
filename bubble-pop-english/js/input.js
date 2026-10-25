// One input controller for mouse, touch and keyboard, built on Pointer
// Events. A single primary pointer drives aiming; release fires once;
// cancel paths (pointercancel / lost capture / blur) never fire. Gestures
// that start on HUD/modal elements never reach the playfield.

import { validAim } from './world.js';
import { clamp } from './util.js';

export class InputController {
  constructor(canvas, game, layout) {
    this.canvas = canvas;
    this.game = game;
    this.layout = layout;
    this.activeId = null;        // captured primary pointer id
    this.aimValid = false;
    this.invalidAimNotified = false;
    this.detach = [];

    const c = canvas;
    this.detach.push(
      this.on(c, 'pointerdown', (e) => this.down(e)),
      this.on(c, 'pointermove', (e) => this.move(e)),
      this.on(c, 'pointerup', (e) => this.up(e)),
      this.on(c, 'pointercancel', (e) => this.cancel(e)),
      this.on(c, 'lostpointercapture', (e) => this.lostCapture(e)),
      this.on(c, 'contextmenu', (e) => e.preventDefault()),
      this.on(window, 'keydown', (e) => this.key(e)),
      this.on(window, 'keyup', (e) => this.keyUp(e)),
      this.on(window, 'blur', () => this.cancelActive()),
    );

    // Keyboard aim state
    this.keyDir = 0;
    this.keyAngle = 90;
    this.lastKeyRepeat = 0;
  }

  on(el, ev, fn) {
    el.addEventListener(ev, fn);
    return () => el.removeEventListener(ev, fn);
  }

  dispose() { this.detach.forEach((d) => d()); }

  localPoint(e) {
    const r = this.canvas.getBoundingClientRect();
    // borderless canvas displayed at CSS size: local = client - rect origin
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  aimFrom(local) {
    const w = this.game.world;
    if (!w) return null;
    const wp = w.screenToWorld(local.x, local.y);
    return validAim(wp.x - w.muzzle.x, wp.y - w.muzzle.y);
  }

  down(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (this.activeId !== null) return;           // one primary pointer
    if (!this.game.canAcceptAim()) return;        // phase + suspension gate
    this.activeId = e.pointerId;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* capture best-effort */ }
    e.preventDefault();
    const aim = this.aimFrom(this.localPoint(e));
    this.game.setAim(aim);
    this.aimValid = !!aim;
    if (!aim && !this.invalidAimNotified) { this.game.notifyInvalidAim(); this.invalidAimNotified = true; }
  }

  move(e) {
    if (e.pointerId !== this.activeId) return;
    const aim = this.aimFrom(this.localPoint(e));
    this.game.setAim(aim);
    this.aimValid = !!aim;
  }

  up(e) {
    if (e.pointerId !== this.activeId) return;
    this.activeId = null;
    const aim = this.aimFrom(this.localPoint(e));
    if (aim) this.game.fire(aim, 'pointer');
    else this.game.clearAim();
  }

  cancel(e) {
    if (e.pointerId !== this.activeId) return;
    this.cancelActive();                           // cancel without firing
  }

  lostCapture(e) {
    if (e.pointerId !== this.activeId) return;
    // losing capture after pointerup is normal; only cancel if a gesture is live
    this.cancelActive();
  }

  cancelActive() {
    if (this.activeId === null) return;
    this.activeId = null;
    this.game.clearAim();                          // cancel never fires
  }

  key(e) {
    // don't hijack keys from focused interface buttons
    const tag = e.target && e.target.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (!this.game.canAcceptAim()) return;
      this.keyDir = e.key === 'ArrowLeft' ? -1 : 1;
      this.applyKeyAim(e.repeat);
    } else if (e.key === 'ArrowUp' || e.key === ' ') {
      e.preventDefault();
      if (e.repeat) return;
      if (this.game.aim) this.game.fire(this.game.aim, 'keyboard');
      else { this.keyAngle = 90; this.game.setAim({ x: 0, y: -1 }); this.game.fire({ x: 0, y: -1 }, 'keyboard'); }
    } else if (e.key === 'Escape') {
      if (this.activeId !== null) this.cancelActive();
      else this.game.togglePause();
    }
  }

  keyUp(e) {
    if (e.key === 'ArrowLeft' && this.keyDir === -1) this.keyDir = 0;
    if (e.key === 'ArrowRight' && this.keyDir === 1) this.keyDir = 0;
  }

  applyKeyAim(repeat) {
    const now = performance.now();
    if (repeat && now - this.lastKeyRepeat < 16) return;
    this.lastKeyRepeat = now;
    const step = repeat ? 2.4 : 4;
    this.keyAngle = clamp(this.keyAngle + this.keyDir * step, 14, 166);
    const rad = (this.keyAngle * Math.PI) / 180;
    this.game.setAim(validAim(Math.cos(rad), -Math.sin(rad)));
    this.aimValid = true;
  }
}
