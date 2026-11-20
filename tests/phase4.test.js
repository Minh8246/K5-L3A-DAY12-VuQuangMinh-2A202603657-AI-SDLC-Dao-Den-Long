// Test Ticket-04: cảnh benchmark, thống kê bench, soak, bảng xếp hạng. Giá trị mong đợi tính tay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBenchGame, benchCamera, benchStats, BENCH } from '../src/core/bench.js';
import { step, snapshot } from '../src/core/sim.js';
import { createInputState } from '../src/core/formats.js';
import { sortLeaderboard, addEntry, isValidName, isoWithOffset } from '../src/leaderboard.js';

const contract = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));

test('B1: cảnh bench — 200 Bóng Mực wander rải trên đảo, 100 đom đóm, L1–L3 sáng fuel 100, Mây ở (0,0,0)', () => {
  const s = snapshot(createBenchGame(42));
  assert.equal(s.shades.length, 200);
  assert.ok(s.shades.every((x) => x.state === 'wander'));
  assert.ok(s.shades.every((x) => Math.hypot(x.pos[0], x.pos[2]) <= 40));
  assert.equal(s.motes_active, 100);
  assert.deepEqual(s.lanterns.map((l) => [l.id, l.lit, l.fuel]), [['L1', true, 100], ['L2', true, 100], ['L3', true, 100], ['L4', false, 0], ['L5', false, 0]]);
  assert.deepEqual(s.player.pos, [0, 0, 0]);
  assert.equal(JSON.stringify(snapshot(createBenchGame(42))), JSON.stringify(s), 'tất định theo seed 42');
});

test('B2: trong bench tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm; Bóng Mực vẫn di chuyển', () => {
  const g = createBenchGame(42);
  const before = snapshot(g).shades.map((x) => x.pos.join());
  const input = createInputState();
  const events = [];
  for (let i = 0; i < 60 * 300; i++) events.push(...step(g, input)); // 300 s > thời lượng Đêm 1
  const s = snapshot(g);
  assert.equal(s.state, 'playing');
  assert.equal(s.shades.length, 200);
  assert.equal(s.motes_active, 100);
  assert.equal(s.player.flames, 3);
  assert.deepEqual(s.lanterns.slice(0, 3).map((l) => l.fuel), [100, 100, 100]);
  assert.deepEqual(events, []);
  assert.ok(s.shades.some((x, i) => x.pos.join() !== before[i]), 'Bóng Mực có di chuyển');
});

test('B3: camera bench — (30,15,0) lúc 0 s, ngược chiều kim đồng hồ, 15 s một vòng', () => {
  const r = (v) => v.map((x) => Math.round(x * 1000) / 1000 || 0);
  assert.deepEqual(r(benchCamera(0)), [30, 15, 0]);
  assert.deepEqual(r(benchCamera(3.75)), [0, 15, 30]); // 90° → +Z (x = cos, z = sin như bản đồ chuẩn)
  assert.deepEqual(r(benchCamera(15)), [30, 15, 0]);
  assert.equal(BENCH.warmupS, 3);
});

test('B4: thống kê bench theo đúng định nghĩa', () => {
  // 100 khung: 98 khung 10 ms, 2 khung 50 ms → N = 100, Σ = 1080 ms
  const dts = [...Array(98).fill(10), 50, 50];
  const st = benchStats(dts);
  assert.equal(st.frames, 100);
  assert.equal(st.avg_fps, 92.6); // 1000 × 100 / 1080
  assert.equal(st.p1_low_fps, 20); // k = 1 → khung chậm nhất 50 ms
  assert.equal(st.frame_ms_p95, 10);
  // k = ceil(0.01 × 250) = 3
  assert.equal(benchStats([...Array(247).fill(10), 20, 40, 60]).p1_low_fps, 25);
});

test('S1: soak 10 Đêm — không crash, RSS cuối ≤ 1.2 × RSS đầu, đúng định dạng', () => {
  const dir = mkdtempSync(join(tmpdir(), 'soak-'));
  const out = join(dir, 'soak.json');
  const [cmd, ...pre] = contract.soak_cmd.split(' ');
  const r = spawnSync(cmd, [...pre, '--seed', '7', '--nights', '10', '--out', out], { encoding: 'utf8', cwd: new URL('..', import.meta.url) });
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(j.nights, 10);
  assert.equal(j.crashes, 0);
  assert.equal(j.results.length, 10);
  assert.ok(j.results.every((x) => ['won', 'lost'].includes(x)));
  assert.ok(j.mem_end_mb <= 1.2 * j.mem_start_mb, `${j.mem_end_mb} > 1.2 × ${j.mem_start_mb}`);
});

test('L1: bảng xếp hạng — điểm giảm dần, bằng điểm thì ai đạt trước đứng trên, giữ top 10', () => {
  const e = (name, score, t) => ({ name, score, nights_won: 1, achieved_at: `2026-11-20T10:00:${String(t).padStart(2, '0')}+07:00`, seed: 1 });
  const list = sortLeaderboard([e('Bao', 100, 5), e('An', 300, 9), e('Cuc', 100, 1), ...Array.from({ length: 10 }, (_, i) => e(`P${i}xx`, 10 + i, 30))]);
  assert.equal(list.length, 10);
  assert.deepEqual(list.slice(0, 3).map((x) => x.name), ['An', 'Cuc', 'Bao']);
  assert.ok(!list.some((x) => x.name === 'P0xx'), 'điểm thấp nhất bị loại khỏi top 10');
});

test('L2: tên 3–12 ký tự [A-Za-z0-9_], có hỗ trợ tiếng Việt có dấu; achieved_at là ISO 8601 có múi giờ', () => {
  for (const ok of ['Minh', 'abc', 'A_1', 'Mây_đèn', 'Đảo123456789'.slice(0, 12)]) assert.ok(isValidName(ok), ok);
  for (const bad of ['ab', 'tên có dấu cách', 'a-b-c', 'x'.repeat(13), '']) assert.ok(!isValidName(bad), bad);
  assert.throws(() => addEntry([], { name: 'no', score: 1 }));
  assert.match(isoWithOffset(new Date(Date.UTC(2026, 10, 20, 9, 0, 0))), /^2026-11-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
});

test('C4: contract v1.3 có bench_cmd và soak_cmd', () => {
  assert.equal(contract.contract_version, '1.3');
  assert.ok(contract.bench_cmd && contract.soak_cmd);
});
