// Gameplay difficulty configuration — one entry per level, separate from the
// learning content (questions.js). Each level tunes puzzle design only:
//
//   minDirectAngles — fewest validated direct aim windows any answer cluster
//                     may keep (real-physics audit; lower = tighter aiming).
//   obstacleBudget  — neutral wall cells placed near (but never touching) the
//                     answer clusters; they block lazy lanes and can be
//                     cleared for small bonuses.
//   powerups        — starting counters for the run.
//
// Difficulty comes from puzzle geometry, never from punishment: boards that
// fail their solvability certificate are rebuilt from a derived seed, so a
// level can never render unfair.

export const QUESTIONS_PER_LEVEL = 4; // mirrored from state.js for config use

export const LEVEL_CONFIG = [
  // — Tier 1 · First Steps (L1–3): open boards, wide windows, teach aiming —
  { tier: 'First Steps', minDirectAngles: 6, obstacleBudget: 0, powerups: { rainbow: 1, heart: 1, aim: 2 } },
  { tier: 'First Steps', minDirectAngles: 6, obstacleBudget: 0, powerups: { rainbow: 1, heart: 1, aim: 2 } },
  { tier: 'First Steps', minDirectAngles: 6, obstacleBudget: 2, powerups: { rainbow: 1, heart: 1, aim: 2 } },
  // — Tier 2 · Builders (L4–6): more bubbles, first neutral clearing shots —
  { tier: 'Builders', minDirectAngles: 5, obstacleBudget: 3, powerups: { rainbow: 1, heart: 1, aim: 2 } },
  { tier: 'Builders', minDirectAngles: 5, obstacleBudget: 4, powerups: { rainbow: 1, heart: 1, aim: 2 } },
  { tier: 'Builders', minDirectAngles: 5, obstacleBudget: 5, powerups: { rainbow: 1, heart: 1, aim: 2 } },
  // — Tier 3 · Strategists (L7–10): angles, obstacles, wall bounces pay off —
  { tier: 'Strategists', minDirectAngles: 4, obstacleBudget: 6, powerups: { rainbow: 1, heart: 2, aim: 2 } },
  { tier: 'Strategists', minDirectAngles: 4, obstacleBudget: 7, powerups: { rainbow: 1, heart: 2, aim: 2 } },
  { tier: 'Strategists', minDirectAngles: 4, obstacleBudget: 8, powerups: { rainbow: 1, heart: 2, aim: 2 } },
  { tier: 'Strategists', minDirectAngles: 3, obstacleBudget: 8, powerups: { rainbow: 1, heart: 2, aim: 2 } },
  // — Tier 4 · Navigators (L11–13): denser validated boards, careful shots —
  { tier: 'Navigators', minDirectAngles: 3, obstacleBudget: 9, powerups: { rainbow: 2, heart: 2, aim: 2 } },
  { tier: 'Navigators', minDirectAngles: 3, obstacleBudget: 10, powerups: { rainbow: 2, heart: 2, aim: 2 } },
  { tier: 'Navigators', minDirectAngles: 2, obstacleBudget: 10, powerups: { rainbow: 2, heart: 2, aim: 2 } },
  // — Tier 5 · Masters (L14–15): advanced layouts, bank-shot routes —
  { tier: 'Masters', minDirectAngles: 2, obstacleBudget: 11, powerups: { rainbow: 2, heart: 2, aim: 3 } },
  { tier: 'Masters', minDirectAngles: 2, obstacleBudget: 12, powerups: { rainbow: 2, heart: 2, aim: 3 } },
];

export function configFor(level) {
  return LEVEL_CONFIG[Math.min(Math.max(level, 1), LEVEL_CONFIG.length) - 1];
}

// Deterministic scoring rules (task 3/4). Every value is tied to a resolved
// in-game event; nothing is random.
export const SCORE = {
  answerBase: 100,        // unchanged base question score
  comboStep: 25,          // + per consecutive correct answer (existing formula)
  firstTry: 40,           // answered on the first shot of the question
  efficientTwo: 20,       // answered within two shots
  efficientThree: 10,     // answered within three shots
  bankShot: 30,           // winning shot used at least one wall bounce
  neutralPerBubble: 10,   // per obstacle bubble cleared (no combo/question effect)
  perfectLevel: 100,      // finished the level on four shots (one per question)
};

// Efficiency badge on the results screen: 4 shots is the perfect line.
export function efficiencyPct(totalShots, questions = QUESTIONS_PER_LEVEL) {
  if (!Number.isFinite(totalShots) || totalShots <= 0) return 100;
  return Math.round((questions / totalShots) * 100);
}
