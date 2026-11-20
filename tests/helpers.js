import { runHeadless } from '../src/core/run.js';

// Chạy headless trong bộ nhớ và tách các loại dòng.
export function run({ seed = 1, night = 1, ticks = 60, every = 1, scenario = null, frames = [] } = {}) {
  const text = runHeadless({ seed, night, ticks, every, scenario, frames });
  const lines = text.trim().split('\n').map((l) => JSON.parse(l));
  const events = lines.filter((l) => l.type === 'event' && l.name !== 'night_start');
  return {
    text,
    lines,
    events,
    ev: (name) => events.filter((e) => e.name === name),
    snaps: lines.filter((l) => l.type === 'snapshot'),
    snapAt: (t) => lines.find((l) => l.type === 'snapshot' && l.tick === t),
    end: lines[lines.length - 1],
  };
}

// Scenario trống: không có thực thể ngẫu nhiên.
export const empty = (extra = {}) => ({
  random_motes: false,
  random_shades: false,
  random_drifters: false,
  motes: [],
  shades: [],
  drifters: [],
  ...extra,
});

export const near = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;
