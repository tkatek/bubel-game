// Boot: preload critical assets (with progress), then wire the modules and
// start at the menu. Core transitions never wait on audio or effects.
import { ASSETS, preloadCritical } from './assets.js';
import { validateLevels } from './questions.js';
import { UI } from './ui.js';
import { Renderer } from './render.js';
import { Layout } from './layout.js';
import { InputController } from './input.js';
import { AudioOut } from './audio.js';
import { Game } from './game.js';
import { DEBUG, DebugOverlay } from './debug.js';
import { PHASE } from './state.js';
import { qs } from './util.js';

async function boot() {
  const root = qs('#bpe-root');
  const ui = new UI(root);
  ui.screen('loading');
  // Dev-only label rendering harness (?labeltest=1) — probe word sets for the
  // answer-label cases; real content otherwise.
  if (new URLSearchParams(location.search).has('labeltest')) {
    const { applyLabelTest } = await import('./labeltest.js');
    applyLabelTest();
  }
  validateLevels();

  const canvas = qs('#bpeCanvas');
  const renderer = new Renderer(canvas);
  if (DEBUG) renderer.debug = new DebugOverlay();

  let images;
  try {
    images = await preloadCritical((p, url) => ui.setLoad(p, `Preparing the classroom… ${Math.round(p * 100)}%`));
  } catch (err) {
    console.error(err);
    ui.setLoad(1, 'Some artwork failed to load. Check your connection and reload.');
    return;
  }
  renderer.setImages(images);
  ui.setLoad(1, 'Ready!');

  const audio = new AudioOut();
  audio.preload(); // fetch + decode samples in parallel with artwork — never gates boot
  const layout = new Layout(root, canvas, renderer);
  const game = new Game({ root, ui, renderer, layout, audio });
  audio.applySettings(game.save); // persisted Music/SFX mixer state
  const input = new InputController(canvas, game, layout);
  layout.start();
  game.start();
  window.__bpeGame = game; // debug/testing handle

  // ---- button wiring (each gesture stays on its element; never fires shots) --
  const click = (id, fn) => qs(`#${id}`).addEventListener('click', (e) => { e.stopPropagation(); audio.play('click'); fn(); });
  click('btnPlay', () => game.startLevel(game.save.unlocked));
  click('btnLevels', () => game.openLevels());
  click('btnHowTo', () => ui.screen('howto'));
  click('btnHowToBack', () => ui.screen(game.state.inGameplay() ? 'game' : 'menu'));
  click('btnSoundMenu', () => ui.toggleAudioPanel(true));
  click('btnSoundPause', () => ui.toggleAudioPanel(true));
  click('btnAudioClose', () => ui.toggleAudioPanel(false));
  click('btnPauseDesktop', () => game.pause());
  click('btnPauseMobile', () => game.pause());
  click('btnResume', () => game.resume());
  click('btnRestart', () => game.startLevel(game.state.level));
  click('btnHome', () => game.home());
  click('btnNextLevel', () => game.startLevel(game.state.level + 1));
  click('btnReplay', () => game.startLevel(game.state.level));
  click('btnLevelSel', () => game.openLevels());
  click('btnRetry', () => game.startLevel(game.state.level));
  click('btnGoLevels', () => game.openLevels());
  click('btnGoHome', () => game.home());
  click('btnPuClose', () => ui.setPopover(false));
  click('btnPuDock', () => ui.setPopover(ui.el.puPopover.hidden));

  for (const btn of root.querySelectorAll('.bpe-pu')) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      game.usePowerup(btn.dataset.pu);
    });
  }

  // ---- audio panel controls (live Music / SFX mixing) ------------------------
  ui.syncAudioPanel(game.save);
  const bindSlider = (id, pref) => {
    const slider = qs(`#${id}`);
    slider.addEventListener('input', () => {
      game.setAudioPref(pref, slider.value / 100); // manager ramps live while dragging
    });
    slider.addEventListener('change', () => {
      audio.play('pop', { volume: 0.65 }); // audible confirmation at the new level
    });
  };
  bindSlider('musicVolume', 'musicVolume');
  bindSlider('sfxVolume', 'sfxVolume');
  qs('#musicToggle').addEventListener('change', (e) => game.setAudioPref('musicOn', e.target.checked));
  qs('#sfxToggle').addEventListener('change', (e) => game.setAudioPref('sound', e.target.checked));

  // Menu "Play" label: continue at the furthest unlocked level
  ui.el.btnPlayLabel.textContent = game.save.unlocked > 1 ? `Play — Level ${game.save.unlocked}` : 'Play';

  // pause when the embedded host iframe loses focus
  window.addEventListener('blur', () => input.cancelActive());
}

boot().catch((err) => {
  console.error('BPE boot failed', err);
  const el = qs('#loadText');
  if (el) el.textContent = 'Something went wrong while starting. Please reload the page.';
});
