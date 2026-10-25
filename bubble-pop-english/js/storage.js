// Versioned persistence with corruption-safe handling. localStorage may be
// unavailable (private modes, embedded contexts) — every call is guarded and
// the game keeps running with in-memory defaults.

const KEY = 'bpe-save';
const VERSION = 1;
const MAX_LEVEL = 15;

function defaults() {
  return {
    version: VERSION,
    sound: true,
    unlocked: 1,                       // highest accessible level
    best: {},                          // level -> { score, stars, time }
  };
}

function shapeOk(d) {
  if (!d || d.version !== VERSION || typeof d !== 'object') return false;
  if (typeof d.sound !== 'boolean') return false;
  const u = d.unlocked;
  if (!Number.isInteger(u) || u < 1 || u > MAX_LEVEL) return false;
  if (!d.best || typeof d.best !== 'object' || Array.isArray(d.best)) return false;
  return Object.entries(d.best).every(([k, v]) =>
    /^\d+$/.test(k) && +k >= 1 && +k <= MAX_LEVEL &&
    v && Number.isFinite(v.score) && Number.isInteger(v.stars) && v.stars >= 0 && v.stars <= 3);
}

let memory = null; // fallback when storage throws

export function loadSave() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { raw = memory && JSON.stringify(memory); }
  if (!raw) return defaults();
  try {
    const data = JSON.parse(raw);
    if (shapeOk(data)) return data;
    console.warn('BPE: save data malformed — starting fresh (old copy kept aside)');
    try { localStorage.setItem(`${KEY}-corrupt`, raw); } catch { /* best effort */ }
  } catch (e) { console.warn('BPE: save data unreadable', e.message); }
  return defaults();
}

export function persist(data) {
  memory = data;
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* unavailable: in-memory only */ }
}

export const MAX_LEVELS = MAX_LEVEL;
