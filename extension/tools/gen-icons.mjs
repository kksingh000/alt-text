#!/usr/bin/env node
// Generates the extension icons (ink rounded square, white mountains, gold
// sun — the classic "image" glyph) as PNGs with zero image dependencies:
// shapes are rasterized with 4x supersampling and encoded by a minimal PNG
// writer on top of node:zlib. Re-run after tweaking: node tools/gen-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const SIZES = [16, 32, 48, 128];

const INK = [16, 20, 24];
const SNOW = [245, 247, 250];
const GOLD = [217, 165, 20];

// --- minimal PNG encoder (8-bit RGBA, filter 0) ---

const CRC_TABLE = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE.push(c >>> 0);
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- shape tests in unit (0..1) coordinates ---

function inRoundedRect(x, y) {
  const margin = 0.02;
  const radius = 0.22;
  if (x < margin || x > 1 - margin || y < margin || y > 1 - margin) return false;
  const cx = Math.min(Math.max(x, margin + radius), 1 - margin - radius);
  const cy = Math.min(Math.max(y, margin + radius), 1 - margin - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function inTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const s1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const s2 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
  const s3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

const MOUNTAIN_BIG = [
  [0.16, 0.8],
  [0.46, 0.4],
  [0.76, 0.8],
];
const MOUNTAIN_SMALL = [
  [0.52, 0.8],
  [0.7, 0.56],
  [0.88, 0.8],
];

function inSun(x, y) {
  return (x - 0.72) ** 2 + (y - 0.3) ** 2 <= 0.1 ** 2;
}

function colorAt(x, y) {
  if (!inRoundedRect(x, y)) return null;
  if (inSun(x, y)) return GOLD;
  if (inTriangle(x, y, ...MOUNTAIN_BIG) || inTriangle(x, y, ...MOUNTAIN_SMALL)) return SNOW;
  return INK;
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 4; // supersampling factor
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const color = colorAt((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
          if (color) {
            r += color[0];
            g += color[1];
            b += color[2];
            covered += 1;
          }
        }
      }
      const i = (py * size + px) * 4;
      if (covered > 0) {
        rgba[i] = Math.round(r / covered);
        rgba[i + 1] = Math.round(g / covered);
        rgba[i + 2] = Math.round(b / covered);
        rgba[i + 3] = Math.round((255 * covered) / (SS * SS));
      }
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), renderIcon(size));
}
console.log(`Icons written to ${OUT_DIR}: ${SIZES.map((s) => `icon-${s}.png`).join(', ')}`);
