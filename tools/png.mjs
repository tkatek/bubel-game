// Minimal pure-Node PNG decoder + encoder (no dependencies).
// Supports 8-bit RGB / RGBA / palette / grayscale + alpha, non-interlaced.
import zlib from 'node:zlib';
import fs from 'node:fs';

export function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG');
  let pos = 8;
  let w, h, bitDepth, colorType, interlace;
  let palette = null, trns = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
      // compression=0, filter=0
      interlace = data[12];
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`Unsupported bit depth ${bitDepth}`);
  if (interlace !== 0) throw new Error('Interlaced PNG not supported');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      line[x] = v;
    }
    const o = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = x * channels, q = o + x * 4;
      if (colorType === 6) { out[q] = line[i]; out[q + 1] = line[i + 1]; out[q + 2] = line[i + 2]; out[q + 3] = line[i + 3]; }
      else if (colorType === 2) { out[q] = line[i]; out[q + 1] = line[i + 1]; out[q + 2] = line[i + 2]; out[q + 3] = 255; }
      else if (colorType === 3) {
        const idx = line[i];
        out[q] = palette[idx * 3]; out[q + 1] = palette[idx * 3 + 1]; out[q + 2] = palette[idx * 3 + 2];
        out[q + 3] = trns && idx < trns.length ? trns[idx] : 255;
      } else if (colorType === 4) { out[q] = out[q + 1] = out[q + 2] = line[i]; out[q + 3] = line[i + 1]; }
      else { out[q] = out[q + 1] = out[q + 2] = line[i]; out[q + 3] = 255; }
    }
    prev = line;
  }
  return { width: w, height: h, data: out };
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encode({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function loadRGBA(path) { return decode(fs.readFileSync(path)); }
export function saveRGBA(path, img) { fs.writeFileSync(path, encode(img)); }
