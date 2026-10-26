// Dev-only rendering harness for the answer-label system (?labeltest=1).
// Swaps the option texts of level 1's four questions for probe word sets that
// exercise every label case — short ("Go"), medium ("Already",
// "Environment") and long ("Nevertheless", "Would have been",
// "Environmental protection", "Had been waiting"). Nothing else changes:
// prompts, types, option ids and the correct-id mapping stay exactly as
// shipped, the bank validates as before, and without the query flag this
// module is never even imported. Reload without the flag for real content.

import { LEVELS } from './questions.js';

const PROBE_SETS = [
  ['Go', 'Already', 'Environment', 'Had been waiting'],
  ['Environmental protection', 'Nevertheless', 'Would have been', 'Go'],
  ['Had been waiting', 'Environment', 'Would have been', 'Already'],
  ['Nevertheless', 'Go', 'Environmental protection', 'Already'],
];

export function applyLabelTest() {
  const lv = LEVELS[0];
  if (!lv || lv.questions.length !== PROBE_SETS.length) {
    console.warn('BPE labeltest: unexpected level shape, harness not applied');
    return;
  }
  lv.questions.forEach((q, i) => {
    q.options.forEach((o, j) => { o.text = PROBE_SETS[i][j]; });
  });
}
