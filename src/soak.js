#!/usr/bin/env node
// Soak test (Ticket-04 §2): node --expose-gc src/soak.js --seed 7 --nights 10 --out soak.json
// 10 Đêm liên tiếp trong cùng tiến trình, Đêm 1 → 2 → 3 xoay vòng; Đêm thứ i (i = 1..N) dùng seed 7 + i.
// Input ngẫu nhiên theo seed: mỗi 30 tick đổi hướng; mỗi tick 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createGame, step } from './core/sim.js';
import { createRng } from './core/rng.js';
import { createInputState } from './core/formats.js';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] !== undefined) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split('=')[1] : def;
}
const seed = Number(arg('seed', 7));
const nights = Number(arg('nights', 10));
const out = arg('out', 'soak.json');
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) {
  process.stderr.write('usage: node --expose-gc src/soak.js --seed <int> --nights <int> --out <file.json>\n');
  process.exit(1);
}

const gc = () => typeof globalThis.gc === 'function' && globalThis.gc();
const rssMb = () => Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;

function playNight(game, inputSeed) {
  // Input dùng luồng ngẫu nhiên riêng (seed khác) để không đổi chuỗi ngẫu nhiên của thế giới.
  const rng = createRng(inputSeed ^ 0x5eed);
  const input = createInputState();
  const maxTicks = Math.round(game.map.duration_s * 60) + 1;
  for (let k = 0; k < maxTicks && game.state === 'playing'; k++) {
    if (k % 30 === 0) {
      const a = rng() * 2 * Math.PI;
      input.move = [Math.cos(a), Math.sin(a)];
    }
    input.jump = rng() < 0.05;
    input.dash = rng() < 0.03;
    input.pulse = rng() < 0.02;
    input.interact = rng() < 0.1;
    step(game, input);
  }
  return game.state === 'playing' ? 'timeout' : game.state;
}

const t0 = process.hrtime.bigint();
const results = [];
let crashes = 0;
let memStart = null;
let game = null;
for (let i = 1; i <= nights; i++) {
  const night = ((i - 1) % 3) + 1;
  try {
    game = createGame({ seed: seed + i, night });
    if (i === 1) {
      gc();
      memStart = rssMb(); // sau khi tải xong Đêm đầu tiên
    }
    results.push(playNight(game, seed + i));
  } catch (e) {
    crashes++;
    results.push('crash');
    process.stderr.write(`night ${i} crashed: ${e.stack}\n`);
  }
  game = null; // reset Đêm
}
gc();
const memEnd = rssMb(); // sau khi reset xong Đêm cuối cùng
const report = {
  nights,
  crashes,
  results,
  mem_start_mb: memStart,
  mem_end_mb: memEnd,
  duration_s: Math.round(Number(process.hrtime.bigint() - t0) / 1e8) / 10,
  seed,
  pass: crashes === 0 && memEnd <= 1.2 * memStart,
};
const p = resolve(out);
mkdirSync(dirname(p), { recursive: true });
writeFileSync(p, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
process.exitCode = 0;
