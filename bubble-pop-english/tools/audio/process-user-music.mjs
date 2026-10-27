// ============================================================================
// Background-music processor — turns the user-supplied track
// (tools/audio/src-user-music.mp3) into the quiet in-game background bed.
//
// What it does:
//   1. decodes the source MP3,
//   2. trims silent edges for a clean loop point,
//   3. matches loudness to the game's music target (RMS ≈ −27 dBFS, peaks
//      capped near −10 dBFS) so it sits ~13 dB under the quietest SFX —
//      audible atmosphere, never competing with reading,
//   4. adds gentle loop fades,
//   5. re-encodes to MP3 (128 kbps stereo) and writes the loop-length
//      sidecar JSON the audio manager uses for gapless looping.
//
// Usage:  node tools/audio/process-user-music.mjs
// Output: assets/audio/music/bg-theme.mp3 + bg-theme.json
// ============================================================================

import { MPEGDecoder } from 'mpg123-decoder';
import { Mp3Encoder } from '@breezystack/lamejs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SRC = path.join(HERE, 'src-user-music.mp3');
const OUT_DIR = path.join(ROOT, 'assets', 'audio', 'music');

const TARGET_RMS_DB = -27;   // music-bed loudness (calm-loop pack target ≈ −26)
const PEAK_CAP_DB = -10;     // hard ceiling after loudness match
const SR = 44100;

const db = (v) => Math.pow(10, v / 20);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function floatToInt16(x, rand) {
  const out = new Int16Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const d = (rand() + rand() - 1) * 1.2;
    out[i] = Math.max(-32768, Math.min(32767, Math.round((x[i] * 32767) + d)));
  }
  return out;
}

function encodeMp3(channels, sr, kbps) {
  const rand = mulberry32(7);
  const enc = new Mp3Encoder(channels.length, sr, kbps);
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

async function decodeMp3(file) {
  const dec = new MPEGDecoder();
  await dec.ready;
  const out = dec.decode(new Uint8Array(fs.readFileSync(file)));
  dec.free();
  return { L: Float64Array.from(out.channelData[0]), R: Float64Array.from(out.channelData[1] || out.channelData[0]), sampleRate: out.sampleRate };
}

const peakOf = (...sigs) => {
  let p = 0;
  for (const s of sigs) for (let i = 0; i < s.length; i++) { const a = Math.abs(s[i]); if (a > p) p = a; }
  return p;
};
const rmsOf = (s) => { let sum = 0; for (let i = 0; i < s.length; i++) sum += s[i] * s[i]; return Math.sqrt(sum / (s.length || 1)); };

(async () => {
  console.log('decoding source…');
  const { L, R, sampleRate } = await decodeMp3(SRC);
  if (sampleRate !== SR) throw new Error(`source is ${sampleRate} Hz — expected ${SR}`);

  const n0 = L.length;
  console.log(`source: ${(n0 / SR).toFixed(2)}s  peak ${(20 * Math.log10(peakOf(L, R))).toFixed(1)} dBFS  rms ${(20 * Math.log10(rmsOf(L))).toFixed(1)} dBFS`);

  // 1. trim silent edges (threshold ≈ −60 dBFS)
  const thr = 1e-3;
  let start = 0;
  while (start < n0 && Math.abs(L[start]) < thr && Math.abs(R[start]) < thr) start++;
  let end = n0;
  while (end > start + SR && (Math.abs(L[end - 1]) < thr && Math.abs(R[end - 1]) < thr)) end--;
  start = Math.max(0, start - Math.round(0.02 * SR));           // keep 20 ms breath
  end = Math.min(n0, end + Math.round(0.25 * SR));              // and 250 ms tail
  const trim = (s) => s.slice(start, end);
  const l = trim(l0Guard(L)), r = trim(R);
  function l0Guard(x) { return x; }

  // 2. loudness match to the quiet music-bed target
  const rms = rmsOf(l);
  const gain = db(TARGET_RMS_DB) / (rms || 1e-9);
  for (let i = 0; i < l.length; i++) { l[i] *= gain; r[i] *= gain; }

  // 3. soft ceiling so nothing in the song pokes above the bed level
  const cap = db(PEAK_CAP_DB);
  let clipped = 0;
  for (let i = 0; i < l.length; i++) {
    for (const ch of [l, r]) {
      const v = ch[i];
      if (Math.abs(v) > cap) { ch[i] = Math.tanh(v / cap) * cap; clipped++; }
    }
  }

  // 4. loop fades: gentle in, and a smooth out so the loop restart is soft
  const fadeIn = Math.round(0.6 * SR), fadeOut = Math.round(1.4 * SR);
  for (let i = 0; i < fadeIn; i++) { const g = i / fadeIn; l[i] *= g; r[i] *= g; }
  for (let i = 0; i < fadeOut; i++) { const g = i / fadeOut; l[l.length - 1 - i] *= g; r[r.length - 1 - i] *= g; }

  const peak = peakOf(l, r);
  console.log(`processed: ${(l.length / SR).toFixed(2)}s  peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS  rms ${(20 * Math.log10(rmsOf(l))).toFixed(1)} dBFS  soft-limited samples: ${clipped}`);

  // 5. encode + sidecar (loopSamples drives the manager's gapless trim)
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const bytes = encodeMp3([l, r], SR, 128);
  const outFile = path.join(OUT_DIR, 'bg-theme.mp3');
  fs.writeFileSync(outFile, bytes);
  fs.writeFileSync(path.join(OUT_DIR, 'bg-theme.json'), JSON.stringify({
    sampleRate: SR,
    loopSamples: l.length,
    seconds: +(l.length / SR).toFixed(3),
    title: 'Background theme (user-supplied)',
    source: 'tools/audio/src-user-music.mp3 — user-provided track, level-matched for background use',
  }, null, 2));
  console.log(`written: ${outFile}  ${(bytes.length / 1024).toFixed(0)} KB`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
