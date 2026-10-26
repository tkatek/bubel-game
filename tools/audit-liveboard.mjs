// Task-7 audit: run the real solver gate on a board dumped from the live game.
// Input JSON on stdin: { cols, loadedColor, correct, options, clusters }
import { checkBoardSolvable, makeSim, surveyDirectShots } from '../bubble-pop-english/js/solver.js';
import { validateBoard } from '../bubble-pop-english/js/board.js';
import { configFor } from '../bubble-pop-english/js/levels.js';

const dump = JSON.parse(await new Promise(r => { let d = ''; process.stdin.on('data', c => d += c); process.stdin.on('end', () => r(d)); }));
const cfg = configFor(dump.level);
const cells = dump.clusters.flatMap(cl => cl.cells.map(([r, c]) => ({ r, c, color: cl.color, option: cl.option ?? null })));
const errs = validateBoard(dump.cols, cells, { loadedColor: dump.loadedColor });
console.log('structural errors:', errs.length ? errs : 'none');
const sim = makeSim(dump.cols, dump.clusters);
const direct = surveyDirectShots(sim, dump.loadedColor);
console.log('per-option winning angles at build colours:', JSON.stringify(Object.fromEntries(Object.entries(direct).map(([k, v]) => [k, v.angles]))));
// gate needs the queue, but we only care about gate #1/#2 here: rebuild a synthetic all-loaded queue
const queue = Array(12).fill(dump.loadedColor);
const gate = checkBoardSolvable({ cols: dump.cols, clusters: dump.clusters, loadedColor: dump.loadedColor, correctOption: dump.correct, queue, options: dump.options, minAngles: cfg.minDirectAngles });
console.log('level', dump.level, 'minDirectAngles =', cfg.minDirectAngles);
console.log('gate.ok =', gate.ok, gate.ok ? '' : JSON.stringify(gate.reasons, null, 1));
