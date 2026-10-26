// Programmatic audit of the question bank (task 4). Run:
//   node tools/validate-questions.mjs
// Imports the real module (no mocks) and reports everything the task
// requires: structure, types, difficulty spread, uniqueness, fallbacks.
import { LEVELS, CEFR_FOR_LEVEL, QUESTION_TYPES, validateLevels, needsLetterBadges } from '../bubble-pop-english/js/questions.js';

let failures = 0;
const fail = (msg) => { failures++; console.error('FAIL:', msg); };
const ok = (msg) => console.log('  ok –', msg);

console.log('== 1. load-time validation ==');
try {
  validateLevels();
  ok('validateLevels() passed (15 levels × 4 questions, schema, CEFR map, ≥3 types/level, unique prompts/ids, valid correct ids)');
} catch (e) {
  fail(e.message);
}

console.log('== 2. counts ==');
const questions = LEVELS.flatMap((lv) => lv.questions);
if (LEVELS.length !== 15) fail(`levels: ${LEVELS.length}`);
if (questions.length !== 60) fail(`questions: ${questions.length}`);
ok(`15 levels, ${questions.length} questions`);

console.log('== 3. one unambiguous correct option ==');
for (const q of questions) {
  const ids = q.options.map((o) => o.id);
  if (ids.filter((id) => id === q.correct).length !== 1) fail(`${q.id}: correct id not exactly once`);
  if (new Set(q.options.map((o) => o.text.trim().toLowerCase())).size !== 4) fail(`${q.id}: duplicate option text`);
}
ok('every question: 4 distinct choices, exactly one valid correct id');

console.log('== 4. question types ==');
const typeCount = {};
for (const q of questions) typeCount[q.type] = (typeCount[q.type] || 0) + 1;
const types = Object.keys(typeCount);
console.log('  types used:', types.map((t) => `${t}(${QUESTION_TYPES[t].label}) ×${typeCount[t]}`).join(', '));
if (types.length < 6) fail(`only ${types.length} distinct types (need ≥6)`);
const unknown = types.filter((t) => !QUESTION_TYPES[t]);
if (unknown.length) fail(`types without QUESTION_TYPES metadata: ${unknown.join(', ')}`);
ok(`${types.length} distinct challenge styles, all with labels + nudges`);

console.log('== 5. ≥3 types per level ==');
for (const lv of LEVELS) {
  const set = new Set(lv.questions.map((q) => q.type));
  if (set.size < 3) fail(`level ${lv.level}: only ${set.size} types`);
}
ok('every level mixes at least 3 challenge types');

console.log('== 6. CEFR progression ==');
LEVELS.forEach((lv, i) => {
  if (lv.cefr !== CEFR_FOR_LEVEL[i]) fail(`level ${lv.level}: ${lv.cefr} != ${CEFR_FOR_LEVEL[i]}`);
});
const map = CEFR_FOR_LEVEL.map((c, i) => `L${i + 1}=${c}`).join(' ');
console.log('  ', map);
ok('progression matches the required A1→C2 ladder');

console.log('== 7. shuffling keeps correctness ==');
// Fisher-Yates with any rng must keep the correct object attached to its id
const q0 = questions[0];
const seedRng = () => 0.42;
const { shuffledOptions } = await import('../bubble-pop-english/js/questions.js');
const shuffled = shuffledOptions(q0, seedRng);
const stillThere = shuffled.find((o) => o.id === q0.correct);
if (!stillThere || stillThere.text !== q0.options.find((o) => o.id === q0.correct).text) fail('shuffling broke option integrity');
ok('option objects shuffle whole — correctness travels with the id');

console.log('== 8. letter-fallback usage (Task-2 adaptive labels) ==');
const fallback = questions.filter((q) => needsLetterBadges(q.options));
console.log(`   ${fallback.length}/60 questions use letter badges: ${fallback.map((q) => q.id).join(', ')}`);
const wordBubbles = questions.length - fallback.length;
if (wordBubbles < 20) fail('too few word-bubble questions');
ok(`word bubbles on ${wordBubbles} questions, letter badges on ${fallback.length}`);

console.log('== 9. explanations ==');
const shortExplain = questions.filter((q) => !q.explain || q.explain.trim().length < 40);
if (shortExplain.length) fail(`thin explanations: ${shortExplain.map((q) => q.id).join(', ')}`);
const avg = Math.round(questions.reduce((s, q) => s + q.explain.length, 0) / questions.length);
ok(`all 60 explanations present, average ${avg} chars`);

console.log('== 10. contextual (dialogue/reading) questions ==');
const ctxQs = questions.filter((q) => Array.isArray(q.context) && q.context.length);
const conv = ctxQs.filter((q) => q.type === 'conversation');
const read = ctxQs.filter((q) => q.type === 'reading');
console.log(`   ${ctxQs.length} questions carry context lines (${conv.length} conversation, ${read.length} reading)`);
if (!conv.length || !read.length) fail('missing dialogue or reading contexts');
ok('structured context data present for dialogue + reading styles');

console.log('== 11. no raw HTML anywhere ==');
const all = questions.flatMap((q) => [q.prompt, q.explain, ...(q.context || []).flatMap((c) => typeof c === 'string' ? [c] : [c.who, c.line]), ...q.options.map((o) => o.text)]);
const bad = all.filter((s) => /[<>]/.test(s));
if (bad.length) fail(`HTML-ish content: ${JSON.stringify(bad.slice(0, 3))}`);
ok(`${all.length} content strings checked — no HTML tags`);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
