// Vòng chạy headless dùng chung cho CLI và test. Trả về nội dung JSONL (Test Contract v1.0 mục E).
import { createGame, step, snapshot } from './sim.js';
import { createInputState, applyFrame } from './formats.js';

export function runHeadless({ seed, ticks, every = 10, scenario = null, frames = [] }) {
  const lines = [];
  const out = (o) => lines.push(JSON.stringify(o));
  const game = createGame({ seed, scenario });
  out(snapshot(game)); // tick 0: sau khi dựng scenario, trước input
  const input = createInputState();
  let fi = 0;
  for (let k = 0; k < ticks && game.state === 'playing'; k++) {
    while (fi < frames.length && frames[fi].tick <= k) applyFrame(input, frames[fi++]);
    for (const e of step(game, input)) out(e);
    if (game.tick % every === 0) out(snapshot(game));
  }
  out({ type: 'end', ticks: game.tick, state: game.state, score: game.score });
  return lines.join('\n') + '\n';
}
