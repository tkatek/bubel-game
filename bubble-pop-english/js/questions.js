// Bubble Pop English — question bank.
// 15 levels × 4 questions = 60 items, A1 (beginner) → C2 (proficient).
// CEFR labels are content guidance only, not a certification claim.
// Data is pure content: no mechanics live here.
//
// Question schema (validated by validateLevels):
//   id        unique string
//   level     1–15            cefr    must match CEFR_FOR_LEVEL
//   type      key of QUESTION_TYPES (drives the card label + feedback nudge)
//   skill     short topic tag (documentation / future filtering)
//   prompt    the question, plain text — no HTML ever
//   context   optional array of dialogue lines: 'plain string' or
//             { who, line } for speakers; rendered as separate lines
//   options   exactly 4 objects with stable ids a,b,c,d
//   correct   one of those ids — exactly one unambiguous winner
//   explain   teaches why the answer works (+ common error where useful)

export const CEFR_FOR_LEVEL = [
  'A1', 'A1', 'A1',            // 1–3  beginner
  'A2', 'A2',                  // 4–5  elementary
  'B1', 'B1', 'B1',            // 6–8  intermediate
  'B2', 'B2', 'B2',            // 9–11 upper intermediate
  'C1', 'C1',                  // 12–13 advanced
  'C2', 'C2',                  // 14–15 proficient
];

// Card labels + the gentle hint shown after a wrong pick (never reveals
// the answer — the learner retries the same question).
export const QUESTION_TYPES = {
  vocab:        { label: 'Vocabulary',   nudge: 'Look for the word that matches the meaning asked for.' },
  grammar:      { label: 'Grammar',      nudge: 'Check the subject and the tense — do they agree?' },
  synonym:      { label: 'Synonyms',     nudge: 'Find the closest meaning, not just a related word.' },
  opposite:     { label: 'Opposites',    nudge: 'You need the word with the reverse meaning.' },
  correction:   { label: 'Correction',   nudge: 'Test each sentence word by word — only one is fully correct.' },
  conversation: { label: 'Conversation', nudge: 'Think about the most natural, polite reply in this situation.' },
  collocation:  { label: 'Collocation',  nudge: 'Some words travel together — find the natural pair.' },
  phrasal:      { label: 'Phrasal verb', nudge: 'The little word (in, off, up) changes the whole meaning.' },
  preposition:  { label: 'Preposition',  nudge: 'Small words, big difference — check the time or place rule.' },
  idiom:        { label: 'Idiom',        nudge: 'Idioms are fixed phrases — only one word completes the image.' },
  reading:      { label: 'Reading',      nudge: 'Re-read the text — the answer must be stated or clearly implied.' },
};

export const LEVELS = [
  // ---- A1 ---------------------------------------------------------------
  { level: 1, cefr: 'A1', title: 'Hello & Basics', questions: [
    { id: 'L01-Q1', level: 1, cefr: 'A1', type: 'vocab', skill: 'word meaning',
      prompt: 'Which word means the place where children go to learn?',
      options: [{ id: 'a', text: 'School' }, { id: 'b', text: 'Kitchen' }, { id: 'c', text: 'Garden' }, { id: 'd', text: 'Airport' }],
      correct: 'a',
      explain: 'A school is where pupils learn with teachers. A kitchen is for cooking, a garden grows plants, and an airport is where planes land.' },
    { id: 'L01-Q2', level: 1, cefr: 'A1', type: 'opposite', skill: 'basic adjectives',
      prompt: "Choose the opposite of 'big'.",
      options: [{ id: 'a', text: 'Tall' }, { id: 'b', text: 'Small' }, { id: 'c', text: 'Long' }, { id: 'd', text: 'Fast' }],
      correct: 'b',
      explain: "'Small' is the direct opposite of 'big': a small mouse, a big elephant. Tall and long measure height and length; fast is about speed." },
    { id: 'L01-Q3', level: 1, cefr: 'A1', type: 'grammar', skill: 'verb "be"',
      prompt: "Complete: 'I ___ a pupil.'",
      options: [{ id: 'a', text: 'is' }, { id: 'b', text: 'are' }, { id: 'c', text: 'am' }, { id: 'd', text: 'be' }],
      correct: 'c',
      explain: "With 'I' we always use 'am': I am. 'Is' goes with he/she/it, and 'are' goes with you/we/they." },
    { id: 'L01-Q4', level: 1, cefr: 'A1', type: 'conversation', skill: 'greetings',
      prompt: 'Choose the most natural reply to Mia.',
      context: [{ who: 'Mia', line: 'Hello! How are you?' }],
      options: [{ id: 'a', text: 'It is Tuesday.' }, { id: 'b', text: 'Fine, thanks — and you?' }, { id: 'c', text: 'I live near the park.' }, { id: 'd', text: 'Yes, please.' }],
      correct: 'b',
      explain: "'How are you?' asks how you feel, so we answer 'Fine, thanks — and you?' and return the question. The other replies answer completely different questions." },
  ]},
  { level: 2, cefr: 'A1', title: 'Family & Numbers', questions: [
    { id: 'L02-Q1', level: 2, cefr: 'A1', type: 'grammar', skill: 'have/has',
      prompt: "Complete: 'We ___ three cats and a dog.'",
      options: [{ id: 'a', text: 'has' }, { id: 'b', text: 'have' }, { id: 'c', text: 'is' }, { id: 'd', text: 'does' }],
      correct: 'b',
      explain: "We/you/they take 'have'; 'has' is only for he/she/it: she has two cats." },
    { id: 'L02-Q2', level: 2, cefr: 'A1', type: 'vocab', skill: 'family words',
      prompt: "What do you call your mother's mother?",
      options: [{ id: 'a', text: 'My aunt' }, { id: 'b', text: 'My cousin' }, { id: 'c', text: 'My grandmother' }, { id: 'd', text: 'My niece' }],
      correct: 'c',
      explain: "Your parents' parents are your grandparents. An aunt is your parent's sister, and a niece is your brother's or sister's daughter." },
    { id: 'L02-Q3', level: 2, cefr: 'A1', type: 'synonym', skill: 'near-synonyms',
      prompt: "Which word means almost the same as 'little'?",
      options: [{ id: 'a', text: 'small' }, { id: 'b', text: 'tall' }, { id: 'c', text: 'loud' }, { id: 'd', text: 'quick' }],
      correct: 'a',
      explain: "'Little' and 'small' both mean not big — near-synonyms. 'Almost the same as' tells you to look for the closest meaning." },
    { id: 'L02-Q4', level: 2, cefr: 'A1', type: 'conversation', skill: 'thanking',
      prompt: 'Choose the most natural reply to Tom.',
      context: [{ who: 'Tom', line: 'Thank you for helping me with my homework.' }],
      options: [{ id: 'a', text: "You're welcome!" }, { id: 'b', text: 'I am nine years old.' }, { id: 'c', text: 'The homework is red.' }, { id: 'd', text: 'Good night!' }],
      correct: 'a',
      explain: "After 'thank you' the natural answer is 'You're welcome' (or 'No problem', 'My pleasure'). The other replies answer different questions entirely." },
  ]},
  { level: 3, cefr: 'A1', title: 'Everyday Things', questions: [
    { id: 'L03-Q1', level: 3, cefr: 'A1', type: 'vocab', skill: 'household words',
      prompt: 'In which room do you cook dinner?',
      options: [{ id: 'a', text: 'bedroom' }, { id: 'b', text: 'kitchen' }, { id: 'c', text: 'bathroom' }, { id: 'd', text: 'garage' }],
      correct: 'b',
      explain: 'Cooking happens in the kitchen. The bedroom is for sleeping, the bathroom for washing, and the garage for the car.' },
    { id: 'L03-Q2', level: 3, cefr: 'A1', type: 'grammar', skill: 'present simple -s',
      prompt: "Complete: 'She ___ to school by bus.'",
      options: [{ id: 'a', text: 'go' }, { id: 'b', text: 'goes' }, { id: 'c', text: 'going' }, { id: 'd', text: 'gone' }],
      correct: 'b',
      explain: "With he/she/it in the present simple we add -s: she goes. 'She go' is the single most common present-simple mistake." },
    { id: 'L03-Q3', level: 3, cefr: 'A1', type: 'opposite', skill: 'basic adjectives',
      prompt: "Choose the opposite of 'open'.",
      options: [{ id: 'a', text: 'closed' }, { id: 'b', text: 'full' }, { id: 'c', text: 'heavy' }, { id: 'd', text: 'wide' }],
      correct: 'a',
      explain: "An open door, a closed door. 'Full' is the opposite of empty, 'heavy' of light, and 'wide' of narrow." },
    { id: 'L03-Q4', level: 3, cefr: 'A1', type: 'correction', skill: 'have/has + articles',
      prompt: 'Which sentence is correct?',
      options: [{ id: 'a', text: 'He have a red bike.' }, { id: 'b', text: 'He has a red bike.' }, { id: 'c', text: 'He has an red bike.' }, { id: 'd', text: 'He is have a red bike.' }],
      correct: 'b',
      explain: "With he/she/it we use 'has', and 'bike' starts with a consonant sound so it takes 'a', not 'an'. 'Is have' glues two verbs together that cannot stand alone." },
  ]},
  // ---- A2 ---------------------------------------------------------------
  { level: 4, cefr: 'A2', title: 'Daily Routine', questions: [
    { id: 'L04-Q1', level: 4, cefr: 'A2', type: 'vocab', skill: 'food & meals',
      prompt: 'What do we call the meal you eat in the morning?',
      options: [{ id: 'a', text: 'Lunch' }, { id: 'b', text: 'Supper' }, { id: 'c', text: 'Breakfast' }, { id: 'd', text: 'Picnic' }],
      correct: 'c',
      explain: "'Breakfast' literally breaks the night's fast. Lunch is the midday meal, dinner or supper the evening one, and a picnic is eaten outdoors." },
    { id: 'L04-Q2', level: 4, cefr: 'A2', type: 'grammar', skill: 'present simple plurals',
      prompt: "Complete: 'They ___ football on Saturdays.'",
      options: [{ id: 'a', text: 'plays' }, { id: 'b', text: 'play' }, { id: 'c', text: 'playing' }, { id: 'd', text: 'are play' }],
      correct: 'b',
      explain: "In the present simple, we/you/they take the plain verb: they play. Only he/she/it adds -s, and 'are play' is never correct." },
    { id: 'L04-Q3', level: 4, cefr: 'A2', type: 'preposition', skill: 'prepositions of time',
      prompt: "Complete: 'My birthday is ___ May.'",
      options: [{ id: 'a', text: 'on' }, { id: 'b', text: 'at' }, { id: 'c', text: 'to' }, { id: 'd', text: 'in' }],
      correct: 'd',
      explain: "Months take 'in' (in May, in 2026), single days take 'on' (on Monday, on 3 May), and clock times take 'at' (at six o'clock)." },
    { id: 'L04-Q4', level: 4, cefr: 'A2', type: 'conversation', skill: 'offers',
      prompt: 'Choose the most natural reply.',
      context: [{ who: 'Lena', line: 'Would you like some more tea?' }],
      options: [{ id: 'a', text: "You're welcome." }, { id: 'b', text: 'Yes, please — just a little.' }, { id: 'c', text: 'No, I am not, thanks.' }, { id: 'd', text: "It's very hot today." }],
      correct: 'b',
      explain: "To accept an offer we say 'Yes, please'; to refuse politely, 'No, thank you'. 'No, I am not' cannot answer 'would you like…', and the other replies ignore the offer." },
  ]},
  { level: 5, cefr: 'A2', title: 'The Past', questions: [
    { id: 'L05-Q1', level: 5, cefr: 'A2', type: 'grammar', skill: 'past simple',
      prompt: "Complete: 'Yesterday we ___ a great film.'",
      options: [{ id: 'a', text: 'watch' }, { id: 'b', text: 'watched' }, { id: 'c', text: 'watching' }, { id: 'd', text: 'watches' }],
      correct: 'b',
      explain: "'Yesterday' marks a finished time, so the past simple is required: watch → watched. 'Watches' belongs to the present with he/she/it." },
    { id: 'L05-Q2', level: 5, cefr: 'A2', type: 'correction', skill: 'irregular past',
      prompt: 'Which sentence uses the past simple correctly?',
      options: [{ id: 'a', text: 'I goed to the park.' }, { id: 'b', text: 'I gone to the park.' }, { id: 'c', text: 'I went to the park.' }, { id: 'd', text: 'I go to the park yesterday.' }],
      correct: 'c',
      explain: "'Go' is irregular: go → went, never 'goed'. 'Gone' needs an auxiliary (I have gone), and option (d) mixes present 'go' with 'yesterday'." },
    { id: 'L05-Q3', level: 5, cefr: 'A2', type: 'opposite', skill: 'character adjectives',
      prompt: "Choose the opposite of 'generous'.",
      options: [{ id: 'a', text: 'Selfish' }, { id: 'b', text: 'Kind' }, { id: 'c', text: 'Helpful' }, { id: 'd', text: 'Friendly' }],
      correct: 'a',
      explain: "Generous people give freely; selfish people keep things for themselves — direct opposites. Kind, helpful and friendly are all close to 'generous', not opposite to it." },
    { id: 'L05-Q4', level: 5, cefr: 'A2', type: 'conversation', skill: 'apologies',
      prompt: 'Choose the most natural reply to Omar.',
      context: [{ who: 'Omar', line: "Sorry I'm late — the bus was delayed." }],
      options: [{ id: 'a', text: 'I was born in May.' }, { id: 'b', text: "No problem — we haven't started yet." }, { id: 'c', text: 'Yes, I did.' }, { id: 'd', text: 'The bus is yellow.' }],
      correct: 'b',
      explain: "When someone apologises, we usually reassure them: 'No problem', 'That's OK', 'Don't worry'. The other replies ignore the apology completely." },
  ]},
  // ---- B1 ---------------------------------------------------------------
  { level: 6, cefr: 'B1', title: 'Getting Around', questions: [
    { id: 'L06-Q1', level: 6, cefr: 'B1', type: 'preposition', skill: 'arrive in/at',
      prompt: "Complete: 'We arrived ___ Rome at midnight, exhausted but happy.'",
      options: [{ id: 'a', text: 'at' }, { id: 'b', text: 'to' }, { id: 'c', text: 'on' }, { id: 'd', text: 'in' }],
      correct: 'd',
      explain: "We arrive IN a city or country but arrive AT a specific place (the hotel, the airport). 'Arrive to' is one of the most common learner errors in English." },
    { id: 'L06-Q2', level: 6, cefr: 'B1', type: 'grammar', skill: 'for/since',
      prompt: "Complete: 'She has lived here ___ 2020.'",
      options: [{ id: 'a', text: 'For' }, { id: 'b', text: 'Since' }, { id: 'c', text: 'During' }, { id: 'd', text: 'Until' }],
      correct: 'b',
      explain: "'Since' marks the starting point of an unfinished period (since 2020); 'for' marks its length (for six years). 'During' needs a noun like 'the summer', and 'until' marks an end point." },
    { id: 'L06-Q3', level: 6, cefr: 'B1', type: 'vocab', skill: 'travel words',
      prompt: 'At the check-in desk, the bags you hand over are called your…',
      options: [{ id: 'a', text: 'furniture' }, { id: 'b', text: 'luggage' }, { id: 'c', text: 'hardware' }, { id: 'd', text: 'groceries' }],
      correct: 'b',
      explain: "'Luggage' (UK) or 'baggage' (US) means the bags you travel with. Furniture, hardware and groceries name entirely different things." },
    { id: 'L06-Q4', level: 6, cefr: 'B1', type: 'conversation', skill: 'ordering food',
      prompt: 'Choose the most natural reply.',
      context: [{ who: 'Waiter', line: 'Are you ready to order?' }],
      options: [{ id: 'a', text: "Yes, I'll have the soup, please." }, { id: 'b', text: 'The soup is very hot today.' }, { id: 'c', text: 'I am order the pasta.' }, { id: 'd', text: 'Yes, it is.' }],
      correct: 'a',
      explain: "In restaurants we order with 'I'll have …, please' — polite and natural. The other options are off-topic or ungrammatical." },
  ]},
  { level: 7, cefr: 'B1', title: 'Experiences', questions: [
    { id: 'L07-Q1', level: 7, cefr: 'B1', type: 'grammar', skill: 'never/ever/already/yet',
      prompt: "Complete: 'I have ___ eaten sushi before — this is my first time.'",
      options: [{ id: 'a', text: 'ever' }, { id: 'b', text: 'already' }, { id: 'c', text: 'never' }, { id: 'd', text: 'yet' }],
      correct: 'c',
      explain: "'Never' gives the negative meaning 'at no time', which matches 'this is my first time'. 'Ever' lives in questions, 'already' in positives about things done sooner than expected, and 'yet' ends negatives and questions." },
    { id: 'L07-Q2', level: 7, cefr: 'B1', type: 'vocab', skill: 'strong adjectives',
      prompt: 'Which word means very tired?',
      options: [{ id: 'a', text: 'Excited' }, { id: 'b', text: 'Relaxed' }, { id: 'c', text: 'Exhausted' }, { id: 'd', text: 'Energetic' }],
      correct: 'c',
      explain: "'Exhausted' is a strong word meaning extremely tired — much stronger than plain 'tired'. 'Completely exhausted' is a very common collocation." },
    { id: 'L07-Q3', level: 7, cefr: 'B1', type: 'conversation', skill: 'giving advice',
      prompt: 'Sara asks for advice. Choose the best reply.',
      context: [{ who: 'Sara', line: 'I keep failing my driving test. What should I do?' }],
      options: [{ id: 'a', text: 'I have never driven a car in my life.' }, { id: 'b', text: 'Driving tests are cheaper in the summer.' }, { id: 'c', text: "You always fail everything, don't you?" }, { id: 'd', text: 'Why don\'t you take a few more lessons before trying again?' }],
      correct: 'd',
      explain: "Sara asks 'What should I do?', so a good reply suggests a solution — 'Why don't you…?' is friendly, practical advice. The others dodge the question or sound unkind." },
    { id: 'L07-Q4', level: 7, cefr: 'B1', type: 'synonym', skill: 'size adjectives',
      prompt: "Which word is closest in meaning to 'enormous'?",
      options: [{ id: 'a', text: 'Huge' }, { id: 'b', text: 'Tiny' }, { id: 'c', text: 'Weak' }, { id: 'd', text: 'Narrow' }],
      correct: 'a',
      explain: "'Enormous' and 'huge' both mean extremely big. 'Tiny' is the opposite, while 'weak' and 'narrow' describe other qualities." },
  ]},
  { level: 8, cefr: 'B1', title: 'Travel & Compare', questions: [
    { id: 'L08-Q1', level: 8, cefr: 'B1', type: 'phrasal', skill: 'travel phrasal verbs',
      prompt: 'At the airport, you show your passport and ticket when you ___ for your flight.',
      options: [{ id: 'a', text: 'check in' }, { id: 'b', text: 'check out' }, { id: 'c', text: 'check up' }, { id: 'd', text: 'check off' }],
      correct: 'a',
      explain: "'Check in' means report at the desk before a flight (or arrive at a hotel). 'Check out' is leaving a hotel, and 'check up on' means make sure someone is fine." },
    { id: 'L08-Q2', level: 8, cefr: 'B1', type: 'grammar', skill: 'comparatives',
      prompt: "Complete: 'This train is ___ than the bus.'",
      options: [{ id: 'a', text: 'fast' }, { id: 'b', text: 'faster' }, { id: 'c', text: 'the fastest' }, { id: 'd', text: 'more fast' }],
      correct: 'b',
      explain: "Two items are compared with -er: fast → faster. 'The fastest' ranks one against many, and 'more fast' doubles the comparison." },
    { id: 'L08-Q3', level: 8, cefr: 'B1', type: 'correction', skill: 'comparative forms',
      prompt: 'Which sentence is correct?',
      options: [{ id: 'a', text: 'My hotel is more cheap than yours.' }, { id: 'b', text: 'My hotel is more cheaper than yours.' }, { id: 'c', text: 'My hotel is cheapest than yours.' }, { id: 'd', text: 'My hotel is cheaper than yours.' }],
      correct: 'd',
      explain: "Short adjectives form the comparative with -er alone: cheap → cheaper. 'More cheaper' doubles the marker, and the superlative 'cheapest' cannot pair with 'than'." },
    { id: 'L08-Q4', level: 8, cefr: 'B1', type: 'reading', skill: 'notices',
      prompt: 'How much will two adults and one child pay in total?',
      context: ['MUSEUM NOTICE — We are closed on Mondays.',
                'Tickets: adults €12 · children €6 · last entry 5 p.m.'],
      options: [{ id: 'a', text: '€30' }, { id: 'b', text: '€36' }, { id: 'c', text: '€24' }, { id: 'd', text: '€18' }],
      correct: 'a',
      explain: 'Two adult tickets cost 2 × €12 = €24, plus one child ticket €6, giving €30. Reading notices for prices is a key real-life skill.' },
  ]},
  // ---- B2 ---------------------------------------------------------------
  { level: 9, cefr: 'B2', title: 'Phrasals & Idioms', questions: [
    { id: 'L09-Q1', level: 9, cefr: 'B2', type: 'phrasal', skill: 'SET phrasal verbs',
      prompt: "Complete: 'We should ___ early tomorrow — the meeting starts at seven sharp.'",
      options: [{ id: 'a', text: 'set off' }, { id: 'b', text: 'set up' }, { id: 'c', text: 'set in' }, { id: 'd', text: 'set about' }],
      correct: 'a',
      explain: "'Set off' means begin a journey. 'Set up' means start a business or arrange equipment, 'set in' describes weather or conditions settling in, and 'set about' means start doing a task." },
    { id: 'L09-Q2', level: 9, cefr: 'B2', type: 'idiom', skill: 'easy idioms',
      prompt: "Complete the idiom: 'The maths test was a piece of ___ — I finished in ten minutes.'",
      options: [{ id: 'a', text: 'bread' }, { id: 'b', text: 'pie' }, { id: 'c', text: 'cake' }, { id: 'd', text: 'toast' }],
      correct: 'c',
      explain: "'A piece of cake' means something very easy. The noun is fixed: swapping it breaks the idiom, which is why idioms must be learnt whole." },
    { id: 'L09-Q3', level: 9, cefr: 'B2', type: 'grammar', skill: 'second conditional',
      prompt: "Complete: 'If I ___ more time, I would learn the guitar.'",
      options: [{ id: 'a', text: 'have' }, { id: 'b', text: 'had' }, { id: 'c', text: 'will have' }, { id: 'd', text: 'would have' }],
      correct: 'b',
      explain: "Second conditional — an imaginary present: if + past simple, would + infinitive. Even with 'I', the unreal form is 'had'." },
    { id: 'L09-Q4', level: 9, cefr: 'B2', type: 'conversation', skill: 'refusing politely',
      prompt: 'Choose the most appropriate reply if you cannot stay.',
      context: [{ who: 'Colleague', line: 'Can you stay late to finish the report tonight?' }],
      options: [{ id: 'a', text: "I'm afraid I can't tonight, but I could come in early tomorrow." }, { id: 'b', text: 'No, absolutely not — never ask me again.' }, { id: 'c', text: 'Yes, of course I cannot.' }, { id: 'd', text: 'Why you ask me this question?' }],
      correct: 'a',
      explain: "At work we refuse politely and offer an alternative: 'I'm afraid I can't … but I could …'. It says no while keeping the relationship good." },
  ]},
  { level: 10, cefr: 'B2', title: 'Work & Conditionals', questions: [
    { id: 'L10-Q1', level: 10, cefr: 'B2', type: 'grammar', skill: 'third conditional',
      prompt: "Complete: 'She would have passed the exam if she ___ harder.'",
      options: [{ id: 'a', text: 'studied' }, { id: 'b', text: 'had studied' }, { id: 'c', text: 'studies' }, { id: 'd', text: 'would study' }],
      correct: 'b',
      explain: "Third conditional — an unreal past: if + had + past participle. The main clause 'would have passed' fixes the if-clause as 'had studied'." },
    { id: 'L10-Q2', level: 10, cefr: 'B2', type: 'correction', skill: 'first conditional',
      prompt: 'Which sentence is correct?',
      options: [{ id: 'a', text: 'If it will rain, we will stay home.' }, { id: 'b', text: 'If it raining, we will stay home.' }, { id: 'c', text: 'If it rains, we will stay home.' }, { id: 'd', text: 'If it rain, we will stay home.' }],
      correct: 'c',
      explain: "First conditional: the if-clause uses the present simple ('rains') and the result uses 'will'. Putting 'will' inside the if-clause — option (a) — is a classic error." },
    { id: 'L10-Q3', level: 10, cefr: 'B2', type: 'vocab', skill: 'work vocabulary',
      prompt: "Complete: 'I need to ___ for a new job — my contract ends next month.'",
      options: [{ id: 'a', text: 'apply' }, { id: 'b', text: 'hire' }, { id: 'c', text: 'employ' }, { id: 'd', text: 'recruit' }],
      correct: 'a',
      explain: "You apply FOR a job when you ask for it. Hire, employ and recruit are what the company does to people — the wrong side of the relationship here." },
    { id: 'L10-Q4', level: 10, cefr: 'B2', type: 'conversation', skill: 'handling complaints',
      prompt: 'Choose the best reply from the hotel receptionist.',
      context: [{ who: 'Guest', line: 'Excuse me, I asked for a room with a sea view, but mine faces the car park.' }],
      options: [{ id: 'a', text: 'The car park is also very nice.' }, { id: 'b', text: "I do apologize — I'll move you to a sea-view room right away." }, { id: 'c', text: 'You should have checked the view before booking.' }, { id: 'd', text: 'Sea views cost nothing extra here.' }],
      correct: 'b',
      explain: 'Good service accepts the complaint, apologises and fixes it immediately. The other replies dismiss the problem or blame the guest.' },
  ]},
  { level: 11, cefr: 'B2', title: 'News & Reports', questions: [
    { id: 'L11-Q1', level: 11, cefr: 'B2', type: 'grammar', skill: 'past passive',
      prompt: "Complete: 'The bridge ___ in 1932.'",
      options: [{ id: 'a', text: 'was built' }, { id: 'b', text: 'built' }, { id: 'c', text: 'is building' }, { id: 'd', text: 'has built' }],
      correct: 'a',
      explain: 'Past simple passive: was/were + past participle. The bridge did not build anything itself, so every active form leaves the sentence wrong.' },
    { id: 'L11-Q2', level: 11, cefr: 'B2', type: 'reading', skill: 'announcements',
      prompt: 'What must passengers for Flight BA204 do?',
      context: ["ANNOUNCEMENT — 'Passengers for Flight BA204 to New York:",
                "boarding closes in fifteen minutes at gate 12.'"],
      options: [{ id: 'a', text: 'Wait fifteen minutes before going to the gate.' }, { id: 'b', text: 'Go to gate 12 within the next fifteen minutes.' }, { id: 'c', text: 'Change to a different flight.' }, { id: 'd', text: 'Collect their luggage at gate 12.' }],
      correct: 'b',
      explain: "'Boarding closes in fifteen minutes' sets a deadline: reach gate 12 before those minutes pass. Option (a) quietly turns the deadline into a delay." },
    { id: 'L11-Q3', level: 11, cefr: 'B2', type: 'synonym', skill: 'abstract adjectives',
      prompt: "Which word is closest in meaning to 'essential'?",
      options: [{ id: 'a', text: 'optional' }, { id: 'b', text: 'ordinary' }, { id: 'c', text: 'necessary' }, { id: 'd', text: 'temporary' }],
      correct: 'c',
      explain: "'Essential' and 'necessary' both mean absolutely needed. Optional means you may choose, temporary means not lasting, and ordinary means not special." },
    { id: 'L11-Q4', level: 11, cefr: 'B2', type: 'correction', skill: 'reported questions',
      prompt: "Complete the reported question: 'Where do you live?' she asked me. → She asked me ___.",
      options: [{ id: 'a', text: 'where do I live.' }, { id: 'b', text: 'where I live do.' }, { id: 'c', text: 'where did I live.' }, { id: 'd', text: 'where I lived.' }],
      correct: 'd',
      explain: "Reported questions use statement word order — no 'do/did' inversion — and backshift the tense: 'Where do you live?' → 'She asked me where I lived.'" },
  ]},
  // ---- C1 ---------------------------------------------------------------
  { level: 12, cefr: 'C1', title: 'Idioms & Precision', questions: [
    { id: 'L12-Q1', level: 12, cefr: 'C1', type: 'idiom', skill: 'metaphor idioms',
      prompt: 'The new policy is a double-edged ___: it cuts costs but annoys long-time customers.',
      options: [{ id: 'a', text: 'sword' }, { id: 'b', text: 'knife' }, { id: 'c', text: 'blade' }, { id: 'd', text: 'spear' }],
      correct: 'a',
      explain: "'A double-edged sword' means something with both benefits and drawbacks. The metaphor is fixed — no other blade completes it." },
    { id: 'L12-Q2', level: 12, cefr: 'C1', type: 'collocation', skill: 'adjective + noun pairs',
      prompt: "Complete with the natural collocation: 'The forecast warns of ___ rain all weekend.'",
      options: [{ id: 'a', text: 'strong' }, { id: 'b', text: 'heavy' }, { id: 'c', text: 'big' }, { id: 'd', text: 'powerful' }],
      correct: 'b',
      explain: "Rain comes in strengths we call 'heavy' or 'light'. 'Strong rain' is a direct translation error from many languages — English pairs heavy/light with rain." },
    { id: 'L12-Q3', level: 12, cefr: 'C1', type: 'vocab', skill: 'character adjectives',
      prompt: 'Which word means able to recover quickly from difficulties?',
      options: [{ id: 'a', text: 'fragile' }, { id: 'b', text: 'resilient' }, { id: 'c', text: 'reluctant' }, { id: 'd', text: 'redundant' }],
      correct: 'b',
      explain: "'Resilient' describes people or materials that bounce back. Fragile means easily broken, reluctant means unwilling, and redundant means no longer needed." },
    { id: 'L12-Q4', level: 12, cefr: 'C1', type: 'conversation', skill: 'disagreeing professionally',
      prompt: 'You disagree with the plan. Choose the most professional reply.',
      context: [{ who: 'Manager', line: "I think we should launch in June. Don't you agree?" }],
      options: [{ id: 'a', text: "That's the worst idea I've ever heard." }, { id: 'b', text: 'June is a month with thirty days.' }, { id: 'c', text: "I see your point, but I'd suggest waiting until the testing is complete." }, { id: 'd', text: 'I am not agreeing nothing with you.' }],
      correct: 'c',
      explain: "Professional disagreement acknowledges the other view first ('I see your point') before giving a reason. Insults or irrelevant facts destroy the discussion." },
  ]},
  { level: 13, cefr: 'C1', title: 'Style & Nuance', questions: [
    { id: 'L13-Q1', level: 13, cefr: 'C1', type: 'idiom', skill: 'peace idioms',
      prompt: 'After years of rivalry, the two firms finally buried the ___ and agreed to work together.',
      options: [{ id: 'a', text: 'hatchet' }, { id: 'b', text: 'axe' }, { id: 'c', text: 'shovel' }, { id: 'd', text: 'bone' }],
      correct: 'a',
      explain: "'Bury the hatchet' means end a quarrel and make peace — from the custom of burying weapons. The noun is fixed, even though 'axe' sounds plausible." },
    { id: 'L13-Q2', level: 13, cefr: 'C1', type: 'collocation', skill: 'verb + noun pairs',
      prompt: "Complete the natural collocation: 'We worked all weekend to meet the ___.'",
      options: [{ id: 'a', text: 'closure' }, { id: 'b', text: 'deadlock' }, { id: 'c', text: 'finish' }, { id: 'd', text: 'deadline' }],
      correct: 'd',
      explain: "'Meet a deadline' is the fixed pair for finishing work on time. You reach a deadlock and a project reaches closure — those nouns take different verbs." },
    { id: 'L13-Q3', level: 13, cefr: 'C1', type: 'correction', skill: 'subjunctive',
      prompt: "Complete the formal sentence: 'The director insisted that the report ___ rewritten before Friday.'",
      options: [{ id: 'a', text: 'is' }, { id: 'b', text: 'was' }, { id: 'c', text: 'be' }, { id: 'd', text: 'will be' }],
      correct: 'c',
      explain: "After 'insist that' (also suggest/demand/recommend), formal English uses the base subjunctive: 'that the report be rewritten'. 'Was' would report a fact rather than a demand." },
    { id: 'L13-Q4', level: 13, cefr: 'C1', type: 'reading', skill: 'memos',
      prompt: 'What does the memo tell members with January–February memberships?',
      context: ['MEMO — To all members:',
                'The gym reopens on 3 March after maintenance works.',
                'January–February memberships will receive a one-month extension automatically.'],
      options: [{ id: 'a', text: 'They must collect a refund for two months.' }, { id: 'b', text: 'They will get an extra month without having to ask.' }, { id: 'c', text: 'They must buy a new card at the front desk.' }, { id: 'd', text: 'They receive free personal training in March.' }],
      correct: 'b',
      explain: "'Automatically' means the gym applies the extension itself — members take no action. No refund, new card or training is mentioned anywhere in the memo." },
  ]},
  { level: 14, cefr: 'C1', title: 'Register & Emphasis', questions: [
    { id: 'L14-Q1', level: 14, cefr: 'C1', type: 'grammar', skill: 'inversion',
      prompt: "Complete: 'Rarely ___ such dedication in such a young athlete.'",
      options: [{ id: 'a', text: 'we have seen' }, { id: 'b', text: 'have we seen' }, { id: 'c', text: 'we saw' }, { id: 'd', text: 'did we saw' }],
      correct: 'b',
      explain: "A negative or limiting adverb (rarely, seldom, never) at the front forces inversion: 'rarely have we seen'. 'Did we saw' mixes the auxiliary with a past form." },
    { id: 'L14-Q2', level: 14, cefr: 'C1', type: 'vocab', skill: 'formal register',
      prompt: "Which word best completes the formal sentence? 'Employees will ___ their salaries on the last working day of each month.'",
      options: [{ id: 'a', text: 'grab' }, { id: 'b', text: 'catch' }, { id: 'c', text: 'receive' }, { id: 'd', text: 'snatch' }],
      correct: 'c',
      explain: "'Receive' is the formal equivalent of 'get' for money or messages. 'Grab' and 'snatch' suggest taking roughly — the wrong register for an employment contract." },
    { id: 'L14-Q3', level: 14, cefr: 'C1', type: 'conversation', skill: 'negotiating',
      prompt: 'Choose the most appropriate reply from the salesperson.',
      context: [{ who: 'Client', line: 'Your price is 20% above our budget. Can anything be done?' }],
      options: [{ id: 'a', text: 'Our price is our price — take it or leave it.' }, { id: 'b', text: 'I understand the budget constraints — if you commit to a two-year contract, I can offer a 10% discount.' }, { id: 'c', text: 'Your budget is not my problem.' }, { id: 'd', text: 'Yes, everything can be done, maybe, perhaps.' }],
      correct: 'b',
      explain: "Good negotiation shows understanding and offers a conditional concession: 'if you …, I can …'. The alternatives shut the conversation down or promise nothing precisely." },
    { id: 'L14-Q4', level: 14, cefr: 'C1', type: 'idiom', skill: 'confusable idioms',
      prompt: "Complete the idiom: 'Her speech struck the right ___ between serious and funny.'",
      options: [{ id: 'a', text: 'chord' }, { id: 'b', text: 'cord' }, { id: 'c', text: 'string' }, { id: 'd', text: 'note' }],
      correct: 'd',
      explain: "'Strike the right note' means hit exactly the right style or balance. 'Strike a chord' also exists but means resonate with someone — and it never takes 'between'." },
  ]},
  // ---- C2 ---------------------------------------------------------------
  { level: 15, cefr: 'C2', title: 'Mastery', questions: [
    { id: 'L15-Q1', level: 15, cefr: 'C2', type: 'vocab', skill: 'connotation',
      prompt: 'Her explanation was so tangled and hard to follow that it seemed almost deliberately ___.',
      options: [{ id: 'a', text: 'convoluted' }, { id: 'b', text: 'conclusive' }, { id: 'c', text: 'conducive' }, { id: 'd', text: 'congenial' }],
      correct: 'a',
      explain: "'Convoluted' means unnecessarily complicated and twisted. 'Conclusive' means decisive, 'conducive' means helping something to happen, and 'congenial' means pleasant." },
    { id: 'L15-Q2', level: 15, cefr: 'C2', type: 'idiom', skill: 'idiom nuance',
      prompt: "Choose the idiom that completes the sentence: 'The CEO's resignation was ___ — everyone in the company had seen the scandal coming for months.'",
      options: [{ id: 'a', text: 'a bolt from the blue' }, { id: 'b', text: 'an open secret' }, { id: 'c', text: 'a blessing in disguise' }, { id: 'd', text: 'the tip of the iceberg' }],
      correct: 'b',
      explain: "'An open secret' is something unofficial that everybody knows — exactly what 'everyone had seen it coming' describes. 'A bolt from the blue' means the opposite: a total surprise." },
    { id: 'L15-Q3', level: 15, cefr: 'C2', type: 'correction', skill: 'agreement in formal style',
      prompt: 'Which sentence is correct in formal written English?',
      options: [{ id: 'a', text: 'Neither of the proposals were convincing.' }, { id: 'b', text: 'Neither of the proposal was convincing.' }, { id: 'c', text: "Neither of the proposals wasn't convincing." }, { id: 'd', text: 'Neither of the proposals was convincing.' }],
      correct: 'd',
      explain: "In formal usage 'neither of …' takes a singular verb: 'Neither … was convincing'. Option (c) also stacks a double negative, which reverses the intended meaning." },
    { id: 'L15-Q4', level: 15, cefr: 'C2', type: 'reading', skill: 'tone & inference',
      prompt: "What is the reviewer's overall judgement of the novel?",
      context: ["REVIEW — 'It is not that the novel is badly written — the prose glitters at times —",
                "but the plot twists feel engineered, and by the final chapter the reader has stopped caring who lives or dies.'"],
      options: [{ id: 'a', text: 'It is badly written from start to finish.' }, { id: 'b', text: "The plot twists are the novel's greatest strength." }, { id: 'c', text: 'It is technically accomplished but emotionally flat.' }, { id: 'd', text: 'The characters are deeply engaging throughout.' }],
      correct: 'c',
      explain: "The reviewer concedes the prose 'glitters' (technical skill) yet admits the reader has 'stopped caring' (emotional failure). 'Not that it is badly written' rules out option (a)." },
  ]},
];

// Validate the whole bank at load; throws loudly in dev so malformed content
// can never start a playable round silently. Also enforces the educational
// contract: CEFR progression, ≥3 challenge types per level, stable option
// ids, exactly one valid correct id, unique prompts, no raw HTML in content.
export function validateLevels() {
  const errors = [];
  const ids = new Set();
  const prompts = new Set();
  if (!Array.isArray(LEVELS) || LEVELS.length !== 15) {
    errors.push(`expected 15 levels, got ${LEVELS ? LEVELS.length : 'none'}`);
    throw new Error(`question bank invalid:\n  ${errors.join('\n  ')}`);
  }
  LEVELS.forEach((lv, li) => {
    const expectedCefr = CEFR_FOR_LEVEL[li];
    if (lv.level !== li + 1) errors.push(`level index ${li}: expected level ${li + 1}, got ${lv.level}`);
    if (lv.cefr !== expectedCefr) errors.push(`level ${lv.level}: cefr ${lv.cefr}, expected ${expectedCefr}`);
    if (!Array.isArray(lv.questions) || lv.questions.length !== 4) {
      errors.push(`level ${lv.level}: expected 4 questions, got ${lv.questions ? lv.questions.length : 'none'}`);
      return;
    }
    const types = new Set();
    lv.questions.forEach((q, i) => {
      const tag = `L${lv.level}#${i + 1}`;
      if (!q.id || ids.has(q.id)) errors.push(`${tag}: duplicate/missing id ${q.id}`);
      ids.add(q.id);
      if (q.level !== lv.level) errors.push(`${tag}: question.level ${q.level} != level ${lv.level}`);
      if (q.cefr !== expectedCefr) errors.push(`${tag}: cefr ${q.cefr}, expected ${expectedCefr}`);
      if (!QUESTION_TYPES[q.type]) errors.push(`${tag}: unknown type '${q.type}'`);
      else types.add(q.type);
      if (!q.prompt || q.prompt.trim().length < 8) errors.push(`${tag}: bad prompt`);
      const promptKey = q.prompt.trim().toLowerCase();
      if (prompts.has(promptKey)) errors.push(`${tag}: duplicate prompt (question reused)`);
      prompts.add(promptKey);
      if (q.context != null) {
        const ok = Array.isArray(q.context) && q.context.length > 0 && q.context.length <= 4 &&
          q.context.every((c) => (typeof c === 'string' && c.trim().length > 0) ||
            (c && typeof c === 'object' && typeof c.who === 'string' && typeof c.line === 'string' && c.line.trim().length > 0));
        if (!ok) errors.push(`${tag}: malformed context lines`);
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        errors.push(`${tag}: needs exactly 4 options`);
        return;
      }
      const optIds = q.options.map((o) => o.id);
      if (optIds.join(',') !== 'a,b,c,d') errors.push(`${tag}: option ids must be the stable set a,b,c,d (got ${optIds.join(',')})`);
      const texts = new Set(q.options.map((o) => String(o.text).trim().toLowerCase()));
      if (texts.size !== 4) errors.push(`${tag}: option texts must be 4 distinct choices`);
      if (!q.options.every((o) => typeof o.text === 'string' && o.text.trim().length > 0)) errors.push(`${tag}: empty option text`);
      if (!optIds.includes(q.correct)) errors.push(`${tag}: correct id '${q.correct}' not among options`);
      if (!q.explain || q.explain.trim().length < 12) errors.push(`${tag}: explanation missing or too short`);
      const htmlish = [q.prompt, q.explain, ...q.options.map((o) => o.text)].join(' ');
      if (/[<>]/.test(htmlish)) errors.push(`${tag}: raw HTML tags are not allowed in content`);
    });
    if (types.size < 3) errors.push(`level ${lv.level}: needs at least 3 different question types, got ${types.size}`);
  });
  if (errors.length) throw new Error(`question bank invalid:\n  ${errors.join('\n  ')}`);
  return true;
}

// Task-2 adaptive bubble labels: sentence-length answers never fit a bubble,
// so the question falls back to letter badges + the banner answer list.
export function needsLetterBadges(options) {
  return options.some((o) => String(o.text).trim().length > 12);
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
