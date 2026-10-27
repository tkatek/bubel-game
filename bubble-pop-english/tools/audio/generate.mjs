// ============================================================================
// Bubble Pop English — original sound design generator
// ----------------------------------------------------------------------------
// Renders every game sound from scratch with additive/subtractive DSP and
// encodes it to MP3 (pure-JS LAME). No third-party audio is used, so the
// whole pack is originally created content with no license strings attached.
//
// Sound identity: cheerful, magical, soft, satisfying, relaxing — the palette
// is music-box bells, warm marimba, gentle sine "bloops" and airy noise
// sweeps. Nothing buzzes, nothing screams.
//
// Usage:  node tools/audio/generate.mjs
// Output: assets/audio/sfx/*.mp3, assets/audio/music/*.mp3 (+ loop sidecar)
// ============================================================================

import { Mp3Encoder } from '@breezystack/lamejs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SFX_DIR = path.join(ROOT, 'assets', 'audio', 'sfx');
const MUSIC_DIR = path.join(ROOT, 'assets', 'audio', 'music');

const SR = 44100;
const sec = (s) => Math.round(s * SR);

// --------------------------------------------------------------------------
// small seeded RNG so every build is reproducible
// --------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --------------------------------------------------------------------------
// mix buses — stereo float64 destination, optional circular (loop-safe) writes
// --------------------------------------------------------------------------
class Stereo {
  constructor(n, { wrap = false } = {}) {
    this.n = n;
    this.wrap = wrap;
    this.L = new Float64Array(n);
    this.R = new Float64Array(n);
  }
  // equal-power pan: -1 hard left .. +1 hard right
  place(offSamples, sig, { gain = 1, pan = 0 } = {}) {
    const a = ((pan + 1) / 2) * (Math.PI / 2);
    const gl = gain * Math.cos(a), gr = gain * Math.sin(a);
    const n = this.n;
    for (let i = 0; i < sig.length; i++) {
      let j = offSamples + i;
      if (j >= n) { if (!this.wrap) break; j %= n; }
      this.L[j] += sig[i] * gl;
      this.R[j] += sig[i] * gr;
    }
  }
  placeSec(offSec, sig, opts) { this.place(sec(offSec), sig, opts); }
}

// --------------------------------------------------------------------------
// oscillators / envelopes
// --------------------------------------------------------------------------
// Phase-continuous sine whose frequency may sweep via f(t) callback.
function sine(durSamples, f, { bend = null, phase0 = 0 } = {}) {
  const out = new Float64Array(durSamples);
  let phase = phase0;
  for (let i = 0; i < durSamples; i++) {
    const t = i / SR;
    const freq = typeof f === 'function' ? f(t, i / durSamples) : f;
    phase += (2 * Math.PI * freq) / SR;
    out[i] = Math.sin(phase);
  }
  return out;
}

// Exponential attack/decay envelope multiplier applied in place.
function env(sig, { attack = 0.002, tau = 0.12, sustain = 0, release = null } = {}) {
  const aS = Math.max(1, sec(attack));
  const relS = release == null ? Infinity : sec(release);
  for (let i = 0; i < sig.length; i++) {
    let g;
    if (i < aS) g = i / aS;
    else g = Math.exp(-(i - aS) / (tau * SR));
    if (i > relS) g *= Math.exp(-(i - relS) / (0.08 * SR));
    if (sustain > 0) g = Math.max(g, sustain);
    sig[i] *= g;
  }
  return sig;
}

const noise = (n, rand) => Float64Array.from({ length: n }, () => rand() * 2 - 1);

// --------------------------------------------------------------------------
// biquad filters (RBJ cookbook) — per-sample coefficient interpolation so a
// centre frequency can sweep smoothly.
// --------------------------------------------------------------------------
function biquad(sig, type, f0, { Q = 0.707, f1 = null } = {}) {
  const fA = Math.max(20, Math.min(SR * 0.49, f0));
  const fB = f1 == null ? fA : Math.max(20, Math.min(SR * 0.49, f1));
  let b0 = 0, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < sig.length; i++) {
    const u = sig.length > 1 ? i / (sig.length - 1) : 0;
    const f = fA * Math.pow(fB / fA, u); // log sweep
    const w = (2 * Math.PI * f) / SR, cw = Math.cos(w), sw = Math.sin(w);
    const alpha = sw / (2 * Q);
    if (type === 'lowpass') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
    else if (type === 'highpass') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
    else { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
    const x0 = sig[i];
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    sig[i] = y0;
  }
  return sig;
}

// --------------------------------------------------------------------------
// Schroeder reverb — 4 damped combs + 2 allpasses, stereo-decorrelated.
// `passes > 1` primes the delay lines so a music loop wraps seamlessly.
// --------------------------------------------------------------------------
function reverbChannel(input, { wet = 0.25, shift = 0, passes = 1 } = {}) {
  const n = input.length;
  let cur = Float64Array.from(input);
  const combs = [
    { d: 1687 + shift, fb: 0.78, damp: 0.28 },
    { d: 1601 + shift, fb: 0.76, damp: 0.30 },
    { d: 2053 + shift, fb: 0.79, damp: 0.26 },
    { d: 2251 + shift, fb: 0.77, damp: 0.31 },
  ].map((c) => ({ ...c, buf: new Float64Array(c.d), idx: 0, store: 0 }));
  const alls = [225 + shift, 556, 441, 341 + shift].map((d) => ({ d, buf: new Float64Array(d), idx: 0 }));
  for (let p = 0; p < passes; p++) {
    const out = new Float64Array(n);
    for (const c of combs) { c.idx = 0; c.store = 0; }
    for (const a of alls) a.idx = 0;
    for (let i = 0; i < n; i++) {
      const x = cur[i];
      let acc = 0;
      for (const c of combs) {
        const y = c.buf[c.idx];
        c.store = y * (1 - c.damp) + c.store * c.damp; // darkening lowpass in the loop
        c.buf[c.idx] = x * 0.5 + c.store * c.fb;
        c.idx = (c.idx + 1) % c.d;
        acc += y;
      }
      acc *= 0.25;
      for (const a of alls) {
        const y = a.buf[a.idx];
        const o = -acc + y * 0.5;
        a.buf[a.idx] = acc + y * 0.5;
        a.idx = (a.idx + 1) % a.d;
        acc = o;
      }
      out[i] = x + acc * wet * 2.2;
    }
    cur = out;
  }
  return cur;
}

function reverb(mix, { wet = 0.25, passes = 1 } = {}) {
  mix.L = reverbChannel(mix.L, { wet, shift: 0, passes });
  mix.R = reverbChannel(mix.R, { wet, shift: 137, passes });
  return mix;
}

// --------------------------------------------------------------------------
// instruments — the shared voice palette
// --------------------------------------------------------------------------
const nf = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// Music-box bell: pure fundamental + two inharmonic shimmer partials + strike.
function bellNote(freq, durS, { gain = 1, tau = 0.55, bright = 1 } = {}) {
  const n = sec(durS);
  const out = new Float64Array(n);
  const partials = [
    { m: 1.0, a: 1.0, t: tau },
    { m: 2.756, a: 0.16 * bright, t: tau * 0.42 },
    { m: 5.404, a: 0.06 * bright, t: tau * 0.18 },
  ];
  const phases = partials.map(() => Math.random() * 2 * Math.PI);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let k = 0; k < partials.length; k++) {
      const p = partials[k];
      const e = Math.exp(-i / (p.t * SR));
      v += p.a * e * Math.sin((2 * Math.PI * freq * p.m * i) / SR + phases[k]);
    }
    out[i] = v;
  }
  env(out, { attack: 0.0012, tau: tau });
  return out;
}

// Warm marimba: fundamental + 4th + 9th partial, dark and soft.
function marimbaNote(freq, durS, { gain = 1, tau = 0.4 } = {}) {
  const n = sec(durS);
  const out = new Float64Array(n);
  const partials = [
    { m: 1.0, a: 1.0, t: tau },
    { m: 3.95, a: 0.14, t: tau * 0.22 },
    { m: 9.2, a: 0.04, t: tau * 0.08 },
  ];
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (const p of partials) v += p.a * Math.exp(-i / (p.t * SR)) * Math.sin((2 * Math.PI * freq * p.m * i) / SR);
    out[i] = v;
  }
  env(out, { attack: 0.002, tau });
  return out;
}

// Soft pad tone: detuned sine pair + faint octave, slow swell.
function padTone(freq, durS, { gain = 1, attack = 0.5, release = 0.9 } = {}) {
  const n = sec(durS);
  const out = new Float64Array(n);
  const d = 1.0016; // ~3 cent detune
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const tail = i > n - sec(release) ? (n - i) / sec(release) : 1;
    const a = Math.min(1, i / sec(attack)) * Math.min(1, tail);
    out[i] = a * (
      Math.sin(2 * Math.PI * freq * t) +
      Math.sin(2 * Math.PI * freq * d * t + 0.6) +
      0.22 * Math.sin(2 * Math.PI * freq * 2 * t + 1.1)
    );
  }
  return out;
}

// Filtered noise sweep — the "air" used by whooshes, shimmer and puffs.
function noiseSweep(durS, { f0, f1, Q = 0.9, tau = 0.1, attack = 0.008, gain = 1, type = 'bandpass', rand } = {}) {
  const n = sec(durS);
  const sig = noise(n, rand);
  biquad(sig, type, f0, { Q, f1 });
  env(sig, { attack, tau });
  for (let i = 0; i < n; i++) sig[i] *= gain;
  return sig;
}

// The signature bubble-pop voice (used alone, and stacked inside chain FX).
function popVoice(freq, durS, rand, { gain = 1, tau = 0.085 } = {}) {
  const n = sec(durS);
  const out = new Float64Array(n);
  // tonal ping with a tiny upward flick at the attack
  const ping = sine(n, (t) => freq * (1 + 0.09 * Math.exp(-t / 0.012)));
  env(ping, { attack: 0.0012, tau });
  for (let i = 0; i < n; i++) out[i] += ping[i];
  // hollow "bloop" body below the ping
  const sub = sine(n, (t) => freq * (0.46 - 0.1 * (t / durS)));
  env(sub, { attack: 0.0015, tau: tau * 0.62 });
  for (let i = 0; i < n; i++) out[i] += 0.38 * sub[i];
  // soft snap texture
  const snap = noiseSweep(0.05, { f0: freq * 2.3, f1: freq * 1.6, Q: 1.1, tau: 0.014, attack: 0.001, gain: 0.5, rand });
  for (let i = 0; i < snap.length && i < n; i++) out[i] += snap[i];
  // airy sparkle just above
  const sp = sine(n, () => freq * 3.05);
  env(sp, { attack: 0.004, tau: tau * 0.5 });
  for (let i = 0; i < n; i++) out[i] += 0.1 * sp[i];
  for (let i = 0; i < n; i++) out[i] *= gain;
  return out;
}

// --------------------------------------------------------------------------
// mastering helpers
// --------------------------------------------------------------------------
function removeDC(sig) {
  let m = 0;
  for (let i = 0; i < sig.length; i++) m += sig[i];
  m /= sig.length || 1;
  for (let i = 0; i < sig.length; i++) sig[i] -= m;
  return sig;
}

function peakOf(...sigs) {
  let p = 0;
  for (const s of sigs) for (let i = 0; i < s.length; i++) { const a = Math.abs(s[i]); if (a > p) p = a; }
  return p;
}

function scaleTo(sig, target) { const p = peakOf(sig) || 1; const k = target / p; for (let i = 0; i < sig.length; i++) sig[i] *= k; return sig; }

// Gentle tanh saturation — rounds peaks so nothing sounds digital.
function soften(sig, drive = 1.15) {
  const k = Math.tanh(drive);
  for (let i = 0; i < sig.length; i++) sig[i] = Math.tanh(sig[i] * drive) / k;
  return sig;
}

function fadeInOut(sig, inS = 0.003, outS = 0.02) {
  const a = sec(inS), r = sec(outS);
  for (let i = 0; i < a && i < sig.length; i++) sig[i] *= i / a;
  for (let i = 0; i < r && i < sig.length; i++) sig[sig.length - 1 - i] *= i / r;
  return sig;
}

const db = (v) => Math.pow(10, v / 20);

// --------------------------------------------------------------------------
// MP3 encoding (Int16 + TPDF dither)
// --------------------------------------------------------------------------
function floatToInt16(x, rand) {
  const out = new Int16Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const d = (rand() + rand() - 1) * 1.2; // TPDF, ~1 LSB
    out[i] = Math.max(-32768, Math.min(32767, Math.round((x[i] * 32767) + d)));
  }
  return out;
}

function encodeMp3(channels, sr, kbps) {
  const rand = mulberry32(7);
  const enc = new Mp3Encoder(channels.length, sr, kbps);
  // Convert to Int16 (scaled + dithered) BEFORE framing: TypedArray.set would
  // truncate ±1.0 floats straight to 0 and produce a silent file.
  const ints = channels.map((ch) => floatToInt16(ch, rand));
  const blocks = [];
  const frame = 1152;
  for (let off = 0; off < ints[0].length; off += frame) {
    const l = ints[0].subarray(off, Math.min(ints[0].length, off + frame));
    const r = ints.length > 1 ? ints[1].subarray(off, Math.min(ints[1].length, off + frame)) : undefined;
    const data = r ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
    if (data.length) blocks.push(Buffer.from(data));
  }
  const tail = enc.flush();
  if (tail.length) blocks.push(Buffer.from(tail));
  return Buffer.concat(blocks);
}

function writeMp3(file, channels, sr, kbps) {
  const data = encodeMp3(channels, sr, kbps);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  return data.length;
}

function report(name, file, bytes, durS, ...sigs) {
  const peak = 20 * Math.log10(peakOf(...sigs) || 1e-9);
  let sum = 0, cnt = 0;
  for (const s of sigs) { for (let i = 0; i < s.length; i++) { sum += s[i] * s[i]; cnt++; } }
  const rms = 20 * Math.log10(Math.sqrt(sum / (cnt || 1)) || 1e-9);
  console.log(
    `${name.padEnd(16)} ${path.basename(file).padEnd(18)} ${(bytes / 1024).toFixed(0).padStart(5)} KB  ` +
    `${durS.toFixed(2).padStart(5)}s  peak ${peak.toFixed(1).padStart(5)} dBFS  rms ${rms.toFixed(1).padStart(5)} dBFS`,
  );
}

// ==========================================================================
// SFX RENDERING
// ==========================================================================
function renderSfx(name, durS, build, { targetPeakDb = -6, wet = 0, tailS = 0.9, drive = 1.15 } = {}) {
  const rand = mulberry32([...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7));
  const n = sec(durS + tailS);
  const mix = new Stereo(n);
  build(mix, rand);
  if (wet > 0) reverb(mix, { wet });
  removeDC(mix.L); removeDC(mix.R);
  // trim trailing pure silence to +0.25s after last audible sample
  let last = 0;
  const check = (ch) => { for (let i = ch.length - 1; i > last; i--) if (Math.abs(ch[i]) > 0.001) { last = i; return; } };
  check(mix.L); check(mix.R);
  const end = Math.min(n, last + sec(0.25) + 1);
  const L = soften(scaleTo(mix.L.subarray(0, end), db(targetPeakDb)), drive);
  const R = soften(scaleTo(mix.R.subarray(0, end), db(targetPeakDb)), drive);
  scaleTo(L, db(targetPeakDb)); scaleTo(R, db(targetPeakDb));
  fadeInOut(L, 0.002, 0.015); fadeInOut(R, 0.002, 0.015);
  const bytes = writeMp3(path.join(SFX_DIR, `${name}.mp3`), [L, R], SR, 112);
  report(name, path.join(SFX_DIR, `${name}.mp3`), bytes, end / SR, L, R);
}

const PENT = [0, 2, 4, 7, 9]; // major pentatonic offsets

function buildAllSfx() {
  fs.mkdirSync(SFX_DIR, { recursive: true });
  console.log('\n— SFX —');

  // UI click: tiny woody tick
  renderSfx('click', 0.09, (mix) => {
    const ping = sine(sec(0.09), 1850);
    env(ping, { attack: 0.0008, tau: 0.016 });
    const low = sine(sec(0.09), 940);
    env(low, { attack: 0.001, tau: 0.028 });
    mix.place(0, ping, { gain: 0.7 });
    mix.place(0, low, { gain: 0.35 });
    mix.place(0, noiseSweep(0.012, { f0: 5200, Q: 0.7, tau: 0.004, attack: 0.0005, gain: 0.3, rand: mulberry32(11) }), {});
  }, { targetPeakDb: -12, tailS: 0.15 });

  // cannon shot: soft puff + warm thump
  renderSfx('shoot', 0.3, (mix, rand) => {
    const puff = noiseSweep(0.17, { f0: 1500, f1: 480, Q: 0.8, tau: 0.055, attack: 0.006, gain: 0.8, rand });
    mix.place(0, puff, {});
    const thump = sine(sec(0.14), (t) => 225 * Math.exp(-t / 0.05) + 88);
    env(thump, { attack: 0.004, tau: 0.055 });
    biquad(thump, 'lowpass', 900);
    mix.place(0, thump, { gain: 0.95 });
    mix.place(0, noiseSweep(0.02, { f0: 2600, Q: 1.0, tau: 0.006, attack: 0.0008, gain: 0.25, rand }), {});
  }, { targetPeakDb: -7, tailS: 0.3, wet: 0.08 });

  // wall bounce: rubbery, quiet
  renderSfx('bounce', 0.2, (mix, rand) => {
    const w = sine(sec(0.2), (t) => (470 * Math.exp(-t / 0.09) + 235) * (1 + 0.025 * Math.sin(2 * Math.PI * 27 * t)));
    env(w, { attack: 0.002, tau: 0.07 });
    biquad(w, 'lowpass', 1400);
    mix.place(0, w, { gain: 0.9 });
    mix.place(0, noiseSweep(0.02, { f0: 900, Q: 0.8, tau: 0.006, attack: 0.001, gain: 0.18, rand }), {});
  }, { targetPeakDb: -10, tailS: 0.25, wet: 0.1 });

  // landing stick: gentle tock when a bubble attaches without popping
  renderSfx('stick', 0.13, (mix, rand) => {
    const w = sine(sec(0.13), (t) => 320 * Math.exp(-t / 0.035) + 200);
    env(w, { attack: 0.0015, tau: 0.04 });
    biquad(w, 'lowpass', 1100);
    mix.place(0, w, { gain: 0.9 });
    mix.place(0, noiseSweep(0.014, { f0: 1800, Q: 0.7, tau: 0.004, attack: 0.0005, gain: 0.2, rand }), {});
  }, { targetPeakDb: -11, tailS: 0.2 });

  // three bubble-pop variants — the hero sound
  const popSpecs = [
    { f: 780, tau: 0.085 },
    { f: 880, tau: 0.095, fifth: true },
    { f: 700, tau: 0.105 },
  ];
  popSpecs.forEach((p, i) => {
    renderSfx(`pop-${i + 1}`, 0.26, (mix, rand) => {
      mix.place(0, popVoice(p.f, 0.26, rand, { gain: 1, tau: p.tau }), { pan: (i - 1) * 0.12 });
      if (p.fifth) {
        const o = sine(sec(0.18), () => p.f * 1.5);
        env(o, { attack: 0.004, tau: 0.05 });
        mix.place(sec(0.012), o, { gain: 0.12 });
      }
    }, { targetPeakDb: -5.5, tailS: 0.35, wet: 0.12 });
  });

  // chain reaction: bubbles cascading up a pentatonic
  renderSfx('chain', 0.95, (mix, rand) => {
    const base = 84; // C6
    for (let i = 0; i < 6; i++) {
      const midi = base + PENT[i % PENT.length] + 12 * Math.floor(i / PENT.length);
      const v = popVoice(nf(midi), 0.16, rand, { gain: 0.4 + i * 0.1, tau: 0.05 });
      mix.placeSec(i * 0.07, v, { pan: (i % 2 === 0 ? -1 : 1) * 0.22 });
    }
    mix.placeSec(0.05, noiseSweep(0.5, { f0: 2200, f1: 8000, type: 'highpass', tau: 0.22, attack: 0.05, gain: 0.12, rand }), {});
    const bloom = bellNote(nf(96), 0.7, { gain: 0.35, tau: 0.4 });
    mix.placeSec(0.45, bloom, { gain: 0.5 });
  }, { targetPeakDb: -8, tailS: 1.0, wet: 0.28 });

  // neutral obstacle cleared: low knock + airy whoosh (distinct from pop)
  renderSfx('clear', 0.45, (mix, rand) => {
    const knock = sine(sec(0.16), (t) => 200 * Math.exp(-t / 0.045) + 120);
    env(knock, { attack: 0.002, tau: 0.07 });
    biquad(knock, 'lowpass', 700);
    mix.place(0, knock, { gain: 0.85 });
    mix.placeSec(0.02, noiseSweep(0.28, { f0: 2400, f1: 550, Q: 0.6, tau: 0.11, attack: 0.012, gain: 0.4, rand }), {});
    const ping = sine(sec(0.2), 620);
    env(ping, { attack: 0.002, tau: 0.055 });
    mix.placeSec(0.05, ping, { gain: 0.25 });
  }, { targetPeakDb: -8, tailS: 0.4, wet: 0.12 });

  // bonus sting: two rising marimba dins
  renderSfx('bonus', 0.5, (mix) => {
    mix.place(0, marimbaNote(nf(88), 0.35, { tau: 0.22 }), { gain: 0.85 });
    mix.placeSec(0.1, marimbaNote(nf(93), 0.4, { tau: 0.26 }), { gain: 0.95 });
    mix.placeSec(0.22, bellNote(nf(96), 0.35, { gain: 0.22, tau: 0.25 }), {});
  }, { targetPeakDb: -8, tailS: 0.55, wet: 0.2 });

  // correct answer: warm music-box major arpeggio
  renderSfx('correct', 1.2, (mix) => {
    const notes = [84, 88, 91, 96]; // C6 E6 G6 C7
    notes.forEach((m, i) => {
      mix.placeSec(i * 0.095, bellNote(nf(m), 0.9, { tau: 0.5, bright: 0.9 }), { gain: i === 3 ? 0.8 : 0.95, pan: (i - 1.5) * 0.12 });
    });
    mix.place(0, sine(sec(0.5), nf(72)), { gain: 0.12 }); // soft C5 warmth underneath
  }, { targetPeakDb: -6, tailS: 1.1, wet: 0.26 });

  // combo: quick rising sparkle run
  renderSfx('combo', 0.8, (mix, rand) => {
    const run = [79, 81, 84, 88]; // G5 A5 C6 E6
    run.forEach((m, i) => {
      const g = [0.55, 0.65, 0.8, 1][i];
      mix.placeSec(i * 0.055, marimbaNote(nf(m), 0.3, { tau: 0.16 }), { gain: g, pan: (i - 1.5) * 0.2 });
    });
    mix.placeSec(0.38, bellNote(nf(91), 0.5, { gain: 0.5, tau: 0.32 }), { pan: 0.15 });
    mix.placeSec(0.04, noiseSweep(0.38, { f0: 3000, f1: 9500, type: 'highpass', tau: 0.16, attack: 0.03, gain: 0.13, rand }), {});
  }, { targetPeakDb: -8, tailS: 0.8, wet: 0.24 });

  // wrong answer: soft descending "mm-m" — mellow, never a buzzer
  renderSfx('wrong', 0.9, (mix) => {
    const a = sine(sec(0.4), nf(76)); // E5
    env(a, { attack: 0.006, tau: 0.19 });
    biquad(a, 'lowpass', 1300);
    mix.place(0, a, { gain: 0.85 });
    const b = sine(sec(0.5), (t) => nf(74) * (1 - 0.02 * (t / 0.5))); // D5, easing down
    env(b, { attack: 0.006, tau: 0.22 });
    biquad(b, 'lowpass', 1200);
    mix.placeSec(0.32, b, { gain: 0.9 });
    const warm = sine(sec(0.8), nf(52)); // E3 shadow
    env(warm, { attack: 0.02, tau: 0.3 });
    mix.place(0, warm, { gain: 0.12 });
  }, { targetPeakDb: -9, tailS: 0.7, wet: 0.2 });

  // miss: small slide + plop, wistful but gentle
  renderSfx('miss', 0.5, (mix, rand) => {
    const slide = sine(sec(0.24), (t) => 520 * Math.exp(-t / 0.14) + 315);
    env(slide, { attack: 0.004, tau: 0.1 });
    biquad(slide, 'lowpass', 1600);
    mix.place(0, slide, { gain: 0.6 });
    const plop = sine(sec(0.12), (t) => 300 * Math.exp(-t / 0.03) + 165);
    env(plop, { attack: 0.002, tau: 0.04 });
    mix.placeSec(0.18, plop, { gain: 0.45 });
  }, { targetPeakDb: -10, tailS: 0.4, wet: 0.14 });

  // power-up: magical rising twinkle into a bloom
  renderSfx('powerup', 1.0, (mix, rand) => {
    const steps = [84, 86, 88, 91, 93, 96]; // C6 D6 E6 G6 A6 C7
    steps.forEach((m, i) => {
      const s = sine(sec(0.1), nf(m));
      env(s, { attack: 0.002, tau: 0.035 });
      mix.placeSec(i * 0.045, s, { gain: 0.25 + i * 0.05, pan: (i % 2 ? 0.3 : -0.3) });
    });
    mix.placeSec(0.42, bellNote(nf(96), 0.7, { gain: 0.75, tau: 0.42 }), {});
    mix.placeSec(0.5, bellNote(nf(91), 0.6, { gain: 0.45, tau: 0.36 }), { pan: -0.2 });
    mix.placeSec(0.02, noiseSweep(0.45, { f0: 3000, f1: 10500, type: 'highpass', tau: 0.18, attack: 0.03, gain: 0.12, rand }), {});
  }, { targetPeakDb: -7, tailS: 1.0, wet: 0.28 });

  // heart: warm major bloom
  renderSfx('heart', 0.7, (mix) => {
    [72, 76, 79].forEach((m, i) => {
      mix.placeSec(i * 0.13, marimbaNote(nf(m + 12), 0.45, { tau: 0.3 }), { gain: 0.8, pan: (i - 1) * 0.18 });
    });
    const low = sine(sec(0.6), nf(48));
    env(low, { attack: 0.02, tau: 0.35 });
    biquad(low, 'lowpass', 500);
    mix.place(0, low, { gain: 0.22 });
  }, { targetPeakDb: -7, tailS: 0.7, wet: 0.22 });

  // level complete: cheerful fanfare
  renderSfx('level-complete', 2.4, (mix) => {
    [72, 76, 79, 84].forEach((m, i) => {
      mix.placeSec(i * 0.115, bellNote(nf(m), 1.1, { tau: 0.5 }), { gain: 0.85, pan: (i - 1.5) * 0.15 });
    });
    // chord bloom
    [84, 88, 91].forEach((m, i) => {
      mix.placeSec(0.55, bellNote(nf(m), 1.3, { tau: 0.55, bright: 0.85 }), { gain: [0.8, 0.62, 0.58][i], pan: (i - 1) * 0.25 });
    });
    // high sparkle answer
    mix.placeSec(1.05, bellNote(nf(96), 1.1, { gain: 0.5, tau: 0.6, bright: 1.1 }), { pan: 0.1 });
    mix.placeSec(1.28, bellNote(nf(103), 1.0, { gain: 0.3, tau: 0.5 }), { pan: -0.15 });
    // warm pad underneath
    [60, 64, 67].forEach((m) => {
      mix.placeSec(0.3, padTone(nf(m), 1.7, { attack: 0.35, release: 0.7 }), { gain: 0.075 });
    });
    const sub = sine(sec(1.4), nf(48));
    env(sub, { attack: 0.03, tau: 0.8 });
    biquad(sub, 'lowpass', 400);
    mix.placeSec(0.3, sub, { gain: 0.2 });
  }, { targetPeakDb: -5.5, tailS: 1.4, wet: 0.3 });

  // game over: gentle descending phrase, consoling not scary
  renderSfx('game-over', 2.2, (mix) => {
    const phrase = [
      { m: 81, t: 0, g: 0.6 },    // A5
      { m: 76, t: 0.34, g: 0.7 }, // E5
      { m: 72, t: 0.68, g: 0.8 }, // C5
    ];
    phrase.forEach(({ m, t, g }) => {
      mix.placeSec(t, bellNote(nf(m), 1.2, { tau: 0.65, bright: 0.8 }), { gain: g, pan: (m - 78) * 0.03 });
    });
    // soft A-minor shadow pad resolving warmly on C
    [57, 60, 64].forEach((m) => mix.placeSec(0.1, padTone(nf(m), 1.5, { attack: 0.4, release: 0.8 }), { gain: 0.06 }));
    [60, 64].forEach((m) => mix.placeSec(1.55, padTone(nf(m), 1.2, { attack: 0.3, release: 0.7 }), { gain: 0.07 }));
    mix.placeSec(1.55, bellNote(nf(84), 0.9, { gain: 0.28, tau: 0.5, bright: 0.7 }), {});
    const sub = sine(sec(1.8), nf(36));
    env(sub, { attack: 0.05, tau: 0.9 });
    biquad(sub, 'lowpass', 300);
    mix.placeSec(0.1, sub, { gain: 0.16 });
  }, { targetPeakDb: -8, tailS: 1.3, wet: 0.3 });
}

// ==========================================================================
// MUSIC — "Bubbles at Rest": 16 calm bars at 70 BPM, seamless loop
// ==========================================================================
function buildMusic() {
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
  console.log('\n— MUSIC —');
  const BPM = 70;
  const beat = 60 / BPM;
  const bars = 16;
  // 70 BPM => one bar = 4 * 60/70 s = 151,200 samples; 16 bars = 2,419,200
  // samples = exactly 2100 MP3 frames — the loop length survives MP3 framing.
  const n = Math.round(bars * 4 * beat * SR);
  console.log(`loop: ${bars} bars @ ${BPM} BPM = ${(n / SR).toFixed(2)}s = ${n} samples (${(n / 1152).toFixed(0)} frames)`);
  const mix = new Stereo(n, { wrap: true });
  const rand = mulberry32(2024);

  const chords = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G', 'F', 'G', 'C', 'C'];
  const CHORDS = {
    C: { pad: [60, 64, 67, 72], bass: 36, arp: [60, 64, 67, 72] },
    Am: { pad: [57, 60, 64, 69], bass: 33, arp: [57, 60, 64, 69] },
    F: { pad: [53, 57, 60, 65], bass: 29, arp: [53, 57, 60, 65] },
    G: { pad: [55, 59, 62, 67], bass: 31, arp: [55, 59, 62, 67] },
  };

  // 1. pad bed — slow swells, one chord per bar, overlapping releases
  for (let bar = 0; bar < bars; bar++) {
    const ch = CHORDS[chords[bar]];
    const t0 = bar * 4 * beat;
    for (const m of ch.pad) {
      mix.placeSec(t0, padTone(nf(m), 4 * beat + 1.1, { attack: 0.65, release: 1.1 }), { gain: 0.052, pan: ((m % 3) - 1) * 0.22 });
    }
  }

  // 2. bass — soft root/fifth sine halves
  for (let bar = 0; bar < bars; bar++) {
    const ch = CHORDS[chords[bar]];
    const t0 = bar * 4 * beat;
    const r = sine(sec(2 * beat), nf(ch.bass + 12));
    env(r, { attack: 0.05, tau: 2.2 });
    biquad(r, 'lowpass', 320);
    mix.placeSec(t0, r, { gain: 0.3 });
    const f = sine(sec(2 * beat), nf(ch.bass + 19));
    env(f, { attack: 0.05, tau: 2.0 });
    biquad(f, 'lowpass', 380);
    mix.placeSec(t0 + 2 * beat, f, { gain: 0.2 });
  }

  // 3. music-box melody (hand-written, sparse and singable)
  const MELODY = [
    [0, 1, 76], [1, 1, 79], [2, 2, 84],
    [4, 1.5, 81], [5.5, 0.5, 76], [6, 2, 84],
    [8, 1, 81], [9, 1, 79], [10, 2, 77],
    [12, 1, 74], [13, 1, 79], [14, 2, 83],
    [16, 1, 84], [17, 1, 79], [18, 2, 76],
    [20, 1, 76], [21, 1, 81], [22, 2, 84],
    [24, 1, 77], [25, 1, 81], [26, 1, 84], [27, 1, 86],
    [28, 1.5, 88], [29.5, 0.5, 86], [30, 2, 83],
    [32, 1, 79], [33, 1, 76], [34, 2, 72],
    [36, 1, 81], [37, 1, 84], [38, 2, 88],
    [40, 1, 77], [41, 1, 79], [42, 2, 81],
    [44, 1, 79], [45, 1, 83], [46, 2, 86],
    [48, 1.5, 84], [49.5, 0.5, 81], [50, 1.5, 77],
    [52, 1, 86], [53, 1, 83], [54, 2, 79],
    [56, 1, 76], [57, 1, 79], [58, 2, 84],
    [60, 1.5, 79], [61.5, 0.5, 76], [62, 2, 72],
  ];
  MELODY.forEach(([beatAt, durB, midi], i) => {
    const durS = Math.min(durB * beat + 1.2, 2.6);
    const note = bellNote(nf(midi), durS, { tau: 0.75, bright: 0.8 });
    mix.placeSec(beatAt * beat, note, { gain: 0.26, pan: (i % 2 === 0 ? -0.18 : 0.18) });
  });

  // 4. sparkle arpeggio — barely-there eighths on even bars, ping-ponged
  for (let bar = 1; bar < bars; bar += 2) {
    const ch = CHORDS[chords[bar]];
    const t0 = bar * 4 * beat;
    const pattern = [0, 1, 2, 3, 2, 1];
    for (let i = 0; i < 8; i++) {
      const m = ch.arp[pattern[i % pattern.length]] + 12;
      const s = sine(sec(0.3), nf(m));
      env(s, { attack: 0.004, tau: 0.09 });
      mix.placeSec(t0 + i * beat * 0.5, s, { gain: 0.05, pan: (i % 2 ? 0.55 : -0.55) });
    }
  }

  // circular reverb (primed so the tail wraps into the loop head)
  reverb(mix, { wet: 0.22, passes: 3 });

  removeDC(mix.L); removeDC(mix.R);
  // gentle master lowpass keeps it sleepy; then peak to a quiet -11 dB
  biquad(mix.L, 'lowpass', 7800); biquad(mix.R, 'lowpass', 7800);
  scaleTo(mix.L, db(-11)); scaleTo(mix.R, db(-11));

  const file = path.join(MUSIC_DIR, 'calm-loop.mp3');
  const bytes = writeMp3(file, [mix.L, mix.R], SR, 128);
  fs.writeFileSync(path.join(MUSIC_DIR, 'calm-loop.json'), JSON.stringify({
    sampleRate: SR, loopSamples: n, seconds: +(n / SR).toFixed(3), title: 'Bubbles at Rest',
  }, null, 2));
  report('music', file, bytes, n / SR, mix.L, mix.R);
}

// ==========================================================================
buildAllSfx();
buildMusic();
console.log('\nDone. All audio is original, generated content (see assets/audio/README.md).');
