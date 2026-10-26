// Game conductor: one requestAnimationFrame loop, fixed-timestep physics,
// shot lifecycle from input to feedback, power-ups, pause, level flow.
// Every async boundary captures the run token; stale work no-ops.

import { LEVELS, validateLevels, shuffledOptions, QUESTION_TYPES } from './questions.js';
import { BUBBLE_COLORS } from './assets.js';
import {
  buildClusters, validateClusters,
  buildPuzzleBoard, validateBoard, buildAmmunitionQueue, densityTargets,
} from './board.js';
import { makeWorld, stepProjectile, resolveLanding, sweepShot, auditReachability } from './world.js';
import { checkBoardSolvable } from './solver.js';
import { computeLabelLayouts } from './labels.js';
import { configFor } from './levels.js';
import { GameState, PHASE, LIFE_CAP } from './state.js';
import { mulberry32, nextId, clamp } from './util.js';
import { loadSave, persist, MAX_LEVELS } from './storage.js';

const FIXED_DT = 1 / 120;         // physics timestep
const MAX_FRAME_DT = 0.1;         // clamp after tab-switch pauses
const FEEDBACK_CORRECT = 1.9;     // seconds — long enough to read the explanation
const FEEDBACK_WRONG = 1.5;
const RESOLVE_POP = 0.38;         // pop animation before outcome evaluation
const CLEAR_BONUS = 30;           // neutral group popped (puzzle bonus)
const FALL_BONUS = 10;            // per bubble disconnected by a valid pop
const BOARD_ATTEMPTS = 10;        // generation candidates before the fallback

function cellsOf(clusters) {
  return clusters.flatMap((cl) => cl.cells.map(([r, c]) => ({ r, c, color: cl.color, option: cl.option ?? null })));
}

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
    // Stall guard: some hosts (embedded webviews, hidden panes) throttle
    // requestAnimationFrame to zero without firing visibilitychange. Keep the
    // simulation alive — dt clamping makes catch-up frames safe.
    this.stallGuard = setInterval(() => {
      if (performance.now() - this.lastT > 250) this.frame(performance.now());
    }, 120);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause('hidden');
    });
  }

  stop() { cancelAnimationFrame(this.raf); clearInterval(this.stallGuard); }

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
    this.state.powerups = { ...configFor(level).powerups }; // per-level loadout
    this.state.go(PHASE.PREPARING_QUESTION);
    this.ui.showGameChrome(true);
    this.ui.hideToast();
    this.ui.setPopover(false);
    this.ui.screen('game');
    this.prepareQuestion(token);
  }

  colsForLayout() {
    const { mode, device } = this.layout;
    // Portrait phones keep 8 columns: ~390 CSS px of playfield lands bubbles
    // at ~46 px, and a 320 px phone still gets ~38 px without clipping.
    // Tablet portrait goes to 12 columns so bubbles stay a readable ~60 px
    // instead of stretching the narrow phone board across the wider screen.
    if (mode === 'mobile') return device === 'tablet' ? 12 : 8;
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
    this.clearedToastShown = false;
    this.questionLoadedColor = st.loadedColor; // restoreBoard rewinds to this

    this.buildPuzzle();
    this.ui.renderQuestion(st);
    this.ui.renderHud(st);
    this.ui.renderTimer(st.activeTime);
    this.aim = null;
    if (st.phase !== PHASE.AIMING) st.go(PHASE.AIMING);
  }

  // Option id → trimmed answer text for the active question.
  answerTextById() {
    const map = new Map((this.state.question?.options || []).map((o) => [o.id, String(o.text).trim()]));
    return (id) => map.get(id) || '';
  }

  // Build the puzzle board + ammunition queue for the current question.
  // Candidates come from the deterministic generator; each must pass the
  // structural validator AND the real-physics solver gate (direct winning
  // shot for the correct cluster, every option selectable, queue colours
  // match real neutral groups) AND the answer-label layout gate (every
  // cluster's label finds a non-overlapping anchor). The first passing
  // candidate wins; the curated template family is the guaranteed fallback.
  buildPuzzle() {
    const st = this.state;
    this.cols = this.colsForLayout();
    const letters = st.optionsOrder.map((o) => o.id);
    const textFor = this.answerTextById();

    let built = null;
    const cfg = configFor(st.level);
    for (let attempt = 0; attempt < BOARD_ATTEMPTS && !built; attempt++) {
      const seed = (this.qSeed + attempt * 7919) >>> 0;
      const puzzle = buildPuzzleBoard({
        cols: this.cols, level: st.level, options: letters, loadedColor: st.loadedColor, seed,
        obstacleBudget: cfg.obstacleBudget,
      });
      if (!puzzle) continue;
      const errs = validateBoard(this.cols, cellsOf(puzzle.clusters), {
        loadedColor: st.loadedColor, ...puzzle.targets,
      });
      if (errs.length) continue;
      const queue = buildAmmunitionQueue({ neutralGroups: puzzle.neutralGroups, loadedColor: st.loadedColor, seed });
      const gate = checkBoardSolvable({
        cols: this.cols, clusters: puzzle.clusters, loadedColor: st.loadedColor,
        correctOption: st.question.correct, queue, options: letters,
        minAngles: cfg.minDirectAngles,
      });
      if (!gate.ok) continue;
      // Label gate: a candidate whose clusters leave no room for overlap-free
      // answer labels is passed over — the next seed re-arranges the clusters.
      // Text size is never shrunk below the readable floor to force a fit.
      const probe = makeWorld(this.cols, puzzle.clusters);
      probe.setView(this.layout.cssW, this.layout.cssH, this.layout.dpr);
      if (computeLabelLayouts(probe, textFor, this.layout.dpr).infeasible.length) continue;
      built = { clusters: puzzle.clusters, queue };
    }

    if (!built) {
      // Curated fallback: legacy audited four-cluster packing (no neutrals).
      const clusters = buildClusters(this.cols, letters, st.loadedColor, mulberry32(1));
      if (validateClusters(this.cols, clusters).length) throw new Error('board template invalid');
      const world = makeWorld(this.cols, clusters);
      const rep = auditReachability(world, letters);
      if (Math.min(...Object.values(rep)) < 3) throw new Error('fallback board unreachable');
      built = { clusters, queue: buildAmmunitionQueue({ neutralGroups: [], loadedColor: st.loadedColor, seed: this.qSeed }) };
    }

    st.queue = built.queue;
    st.loadedColor = st.queue[0];
    st.nextColor = st.queue[1] ?? st.queue[0];
    this.renderer.clearTransient();
    this.world = makeWorld(this.cols, built.clusters);
    this.world.setView(this.layout.cssW, this.layout.cssH, this.layout.dpr);
    this.world.labels = computeLabelLayouts(this.world, textFor, this.layout.dpr).layouts;
  }

  // Rebuild the identical board + queue (after a wrong answer / miss: the
  // board must return to a clean, solvable state for the same question).
  // Everything derives from qSeed + the question's initial loaded colour.
  restoreBoard() {
    const st = this.state;
    st.loadedColor = this.questionLoadedColor;
    this.buildPuzzle();
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
  // Rainbow bubbles match any colour: pick the neighbour colour whose group
  // (with the landing cell) is largest, preferring groups containing an
  // answer cluster so the power-up can always resolve a question.
  rainbowLandingColor(r, c) {
    const board = this.world.board;
    const colors = new Map(); // color -> { size, hasOption }
    for (const [nr, nc] of board.neighbors(r, c)) {
      const cell = board.get(nr, nc);
      if (!cell) continue;
      if (!colors.has(cell.color)) colors.set(cell.color, { size: 0, hasOption: false });
      const agg = colors.get(cell.color);
      agg.size = board.groupAt(nr, nc).length;
      agg.hasOption = agg.hasOption || cell.option != null;
    }
    let best = null;
    for (const [color, agg] of colors) {
      if (agg.size < 2) continue; // a group of 2 + landing = 3 = match
      const score = (agg.hasOption ? 100 : 0) + agg.size;
      if (!best || score > best.score) best = { color, score };
    }
    return best ? best.color : null;
  }

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
    // Rainbow matches any colour; otherwise the shot keeps its loaded colour
    // (neutral boards never share the answer colour, so a loaded bubble can
    // only ever join answer clusters).
    const landColor = st.shot.rainbow ? (this.rainbowLandingColor(r, c) || st.shot.color) : st.shot.color;
    this.world.board.set(r, c, { color: landColor, option: null });
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
        // grid is now final; anything left unsupported falls
        const falls = this.world.board.dropUnsupported();
        this.renderer.spawnPopBurst(centers, landColor);
        this.spawnFallers(falls);
        this.pendingOutcome = { kind: 'popped', option: chosen, falls: falls.length };
        st.go(PHASE.RESOLVING);
        this.resolveT = RESOLVE_POP;
        this.audio.play('pop');
        return;
      }
      if (opts.size > 1) {
        // Validated boards make this impossible; recover without penalty.
        console.warn('BPE: ambiguous landing (touched two clusters) — recovered without penalty');
        for (const [gr, gc] of group) this.world.board.remove(gr, gc);
        this.world.board.dropUnsupported();
        st.shot = null;
        this.restoreBoard();
        st.go(PHASE.AIMING);
        return;
      }
      // pure neutral match → obstacle cleared, the same question continues
      const centers = group.map(([gr, gc]) => this.world.board.cellCenter(gr, gc, this.world.D));
      for (const [gr, gc] of group) this.world.board.remove(gr, gc);
      const falls = this.world.board.dropUnsupported();
      this.renderer.spawnPopBurst(centers, landColor);
      this.spawnFallers(falls);
      this.pendingOutcome = { kind: 'cleared', popped: group.length, falls: falls.length };
      st.go(PHASE.RESOLVING);
      this.resolveT = RESOLVE_POP;
      this.audio.play('pop');
      return;
    }

    // genuine miss: projectile attached without a match — remove it, restore
    this.pendingOutcome = { kind: 'miss' };
    st.go(PHASE.RESOLVING);
    this.resolveT = RESOLVE_POP * 0.6;
  }

  // Shift the ammunition queue after a fully resolved shot. The queue never
  // runs dry of winning shots: extensions stay on the loaded colour, which
  // the solver gate guarantees can always pop the correct cluster directly.
  advanceQueue() {
    const st = this.state;
    if (!st.queue.length) return;
    st.queue.shift();
    if (st.queue.length < 2) st.queue.push(st.loadedColor);
    st.loadedColor = st.queue[0];
    st.nextColor = st.queue[1] ?? st.queue[0];
  }

  spawnFallers(cells) {
    if (!cells.length) return;
    const fallers = cells.map((f) => {
      const p = this.world.board.cellCenter(f.r, f.c, this.world.D);
      return { x: p.x, y: p.y, color: f.color, vy: -20 - Math.random() * 30, vx: (Math.random() - 0.5) * 30, t: 0 };
    });
    this.renderer.spawnFallers(fallers);
  }

  finishResolve() {
    const st = this.state;
    const out = this.pendingOutcome;
    this.pendingOutcome = null;
    st.shot = null;
    this.advanceQueue();
    this.ui.renderHud(st);
    if (!out) { st.go(PHASE.AIMING); return; }

    if (out.kind === 'cleared') {
      // neutral group popped: puzzle bonus, same question continues — never
      // treated as a wrong English answer
      const gain = CLEAR_BONUS + FALL_BONUS * out.falls + 5 * Math.max(0, out.popped - 3);
      st.score += gain;
      st.go(PHASE.AIMING);
      this.audio.play('pop');
      this.ui.toast(
        this.clearedToastShown ? `Cleared! +${gain}` : 'Obstacle cleared!',
        this.clearedToastShown
          ? `Puzzle bonus +${gain} — now answer the question!`
          : 'Those were not answers — clear them for bonus points, then pop the word group you choose!',
        1600,
      );
      this.clearedToastShown = true;
      return;
    }

    if (out.kind === 'popped') {
      const correct = out.option === st.question.correct;
      if (correct) {
        const gain = 100 + 25 * st.combo;
        st.score += gain;
        st.combo++;
        st.qIndex++;
        st.go(PHASE.FEEDBACK);
        // Learning feedback: positive note + the explanation. Longer
        // explanations (advanced levels) hold a little longer on screen,
        // capped so the arcade flow never stalls.
        const explainMs = 2100 + Math.min(1500, Math.round(st.question.explain.length * 9));
        this.feedbackT = Math.max(FEEDBACK_CORRECT, explainMs / 1000);
        this.feedbackKind = { correct: true, gain, explain: st.question.explain };
        this.audio.play('correct');
        this.ui.renderHud(st);
        this.ui.toast(`Correct! +${gain}`, st.question.explain, explainMs);
        return;
      }
      // wrong answer: one heart, retry the same question — coach with a
      // type-aware nudge instead of only a red cross (never reveals the
      // answer; the question stays on the board)
      st.combo = 0;
      st.mistakes++;
      st.lives--;
      st.go(PHASE.FEEDBACK);
      this.feedbackT = FEEDBACK_WRONG;
      this.feedbackKind = { correct: false, wrong: true };
      this.audio.play('wrong');
      this.ui.renderHud(st);
      const info = QUESTION_TYPES[st.question.type];
      const nudge = (info && info.nudge) || 'Read the question again carefully.';
      this.ui.toast('Not quite…', `${nudge} One heart lost — try another answer!`, 2200);
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
    this.ui.goTip.textContent = 'Tip: each answer sits on a bubble group — pop the group whose label answers the question!';
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
    // Answer labels depend on the view scale (readable-size floors in CSS px),
    // so re-fit them for the new geometry. Cluster arrangement itself only
    // changes at question boundaries (buildPuzzle), never mid-question.
    if (this.state.question) {
      this.world.labels = computeLabelLayouts(this.world, this.answerTextById(), info.dpr).layouts;
    }
    // Overlay hints for CSS (Next card sits right of the cannon).
    const scale = this.world.view.scale;
    this.root.style.setProperty('--bpe-cannon-half', `${Math.round((this.world.cannonW / 2) * scale)}px`);
    this.root.style.setProperty('--bpe-muzzle-up', `${Math.round((this.world.H - this.world.muzzle.y) * scale)}px`);
  }

  // Debug helper: current predicted landing for the overlay
  predictLanding() {
    if (!this.world || !this.aim) return null;
    const ev = sweepShot(this.world, this.world.muzzle, this.aim, this.world.W * 3);
    const landing = resolveLanding(this.world, ev);
    return { ev, landing };
  }
}
