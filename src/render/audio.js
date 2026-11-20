// Âm thanh tổng hợp bằng WebAudio (không dùng file asset). Nhạc nền đêm + hiệu ứng.
let ctx = null;
let master = null;
let music = null;
let volume = 0.6;

export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v;
}

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  startMusic();
}

function tone(freq, dur, { type = 'sine', gain = 0.25, slideTo = null, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// Nhạc nền: hợp âm trầm ngũ cung, chậm, lặp lại.
function startMusic() {
  if (music) return;
  const notes = [146.83, 174.61, 196.0, 220.0, 261.63];
  let i = 0;
  music = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    tone(notes[i % notes.length] / 2, 3.5, { type: 'sine', gain: 0.05 });
    tone(notes[(i + 2) % notes.length], 2.5, { type: 'triangle', gain: 0.025, delay: 0.4 });
    i++;
  }, 2600);
}

export const sfx = {
  pick: () => tone(1100, 0.12, { type: 'triangle', gain: 0.15, slideTo: 1600 }),
  lantern: () => [523, 659, 784].forEach((f, i) => tone(f, 0.9, { type: 'triangle', gain: 0.18, delay: i * 0.08 })),
  pulse: () => tone(300, 0.6, { type: 'sawtooth', gain: 0.12, slideTo: 900 }),
  hit: () => tone(140, 0.4, { type: 'square', gain: 0.2, slideTo: 60 }),
  jump: () => tone(400, 0.15, { type: 'sine', gain: 0.12, slideTo: 700 }),
  dash: () => tone(800, 0.18, { type: 'sawtooth', gain: 0.08, slideTo: 300 }),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.6, { type: 'triangle', gain: 0.2, delay: i * 0.15 })),
  lose: () => [392, 311, 261].forEach((f, i) => tone(f, 0.7, { type: 'sine', gain: 0.2, delay: i * 0.25 })),
  shade: () => tone(90, 0.8, { type: 'sawtooth', gain: 0.1, slideTo: 60 }),
  tick: () => tone(1500, 0.05, { type: 'square', gain: 0.08 }),
  wind: () => tone(200, 1.5, { type: 'sawtooth', gain: 0.04, slideTo: 120 }),
};
