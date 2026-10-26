// WebAudio blips generated at runtime — no audio files, no network. The
// context unlocks on the first user gesture; every failure is swallowed so
// gameplay never depends on audio succeeding.
//
// Sound design notes: pops rise in pitch with the answer combo so a streak is
// audible; big clears get a chord; clears/bonuses/hearts have their own
// voices so eyes-free players can tell events apart. `play(name, opts)` is
// deterministic per event — no randomness.

export class AudioOut {
  constructor() {
    this.ctx = null;
    this.enabled = true;      // user preference
    this.failed = false;
    this.unlockBound = () => this.unlock();
    window.addEventListener('pointerdown', this.unlockBound, { capture: true, once: false });
    window.addEventListener('keydown', this.unlockBound, { capture: true });
  }

  unlock() {
    if (this.ctx || this.failed) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.failed = true; return; }
      this.ctx = new AC();
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch { this.failed = true; }
  }

  get ready() { return this.enabled && this.ctx && !this.failed && this.ctx.state === 'running'; }

  tone(freq, dur, { type = 'sine', gain = 0.14, slide = 0, delay = 0 } = {}) {
    if (!this.ready) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    } catch { /* never block gameplay on audio */ }
  }

  play(name, opts = {}) {
    switch (name) {
      case 'fire': this.tone(300, 0.16, { type: 'triangle', slide: 260, gain: 0.1 }); break;
      case 'pop': {
        // Pitch climbs with the combo streak (capped) and big groups chord.
        const combo = Math.max(0, Math.min(8, opts.combo || 0));
        const base = 480 * Math.pow(1.059, combo); // one semitone per streak
        this.tone(base, 0.12, { type: 'sine', slide: base * 0.55 });
        this.tone(base * 1.5, 0.1, { delay: 0.05 });
        if (opts.big) this.tone(base * 2, 0.14, { delay: 0.09, gain: 0.09 });
        break;
      }
      case 'clear': // neutral obstacle burst: soft low knock + sparkle
        this.tone(210, 0.14, { type: 'triangle', slide: -60, gain: 0.1 });
        this.tone(640, 0.09, { delay: 0.06, gain: 0.06 });
        break;
      case 'bonus': // efficiency / bank-shot reward sting
        this.tone(660, 0.09, { gain: 0.09 });
        this.tone(990, 0.12, { delay: 0.07, gain: 0.09 });
        break;
      case 'correct': {
        const shift = Math.max(0, Math.min(4, (opts.combo || 1) - 1));
        const k = Math.pow(1.059, shift * 2);
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f * k, 0.14, { delay: i * 0.09, gain: 0.11 }));
        break;
      }
      case 'wrong': this.tone(190, 0.28, { type: 'sawtooth', slide: -70, gain: 0.08 }); break;
      case 'miss': this.tone(240, 0.18, { type: 'triangle', slide: -90, gain: 0.07 }); break;
      case 'click': this.tone(600, 0.05, { gain: 0.06 }); break;
      case 'heart': // warm major third for the extra-heart power-up
        this.tone(392, 0.16, { gain: 0.1 });
        this.tone(494, 0.2, { delay: 0.08, gain: 0.1 });
        break;
      case 'levelup': {
        // Fanfare length tracks the star rating: three stars ring extra bells.
        const stars = Math.max(1, Math.min(3, opts.stars || 0));
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, { delay: i * 0.1, gain: 0.12 }));
        if (stars >= 2) this.tone(1318, 0.2, { delay: 0.42, gain: 0.11 });
        if (stars >= 3) { this.tone(1568, 0.26, { delay: 0.52, gain: 0.12 }); this.tone(2093, 0.3, { delay: 0.62, gain: 0.09 }); }
        break;
      }
      case 'gameover': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', delay: i * 0.14, gain: 0.1 })); break;
    }
  }
}
