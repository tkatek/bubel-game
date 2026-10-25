// Bubble Pop English — question bank.
// 15 levels × 4 questions = 60 items, introductory (A1) → advanced usage (C2).
// CEFR labels are content guidance only, not a certification claim.
// Data is pure content: no mechanics live here.

export const LEVELS = [
  { level: 1, cefr: 'A1', title: 'Hello & Colours', questions: [
    { id: 'q0101', prompt: 'What colour is the sky on a clear sunny day?',
      options: [{ id: 'a', text: 'Blue' }, { id: 'b', text: 'Green' }, { id: 'c', text: 'Black' }, { id: 'd', text: 'Brown' }],
      correct: 'a', explain: 'A clear sky looks blue: "The sky is blue today."' },
    { id: 'q0102', prompt: 'Which word is the opposite of "big"?',
      options: [{ id: 'a', text: 'Tall' }, { id: 'b', text: 'Small' }, { id: 'c', text: 'Long' }, { id: 'd', text: 'Fast' }],
      correct: 'b', explain: '"Small" is the opposite of "big" — a small mouse, a big elephant.' },
    { id: 'q0103', prompt: 'Which of these words is a greeting?',
      options: [{ id: 'a', text: 'Chair' }, { id: 'b', text: 'Apple' }, { id: 'c', text: 'Hello' }, { id: 'd', text: 'Slow' }],
      correct: 'c', explain: '"Hello" greets people. A chair, an apple and slow are not greetings.' },
    { id: 'q0104', prompt: 'A ripe banana is usually …',
      options: [{ id: 'a', text: 'purple' }, { id: 'b', text: 'yellow' }, { id: 'c', text: 'silver' }, { id: 'd', text: 'pink' }],
      correct: 'b', explain: 'Ripe bananas are yellow. Unripe ones are green.' },
  ]},
  { level: 2, cefr: 'A1', title: 'Numbers & Family', questions: [
    { id: 'q0201', prompt: 'How many days are there in a week?',
      options: [{ id: 'a', text: 'Five' }, { id: 'b', text: 'Six' }, { id: 'c', text: 'Seven' }, { id: 'd', text: 'Ten' }],
      correct: 'c', explain: 'Monday to Sunday — a week has seven days.' },
    { id: 'q0202', prompt: 'Your mother\'s mother is your …',
      options: [{ id: 'a', text: 'aunt' }, { id: 'b', text: 'sister' }, { id: 'c', text: 'grandmother' }, { id: 'd', text: 'cousin' }],
      correct: 'c', explain: 'Your parents\' parents are your grandmother and grandfather.' },
    { id: 'q0203', prompt: 'Which number comes right after ten?',
      options: [{ id: 'a', text: 'Nine' }, { id: 'b', text: 'Eleven' }, { id: 'c', text: 'Twenty' }, { id: 'd', text: 'Twelve' }],
      correct: 'b', explain: 'Ten, eleven, twelve — eleven follows ten.' },
    { id: 'q0204', prompt: 'Your brother\'s daughter is your …',
      options: [{ id: 'a', text: 'niece' }, { id: 'b', text: 'nephew' }, { id: 'c', text: 'uncle' }, { id: 'd', text: 'mother' }],
      correct: 'a', explain: 'A brother\'s (or sister\'s) daughter is your niece; a son is your nephew.' },
  ]},
  { level: 3, cefr: 'A1', title: 'Everyday Things', questions: [
    { id: 'q0301', prompt: 'You sleep on a …',
      options: [{ id: 'a', text: 'shelf' }, { id: 'b', text: 'bed' }, { id: 'c', text: 'oven' }, { id: 'd', text: 'rug' }],
      correct: 'b', explain: 'You sleep in a bed at night.' },
    { id: 'q0302', prompt: 'Complete: "I ___ a student."',
      options: [{ id: 'a', text: 'am' }, { id: 'b', text: 'is' }, { id: 'c', text: 'are' }, { id: 'd', text: 'be' }],
      correct: 'a', explain: 'With "I" we use "am": I am, you are, he/she is.' },
    { id: 'q0303', prompt: 'Which one do you wear on your feet?',
      options: [{ id: 'a', text: 'A hat' }, { id: 'b', text: 'Gloves' }, { id: 'c', text: 'Shoes' }, { id: 'd', text: 'A scarf' }],
      correct: 'c', explain: 'Shoes go on your feet. Hats, gloves and scarves go elsewhere!' },
    { id: 'q0304', prompt: 'Complete: "She ___ to school every day."',
      options: [{ id: 'a', text: 'go' }, { id: 'b', text: 'goes' }, { id: 'c', text: 'going' }, { id: 'd', text: 'gone' }],
      correct: 'b', explain: 'With he/she/it in the present simple we add -s: she goes.' },
  ]},
  { level: 4, cefr: 'A2', title: 'Daily Routine', questions: [
    { id: 'q0401', prompt: 'Complete: "I usually ___ up at seven o\'clock."',
      options: [{ id: 'a', text: 'wake' }, { id: 'b', text: 'get' }, { id: 'c', text: 'stand' }, { id: 'd', text: 'take' }],
      correct: 'b', explain: 'The expression is "get up" — it means leave your bed.' },
    { id: 'q0402', prompt: 'What do we call the meal you eat in the morning?',
      options: [{ id: 'a', text: 'Lunch' }, { id: 'b', text: 'Supper' }, { id: 'c', text: 'Breakfast' }, { id: 'd', text: 'Dinner' }],
      correct: 'c', explain: 'Morning meal = breakfast, midday = lunch, evening = dinner.' },
    { id: 'q0403', prompt: 'The clock shows 9:15. We say "quarter ___ nine".',
      options: [{ id: 'a', text: 'past' }, { id: 'b', text: 'to' }, { id: 'c', text: 'at' }, { id: 'd', text: 'on' }],
      correct: 'a', explain: 'After the hour we use "past": 9:15 = quarter past nine.' },
    { id: 'q0404', prompt: 'Which day comes right after Monday?',
      options: [{ id: 'a', text: 'Sunday' }, { id: 'b', text: 'Wednesday' }, { id: 'c', text: 'Friday' }, { id: 'd', text: 'Tuesday' }],
      correct: 'd', explain: 'The week order: Monday, Tuesday, Wednesday…' },
  ]},
  { level: 5, cefr: 'A2', title: 'The Past & Feelings', questions: [
    { id: 'q0501', prompt: 'Complete: "Yesterday we ___ a great film."',
      options: [{ id: 'a', text: 'watch' }, { id: 'b', text: 'watched' }, { id: 'c', text: 'watching' }, { id: 'd', text: 'watches' }],
      correct: 'b', explain: 'Finished past actions use the past simple: watch → watched.' },
    { id: 'q0502', prompt: 'You won the game! You feel very …',
      options: [{ id: 'a', text: 'angry' }, { id: 'b', text: 'tired' }, { id: 'c', text: 'happy' }, { id: 'd', text: 'afraid' }],
      correct: 'c', explain: 'Winning something good usually makes you happy.' },
    { id: 'q0503', prompt: 'Complete: "She ___ to the beach last summer."',
      options: [{ id: 'a', text: 'goes' }, { id: 'b', text: 'went' }, { id: 'c', text: 'goed' }, { id: 'd', text: 'going' }],
      correct: 'b', explain: '"Go" is irregular: go → went → gone.' },
    { id: 'q0504', prompt: 'He was ill, so he ___ go to school yesterday.',
      options: [{ id: 'a', text: 'didn\'t' }, { id: 'b', text: 'don\'t' }, { id: 'c', text: 'doesn\'t' }, { id: 'd', text: 'isn\'t' }],
      correct: 'a', explain: 'Past simple negatives use "didn\'t" + base verb.' },
  ]},
  { level: 6, cefr: 'A2', title: 'Where Things Are', questions: [
    { id: 'q0601', prompt: 'The cat is hiding ___ the table — you can\'t see it!',
      options: [{ id: 'a', text: 'under' }, { id: 'b', text: 'on' }, { id: 'c', text: 'between' }, { id: 'd', text: 'behind' }],
      correct: 'a', explain: '"Under" means below something: the cat is under the table.' },
    { id: 'q0602', prompt: 'Complete: "We arrived ___ Paris on Friday."',
      options: [{ id: 'a', text: 'at' }, { id: 'b', text: 'in' }, { id: 'c', text: 'to' }, { id: 'd', text: 'on' }],
      correct: 'b', explain: 'Arrive in a city or country, arrive at a place like a station.' },
    { id: 'q0603', prompt: 'Please put the milk ___ the fridge.',
      options: [{ id: 'a', text: 'on' }, { id: 'b', text: 'in' }, { id: 'c', text: 'between' }, { id: 'd', text: 'next' }],
      correct: 'b', explain: '"In" = inside: the milk goes inside the fridge.' },
    { id: 'q0604', prompt: 'The bank is ___ the post office and the library.',
      options: [{ id: 'a', text: 'between' }, { id: 'b', text: 'above' }, { id: 'c', text: 'under' }, { id: 'd', text: 'in' }],
      correct: 'a', explain: '"Between" describes a place in the middle of two others.' },
  ]},
  { level: 7, cefr: 'B1', title: 'Experiences', questions: [
    { id: 'q0701', prompt: 'Complete: "Have you ___ visited London?"',
      options: [{ id: 'a', text: 'never' }, { id: 'b', text: 'ever' }, { id: 'c', text: 'yet' }, { id: 'd', text: 'already' }],
      correct: 'b', explain: 'Questions about experience use "ever": Have you ever…?' },
    { id: 'q0702', prompt: 'Complete: "She\'s lived here ___ 2015."',
      options: [{ id: 'a', text: 'for' }, { id: 'b', text: 'since' }, { id: 'c', text: 'from' }, { id: 'd', text: 'during' }],
      correct: 'b', explain: '"Since" + a point in time (2015); "for" + a length of time (eight years).' },
    { id: 'q0703', prompt: 'Complete: "I\'ve ___ finished my homework, so I can play now."',
      options: [{ id: 'a', text: 'yet' }, { id: 'b', text: 'still' }, { id: 'c', text: 'already' }, { id: 'd', text: 'ever' }],
      correct: 'c', explain: '"Already" = earlier than expected, in positive sentences.' },
    { id: 'q0704', prompt: 'Complete: "We haven\'t decided ___. Give us more time."',
      options: [{ id: 'a', text: 'yet' }, { id: 'b', text: 'already' }, { id: 'c', text: 'ever' }, { id: 'd', text: 'never' }],
      correct: 'a', explain: '"Yet" appears in negatives and questions at the end: not… yet.' },
  ]},
  { level: 8, cefr: 'B1', title: 'Compare & Travel', questions: [
    { id: 'q0801', prompt: 'Complete: "This train is ___ than the bus."',
      options: [{ id: 'a', text: 'fast' }, { id: 'b', text: 'faster' }, { id: 'c', text: 'the fastest' }, { id: 'd', text: 'more fast' }],
      correct: 'b', explain: 'Short adjectives add -er for comparisons: fast → faster.' },
    { id: 'q0802', prompt: 'Complete: "It\'s ___ hotel in the city — nothing costs more!"',
      options: [{ id: 'a', text: 'the most expensive' }, { id: 'b', text: 'more expensive' }, { id: 'c', text: 'expensiver' }, { id: 'd', text: 'most expensive' }],
      correct: 'a', explain: 'Superlatives of long adjectives: the most + adjective.' },
    { id: 'q0803', prompt: 'At the airport, you ___ before your flight.',
      options: [{ id: 'a', text: 'check in' }, { id: 'b', text: 'check out' }, { id: 'c', text: 'check up' }, { id: 'd', text: 'check off' }],
      correct: 'a', explain: '"Check in" = show your ticket and leave your luggage.' },
    { id: 'q0804', prompt: 'The plane couldn\'t leave because of fog — the flight was …',
      options: [{ id: 'a', text: 'arrived' }, { id: 'b', text: 'booked' }, { id: 'c', text: 'delayed' }, { id: 'd', text: 'cancelled out' }],
      correct: 'c', explain: '"Delayed" = leaving later than planned. Fog often delays flights.' },
  ]},
  { level: 9, cefr: 'B1', title: 'Phrasal Starter', questions: [
    { id: 'q0901', prompt: 'Complete: "Can you ___ this form and return it to me?"',
      options: [{ id: 'a', text: 'fill in' }, { id: 'b', text: 'fill over' }, { id: 'c', text: 'fill up on' }, { id: 'd', text: 'full in' }],
      correct: 'a', explain: '"Fill in a form" = write your details in it.' },
    { id: 'q0902', prompt: 'We should ___ early tomorrow — the meeting is at seven.',
      options: [{ id: 'a', text: 'set off' }, { id: 'b', text: 'set up' }, { id: 'c', text: 'set in' }, { id: 'd', text: 'set about' }],
      correct: 'a', explain: '"Set off" = begin a journey.' },
    { id: 'q0903', prompt: 'They ___ their own company last year and it\'s doing well.',
      options: [{ id: 'a', text: 'put up' }, { id: 'b', text: 'set up' }, { id: 'c', text: 'got up' }, { id: 'd', text: 'took up' }],
      correct: 'b', explain: '"Set up a company" = start a business.' },
    { id: 'q0904', prompt: 'It\'s hard, but don\'t ___ — we can finish it together!',
      options: [{ id: 'a', text: 'give up' }, { id: 'b', text: 'give in to' }, { id: 'c', text: 'give away' }, { id: 'd', text: 'give out' }],
      correct: 'a', explain: '"Give up" = stop trying.' },
  ]},
  { level: 10, cefr: 'B2', title: 'Conditionals', questions: [
    { id: 'q1001', prompt: 'Complete: "If I ___ more time, I would learn the guitar."',
      options: [{ id: 'a', text: 'have' }, { id: 'b', text: 'had' }, { id: 'c', text: 'will have' }, { id: 'd', text: 'would have' }],
      correct: 'b', explain: 'Second conditional: if + past simple, would + verb.' },
    { id: 'q1002', prompt: 'Complete: "If it rains tomorrow, we ___ the picnic."',
      options: [{ id: 'a', text: 'would cancel' }, { id: 'b', text: 'cancelled' }, { id: 'c', text: 'will cancel' }, { id: 'd', text: 'will cancelled' }],
      correct: 'c', explain: 'First conditional: if + present simple, will + verb.' },
    { id: 'q1003', prompt: 'Complete: "I wish I ___ how to sail."',
      options: [{ id: 'a', text: 'know' }, { id: 'b', text: 'knew' }, { id: 'c', text: 'will know' }, { id: 'd', text: 'am knowing' }],
      correct: 'b', explain: 'After "I wish" we use the past simple for unreal present wishes.' },
    { id: 'q1004', prompt: 'She would have passed if she ___ harder.',
      options: [{ id: 'a', text: 'studied' }, { id: 'b', text: 'had studied' }, { id: 'c', text: 'studies' }, { id: 'd', text: 'would study' }],
      correct: 'b', explain: 'Third conditional: if + had + past participle, would have + participle.' },
  ]},
  { level: 11, cefr: 'B2', title: 'Passive & Reports', questions: [
    { id: 'q1101', prompt: 'Complete: "The bridge ___ in 1932."',
      options: [{ id: 'a', text: 'was built' }, { id: 'b', text: 'built' }, { id: 'c', text: 'is building' }, { id: 'd', text: 'has built' }],
      correct: 'a', explain: 'Past passive: was/were + past participle. The bridge didn\'t build itself!' },
    { id: 'q1102', prompt: 'Complete: "The results ___ tomorrow morning."',
      options: [{ id: 'a', text: 'will announce' }, { id: 'b', text: 'will be announced' }, { id: 'c', text: 'are announcing' }, { id: 'd', text: 'announced' }],
      correct: 'b', explain: 'Future passive: will be + past participle.' },
    { id: 'q1103', prompt: 'He said he ___ very tired after the journey.',
      options: [{ id: 'a', text: 'is' }, { id: 'b', text: 'was' }, { id: 'c', text: 'will be' }, { id: 'd', text: 'be' }],
      correct: 'b', explain: 'In reported speech, present usually shifts to past: is → was.' },
    { id: 'q1104', prompt: 'English ___ as an official language in many countries.',
      options: [{ id: 'a', text: 'speaks' }, { id: 'b', text: 'is speaking' }, { id: 'c', text: 'is spoken' }, { id: 'd', text: 'spoken' }],
      correct: 'c', explain: 'Present simple passive: am/is/are + past participle.' },
  ]},
  { level: 12, cefr: 'B2', title: 'Idiom Bank', questions: [
    { id: 'q1201', prompt: 'Complete: "It\'s raining ___ — take an umbrella!"',
      options: [{ id: 'a', text: 'cats and dogs' }, { id: 'b', text: 'horses and goats' }, { id: 'c', text: 'birds and bees' }, { id: 'd', text: 'lions and tigers' }],
      correct: 'a', explain: '"Raining cats and dogs" = raining very heavily.' },
    { id: 'q1202', prompt: 'She was over the ___ about her promotion.',
      options: [{ id: 'a', text: 'cloud' }, { id: 'b', text: 'moon' }, { id: 'c', text: 'roof' }, { id: 'd', text: 'hill' }],
      correct: 'b', explain: '"Over the moon" = extremely happy.' },
    { id: 'q1203', prompt: 'Complete: "Once ___ a time, there was a little dragon."',
      options: [{ id: 'a', text: 'upon' }, { id: 'b', text: 'on' }, { id: 'c', text: 'up' }, { id: 'd', text: 'in' }],
      correct: 'a', explain: 'Fairy stories in English begin "Once upon a time…"' },
    { id: 'q1204', prompt: 'Good news — we finally see eye to ___ on the plan.',
      options: [{ id: 'a', text: 'nose' }, { id: 'b', text: 'ear' }, { id: 'c', text: 'eye' }, { id: 'd', text: 'mouth' }],
      correct: 'c', explain: '"See eye to eye" = agree completely with someone.' },
  ]},
  { level: 13, cefr: 'C1', title: 'Advanced Idioms', questions: [
    { id: 'q1301', prompt: 'The new policy is a double-edged …',
      options: [{ id: 'a', text: 'knife' }, { id: 'b', text: 'sword' }, { id: 'c', text: 'blade' }, { id: 'd', text: 'spear' }],
      correct: 'b', explain: 'A "double-edged sword" brings benefits and problems at the same time.' },
    { id: 'q1302', prompt: 'After years of rivalry, the two firms finally buried the …',
      options: [{ id: 'a', text: 'axe' }, { id: 'b', text: 'hatchet' }, { id: 'c', text: 'conflict' }, { id: 'd', text: 'spear' }],
      correct: 'b', explain: '"Bury the hatchet" = end a quarrel and make peace.' },
    { id: 'q1303', prompt: 'Her speech struck the right ___ between serious and funny.',
      options: [{ id: 'a', text: 'chord' }, { id: 'b', text: 'cord' }, { id: 'c', text: 'note' }, { id: 'd', text: 'tone' }],
      correct: 'c', explain: '"Strike the right note" = create exactly the right impression.' },
    { id: 'q1304', prompt: 'The evidence for that theory is thin on the …',
      options: [{ id: 'a', text: 'floor' }, { id: 'b', text: 'land' }, { id: 'c', text: 'ground' }, { id: 'd', text: 'earth' }],
      correct: 'c', explain: '"Thin on the ground" = rare, not much of it about.' },
  ]},
  { level: 14, cefr: 'C1', title: 'Style & Structure', questions: [
    { id: 'q1401', prompt: 'Which request is the most formal?',
      options: [{ id: 'a', text: 'Gimme a hand, will you?' }, { id: 'b', text: 'Can you help me?' },
                 { id: 'c', text: 'I wonder if you could help me.' }, { id: 'd', text: 'Help me now.' }],
      correct: 'c', explain: '"I wonder if you could…" is a polite, formal indirect request.' },
    { id: 'q1402', prompt: 'Complete: "Rarely ___ such dedication in a young athlete."',
      options: [{ id: 'a', text: 'we have seen' }, { id: 'b', text: 'have we seen' }, { id: 'c', text: 'we saw' }, { id: 'd', text: 'did we saw' }],
      correct: 'b', explain: 'After a negative adverb like "rarely", the verb inverts: rarely have we seen.' },
    { id: 'q1403', prompt: 'The manager insisted that the report ___ rewritten.',
      options: [{ id: 'a', text: 'is' }, { id: 'b', text: 'was' }, { id: 'c', text: 'be' }, { id: 'd', text: 'will be' }],
      correct: 'c', explain: 'After "insist that", formal English uses the subjunctive base form: be.' },
    { id: 'q1404', prompt: 'Complete: "Not until the results arrived ___ the scale of the problem."',
      options: [{ id: 'a', text: 'we realised' }, { id: 'b', text: 'did we realise' }, { id: 'c', text: 'we did realise' }, { id: 'd', text: 'realised we' }],
      correct: 'b', explain: '"Not until…" at the front triggers inversion: did we realise.' },
  ]},
  { level: 15, cefr: 'C2', title: 'Fine Nuance', questions: [
    { id: 'q1501', prompt: 'Her explanation was confusing and hard to follow — it was rather …',
      options: [{ id: 'a', text: 'convoluted' }, { id: 'b', text: 'conclusive' }, { id: 'c', text: 'conducive' }, { id: 'd', text: 'congenial' }],
      correct: 'a', explain: '"Convoluted" = unnecessarily complicated and twisted.' },
    { id: 'q1502', prompt: 'The two theories are not mutually …; both can be true.',
      options: [{ id: 'a', text: 'exclusive' }, { id: 'b', text: 'exhaustive' }, { id: 'c', text: 'expressive' }, { id: 'd', text: 'excusable' }],
      correct: 'a', explain: '"Mutually exclusive" = impossible together at the same time.' },
    { id: 'q1503', prompt: 'He gave a ___ account of his travels, sparing no detail.',
      options: [{ id: 'a', text: 'mendacious' }, { id: 'b', text: 'meticulous' }, { id: 'c', text: 'mercurial' }, { id: 'd', text: 'mediocre' }],
      correct: 'b', explain: '"Meticulous" = extremely careful and precise, detail by detail.' },
    { id: 'q1504', prompt: 'Her closing remarks only ___ the tension in the room.',
      options: [{ id: 'a', text: 'alleviated' }, { id: 'b', text: 'placated' }, { id: 'c', text: 'exacerbated' }, { id: 'd', text: 'mitigated' }],
      correct: 'c', explain: '"Exacerbate" = make worse. The others all mean calm or reduce.' },
  ]},
];

// Validate the whole bank at load; throws loudly in dev so malformed content
// can never start a playable round silently.
export function validateLevels() {
  const errors = [];
  const ids = new Set();
  if (LEVELS.length !== 15) errors.push(`expected 15 levels, got ${LEVELS.length}`);
  LEVELS.forEach((lv) => {
    if (lv.questions.length !== 4) errors.push(`level ${lv.level}: expected 4 questions, got ${lv.questions.length}`);
    lv.questions.forEach((q, i) => {
      const tag = `${lv.level}#${i + 1}`;
      if (!q.id || ids.has(q.id)) errors.push(`${tag}: duplicate/missing id ${q.id}`);
      ids.add(q.id);
      if (!q.prompt || q.prompt.length < 8) errors.push(`${tag}: bad prompt`);
      if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`${tag}: needs exactly 4 options`);
      const optIds = new Set(q.options.map((o) => o.id));
      const texts = new Set(q.options.map((o) => o.text.trim().toLowerCase()));
      if (optIds.size !== 4) errors.push(`${tag}: option ids not unique`);
      if (texts.size !== 4) errors.push(`${tag}: option texts not unique`);
      if (!optIds.has(q.correct)) errors.push(`${tag}: correct id ${q.correct} not among options`);
      if (!q.explain || q.explain.length < 4) errors.push(`${tag}: missing explanation`);
    });
  });
  if (errors.length) throw new Error(`question bank invalid:\n  ${errors.join('\n  ')}`);
  return true;
}

// Shuffle whole option objects (correctness travels with the id).
export function shuffledOptions(question, rng) {
  const arr = question.options.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
