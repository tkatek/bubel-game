// Game conductor: one requestAnimationFrame loop, fixed-timestep physics,
// shot lifecycle from input to feedback, power-ups, pause, level flow.
// Every async boundary captures the run token; stale work no-ops.

import { LEVELS, validateLevels, shuffledOptions } from './questions.js';
import { BUBBLE_COLORS } from './assets.js';
import { buildClusters, validateClusters } from './board.js';
import { makeWorld, stepProjectile, resolveLanding, sweepShot, auditReachability } from './world.js';
import { GameState, PHASE, LIFE_CAP } from './state.js';
import { mulberry32, nextId, clamp } from './util.js';
import { loadSave, persist, MAX_LEVELS } from './storage.js';

const FIXED_DT = 1 / 120;         // physics timestep
const MAX_FRAME_DT = 0.1;         // clamp after tab-switch pauses
const FEEDBACK_CORRECT = 1.9;     // seconds — long enough to read the explanation
const FEEDBACK_WRONG = 1.5;
const RESOLVE_POP = 0.38;         // pop animation before outcome evaluation

export class Game {
  constructor({ root, ui, renderer, layout, audio }) {
    this.root = root;
    this.ui = ui;
    this.renderer = renderer;
    this.layout = layout;
    this.audio = audio;
    this.state = new GameState();
    this.world = null;
    this.aim = null;
    this.lastPointerWorld = null;
    this.save = loadSave();
    this.acc = 0;
    this.lastT = 0;
    this.raf = 0;
    this.rafBound = (t) => this.frame(t);
    this.resolveT = 0;
    this.pendingOutcome = null;   // evaluated result waiting through pop anim
    this.qSeed = 1;
    this.cols = 11;
    layout.onResize = (info) => this.onResize(info);
  }

  // ---- lifecycle ---------------------------------------------------------
  start() {
    validateLevels();
    this.state.go(PHASE.MENU);
    this.ui.screen('menu');
    this.ui.buildLevelGrid(this.save, (lv) => this.startLevel(lv));
    this.ui.setSoundIcons(this.save.sound);
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.rafBound);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause('hidden');
    });
  }

  stop() { cancelAnimationFrame(this.raf); }

  frame(now) {
    const dtRaw = Math.min((now - this.lastT) / 1000, MAX_FRAME_DT);
    this.lastT = now;
    this.update(dtRaw);
    this.renderer.draw(this, dtRaw, now);
    this.raf = requestAnimationFrame(this.rafBound);
  }

  update(dt) {
    const st = this.state;
    if (st.suspended) return; // paused: freeze projectile, timers, deadlines
    const counting = [PHASE.AIMING, PHASE.PROJECTILE_FLYING, PHASE.RESOLVING].includes(st.phase);
    if (counting) {
      st.activeTime += dt;
      this.ui.renderTimer(st.activeTime);
    }
    switch (st.phase) {
      case PHASE.PROJECTILE_FLYING: {
        if (!st.shot) { st.go(PHASE.AIMING); break; }
        this.acc += dt;
        while (this.acc >= FIXED_DT && st.phase === PHASE.PROJECTILE_FLYING) {
          this.acc -= FIXED_DT;
          const ev = stepProjectile(this.world, st.shot, FIXED_DT);
          if (ev) { this.beginResolve(ev); break; }
        }
        break;
      }
      case PHASE.RESOLVING: {
        this.resolveT -= dt;
        if (this.resolveT <= 0) this.finishResolve();
        break;
      }
      case PHASE.FEEDBACK: {
        this.feedbackT -= dt;
        if (this.feedbackT <= 0) this.exitFeedback();
        break;
      }
      default: break;
    }
  }

  // ---- level / question flow ---------------------------------------------
  startLevel(level) {
    if (typeof window !== 'undefined' && window.__bpeLog) window.__bpeLog.push(`startLevel:${level}@${Math.round(performance.now())}`);
    if (level < 1 || level > MAX_LEVELS || level > this.save.unlocked) return;
    const token = this.state.runToken + 1;
    this.state.startRun(level);
    this.state.go(PHASE.PREPARING_QUESTION);
    this.ui.showGameChrome(true);
    this.ui.hideToast();
    this.ui.setPopover(false);
    this.ui.screen('game');
    this.prepareQuestion(token);
  }

  colsForLayout() {
    const { mode, device } = this.layout;
    if (mode === 'mobile') return device === 'tablet' ? 9 : 8;
    if (mode === 'tablet') return 9;
    return device === 'desktop' ? 11 : 10;
  }

  prepareQuestion(token) {
    if (token !== this.state.runToken) return;
    const st = this.state;
    const lv = LEVELS[st.level - 1];
    const q = lv.questions[st.qIndex];
    st.question = q;

    this.qSeed = (st.runToken * 131 + st.level * 31 + st.qIndex * 7 + 101) >>> 0;
    const rng = mulberry32(this.qSeed);
    st.optionsOrder = shuffledOptions(q, rng);
    st.loadedColor = BUBBLE_COLORS[Math.floor(rng() * 4)];
    st.rainbowArmed = false;
    st.aimBoost = false;
    // Bubble labels show the answer word; questions with sentence-length
    // answers fall back to letter badges + a banner list (readability).
    st.useLetters = st.optionsOrder.some((o) => o.text.trim().length > 12);

    this.buildBoard();
    this.ui.renderQuestion(st);
    this.ui.renderHud(st);
    this.ui.renderTimer(st.activeTime);
    this.aim = null;
    if (st.phase !== PHASE.AIMING) st.go(PHASE.AIMING);
  }

  buildBoard() {
    const st = this.state;
    this.cols = this.colsForLayout();
    const rng = mulberry32(this.qSeed);
    const letters = st.optionsOrder.map((o) => o.id);
    let clusters = buildClusters(this.cols, letters, st.loadedColor, rng);
    // structural + real-physics reachability guard (defensive: fall back to
    // the canonical un-mirrored packing if a variant ever fails)
    const errs = validateClusters(this.cols, clusters);
    const world = makeWorld(this.cols, clusters);
    const rep = auditReachability(world, letters);
    if (errs.length || Math.min(...Object.values(rep)) < 5) {
      console.warn('BPE: board variant rejected, using canonical packing', errs, rep);
      clusters = buildClusters(this.cols, letters, st.loadedColor, mulberry32(1));
      if (validateClusters(this.cols, clusters).length) throw new Error('board template invalid');
    }
    this.world = makeWorld(this.cols, clusters);
    this.world.setView(this.layout.cssW, this.layout.cssH, this.layout.dpr);
  }

  // Rebuild the identical board (after a wrong answer / miss: the board must
  // return to a clean, solvable state for the same question).
  restoreBoard() {
    const st = this.state;
    const letters = st.optionsOrder.map((o) => o.id);
    const clusters = buildClusters(this.cols, letters, st.loadedColor, mulberry32(this.qSeed));
    this.world = makeWorld(this.cols, clusters);
    this.world.setView(this.layout.cssW, this.layout.cssH, this.layout.dpr);
  }

  // ---- input hooks --------------------------------------------------------
  canAcceptAim() {
    return this.state.phase === PHASE.AIMING && !this.state.suspended && !!this.world;
  }

  setAim(aim) { if (this.canAcceptAim()) this.aim = aim; else this.aim = null; }
  clearAim() { this.aim = null; }

  notifyInvalidAim() {
    if (this.state.phase !== PHASE.AIMING) return;
    this.ui.toast('Aim upward', 'Slide your aim above the cannon — bubbles only fly up!', 1400);
  }

  fire(aim, source) {
    const st = this.state;
    if (!this.canAcceptAim() || !aim) return;
    if (st.shot) return; // at most one projectile in flight
    const rainbow = st.rainbowArmed;
    if (rainbow) {
      if (st.powerups.rainbow <= 0) return;
      st.powerups.rainbow--;
      st.rainbowArmed = false;
    }
    st.shot = {
      id: st.newShotId(),
      color: st.loadedColor,
      rainbow,
      pos: { x: this.world.muzzle.x, y: this.world.muzzle.y },
      dir: { x: aim.x, y: aim.y },
      trail: [],
      token: st.runToken,
    };
    this.aim = null;
    st.go(PHASE.PROJECTILE_FLYING);
    this.renderer.bumpRecoil();
    this.audio.play('fire');
  }

  // ---- shot resolution ----------------------------------------------------
  beginResolve(event) {
    const st = this.state;
    if (!st.shot) return;
    const landing = resolveLanding(this.world, event);

    // Engine-recoverable failures: never charge the learner
    if (!landing.ok) {
      console.warn('BPE: shot could not resolve (' + landing.reason + ') — recovered without penalty');
      st.shot = null;
      st.go(PHASE.AIMING);
      this.ui.toast('Fizzle…', 'That shot slipped — no heart lost, try again!', 1200);
      return;
    }

    const [r, c] = landing.cell;
    // rainbow matches any colour, otherwise the colour must equal the loaded
    // colour (monochrome boards make every hit compatible by construction)
    const cellColor = st.shot.rainbow ? null : st.shot.color;
    this.world.board.set(r, c, { color: st.shot.color, option: null });
    const group = this.world.board.groupAt(r, c);

    if (group.length >= 3) {
      const opts = new Set();
      for (const [gr, gc] of group) {
        const cell = this.world.board.get(gr, gc);
        if (cell && cell.option) opts.add(cell.option);
      }
      if (opts.size === 1) {
        // clean cluster pop → this shot chose an answer
        const chosen = [...opts][0];
        const centers = group.map(([gr, gc]) => this.world.board.cellCenter(gr, gc, this.world.D));
        for (const [gr, gc] of group) this.world.board.remove(gr, gc);
        this.renderer.spawnPopBurst(centers, st.shot.color);
        this.pendingOutcome = { kind: 'popped', option: chosen };
        st.go(PHASE.RESOLVING);
        this.resolveT = RESOLVE_POP;
        this.audio.play('pop');
        return;
      }
      if (opts.size > 1) {
        // Validated boards make this impossible; recover without penalty.
        console.warn('BPE: ambiguous landing (touched two clusters) — recovered without penalty');
        for (const [gr, gc] of group) this.world.board.remove(gr, gc);
        this.world.board.remove(r, c);
        st.shot = null;
        this.restoreBoard();
        st.go(PHASE.AIMING);
        return;
      }
      // group ≥3 but no option (pure projectile cluster — not possible with
      // monochrome templates; treat as miss below)
    }

    // genuine miss: projectile attached without a match — remove it, restore
    this.pendingOutcome = { kind: 'miss' };
    st.go(PHASE.RESOLVING);
    this.resolveT = RESOLVE_POP * 0.6;
  }

  finishResolve() {
    const st = this.state;
    const out = this.pendingOutcome;
    this.pendingOutcome = null;
    st.shot = null;
    if (!out) { st.go(PHASE.AIMING); return; }

    if (out.kind === 'popped') {
      const correct = out.option === st.question.correct;
      if (correct) {
        const gain = 100 + 25 * st.combo;
        st.score += gain;
        st.combo++;
        st.qIndex++;
        st.go(PHASE.FEEDBACK);
        this.feedbackT = FEEDBACK_CORRECT;
        this.feedbackKind = { correct: true, gain, explain: st.question.explain };
        this.audio.play('correct');
        this.ui.renderHud(st);
        this.ui.toast(`Correct! +${gain}`, st.question.explain, 2100);
        return;
      }
      // wrong answer: one heart, retry the same question
      st.combo = 0;
      st.mistakes++;
      st.lives--;
      st.go(PHASE.FEEDBACK);
      this.feedbackT = FEEDBACK_WRONG;
      this.feedbackKind = { correct: false, wrong: true };
      this.audio.play('wrong');
      this.ui.renderHud(st);
      this.ui.toast('Not quite…', 'That group was the wrong answer — one heart lost. Read the question again!', 2000);
      return;
    }

    // miss
    st.combo = 0;
    st.mistakes++;
    st.lives--;
    st.go(PHASE.FEEDBACK);
    this.feedbackT = FEEDBACK_WRONG;
    this.feedbackKind = { correct: false, miss: true };
    this.audio.play('miss');
    this.ui.renderHud(st);
    this.ui.toast('Missed!', 'Your bubble didn\'t join a group of three — one heart lost.', 1800);
  }

  exitFeedback() {
    const st = this.state;
    if (st.lives <= 0) { this.gameOver(); return; }
    const token = st.runToken;
    if (st.qIndex >= 4) { this.levelComplete(); return; }
    // wrong/miss restores the board, correct advances — both rebuild via
    // prepareQuestion only when advancing; otherwise restore same question
    if (this.feedbackKind && this.feedbackKind.correct) {
      st.go(PHASE.PREPARING_QUESTION);
      this.prepareQuestion(token);
    } else {
      this.restoreBoard();
      st.go(PHASE.AIMING);
      this.ui.renderHud(st);
    }
    this.feedbackKind = null;
  }

  // ---- level end ----------------------------------------------------------
  levelComplete() {
    const st = this.state;
    st.go(PHASE.LEVEL_COMPLETE);
    const stars = st.mistakes === 0 ? 3 : st.mistakes === 1 ? 2 : 1;
    const prev = this.save.best[st.level];
    if (!prev || st.score > prev.score) {
      this.save.best[st.level] = { score: st.score, stars, time: Math.round(st.activeTime) };
    }
    if (st.level < MAX_LEVELS) this.save.unlocked = Math.max(this.save.unlocked, st.level + 1);
    persist(this.save);
    this.ui.buildLevelGrid(this.save, (lv) => this.startLevel(lv));
    this.ui.showResults({ score: st.score, mistakes: st.mistakes, time: st.activeTime, stars, level: st.level });
    this.ui.screen('complete');
    this.ui.showGameChrome(false);
    this.audio.play('levelup');
  }

  gameOver() {
    const st = this.state;
    st.go(PHASE.GAME_OVER);
    this.ui.gameoverSub.textContent = `Level ${st.level} — Question ${Math.min(st.qIndex + 1, 4)} of 4`;
    this.ui.goTip.textContent = 'Tip: the letter on each bubble group matches an answer choice. Pop the group whose letter you believe!';
    this.ui.screen('gameover');
    this.ui.showGameChrome(false);
    this.audio.play('gameover');
  }

  // ---- pause ---------------------------------------------------------------
  pause(reason = 'user') {
    if (!this.state.pause()) return false;
    this.ui.pauseInfo.textContent = `Level ${this.state.level} · Question ${Math.min(this.state.qIndex + 1, 4)}/4 · Score ${this.state.score}`;
    this.ui.screen('pause');
    this.pausedByHidden = reason === 'hidden';
    return true;
  }

  resume() {
    if (!this.state.resume()) return;
    this.ui.screen('game');
    this.lastT = performance.now(); // no delta-time jump on resume
    this.acc = 0;
  }

  togglePause() {
    if (this.state.suspended) this.resume();
    else this.pause();
  }

  // ---- navigation ----------------------------------------------------------
  home() {
    this.state.runToken++;       // invalidate all pending work
    this.state.shot = null;
    this.state.suspended = false;
    if (this.state.phase !== PHASE.MENU) this.state.go(PHASE.MENU);
    this.ui.hideToast();
    this.ui.setPopover(false);
    this.ui.screen('menu');
    this.ui.showGameChrome(false);
  }

  openLevels() {
    this.state.runToken++;
    this.state.shot = null;
    this.state.suspended = false;
    if (this.state.phase !== PHASE.MENU && this.state.phase !== PHASE.LEVEL_SELECT) {
      this.state.go(PHASE.MENU);
    }
    this.state.go(PHASE.LEVEL_SELECT);
    this.ui.hideToast();
    this.ui.setPopover(false);
    this.ui.buildLevelGrid(this.save, (lv) => this.startLevel(lv));
    this.ui.screen('levels');
    this.ui.showGameChrome(false);
  }

  // ---- power-ups -----------------------------------------------------------
  usePowerup(kind) {
    const st = this.state;
    if (st.suspended) return;
    if (st.phase !== PHASE.AIMING) return; // not during an unresolved shot
    if (st.powerups[kind] <= 0) return;
    if (kind === 'rainbow') {
      st.rainbowArmed = !st.rainbowArmed; // toggling back refunds nothing but also isn't consumed
      this.audio.play('click');
      this.ui.toast(st.rainbowArmed ? 'Rainbow armed' : 'Rainbow put away',
        st.rainbowArmed ? 'Your next bubble matches any colour.' : 'Back to the normal bubble.', 1200);
    } else if (kind === 'heart') {
      if (st.lives >= LIFE_CAP) return; // cannot help: not consumed, stays disabled
      st.lives = Math.min(LIFE_CAP, st.lives + 1);
      st.powerups.heart--;
      this.audio.play('pop');
      this.ui.toast('Extra heart!', 'You have ' + st.lives + ' hearts now.', 1300);
    } else if (kind === 'aim') {
      st.aimBoost = true;
      st.powerups.aim--;
      this.audio.play('click');
      this.ui.toast('Eagle eye!', 'Longer guide with a predicted landing for this question.', 1400);
    }
    this.ui.renderHud(st);
  }

  toggleSound() {
    this.save.sound = !this.save.sound;
    this.audio.enabled = this.save.sound;
    persist(this.save);
    this.ui.setSoundIcons(this.save.sound);
  }

  // ---- resize ---------------------------------------------------------------
  onResize(info) {
    if (!this.world) return;
    // Recompute the viewport transform first; the whole existing world
    // (targets, projectile, cannon) scales together so nothing moves
    // relative to anything else. Native rebuild happens at the next
    // PREPARING_QUESTION boundary.
    this.world.setView(info.cssW, info.cssH, info.dpr);
  }

  // Debug helper: current predicted landing for the overlay
  predictLanding() {
    if (!this.world || !this.aim) return null;
    const ev = sweepShot(this.world, this.world.muzzle, this.aim, this.world.W * 3);
    const landing = resolveLanding(this.world, ev);
    return { ev, landing };
  }
}
