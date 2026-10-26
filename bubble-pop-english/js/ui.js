// DOM HUD + screens. All panel content is live state rendered in readable
// HTML above the painted artwork — the PNGs are decoration only.

import { ASSETS, BUBBLE_COLORS, COLOR_NAMES } from './assets.js';
import { fmtTime, clamp } from './util.js';
import { MAX_LEVELS } from './storage.js';
import { CEFR_FOR_LEVEL, QUESTION_TYPES } from './questions.js';

const SCREENS = ['screen-loading', 'screen-menu', 'screen-levels', 'screen-howto', 'screen-pause',
  'screen-complete', 'screen-gameover'];

export class UI {
  constructor(root) {
    this.root = root;
    const q = (id) => root.querySelector(`#${id}`);
    this.el = {
      loadText: q('loadText'), loadFill: q('loadFill'),
      qText: q('qText'), qTextM: q('qTextM'), qOpts: root.querySelector('#qOpts'), qOptsM: root.querySelector('#qOptsM'),
      qType: q('qType'), qTypeM: q('qTypeM'), qContext: q('qContext'), qContextM: q('qContextM'),
      qColorChip: q('qColorChip'), qColorName: q('qColorName'), qColorDot: root.querySelector('.bpe-q-color-dot'),
      mColorChip: q('mColorChip'), mColorName: q('mColorName'),
      levelNum: q('levelNum'), levelCefr: q('levelCefr'), levelNumM: q('levelNumM'), levelCefrM: q('levelCefrM'),
      progText: q('progText'), progSegs: q('progSegs'), progTextM: q('progTextM'), progSegsM: q('progSegsM'),
      qBar: q('qBar'), qBarM: q('qBarM'),
      hearts: q('hearts'), heartsM: q('heartsM'),
      comboVal: q('comboVal'), comboFill: q('comboFill'), comboValM: q('comboValM'),
      timerVal: q('timerVal'), timerValM: q('timerValM'),
      scoreVal: q('scoreVal'), scoreValM: q('scoreValM'),
      nextBubble: q('nextBubble'), nextBubbleM: q('nextBubbleM'),
      puBadges: {
        rainbow: [q('puBadgeRainbow'), q('puBadgeRainbowM')],
        heart: [q('puBadgeHeart'), q('puBadgeHeartM')],
        aim: [q('puBadgeAim'), q('puBadgeAimM')],
      },
      puButtons: Array.from(root.querySelectorAll('.bpe-pu')),
      toast: q('toast'), toastTitle: q('toastTitle'), toastBody: q('toastBody'),
      levelGrid: q('levelGrid'), totalStars: q('totalStars'),
      pauseInfo: q('pauseInfo'),
      completeTitle: q('completeTitle'), completeSub: q('completeSub'), completeStars: q('completeStars'),
      resScore: q('resScore'), resQuestions: q('resQuestions'), resMistakes: q('resMistakes'), resTime: q('resTime'),
      gameoverSub: q('gameoverSub'), goTip: q('goTip'),
      btnPlayLabel: q('btnPlayLabel'),
      puPopover: q('puPopover'), btnPuDock: q('btnPuDock'), puBadgeDock: q('puBadgeDock'),
      soundMenuIcon: q('soundMenuIcon'), soundPauseIcon: q('soundPauseIcon'),
    };
    // Dock power-up row badges are attribute-addressed so every rendered
    // instance (rail, popover, dock row) stays in sync from one state source.
    for (const kind of ['rainbow', 'heart', 'aim']) {
      const extra = Array.from(root.querySelectorAll(`[data-badge-for="${kind}"]`));
      this.el.puBadges[kind] = [...(this.el.puBadges[kind] || []), ...extra];
    }
    this.toastTimer = 0;
    this.bubbleUrl = {}; // per-colour CSS background URL
    for (const c of BUBBLE_COLORS) this.bubbleUrl[c] = ASSETS.bubbles[c].url;
  }

  screen(name) {
    if (typeof window !== 'undefined' && window.__bpeLog) window.__bpeLog.push(`screen:${name}@${Math.round(performance.now())}`);
    for (const id of SCREENS) {
      const el = this.root.querySelector(`#${id}`);
      if (!el) continue;
      const show = id === `screen-${name}`;
      el.hidden = !show;
      // hidden overlays must leave hit-testing: display none via [hidden]
      el.style.display = show ? '' : 'none';
    }
    this.root.dataset.screen = name;
  }

  showGameChrome(show) {
    this.root.dataset.ingame = show ? '1' : '0';
  }

  setLoad(pct, text) {
    if (typeof window !== 'undefined' && window.__bpeLog) window.__bpeLog.push(`load:${(pct * 100) | 0}:${text}@${Math.round(performance.now())}`);
    this.el.loadFill.style.width = `${Math.round(pct * 100)}%`;
    if (text) this.el.loadText.textContent = text;
  }

  renderQuestion(state) {
    const q = state.question;
    // Answers live entirely on the bubble clusters — inside the designated
    // bubble or in an attached label (see labels.js). No banner list, no
    // letter badges: every answer is always readable where it is played.
    const typeLabel = (QUESTION_TYPES[q.type] && QUESTION_TYPES[q.type].label) || 'Question';
    for (const [typeEl, textEl, ctxEl] of [
      [this.el.qType, this.el.qText, this.el.qContext],
      [this.el.qTypeM, this.el.qTextM, this.el.qContextM],
    ]) {
      if (!textEl) continue;
      if (typeEl) typeEl.textContent = typeLabel;
      textEl.textContent = q.prompt;
      this.renderContext(ctxEl, q.context);
    }
    const cname = COLOR_NAMES[state.loadedColor];
    this.el.qColorName.textContent = cname;
    this.el.mColorName.textContent = cname;
    this.el.qColorDot.style.background = `url(${this.bubbleUrl[state.loadedColor]}) center/cover`;
    this.renderLoadedColors(state);
  }

  // Cannon bubble + "Next" preview reflect the live ammunition queue; called
  // from renderQuestion (new question) and renderHud (after every resolved
  // shot advances the queue).
  renderLoadedColors(state) {
    const loaded = this.bubbleUrl[state.loadedColor] || '';
    const next = this.bubbleUrl[state.nextColor] || loaded;
    this.el.qColorName.textContent = COLOR_NAMES[state.loadedColor];
    this.el.mColorName.textContent = COLOR_NAMES[state.loadedColor];
    this.el.qColorDot.style.background = `url(${loaded}) center/cover`;
    const mDot = this.el.mColorChip && this.el.mColorChip.querySelector('.bpe-q-color-dot');
    if (mDot) mDot.style.background = `url(${loaded}) center/cover`;
    this.el.nextBubble.style.backgroundImage = `url(${next})`;
    this.el.nextBubbleM.style.backgroundImage = `url(${next})`;
  }

  // Dialogue / reading context rendered as structured lines: a plain string
  // becomes one line, { who, line } gets a bolded speaker. textContent only.
  renderContext(el, context) {
    if (!el) return;
    el.textContent = '';
    const lines = Array.isArray(context) ? context : [];
    el.hidden = lines.length === 0;
    for (const entry of lines) {
      const line = document.createElement('div');
      line.className = 'bpe-q-context-line';
      if (entry && typeof entry === 'object' && typeof entry.line === 'string') {
        if (entry.who) {
          const who = document.createElement('b');
          who.textContent = `${entry.who}:`;
          line.appendChild(who);
        }
        const text = document.createElement('span');
        text.textContent = entry.line;
        line.appendChild(text);
      } else {
        line.textContent = String(entry);
      }
      el.appendChild(line);
    }
  }

  renderHud(state) {
    this.el.levelNum.textContent = state.level;
    this.el.levelCefr.textContent = this.cefrFor(state.level);
    this.el.levelNumM.textContent = `Lv ${state.level}`;
    this.el.levelCefrM.textContent = this.cefrFor(state.level);

    const qn = clamp(state.qIndex + 1, 1, 4);
    this.el.progText.textContent = `${qn} / 4`;
    this.el.progTextM.textContent = `${qn} / 4`;
    // progress bar (reference style) — filled portion = questions completed
    const fillPct = Math.round((state.qIndex / 4) * 100);
    for (const bar of [this.el.qBar, this.el.qBarM]) {
      if (bar) bar.style.width = `${fillPct}%`;
    }
    const segs = [this.el.progSegs, this.el.progSegsM];
    for (const wrap of segs) {
      if (!wrap) continue;
      Array.from(wrap.children).forEach((seg, i) => {
        seg.classList.toggle('is-done', i < state.qIndex);
        seg.classList.toggle('is-now', i === state.qIndex);
      });
    }

    const hearts = [this.el.hearts, this.el.heartsM];
    for (const h of hearts) {
      if (!h) continue;
      if (h.children.length !== 3) {
        h.textContent = '';
        for (let i = 0; i < 3; i++) {
          const img = document.createElement('img');
          img.src = ASSETS.icons.heart;
          img.alt = '';
          img.draggable = false;
          h.appendChild(img);
        }
      }
      Array.from(h.children).forEach((img, i) => {
        const lost = i >= state.lives;
        img.src = lost ? ASSETS.icons.heartEmpty : ASSETS.icons.heart;
        img.classList.toggle('is-lost', lost);
      });
    }

    this.el.comboVal.textContent = `×${state.combo + 1}`;
    this.el.comboValM.textContent = `×${state.combo + 1}`;
    this.el.comboFill.style.width = `${clamp(state.combo * 25, 0, 100)}%`;

    this.el.scoreVal.textContent = state.score.toLocaleString('en-US');
    this.el.scoreValM.textContent = state.score.toLocaleString('en-US');

    // cannon bubble + next-up preview (live ammunition queue)
    this.renderLoadedColors(state);

    // power-ups: counters + disabled states
    const pu = state.powerups;
    const busy = state.phase === 'PROJECTILE_FLYING' || state.phase === 'RESOLVING';
    const setPu = (kind) => {
      const n = pu[kind];
      const left = kind === 'heart' && state.lives >= 3 ? 0 : n;
      for (const badge of this.el.puBadges[kind]) if (badge) badge.textContent = left;
      const usable = n > 0 && !busy && (kind !== 'heart' || state.lives < 3);
      for (const btn of this.el.puButtons) {
        if (btn.dataset.pu === kind) {
          btn.disabled = !usable;
          btn.classList.toggle('is-active', (kind === 'rainbow' && state.rainbowArmed) || (kind === 'aim' && state.aimBoost));
        }
      }
    };
    setPu('rainbow'); setPu('heart'); setPu('aim');
    this.el.puBadgeDock.textContent = pu.rainbow + pu.heart + pu.aim;
  }

  renderTimer(seconds) {
    const t = fmtTime(seconds);
    this.el.timerVal.textContent = t;
    this.el.timerValM.textContent = t;
  }

  cefrFor(level) { return CEFR_FOR_LEVEL[level - 1] || 'A1'; }

  toast(title, body, ms = 1900) {
    this.el.toastTitle.textContent = title;
    this.el.toastBody.textContent = body;
    this.el.toast.hidden = false;
    this.el.toast.style.display = '';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.el.toast.hidden = true; this.el.toast.style.display = 'none'; }, ms);
  }
  hideToast() { clearTimeout(this.toastTimer); this.el.toast.hidden = true; this.el.toast.style.display = 'none'; }

  buildLevelGrid(save, onPick) {
    const grid = this.el.levelGrid;
    grid.textContent = '';
    let stars = 0;
    for (let lv = 1; lv <= MAX_LEVELS; lv++) {
      const best = save.best[lv];
      const unlocked = lv <= save.unlocked;
      stars += best ? best.stars : 0;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'bpe-lv' + (unlocked ? '' : ' is-locked') + (best ? ' is-done' : '');
      cell.disabled = !unlocked;
      cell.setAttribute('aria-label', `Level ${lv}${unlocked ? '' : ' (locked)'}`);
      cell.innerHTML = `
        <span class="bpe-lv-num">${lv}</span>
        <span class="bpe-lv-cefr">${this.cefrFor(lv)}</span>
        <span class="bpe-lv-stars">${
          [1, 2, 3].map((s) => `<img src="${ASSETS.icons.star}" class="${best && best.stars >= s ? '' : 'is-off'}" alt="" draggable="false">`).join('')
        }</span>
        ${best ? `<span class="bpe-lv-best">${best.score}</span>` : ''}`;
      if (unlocked) cell.addEventListener('click', () => onPick(lv));
      grid.appendChild(cell);
    }
    this.el.totalStars.textContent = `${stars} / 45`;
  }

  showResults({ score, mistakes, time, stars, level }) {
    this.el.resScore.textContent = score;
    this.el.resQuestions.textContent = '4 / 4';
    this.el.resMistakes.textContent = mistakes;
    this.el.resTime.textContent = fmtTime(time);
    this.el.completeTitle.textContent = level >= MAX_LEVELS ? 'Course Complete!' : 'Level Complete!';
    this.el.completeStars.textContent = '';
    for (let s = 1; s <= 3; s++) {
      const img = document.createElement('img');
      img.src = ASSETS.icons.star;
      img.alt = s <= stars ? 'star' : 'no star';
      if (s > stars) img.className = 'is-off';
      this.el.completeStars.appendChild(img);
    }
    this.root.querySelector('#btnNextLevel').style.display = level >= MAX_LEVELS ? 'none' : '';
  }

  setSoundIcons(on) {
    this.el.soundMenuIcon.src = on ? ASSETS.icons.soundOn : ASSETS.icons.soundOff;
    this.el.soundPauseIcon.src = on ? ASSETS.icons.soundOn : ASSETS.icons.soundOff;
  }

  setPopover(open) {
    this.el.puPopover.hidden = !open;
    this.el.puPopover.style.display = open ? '' : 'none';
    this.el.btnPuDock.setAttribute('aria-expanded', String(open));
  }
}

// escapeHtml helper removed: option chips are built from DOM nodes now, so
// question data can never reach innerHTML.
