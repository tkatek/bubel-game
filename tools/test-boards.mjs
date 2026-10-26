// Headless board-quality harness referenced by js/solver.js. Runs the exact
// runtime gate (buildPuzzleBoard → validateBoard → buildAmmunitionQueue →
// checkBoardSolvable) across all levels, questions, seeds and responsive
// board widths, then reports difficulty shape per level:
//   - fallback rate   (candidate boards rejected — should be ~0)
//   - neutral density (obstacle bubbles on the board)
//   - window size     (distinct winning angles for the correct answer)
//
// Usage: node tools/test-boards.mjs [quick|full]
//   quick — runToken sweep 0..3  (default)
//   full  — runToken sweep 0..11 (CI deep run)
// Exit 1 when any question cannot build a gated board for ANY swept seed —
// that would mean a player can hit an unbuildable question.

import { LEVELS, validateLevels, shuffledOptions } from '../bubble-pop-english/js/questions.js';
import { BUBBLE_COLORS } from '../bubble-pop-english/js/assets.js';
import { buildPuzzleBoard, validateBoard, buildAmmunitionQueue } from '../bubble-pop-english/js/board.js';
import { checkBoardSolvable, makeSim, surveyDirectShots, simulateShot } from '../bubble-pop-english/js/solver.js';
import { mulberry32 } from '../bubble-pop-english/js/util.js';
import { configFor } from '../bubble-pop-english/js/levels.js';

const quick = !process.argv.includes('full');
const TOKENS = quick ? 4 : 12;
const WIDTHS = [8, 9, 10, 11, 12]; // phone / tablet / small desktop / desktop / wide

function qSeed(level, qIndex, runToken) {
  return (runToken * 131 + level * 31 + qIndex * 7 + 101) >>> 0;
}

function cellsOf(clusters) {
  return clusters.flatMap((cl) => cl.cells.map(([r, c]) => ({ r, c, color: cl.color, option: cl.option ?? null })));
}

// One candidate pipeline — mirrors game.js buildPuzzle() attempt loop
// (including the LEVEL_CONFIG gate knobs and the density retreat).
function buildQuestion({ cols, level, q, qSeed: seed, loadedColor, optionsOrder }) {
  const letters = optionsOrder.map((o) => o.id);
  const cfg = configFor(level);
  const biasFor = (attempt) => (attempt < 5 ? 0.55 : attempt < 8 ? 0.3 : 0.08);
  for (let attempt = 0; attempt < 10; attempt++) {
    const s = (seed + attempt * 7919) >>> 0;
    const puzzle = buildPuzzleBoard({ cols, level, options: letters, loadedColor, seed: s, obstacleBudget: cfg.obstacleBudget, densityBias: biasFor(attempt) });
    if (!puzzle) continue;
    const errs = validateBoard(cols, cellsOf(puzzle.clusters), { loadedColor, ...puzzle.targets });
    if (errs.length) continue;
    const queue = buildAmmunitionQueue({ neutralGroups: puzzle.neutralGroups, loadedColor, seed: s });
    const gate = checkBoardSolvable({
      cols, clusters: puzzle.clusters, loadedColor, correctOption: q.correct, queue, options: letters,
      minAngles: cfg.minDirectAngles,
    });
    if (!gate.ok) continue;
    return { puzzle, queue, gate, attempts: attempt + 1 };
  }
  return null;
}

// End-to-end physics check: fire the solver's own winning angle and confirm
// the correct option pops (this is what a player's direct shot does).
function fireWinningShot({ cols, clusters, loadedColor, correctOption }) {
  const sim = makeSim(cols, clusters);
  const direct = surveyDirectShots(sim, loadedColor);
  const win = direct[correctOption];
  if (!win || !win.angles) return { ok: false, why: 'no winning angle to re-fire' };
  const out = simulateShot(sim, win.first, loadedColor);
  if (!out.landed) return { ok: false, why: 'winning shot fizzled' };
  if (out.poppedOptions.length !== 1 || out.poppedOptions[0] !== correctOption) {
    return { ok: false, why: `fired winning angle popped ${JSON.stringify(out.poppedOptions)}` };
  }
  return { ok: true };
}

let failures = 0;
let questions = 0;
const perLevel = new Map();

validateLevels();
console.log(`Bubble Pop English — board gate harness (${quick ? 'quick' : 'full'})`);
console.log(`levels=${LEVELS.length} widths=${WIDTHS.join('/')} runTokens=${TOKENS}`);

for (const lv of LEVELS) {
  const stat = { built: 0, fallback: 0, neut: 0, winMin: Infinity, winSum: 0, n: 0, fails: [] };
  for (let qi = 0; qi < lv.questions.length; qi++) {
    const q = lv.questions[qi];
    for (let token = 0; token < TOKENS; token++) {
      for (const cols of WIDTHS) {
        questions++;
        const seed = qSeed(lv.level, qi, token);
        const rng = mulberry32(seed);
        const optionsOrder = shuffledOptions(q, rng);
        const loadedColor = BUBBLE_COLORS[Math.floor(rng() * 4)];
        const built = buildQuestion({ cols, level: lv.level, q, qSeed: seed, loadedColor, optionsOrder });
        if (!built) { failures++; stat.fallback++; stat.fails.push(`q${qi + 1} token${token} cols${cols}: NO CANDIDATE`); continue; }
        // runtime fallback path in game.js must also stay solvable
        stat.built++;
        stat.neut += built.puzzle.clusters.filter((c) => c.option == null).reduce((s, c) => s + c.cells.length, 0);
        const win = built.gate.direct[q.correct]?.angles ?? 0;
        stat.winMin = Math.min(stat.winMin, win);
        stat.winSum += win;
        stat.n++;
        const fire = fireWinningShot({ cols, clusters: built.puzzle.clusters, loadedColor, correctOption: q.correct });
        if (!fire.ok) { failures++; stat.fails.push(`q${qi + 1} token${token} cols${cols}: ${fire.why}`); }
      }
    }
  }
  perLevel.set(lv.level, stat);
  const avgWin = stat.n ? (stat.winSum / stat.n).toFixed(1) : '—';
  const winMin = stat.winMin === Infinity ? '—' : stat.winMin;
  console.log(
    `L${String(lv.level).padStart(2)} ${lv.cefr} ` +
    `built=${stat.built} fallback=${stat.fallback} ` +
    `neutrals=${stat.built ? (stat.neut / stat.built).toFixed(1) : '—'} ` +
    `correctWindow min=${winMin} avg=${avgWin}` +
    (stat.fails.length ? ` FAILS=${stat.fails.length}` : ''),
  );
  for (const f of stat.fails.slice(0, 6)) console.log(`   ✗ ${f}`);
}

// Determinism check: identical seeds must build identical boards (restoreBoard
// relies on this after wrong answers / misses).
let determinismOk = true;
{
  const lv = LEVELS[7];
  const q = lv.questions[1];
  for (const cols of WIDTHS) {
    const seed = qSeed(lv.level, 1, 2);
    const rng = mulberry32(seed);
    const optionsOrder = shuffledOptions(q, rng);
    const loadedColor = BUBBLE_COLORS[Math.floor(rng() * 4)];
    const a = buildQuestion({ cols, level: lv.level, q, qSeed: seed, loadedColor, optionsOrder });
    const b = buildQuestion({ cols, level: lv.level, q, qSeed: seed, loadedColor, optionsOrder });
    if (!a || !b) { determinismOk = false; failures++; console.log(`✗ determinism: board unbuildable at cols=${cols}`); continue; }
    const sig = (r) => JSON.stringify(r.puzzle.clusters.map((c) => [c.option, c.color, c.cells]));
    if (sig(a) !== sig(b)) { determinismOk = false; failures++; console.log(`✗ determinism broken at cols=${cols}`); }
  }
  if (determinismOk) console.log('determinism: same seed → identical board ✓');
}

// Queue invariant sweep: never two consecutive non-loaded colours, never empty.
{
  let bad = 0;
  for (const lv of LEVELS) for (let qi = 0; qi < 4; qi++) {
    for (let token = 0; token < TOKENS; token++) {
      const seed = qSeed(lv.level, qi, token);
      const rng = mulberry32(seed);
      const q = lv.questions[qi];
      const optionsOrder = shuffledOptions(q, rng);
      const loadedColor = BUBBLE_COLORS[Math.floor(rng() * 4)];
      const cols = 11;
      const built = buildQuestion({ cols, level: lv.level, q, qSeed: seed, loadedColor, optionsOrder });
      if (!built) continue;
      const { queue } = built;
      if (queue.length < 2) { bad++; continue; }
      for (let i = 1; i < queue.length; i++) if (queue[i] !== loadedColor && queue[i - 1] !== loadedColor) bad++;
    }
  }
  if (bad) { failures++; console.log(`✗ queue invariant violations: ${bad}`); }
  else console.log('ammunition queue: no consecutive non-loaded colours ✓');
}

// Stepped-flight regression: the live projectile advances in bounded substeps
// (stepProjectile) while the aim guide and solver use one full sweep — both
// must agree on the landing for every angle, especially after wall bounces.
{
  const { makeWorld, sweepShot, resolveLanding } = await import('../bubble-pop-english/js/world.js');
  let mismatches = 0;
  let checked = 0;
  const lv = LEVELS[8]; // board with obstacles; wall bounces are relevant here
  const q = lv.questions[0];
  const cols = 11;
  const seed = qSeed(lv.level, 0, 1);
  const rng = mulberry32(seed);
  const optionsOrder = shuffledOptions(q, rng);
  const loadedColor = BUBBLE_COLORS[Math.floor(rng() * 4)];
  const built = buildQuestion({ cols, level: lv.level, q, qSeed: seed, loadedColor, optionsOrder });
  if (built) {
    for (let deg = 16; deg <= 164; deg += 3) {
      const rad = (deg * Math.PI) / 180;
      const dir = { x: Math.cos(rad), y: -Math.sin(rad) };
      const world = makeWorld(cols, built.puzzle.clusters);
      // full sweep (guide/solver path)
      const ev = sweepShot(world, world.muzzle, dir, world.W * 3);
      const predicted = ev.type === 'bubble' || ev.type === 'ceiling' ? resolveLanding(world, ev) : { ok: false };
      // stepped flight (live projectile path, mirrors stepProjectile)
      const shot = { pos: { ...world.muzzle }, dir: { ...dir }, trail: [], bounces: 0 };
      let ended = null;
      for (let i = 0; i < 4000 && !ended; i++) {
        let remaining = world.speed * (1 / 120);
        const stepMax = world.D * 0.25;
        while (remaining > 1e-6 && !ended) {
          const step = Math.min(stepMax, remaining);
          remaining -= step;
          const sub = sweepShot(world, shot.pos, shot.dir, step);
          shot.trail.push({ ...shot.pos });
          if (sub.bounces) shot.bounces += sub.bounces;
          if (sub.type === 'exhausted') { shot.pos = sub.point; if (sub.dir) shot.dir = sub.dir; continue; }
          shot.pos = sub.point;
          ended = sub;
        }
      }
      const stepped = ended && (ended.type === 'bubble' || ended.type === 'ceiling')
        ? resolveLanding(world, ended)
        : { ok: false };
      checked++;
      const agree = predicted.ok === stepped.ok &&
        (!predicted.ok || !stepped.ok ||
          (predicted.cell[0] === stepped.cell[0] && predicted.cell[1] === stepped.cell[1]));
      if (!agree) {
        mismatches++;
        if (mismatches <= 3) console.log(`   ✗ deg ${deg}: predicted ${JSON.stringify(predicted.cell)} stepped ${JSON.stringify(stepped.cell)}`);
      }
    }
  }
  if (mismatches) { failures++; console.log(`✗ stepped-flight disagrees with guide sweep on ${mismatches}/${checked} angles`); }
  else console.log(`stepped flight matches guide sweep on ${checked} angles ✓`);
}

console.log('————————————————');
console.log(`${questions} board builds · ${failures} failure${failures === 1 ? '' : 's'}`);
process.exit(failures ? 1 : 0);
