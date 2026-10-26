// Task-7 audit diagnostic v2 (bounded):
// A. rejection-stage census: why do attempts fail, for the known-hard sweep?
// B. can the game's legacy fallback path ever throw?
// C. rescue curve only over combos that fail the 10-attempt pipeline.

import { LEVELS, validateLevels, shuffledOptions } from '../bubble-pop-english/js/questions.js';
import { BUBBLE_COLORS } from '../bubble-pop-english/js/assets.js';
import {
  buildPuzzleBoard, validateBoard, buildAmmunitionQueue, buildClusters, validateClusters,
} from '../bubble-pop-english/js/board.js';
import { checkBoardSolvable } from '../bubble-pop-english/js/solver.js';
import { makeWorld, auditReachability } from '../bubble-pop-english/js/world.js';
import { mulberry32 } from '../bubble-pop-english/js/util.js';
import { configFor } from '../bubble-pop-english/js/levels.js';

const WIDTHS = [8, 9, 10, 11, 12];
const TOKENS = 12;
const qSeed = (level, qIndex, runToken) => (runToken * 131 + level * 31 + qIndex * 7 + 101) >>> 0;
const cellsOf = (clusters) => clusters.flatMap((cl) => cl.cells.map(([r, c]) => ({ r, c, color: cl.color, option: cl.option ?? null })));

// mirror game.js biasFor so the census measures the real pipeline
const biasFor = (attempt) => (attempt < 5 ? 0.55 : attempt < 8 ? 0.3 : 0.08);

function classifyAttempt({ cols, level, letters, loadedColor, seed, q, bias }) {
  const cfg = configFor(level);
  const puzzle = buildPuzzleBoard({
    cols, level, options: letters, loadedColor, seed,
    obstacleBudget: cfg.obstacleBudget, densityBias: bias,
  });
  if (!puzzle) return 'generator';
  const errs = validateBoard(cols, cellsOf(puzzle.clusters), { loadedColor, ...puzzle.targets });
  if (errs.length) return 'structural';
  const queue = buildAmmunitionQueue({ neutralGroups: puzzle.neutralGroups, loadedColor, seed });
  const gate = checkBoardSolvable({
    cols, clusters: puzzle.clusters, loadedColor, correctOption: q.correct, queue,
    options: letters, minAngles: cfg.minDirectAngles,
  });
  return gate.ok ? 'ok' : 'physics';
}

function comboInfo(lv, qi, token, cols) {
  const q = lv.questions[qi];
  const seed = qSeed(lv.level, qi, token);
  const rng = mulberry32(seed);
  const letters = shuffledOptions(q, rng).map((o) => o.id);
  const loadedColor = BUBBLE_COLORS[Math.floor(rng() * 4)];
  return { q, seed, letters, loadedColor };
}

// ---- A+C. census + rescue over failing combos only -------------------------
const stageTotals = { generator: 0, structural: 0, physics: 0 };
const perLevel = new Map();
const hardCombos = [];
for (const lv of LEVELS) {
  const s = { gen: 0, struct: 0, phys: 0, ok: 0, hard: 0 };
  for (let qi = 0; qi < 4; qi++) {
    for (let token = 0; token < TOKENS; token++) {
      for (const cols of WIDTHS) {
        const info = comboInfo(lv, qi, token, cols);
        let won = false;
        for (let attempt = 0; attempt < 10; attempt++) {
          const seed = (info.seed + attempt * 7919) >>> 0;
          const r = classifyAttempt({ cols, level: lv.level, letters: info.letters, loadedColor: info.loadedColor, seed, q: info.q, bias: biasFor(attempt) });
          if (r === 'ok') { won = true; break; }
          if (r === 'generator') { s.gen++; stageTotals.generator++; }
          else if (r === 'structural') { s.struct++; stageTotals.structural++; }
          else { s.phys++; stageTotals.physics++; }
        }
        if (won) s.ok++;
        else { s.hard++; hardCombos.push({ lv: lv.level, qi, token, cols, info }); }
      }
    }
  }
  perLevel.set(lv.level, s);
}
console.log('== per-level attempt outcomes within the 10-attempt pipeline ==');
for (const [lv, s] of perLevel) {
  console.log(`L${String(lv).padStart(2)} ok=${String(s.ok).padStart(3)} hard=${String(s.hard).padStart(2)}  failed-attempts: gen=${String(s.gen).padStart(4)} struct=${String(s.struct).padStart(3)} physics=${String(s.phys).padStart(4)}`);
}
console.log('stage totals:', JSON.stringify(stageTotals));

// what bias would rescue them? sweep densityBias for the hard combos only
console.log(`\n== rescue sweep over ${hardCombos.length} hard combos ==`);
for (const bias of [0.08, 0.0, 0.15]) {
  let rescued = 0;
  for (const h of hardCombos) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const seed = (h.info.seed + attempt * 7919) >>> 0;
      if (classifyAttempt({ cols: h.cols, level: h.lv, letters: h.info.letters, loadedColor: h.info.loadedColor, seed, q: h.info.q, bias }) === 'ok') { rescued++; break; }
    }
  }
  console.log(`fixed bias=${bias}: rescued ${rescued}/${hardCombos.length}`);
}
// attempt-count curve with the shipped bias schedule, continued past 10
for (const budget of [14, 20, 30]) {
  let rescued = 0;
  for (const h of hardCombos) {
    for (let attempt = 0; attempt < budget; attempt++) {
      const bias = attempt < 5 ? 0.55 : attempt < 8 ? 0.3 : 0.08;
      const seed = (h.info.seed + attempt * 7919) >>> 0;
      if (classifyAttempt({ cols: h.cols, level: h.lv, letters: h.info.letters, loadedColor: h.info.loadedColor, seed, q: h.info.q, bias }) === 'ok') { rescued++; break; }
    }
  }
  console.log(`shipped schedule, attempts=${budget}: rescued ${rescued}/${hardCombos.length}`);
}

// ---- B. can the legacy fallback ever throw? --------------------------------
console.log('\n== legacy fallback path (mulberry32(1), audit>=3) ==');
let fallbackThrows = 0;
for (const lv of LEVELS) {
  for (let qi = 0; qi < 4; qi++) {
    for (const cols of WIDTHS) {
      for (let token = 0; token < TOKENS; token++) {
        const info = comboInfo(lv, qi, token, cols);
        const clusters = buildClusters(cols, info.letters, info.loadedColor, mulberry32(1));
        const errs = validateClusters(cols, clusters);
        const rep = auditReachability(makeWorld(cols, clusters), info.letters);
        if (errs.length || Math.min(...Object.values(rep)) < 3) {
          fallbackThrows++;
          if (fallbackThrows <= 5) console.log(`  THROW RISK L${lv.level} q${qi + 1} cols${cols}: errs=[${errs}] minAudit=${Math.min(...Object.values(rep))}`);
        }
      }
    }
  }
}
console.log(fallbackThrows === 0 ? 'fallback path: never throws across the full sweep ✓' : `fallback path THROWS for ${fallbackThrows} combos ✗`);
