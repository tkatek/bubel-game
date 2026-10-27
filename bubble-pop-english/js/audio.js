// Central audio manager: preloaded MP3 samples from assets/audio/ (original,
// generated content — see assets/audio/README.md), mixed through a small
// WebAudio graph with separate Music / Sound-Effect buses and a soft limiter
// so busy moments can never clip.
//
// Design rules this module enforces:
//  · Sounds play only from explicit game events — `play(name)` is called by
//    game.js / main.js at the moment the event happens, nowhere else.
//  · Anti-overlap: every event declares a minimum retrigger gap and a voice
//    cap, so large explosions and repeated animations collapse into one clean
//    sound instead of a stack of copies.
//  · Music is mastered quiet and fades in/out smoothly; it ducks under big
//    stings and never competes with reading.
//  · Autoplay is respected: the context is created and resumed inside the
//    first user gesture, and playback no-ops until it is running.
//  · Audio failure is never fatal: missing files, decode errors and suspended
//    contexts all degrade to silence while gameplay continues.
//
// The class keeps the legacy `AudioOut` name and the `play(name, opts)` /
// `enabled` surface that game.js and main.js already use.

const SFX_DIR = 'assets/audio/sfx/';
const MUSIC_DIR = 'assets/audio/music/';

// Event manifest. gain = bus-level multiplier (samples are mastered to
// different peaks), minGap = seconds between retriggers, maxVoices = how many
// copies may sound at once, jitter = ±playback-rate detune to keep repetition
// from sounding mechanical. `rotate` cycles through the files round-robin.
export const SFX_EVENTS = {
  click:    { files: ['click'], gain: 0.5, minGap: 0.05, maxVoices: 2, jitter: 0 },
  fire:     { files: ['shoot'], gain: 0.85, minGap: 0.09, maxVoices: 2, jitter: 0.02 },
  bounce:   { files: ['bounce'], gain: 0.6, minGap: 0.085, maxVoices: 2, jitter: 0.03 },
  stick:    { files: ['stick'], gain: 0.55, minGap: 0.09, maxVoices: 2, jitter: 0.03 },
  pop:      { files: ['pop-1', 'pop-2', 'pop-3'], gain: 0.72, minGap: 0.035, maxVoices: 4, jitter: 0.025, rotate: true },
  chain:    { files: ['chain'], gain: 0.6, minGap: 0.25, maxVoices: 1, jitter: 0.015 },
  clear:    { files: ['clear'], gain: 0.65, minGap: 0.1, maxVoices: 2, jitter: 0.02 },
  bonus:    { files: ['bonus'], gain: 0.6, minGap: 0.12, maxVoices: 1, jitter: 0.02 },
  correct:  { files: ['correct'], gain: 0.8, minGap: 0.1, maxVoices: 1, jitter: 0 },
  wrong:    { files: ['wrong'], gain: 0.7, minGap: 0.2, maxVoices: 1, jitter: 0 },
  miss:     { files: ['miss'], gain: 0.6, minGap: 0.2, maxVoices: 1, jitter: 0.02 },
  combo:    { files: ['combo'], gain: 0.62, minGap: 0.15, maxVoices: 1, jitter: 0 },
  powerup:  { files: ['powerup'], gain: 0.7, minGap: 0.1, maxVoices: 1, jitter: 0 },
  heart:    { files: ['heart'], gain: 0.7, minGap: 0.1, maxVoices: 1, jitter: 0 },
  levelup:  { files: ['level-complete'], gain: 0.85, minGap: 0.5, maxVoices: 1, jitter: 0 },
  gameover: { files: ['game-over'], gain: 0.75, minGap: 0.5, maxVoices: 1, jitter: 0 },
};

// Background music: the user-supplied track, level-matched to a quiet bed by
// tools/audio/process-user-music.mjs (RMS −27 dBFS — far below the SFX).
// The original instrumental "calm-loop.mp3" stays in the folder as an
// alternative; switch MUSIC_FILE to swap tracks.
const MUSIC_FILE = 'bg-theme';
const MAX_TOTAL_VOICES = 16;
const MUSIC_DEFAULTS = { fade: 1.2, duckFactor: 0.45, duckHold: 2.4 };

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

export class AudioOut {
  constructor() {
    this.ctx = null;
    this.failed = false;
    this.unlocked = false;
    this.buffers = new Map();      // base name -> AudioBuffer
    this.missing = new Set();      // names that could not be fetched/decoded
    this.preloadPromise = null;

    this.settings = {
      sfxEnabled: true,
      musicEnabled: true,
      sfxVolume: 0.9,
      musicVolume: 0.35,
    };

    this.voices = new Map();       // event name -> Set of live AudioBufferSource
    this.lastPlay = new Map();     // event name -> ctx time of last trigger
    this.rotateIdx = new Map();    // event name -> round-robin cursor
    this.warned = new Set();
    this.totalVoices = 0;

    this.music = { source: null, gain: null, playing: false, want: false, stopping: null };
    this.sfxBus = null;
    this.musicBus = null;
    this.master = null;
    this.hiddenTimer = 0;
    this.hidden = false;

    this.unlockBound = () => this.unlock();
    for (const type of ['pointerdown', 'touchend', 'keydown']) {
      window.addEventListener(type, this.unlockBound, { capture: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.onHidden(); else this.onVisible();
    });
    window.addEventListener('pagehide', () => this.onHidden());
    window.addEventListener('pageshow', () => this.onVisible());
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('resume', () => this.onVisible()); // webview resume
    }
  }

  // ---- settings (persisted by storage.js through game.setAudioPref) ------
  applySettings(save = {}) {
    const s = this.settings;
    s.sfxEnabled = save.sound !== false;
    s.musicEnabled = save.musicOn !== false;
    s.sfxVolume = clamp01(save.sfxVolume != null ? save.sfxVolume : 0.9);
    s.musicVolume = clamp01(save.musicVolume != null ? save.musicVolume : 0.35);
    if (this.ctx) {
      try { this.sfxBus.gain.setTargetAtTime(s.sfxVolume, this.ctx.currentTime, 0.03); } catch { /* noop */ }
    }
    this.refreshMusic();
  }

  // Legacy single-flag surface used by game.toggleSound().
  get enabled() { return this.settings.sfxEnabled; }
  set enabled(v) {
    this.settings.sfxEnabled = v !== false;
    this.refreshMusic();
  }

  // ---- resource loading ---------------------------------------------------
  // Decoding runs through an OfflineAudioContext so nothing touches autoplay
  // policy and no console warnings appear before the first gesture. Fails soft:
  // missing or broken files land in `this.missing` and simply never play.
  async preload() {
    if (this.preloadPromise) return this.preloadPromise;
    this.preloadPromise = (async () => {
      const decodeCtx = this.makeDecodeContext();
      if (!decodeCtx) { this.failed = true; return; }
      const jobs = [];
      const wanted = new Map(); // url -> base name
      for (const [event, cfg] of Object.entries(SFX_EVENTS)) {
        for (const f of cfg.files) wanted.set(`${SFX_DIR}${f}.mp3`, f);
      }
      wanted.set(`${MUSIC_DIR}${MUSIC_FILE}.mp3`, MUSIC_FILE);
      for (const [url, name] of wanted) {
        jobs.push(this.loadOne(decodeCtx, url, name));
      }
      await Promise.all(jobs);
      // Loop sidecar: exact sample length for gapless music.
      try {
        const res = await fetch(`${MUSIC_DIR}${MUSIC_FILE}.json`);
        if (res.ok) this.musicLoopInfo = await res.json();
      } catch { /* optional */ }
      if (this.missing.size) {
        console.warn(`BPE audio: ${this.missing.size} file(s) unavailable: ${[...this.missing].join(', ')}`);
      }
    })();
    return this.preloadPromise;
  }

  makeDecodeContext() {
    try {
      const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (OC) return new OC(2, 44100, 44100);
    } catch { /* fall through */ }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) return new AC();
    } catch { /* fall through */ }
    return null;
  }

  async loadOne(ctx, url, name) {
    try {
      let buf = await this.decodeUrl(ctx, url);
      // A stale intermediate cache can serve a broken/old file that decodes to
      // pure silence. Retry once past the cache before giving up on the name.
      if (this.isSilent(buf)) buf = await this.decodeUrl(ctx, `${url}?bpev=${Date.now()}`);
      if (this.isSilent(buf)) throw new Error('decoded to silence');
      this.buffers.set(name, buf);
    } catch (e) {
      this.missing.add(name);
    }
  }

  async decodeUrl(ctx, url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return this.decodeData(ctx, await res.arrayBuffer());
  }

  // Strided peak scan — cheap, and enough to tell PCM content from digital zero.
  isSilent(buffer) {
    try {
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const d = buffer.getChannelData(c);
        for (let i = 0; i < d.length; i += 97) if (Math.abs(d[i]) > 1e-5) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  decodeData(ctx, raw) {
    return new Promise((resolve, reject) => {
      let maybe = null;
      try { maybe = ctx.decodeAudioData(raw, resolve, reject); } catch (e) { return reject(e); }
      // Promise-style contexts resolve here; callback-style ones via the handlers.
      if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
    });
  }

  // ---- lifecycle / autoplay ----------------------------------------------
  // Must run inside a user gesture: creates the context, resumes it, warms
  // Safari up with a silent buffer, then starts music if it is wanted. Later
  // gestures double as recovery for iOS "interrupted" (Siri / ringer) states.
  unlock() {
    if (this.failed) return;
    if (this.unlocked) { this.resumeCtx(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.failed = true; return; }
      if (!this.ctx) {
        this.ctx = new AC();
        this.buildGraph();
        // The first resume() is asynchronous: when the context actually
        // reaches 'running', re-check whether music should start (this also
        // recovers iOS "interrupted" states after Siri / a phone call).
        this.ctx.addEventListener('statechange', () => {
          try { if (this.ctx.state === 'running') this.refreshMusic(); } catch { /* noop */ }
        });
      }
      this.unlocked = true;
      this.resumeCtx();
      this.warmUp();
      this.music.want = true; // gesture happened; refreshMusic decides the rest
      this.refreshMusic();
    } catch {
      this.failed = true;
    }
  }

  buildGraph() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(ctx.destination);

    // Soft limiter on the SFX bus only: popping bursts can stack, and the
    // limiter shaves the sum instead of letting it clip the output.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 4;
    limiter.ratio.value = 14;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.16;
    limiter.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.settings.sfxVolume;
    this.sfxBus.connect(limiter);

    // Music bypasses the limiter: SFX peaks must not pump the music bed.
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);
  }

  resumeCtx() {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') {
        this.ctx.resume().catch(() => {});
      }
    } catch { /* noop */ }
  }

  warmUp() {
    // iOS Safari sometimes needs one scheduled buffer inside the gesture
    // before later buffer sources behave; a 20 ms silent blip is inaudible.
    try {
      if (!this.ctx || this.buffers.size === 0) return;
      const src = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.buffer = this.silentBuffer();
      src.connect(g).connect(this.master);
      src.start();
    } catch { /* noop */ }
  }

  silentBuffer() {
    if (!this._silent) {
      this._silent = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * 0.02), this.ctx.sampleRate);
    }
    return this._silent;
  }

  get ready() {
    return !this.failed && !!this.ctx && this.ctx.state === 'running' && this.unlocked;
  }

  // ---- playback -----------------------------------------------------------
  // opts: { volume, combo, rate, delay } — all optional; `combo` raises the
  // pitch of pops and answer chimes so a streak is audible.
  play(name, opts = {}) {
    try {
      if (!this.ready || !this.settings.sfxEnabled) return;
      const ev = SFX_EVENTS[name];
      if (!ev) return;
      if (this.missing.has(ev.files[0]) && ev.files.length === 1) return;

      const ctx = this.ctx;
      const now = ctx.currentTime;
      const at = now + Math.max(0, opts.delay || 0);

      // anti-overlap: per-event retrigger gap and voice cap
      const last = this.lastPlay.get(name);
      if (last != null && at - last < ev.minGap) return;
      const live = this.voices.get(name);
      if (live && live.size >= ev.maxVoices) return;
      if (this.totalVoices >= MAX_TOTAL_VOICES) return;

      // pick the file (round-robin for variants)
      let base = ev.files[0];
      if (ev.files.length > 1) {
        const idx = ev.rotate ? (this.rotateIdx.get(name) || 0) : Math.floor(Math.random() * ev.files.length);
        base = ev.files[idx % ev.files.length];
        if (ev.rotate) this.rotateIdx.set(name, (idx + 1) % ev.files.length);
      }
      const buffer = this.buffers.get(base);
      if (!buffer) { this.warnOnce(base); return; }

      // pitch: combo climb + tiny anti-mechanical jitter
      let rate = opts.rate || 1;
      if (opts.combo != null) {
        const steps = name === 'pop'
          ? Math.min(6, Math.max(0, opts.combo))
          : Math.min(2, Math.max(0, (opts.combo | 0) - 1)) * 2;
        rate *= Math.pow(2, steps / 12);
      }
      if (ev.jitter) rate *= 1 + (Math.random() * 2 - 1) * ev.jitter;
      rate = Math.max(0.5, Math.min(2, rate));

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;

      const gain = ctx.createGain();
      const vol = ev.gain * clamp01(opts.volume != null ? opts.volume : 1);
      gain.gain.value = vol;

      src.connect(gain).connect(this.sfxBus);
      src.start(at);

      this.lastPlay.set(name, at);
      this.trackVoice(name, src, buffer.duration / rate + 0.1);

      // big stings dip the music bed so they read clearly without shouting
      if (name === 'levelup') this.duckMusic(MUSIC_DEFAULTS.duckFactor, 3.2);
      else if (name === 'gameover') this.duckMusic(0.55, 3.4);
    } catch { /* audio must never break gameplay */ }
  }

  trackVoice(name, src, lifetime) {
    if (!this.voices.has(name)) this.voices.set(name, new Set());
    const set = this.voices.get(name);
    set.add(src);
    this.totalVoices++;
    const release = () => {
      if (set.delete(src)) this.totalVoices = Math.max(0, this.totalVoices - 1);
    };
    src.addEventListener('ended', release, { once: true });
    // safety net if `ended` never fires (tab freeze during playback)
    setTimeout(release, (lifetime + 1) * 1000);
  }

  warnOnce(base) {
    if (this.warned.has(base)) return;
    this.warned.add(base);
    console.warn(`BPE audio: sample "${base}" not loaded — event skipped (game continues silently)`);
  }

  // ---- music --------------------------------------------------------------
  // Music starts only when everything agrees: the user has gestured at least
  // once (autoplay), music is enabled with volume > 0 (panel/settings), the
  // tab is visible, the context is running and the file decoded. `want` is
  // just the gesture flag — applySettings() re-runs this when the user flips
  // the Music switch mid-session.
  refreshMusic() {
    const wantNow = this.unlocked && this.music.want
      && this.settings.musicEnabled
      && this.settings.musicVolume > 0
      && !this.hidden
      && this.ready
      && this.buffers.has(MUSIC_FILE);
    if (wantNow && !this.music.playing) this.startMusic(MUSIC_DEFAULTS.fade);
    else if (!wantNow && this.music.playing) this.stopMusic(0.6);
    else if (this.music.playing) this.applyMusicGain(0.15);
  }

  applyMusicGain(ramp = 0.2) {
    try {
      const target = this.settings.musicVolume;
      this.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, Math.max(0.02, ramp / 3));
    } catch { /* noop */ }
  }

  startMusic(fade = MUSIC_DEFAULTS.fade) {
    try {
      if (!this.ready || this.music.playing) return;
      const buffer = this.buffers.get(MUSIC_FILE);
      if (!buffer) return;
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.trimLoop(buffer);
      src.loop = true;
      src.connect(this.musicBus);
      this.musicBus.gain.cancelScheduledValues(ctx.currentTime);
      this.musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
      src.start();
      this.music.source = src;
      this.music.playing = true;
      this.applyMusicGain(fade);
      src.addEventListener('ended', () => {
        if (this.music.source === src) { this.music.source = null; this.music.playing = false; }
      }, { once: true });
    } catch { /* noop */ }
  }

  stopMusic(fade = 0.8) {
    try {
      if (!this.ctx || !this.music.playing) return;
      const ctx = this.ctx;
      const src = this.music.source;
      this.music.playing = false;
      this.music.source = null;
      const g = this.musicBus.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(Math.max(0.0001, g.value), ctx.currentTime);
      g.setTargetAtTime(0.0001, ctx.currentTime, Math.max(0.02, fade / 3));
      if (src) {
        try { src.stop(ctx.currentTime + fade + 0.15); } catch { /* already stopped */ }
      }
    } catch { /* noop */ }
  }

  duckMusic(factor = MUSIC_DEFAULTS.duckFactor, hold = MUSIC_DEFAULTS.duckHold) {
    try {
      if (!this.ctx || !this.music.playing) return;
      const ctx = this.ctx;
      const g = this.musicBus.gain;
      const target = this.settings.musicVolume;
      g.cancelScheduledValues(ctx.currentTime);
      g.setTargetAtTime(target * factor, ctx.currentTime, 0.18);
      g.setTargetAtTime(target, ctx.currentTime + hold, 0.9);
    } catch { /* noop */ }
  }

  // MP3 framing pads the decoded loop; cut to the exact composed length
  // (sidecar JSON) so `loop = true` is seamless. Falls back to a threshold
  // scan, then to the raw buffer — worst case is a faint seam, never a crash.
  trimLoop(buffer) {
    try {
      const info = this.musicLoopInfo;
      const sr = buffer.sampleRate;
      let start = 0;
      let length = buffer.length;
      const chans = [];
      for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
      if (info && info.loopSamples) {
        length = Math.round((info.loopSamples * sr) / info.sampleRate);
        const scan = Math.min(4096, length);
        outer: for (let i = 0; i < scan; i++) {
          for (const ch of chans) {
            if (Math.abs(ch[i]) > 1e-4) { start = i > 0 ? i - 1 : 0; break outer; }
          }
        }
      }
      if (start + length > buffer.length) length = buffer.length - start;
      if (start === 0 && length === buffer.length) return buffer;
      const out = this.ctx.createBuffer(buffer.numberOfChannels, length, sr);
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        out.getChannelData(c).set(chans[c].subarray(start, start + length));
      }
      return out;
    } catch {
      return buffer;
    }
  }

  // ---- background tabs / interruptions ------------------------------------
  onHidden() {
    this.hidden = true;
    if (!this.ctx) return;
    try {
      if (this.music.playing) {
        const g = this.musicBus.gain;
        g.cancelScheduledValues(this.ctx.currentTime);
        g.setTargetAtTime(0.0001, this.ctx.currentTime, 0.12);
      }
      clearTimeout(this.hiddenTimer);
      this.hiddenTimer = setTimeout(() => {
        try { if (this.hidden && this.ctx) this.ctx.suspend().catch(() => {}); } catch { /* noop */ }
      }, 400);
    } catch { /* noop */ }
  }

  onVisible() {
    this.hidden = false;
    clearTimeout(this.hiddenTimer);
    if (!this.ctx) return;
    this.resumeCtx();
    this.refreshMusic();
  }

  // ---- diagnostics (used by automated tests / debug overlay) --------------
  status() {
    return {
      supported: !this.failed && !!this.ctx,
      unlocked: this.unlocked,
      ctxState: this.ctx ? this.ctx.state : 'none',
      loaded: [...this.buffers.keys()].sort(),
      missing: [...this.missing].sort(),
      activeVoices: this.totalVoices,
      settings: { ...this.settings },
      music: { playing: this.music.playing, want: this.music.want },
    };
  }
}
