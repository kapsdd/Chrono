// Make the icon's white PNG corners transparent — for a clean exe/taskbar icon.
//
// Usage:
//   npm i -D pngjs
//   node scripts/clean-icon.js
//
// It flood-fills white starting from the image borders, so only the background
// around the rounded black square becomes transparent; the white figure inside
// (separated from the edge by black) is preserved. The original is backed up to
// okno/icon-original.png and okno/icon.png is overwritten in place, so the build
// (which references okno/icon.png) picks up the cleaned version automatically.

const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const SRC = path.join(__dirname, "..", "okno", "icon.png");
const BACKUP = path.join(__dirname, "..", "okno", "icon-original.png");

const png = PNG.sync.read(fs.readFileSync(SRC));
const { width, height, data } = png;
const at = (x, y) => (y * width + x) * 4;
const isWhite = (i) => data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235 && data[i + 3] > 10;

const visited = new Uint8Array(width * height);
const stack = [];
const push = (x, y) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const p = y * width + x;
  if (visited[p]) return;
  visited[p] = 1;
  stack.push(x, y);
};

// Seed from every border pixel.
for (let x = 0; x < width; x++) {
  push(x, 0);
  push(x, height - 1);
}
for (let y = 0; y < height; y++) {
  push(0, y);
  push(width - 1, y);
}

let cleared = 0;
while (stack.length) {
  const y = stack.pop();
  const x = stack.pop();
  const i = at(x, y);
  if (!isWhite(i)) continue;
  data[i + 3] = 0; // transparent
  cleared++;
  push(x + 1, y);
  push(x - 1, y);
  push(x, y + 1);
  push(x, y - 1);
}

if (!fs.existsSync(BACKUP)) fs.copyFileSync(SRC, BACKUP);
fs.writeFileSync(SRC, PNG.sync.write(png));
console.log(`Done: cleared ${cleared} background pixels. Backup: okno/icon-original.png`);
