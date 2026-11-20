import { runHeadless } from '../src/core/run.js';

// Chạy headless trong bộ nhớ và tách các loại dòng.
export function run({ seed = 1, ticks = 60, every = 1, scenario = null, frames = [] } = {}) {
  const text = runHeadless({ seed, ticks, every, scenario, frames });
  const lines = text.trim().split('\n').map((l) => JSON.parse(l));
  return {
    text,
    lines,
    events: lines.filter((l) => l.type === 'event'),
    snaps: lines.filter((l) => l.type === 'snapshot'),
    snapAt: (t) => lines.find((l) => l.type === 'snapshot' && l.tick === t),
    end: lines[lines.length - 1],
  };
}

// Scenario trống: không có đom đóm / Bóng Mực ngẫu nhiên.
export const empty = (extra = {}) => ({ random_motes: false, random_shades: false, motes: [], shades: [], ...extra });
