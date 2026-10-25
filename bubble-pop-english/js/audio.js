// WebAudio blips generated at runtime — no audio files, no network. The
// context unlocks on the first user gesture; every failure is swallowed so
// gameplay never depends on audio succeeding.

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

  play(name) {
    switch (name) {
      case 'fire': this.tone(300, 0.16, { type: 'triangle', slide: 260, gain: 0.1 }); break;
      case 'pop': this.tone(520, 0.12, { type: 'sine', slide: 300 }); this.tone(780, 0.1, { delay: 0.05 }); break;
      case 'correct':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.14, { delay: i * 0.09, gain: 0.11 }));
        break;
      case 'wrong': this.tone(190, 0.28, { type: 'sawtooth', slide: -70, gain: 0.08 }); break;
      case 'miss': this.tone(240, 0.18, { type: 'triangle', slide: -90, gain: 0.07 }); break;
      case 'click': this.tone(600, 0.05, { gain: 0.06 }); break;
      case 'levelup':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.18, { delay: i * 0.1, gain: 0.12 }));
        break;
      case 'gameover': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', delay: i * 0.14, gain: 0.1 })); break;
    }
  }
}
