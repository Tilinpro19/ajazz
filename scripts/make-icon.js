// Genera build/icon.png (256x256) y build/icon.ico sin dependencias: un mouse estilizado
// sobre fondo oscuro. Uso: npm run icon
import fs from "node:fs";
import zlib from "node:zlib";

const S = 256;
const px = Buffer.alloc(S * S * 4);

const mix = (a, b, t) => a + (b - a) * t;
function blend(x, y, [r, g, b], alpha) {
  const i = (y * S + x) * 4;
  const a = alpha + (px[i + 3] / 255) * (1 - alpha);
  if (a <= 0) return;
  for (const [k, c] of [[0, r], [1, g], [2, b]]) px[i + k] = Math.round((c * alpha + px[i + k] * (px[i + 3] / 255) * (1 - alpha)) / a);
  px[i + 3] = Math.round(a * 255);
}

// Distancia con signo a un rectángulo redondeado (centro, semiejes, radio).
const roundRect = (x, y, cx, cy, hw, hh, r) => {
  const qx = Math.abs(x - cx) - hw + r;
  const qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const cover = (d) => Math.max(0, Math.min(1, 0.5 - d)); // antialias de 1 px

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const X = x + 0.5;
    const Y = y + 0.5;
    // Fondo: cuadrado redondeado oscuro.
    const bg = cover(roundRect(X, Y, 128, 128, 120, 120, 52));
    if (bg) blend(x, y, [18, 22, 27], bg);
    // Cuerpo del mouse con degradado turquesa.
    const body = cover(roundRect(X, Y, 128, 136, 62, 92, 60));
    if (body) {
      const t = (Y - 44) / 184;
      blend(x, y, [Math.round(mix(0, 0, t)), Math.round(mix(230, 150, t)), Math.round(mix(214, 140, t))], body);
    }
    // Separación de los botones y rueda.
    const split = cover(Math.max(Math.abs(X - 128) - 2.5, Math.abs(Y - 86) - 42));
    if (split && body) blend(x, y, [18, 22, 27], split * body);
    const wheel = cover(roundRect(X, Y, 128, 92, 9, 20, 9));
    if (wheel) blend(x, y, [18, 22, 27], wheel);
    const wheelIn = cover(roundRect(X, Y, 128, 92, 4, 13, 4));
    if (wheelIn) blend(x, y, [0, 230, 214], wheelIn);
  }
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

// ICO con una sola imagen PNG de 256x256 (válido desde Windows Vista).
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 0; ico[7] = 0; ico[8] = 0; ico[9] = 0;
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);

fs.mkdirSync("build", { recursive: true });
fs.writeFileSync("build/icon.png", png);
fs.writeFileSync("build/icon.ico", Buffer.concat([ico, png]));
console.log("build/icon.png y build/icon.ico generados");
