// Cảnh benchmark chuẩn (Ticket-04 §1): Đêm 1, 200 Bóng Mực wander rải đều trên đảo, 100 đom đóm,
// L1–L3 sáng fuel 100, Mây đứng yên ở (0,0,0). Không có thực thể sáng tạo thêm.
import { createGame } from './sim.js';
import { createRng } from './rng.js';

export const BENCH = Object.freeze({ shades: 200, motes: 100, radius: 38, orbitR: 30, orbitY: 15, orbitPeriodS: 15, warmupS: 3 });

function uniformDisk(rng, r) {
  const rr = r * Math.sqrt(rng());
  const a = rng() * 2 * Math.PI;
  return [Math.round(rr * Math.cos(a) * 1000) / 1000, Math.round(rr * Math.sin(a) * 1000) / 1000];
}

export function createBenchGame(seed = 42) {
  const rng = createRng(seed);
  const shades = [];
  for (let i = 0; i < BENCH.shades; i++) {
    const [x, z] = uniformDisk(rng, BENCH.radius);
    shades.push({ id: `S${i + 1}`, pos: [x, 1, z], state: 'wander' });
  }
  const motes = [];
  for (let i = 0; i < BENCH.motes; i++) {
    const [x, z] = uniformDisk(rng, BENCH.radius);
    motes.push([x, 0, z]);
  }
  const scenario = {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    shades,
    motes,
    lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: 100 })),
  };
  return createGame({ seed, night: 1, scenario, bench: true });
}

// Camera bay vòng: tâm (0,0,0), R = 30, Y = 15, bắt đầu ở góc 0° = (30,15,0), ngược chiều kim đồng hồ nhìn từ trên
// (x = R·cos, z = R·sin, cùng quy ước góc với bản đồ chuẩn), 15 s một vòng.
export function benchCamera(tSeconds) {
  const a = (2 * Math.PI * tSeconds) / BENCH.orbitPeriodS;
  return [BENCH.orbitR * Math.cos(a), BENCH.orbitY, BENCH.orbitR * Math.sin(a)];
}

// Thống kê theo đúng định nghĩa của Ticket-04 §1.
export function benchStats(dts) {
  const n = dts.length;
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(n - k);
  const p95 = sorted[Math.min(n - 1, Math.ceil(0.95 * n) - 1)];
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    avg_fps: r1((1000 * n) / sum),
    p1_low_fps: r1(1000 / (worst.reduce((a, b) => a + b, 0) / k)),
    frame_ms_p95: r1(p95),
    frames: n,
  };
}
