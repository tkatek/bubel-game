// Bounded shot planner over the REAL physics. Every simulated shot uses the
// same sweepShot/resolveLanding geometry as the live projectile and the aim
// guide, so "the solver says it is reachable" means a player shot can do it:
// true projectile radius, wall reflections, obstacle collision order, snap
// landing cell, match-group size and support drops are all part of the sim.
//
// Runtime gate (game.js, per question): the correct cluster must have a
// direct winning angle, every option must be selectable, and clearing any
// single neutral group must not destroy that win. The dev harness
// (tools/test-boards.mjs) runs the same gate across all levels, seeds and
// responsive board widths.

import { makeWorld, sweepShot, resolveLanding, MAX_DEFLECTION } from './world.js';

const ANGLE_LO = 90 - MAX_DEFLECTION;   // 14°
const ANGLE_HI = 90 + MAX_DEFLECTION;   // 166°

export function angleFan(stepDeg = 1.5) {
  const out = [];
  for (let deg = ANGLE_LO; deg <= ANGLE_HI + 1e-9; deg += stepDeg) out.push(deg);
  return out;
}

// A simulation context: world geometry + a private HexBoard copy that shots
// mutate. The live game world is never touched.
export function makeSim(cols, clusters) {
  const world = makeWorld(cols, clusters);
  return {
    cols,
    world,
    board: world.board,
    withBoard(board) { return { cols, world: { ...this.world, board }, board }; },
  };
}

// Fire one simulated shot. Mutates sim.board. Returns:
//   { landed:false }                                — fizzled (no legal cell)
//   { landed:true, popped, poppedOptions, falls }   — popped > 0 means a
//     match-group of 3+ burst; falls = bubbles that lost support after it.
export function simulateShot(sim, angleDeg, color) {
  const rad = (angleDeg * Math.PI) / 180;
  const dir = { x: Math.cos(rad), y: -Math.sin(rad) };
  const ev = sweepShot(sim.world, sim.world.muzzle, dir, sim.world.W * 3);
  if (ev.type !== 'bubble' && ev.type !== 'ceiling') return { landed: false };
  const landing = resolveLanding(sim.world, ev);
  if (!landing.ok) return { landed: false };
  const [r, c] = landing.cell;
  sim.board.set(r, c, { color, option: null });
  const group = sim.board.groupAt(r, c);
  if (group.length >= 3) {
    const opts = new Set();
    for (const [gr, gc] of group) {
      const cell = sim.board.get(gr, gc);
      if (cell && cell.option != null) opts.add(cell.option);
    }
    for (const [gr, gc] of group) sim.board.remove(gr, gc);
    const falls = sim.board.dropUnsupported();
    return {
      landed: true,
      popped: group.length,
      poppedOptions: [...opts],
      clearedNeutral: opts.size === 0,
      falls: falls.length,
      cell: [r, c],
    };
  }
  return { landed: true, popped: 0, poppedOptions: [], falls: 0, cell: [r, c] };
}

// One fan pass with the loaded colour: how many distinct angles pop each
// option directly (window size), and which options are selectable at all.
export function surveyDirectShots(sim, loadedColor, stepDeg = 1.5) {
  const sim2 = { cols: sim.cols, world: sim.world, board: sim.board };
  const windows = new Map(); // option -> Set of landing signatures
  const angleFor = new Map(); // option -> first winning angle
  for (const deg of angleFan(stepDeg)) {
    const probe = sim.withBoard(sim.board.clone());
    const out = simulateShot(probe, deg, loadedColor);
    if (!out.landed || out.popped === 0 || out.poppedOptions.length !== 1) continue;
    const opt = out.poppedOptions[0];
    if (!windows.has(opt)) windows.set(opt, new Set());
    windows.get(opt).add(out.cell.join(','));
    if (!angleFor.has(opt)) angleFor.set(opt, deg);
  }
  const report = {};
  for (const [opt, sigs] of windows) report[opt] = { angles: sigs.size, first: angleFor.get(opt) };
  return report;
}

// Depth-2 selectability: a setup shot (any colour from `setupColors`) that
// changes the board, followed by a direct loaded-colour pop of `option`.
// Bounded: coarse setup fan, and only setups that actually pop something.
export function planDepth2(sim, option, loadedColor, setupColors) {
  for (const deg of angleFan(4.5)) {
    const probe = sim.withBoard(sim.board.clone());
    const color = setupColors[Math.abs(Math.round(deg)) % setupColors.length];
    const out = simulateShot(probe, deg, color);
    if (!out.landed || out.popped === 0) continue;
    const after = surveyDirectShots(probe, loadedColor, 3);
    if (after[option] && after[option].angles >= 1) return { setup: deg, color, win: after[option].first };
  }
  return null;
}

// The runtime gate. `clusters` must be the full puzzle board (answers +
// neutrals). Returns { ok, reasons, direct, windows }.
export function checkBoardSolvable({ cols, clusters, loadedColor, correctOption, queue, options }) {
  const reasons = [];
  const sim = makeSim(cols, clusters);

  // 1. Direct shots: every option must have at least one winning angle with
  //    the loaded colour, and the correct one a comfortable window.
  const direct = surveyDirectShots(sim, loadedColor);
  for (const opt of options) {
    if (!direct[opt] || direct[opt].angles < 1) reasons.push(`option ${opt} has no direct winning shot`);
  }
  if (!direct[correctOption]) reasons.push(`correct option ${correctOption} not directly poppable`);

  // 2. Clearing any single neutral group must keep the correct answer
  //    winnable (the shot that opens the board must never close it).
  const neutralGroups = sim.board.neutralGroups().filter((g) => g.cells.length >= 3);
  for (const g of neutralGroups) {
    const probe = sim.withBoard(sim.board.clone());
    for (const [r, c] of g.cells) probe.board.remove(r, c);
    probe.board.dropUnsupported();
    const after = surveyDirectShots(probe, loadedColor, 3);
    if (!after[correctOption]) reasons.push(`clearing neutral group ${g.color}@${g.cells[0]} kills the winning shot`);
  }

  // 3. Ammunition invariant: every non-loaded queue colour matches a real
  //    neutral group (≥3) on this board, and loaded shots are never scarce
  //    (no two consecutive non-loaded entries).
  const groupColors = new Set(neutralGroups.map((g) => g.color));
  for (let i = 0; i < queue.length; i++) {
    const col = queue[i];
    if (col === loadedColor) continue;
    if (!groupColors.has(col)) reasons.push(`queue[${i}] colour ${col} has no neutral group`);
    if (i > 0 && queue[i - 1] !== loadedColor) reasons.push(`queue has consecutive non-loaded colours at ${i - 1},${i}`);
  }

  return { ok: reasons.length === 0, reasons, direct, windows: direct };
}

// Dev-harness helper: minimum shot depth to pop each option (bounded ≤ 2),
// with queue-aware colours for the setup shot.
export function optionDepths({ cols, clusters, loadedColor, queue, options }) {
  const sim = makeSim(cols, clusters);
  const direct = surveyDirectShots(sim, loadedColor);
  const depths = {};
  const setupColors = [...new Set(queue)].filter((c) => c !== loadedColor);
  for (const opt of options) {
    if (direct[opt]) { depths[opt] = 1; continue; }
    depths[opt] = planDepth2(sim, opt, loadedColor, setupColors.length ? setupColors : [loadedColor]) ? 2 : null;
  }
  return depths;
}
