// Central game state: explicit phases, pause as suspension, run/shot tokens.
// Pure data + transition guards; orchestration lives in game.js.

export const PHASE = {
  BOOT: 'BOOT',
  LOADING: 'LOADING',
  MENU: 'MENU',
  LEVEL_SELECT: 'LEVEL_SELECT',
  HOWTO: 'HOWTO',
  PREPARING_QUESTION: 'PREPARING_QUESTION',
  AIMING: 'AIMING',
  PROJECTILE_FLYING: 'PROJECTILE_FLYING',
  RESOLVING: 'RESOLVING',
  FEEDBACK: 'FEEDBACK',
  LEVEL_COMPLETE: 'LEVEL_COMPLETE',
  GAME_OVER: 'GAME_OVER',
};

const ALLOWED = {
  [PHASE.BOOT]: [PHASE.LOADING, PHASE.MENU],
  [PHASE.LOADING]: [PHASE.MENU],
  [PHASE.MENU]: [PHASE.LEVEL_SELECT, PHASE.HOWTO, PHASE.PREPARING_QUESTION],
  [PHASE.LEVEL_SELECT]: [PHASE.MENU, PHASE.PREPARING_QUESTION, PHASE.HOWTO],
  [PHASE.HOWTO]: [PHASE.MENU, PHASE.LEVEL_SELECT],
  [PHASE.PREPARING_QUESTION]: [PHASE.AIMING, PHASE.MENU, PHASE.LEVEL_SELECT, PHASE.GAME_OVER],
  [PHASE.AIMING]: [PHASE.PROJECTILE_FLYING, PHASE.PREPARING_QUESTION, PHASE.LEVEL_COMPLETE, PHASE.GAME_OVER, PHASE.MENU],
  [PHASE.PROJECTILE_FLYING]: [PHASE.RESOLVING, PHASE.MENU],
  [PHASE.RESOLVING]: [PHASE.AIMING, PHASE.PREPARING_QUESTION, PHASE.FEEDBACK, PHASE.LEVEL_COMPLETE, PHASE.GAME_OVER, PHASE.MENU],
  [PHASE.FEEDBACK]: [PHASE.PREPARING_QUESTION, PHASE.AIMING, PHASE.LEVEL_COMPLETE, PHASE.GAME_OVER, PHASE.MENU],
  [PHASE.LEVEL_COMPLETE]: [PHASE.PREPARING_QUESTION, PHASE.LEVEL_SELECT, PHASE.MENU],
  [PHASE.GAME_OVER]: [PHASE.PREPARING_QUESTION, PHASE.LEVEL_SELECT, PHASE.MENU],
};

export const LIFE_CAP = 3;
export const QUESTIONS_PER_LEVEL = 4;

export class GameState {
  constructor() {
    this.phase = PHASE.BOOT;
    this.prevPhase = null;          // restored by resume after pause
    this.suspended = false;         // pause flag — orthogonal to phase
    this.runToken = 0;              // invalidates stale callbacks after teardown
    this.level = 1;
    this.qIndex = 0;                // 0-based within level
    this.lives = LIFE_CAP;
    this.score = 0;
    this.combo = 0;                 // consecutive correct answers
    this.mistakes = 0;              // drives stars (0→3★, 1→2★, ≥2→1★)
    this.activeTime = 0;            // elapsed seconds while the learner can act
    this.shotsLevel = 0;            // total shots this level (efficiency stat)
    this.shotsQuestion = 0;         // shots since the current question started
    this.question = null;           // full question object from questions.js: { id, level, cefr, type, prompt, context?, options, correct, explain }
    this.optionsOrder = [];         // shuffled option objects
    this.loadedColor = 'blue';      // colour in the cannon (queue head)
    this.nextColor = 'blue';        // next bubble up (queue[1], HUD preview)
    this.queue = [];                // deterministic ammunition queue for this question
    this.rainbowArmed = false;
    this.aimBoost = false;
    this.powerups = { rainbow: 1, heart: 1, aim: 2 };
    this.shot = null;               // in-flight projectile descriptor
    this.shotSeq = 0;
  }

  canGo(next) {
    return ALLOWED[this.phase]?.includes(next);
  }

  go(next, why = '') {
    if (next !== this.phase && !this.canGo(next)) {
      throw new Error(`illegal phase ${this.phase} → ${next} ${why}`);
    }
    this.phase = next;
  }

  startRun(level) {
    this.runToken++;
    this.level = level;
    this.qIndex = 0;
    this.lives = LIFE_CAP;
    this.score = 0;
    this.combo = 0;
    this.mistakes = 0;
    this.activeTime = 0;
    this.shotsLevel = 0;
    this.shotsQuestion = 0;
    this.shot = null;
    this.rainbowArmed = false;
    this.aimBoost = false;
    this.powerups = { rainbow: 1, heart: 1, aim: 2 };
    this.queue = [];
    this.nextColor = this.loadedColor;
  }

  newShotId() { return `shot-${this.runToken}-${++this.shotSeq}`; }

  // Pause: explicit suspension; remembers the live phase. Only real gameplay
  // phases are pausable — menus/modals are already safe states.
  pause() {
    const live = [PHASE.AIMING, PHASE.PROJECTILE_FLYING, PHASE.RESOLVING, PHASE.FEEDBACK, PHASE.PREPARING_QUESTION];
    if (this.suspended || !live.includes(this.phase)) return false;
    this.suspended = true;
    return true;
  }

  resume() {
    if (!this.suspended) return false;
    this.suspended = false;
    return true;
  }

  inGameplay() {
    return [PHASE.PREPARING_QUESTION, PHASE.AIMING, PHASE.PROJECTILE_FLYING, PHASE.RESOLVING, PHASE.FEEDBACK]
      .includes(this.phase);
  }
}
