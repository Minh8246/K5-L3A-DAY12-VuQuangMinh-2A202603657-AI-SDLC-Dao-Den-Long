// Hồi quy Phase 1 (R1–R13) với SỐ CHUẨN của Ticket-02. Mỗi chỗ đổi so với Phase 1 có ghi chú "P2:".
// Giá trị mong đợi tính tay từ tuning; lý do sửa test: docs/notes/phase-2.md mục 5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, empty, near } from './helpers.js';
import { TUNING } from '../src/core/tuning.js';

const S = TUNING.score;

test('R1: tick 0 — night_start, Mây ở gốc, 5 đèn chuẩn, 20 đom đóm, chưa có Bóng Mực', () => {
  const r = run({ ticks: 0 });
  assert.deepEqual(r.lines[0], { type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
  const s = r.snapAt(0);
  assert.deepEqual(s.player.pos, [0, 0, 0]);
  assert.equal(s.player.flames, 3);
  assert.deepEqual(
    s.lanterns.map((l) => l.pos),
    [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  );
  assert.equal(s.state, 'playing');
  assert.equal(s.time_left_s, 240); // P3: Đêm 1 = 240 s
  assert.equal(s.night, 1);
  assert.equal(s.motes_active, 20);
  assert.equal(new Set(s.motes.map((m) => m.pos.join())).size, 20, '20 điểm khác nhau');
  assert.deepEqual(s.shades, []); // P2: Bóng Mực sinh từ tick 300
  assert.deepEqual(r.end, { type: 'end', ticks: 0, state: 'playing', score: 0 });
});

test('R2: di chuyển theo yaw camera, 6 m/s, chuẩn hóa vector', () => {
  const go = (move, yaw) =>
    run({ ticks: 60, scenario: empty(), frames: [{ tick: 0, move, cam_yaw_deg: yaw }] }).snapAt(60).player.pos;
  assert.deepEqual(go([0, 1], 0), [0, 0, 6]);
  assert.deepEqual(go([1, 0], 0), [6, 0, 0]);
  assert.deepEqual(go([0, 1], 90), [6, 0, 0]);
  assert.deepEqual(go([1, 0], 90), [0, 0, -6]);
  assert.deepEqual(go([1, 1], 0), [4.243, 0, 4.243]);
  assert.deepEqual(go([0, 0.5], 0), [0, 0, 3]);
});

test('R2: nhảy 7 m/s, trọng lực 20, chỉ nhảy khi chạm đất', () => {
  const r = run({ ticks: 60, scenario: empty(), frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 5, jump: true }] });
  assert.ok(r.snapAt(10).player.pos[1] > 0.5);
  assert.equal(r.snapAt(10).player.grounded, false);
  assert.equal(r.snapAt(60).player.pos[1], 0);
  assert.equal(r.snapAt(60).player.grounded, true);
  const peak = Math.max(...r.snaps.map((s) => s.player.pos[1]));
  assert.ok(peak < 1.3, `nhảy giữa không trung không được (đỉnh ${peak})`);
});

test('R3: nhặt tự động khi XZ ≤ 1.0 và chênh cao ≤ 1.5', () => {
  const r = run({ ticks: 1, scenario: empty({ motes: [[0, 0, 1.0]] }) });
  assert.deepEqual(r.events[0], { type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } });
  assert.equal(r.snapAt(1).score, 0); // P2: điểm tính khi NẠP, không phải khi nhặt
  assert.equal(run({ ticks: 1, scenario: empty({ motes: [[0, 0, 1.01]] }) }).events.length, 0);
  assert.equal(run({ ticks: 1, scenario: empty({ motes: [[0, 1.5, 0.5]] }) }).events.length, 1);
  assert.equal(run({ ticks: 1, scenario: empty({ motes: [[0, 1.6, 0.5]] }) }).events.length, 0);
});

test('R3: không nhặt khi đầy 10; đi tới đom đóm thì nhặt đúng tick', () => {
  const full = run({ ticks: 5, scenario: empty({ player: { carried: 10 }, motes: [[0, 0, 0.5]] }) });
  assert.equal(full.events.length, 0);
  // đi +Z 0.1 m/tick; đom đóm ở z = 3.2 → vào bán kính 1.0 khi z = 2.2 (tick 22)
  const r = run({ ticks: 40, scenario: empty({ motes: [[0, 0, 3.2]] }), frames: [{ tick: 0, move: [0, 1] }] });
  assert.equal(r.ev('mote_picked')[0].tick, 22);
});

test('R4: nạp đủ 10 → lantern_lit; +5/đom đóm nạp (P3), +100 thắp lần đầu', () => {
  const r = run({
    ticks: 2,
    scenario: empty({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.deepEqual(
    r.events.map((e) => [e.tick, e.name, e.data]),
    [
      [1, 'deposit', { lantern_id: 'L1', amount: 10, deposited: 10 }],
      [1, 'lantern_lit', { lantern_id: 'L1', relight: false }], // P3: thêm trường relight
    ],
  );
  assert.equal(r.snapAt(1).score, 10 * 5 + 100);
});

test('R4: nạp nhiều lần (đèn nhớ tiến độ), chỉ cạnh lên, ngoài 2.0 m thì không nạp', () => {
  const r = run({
    ticks: 30,
    scenario: empty({ player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 2], deposited: 1 }] }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.deepEqual(r.events.map((e) => e.data), [{ lantern_id: 'L1', amount: 3, deposited: 4 }]);
  assert.equal(r.snapAt(1).score, 15); // P3: +5 mỗi đom đóm nạp
  const far = run({
    ticks: 2,
    scenario: empty({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 2.01] }] }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(far.events.length, 0);
});

test('R4: hai đèn trong bán kính → chọn đèn gần nhất; bằng nhau → id nhỏ hơn', () => {
  const r = run({
    ticks: 1,
    scenario: empty({ player: { carried: 1 }, lanterns: [{ id: 'L1', pos: [1.5, 0, 0] }, { id: 'L2', pos: [-1.5, 0, 0] }, { id: 'L3', pos: [0, 0, 1] }] }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(r.events[0].data.lantern_id, 'L3');
  const tie = run({
    ticks: 1,
    scenario: empty({ player: { carried: 1 }, lanterns: [{ id: 'L2', pos: [1.5, 0, 0] }, { id: 'L1', pos: [-1.5, 0, 0] }] }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(tie.events[0].data.lantern_id, 'L1');
});

test('R4: sự kiện ghi tick = k+1 cho input ở tick k', () => {
  const r = run({
    ticks: 200,
    scenario: empty({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] }),
    frames: [{ tick: 120, interact: true }],
  });
  assert.equal(r.events[0].tick, 121);
});

// R5 (thắng ngay khi thắp hết đèn, reason all_lit) và R5/T3 (thắng đúng tick hết giờ do all_lit) đã BỊ XÓA ở Phase 3:
// Ticket-03 §3 [THAY THẾ] luật thắng — không còn thắng sớm, all_lit không còn dùng. Test thay thế: P3-WIN-* trong tests/phase3.test.js.

test('R6: Bóng Mực chạm → −1 lửa, rơi floor(n/2), bất tử 90 tick, bóng recoil', () => {
  const r = run({ ticks: 200, scenario: empty({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }) });
  const hits = r.ev('player_hit');
  assert.deepEqual(hits[0], { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 2, dropped: 2 } });
  assert.ok(hits[1].tick - hits[0].tick >= 90);
  const s1 = r.snapAt(1);
  assert.equal(s1.player.invuln, true);
  assert.equal(s1.shades[0].state, 'recoil');
});

test('R6: Bóng Mực đuổi (≤ 12 m) với 4 m/s', () => {
  const r = run({ ticks: 60, scenario: empty({ shades: [{ id: 'S1', pos: [10, 1, 0] }] }) });
  assert.deepEqual(r.snapAt(60).shades[0], { id: 'S1', pos: [6, 1, 0], state: 'chase' });
});

test('R7: hết lửa → thua no_flames', () => {
  const r = run({ ticks: 100, scenario: empty({ player: { flames: 1 }, shades: [{ pos: [0.2, 1, 0] }] }) });
  assert.deepEqual(r.ev('game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'lost', score: 0 });
});

test('R8: Tỏa Sáng — tâm chân+0.8, 3D ≤ 5, tốn 3, +5/con, choáng, đẩy 4 m trong 15 tick', () => {
  const r = run({
    ticks: 130,
    scenario: empty({
      player: { carried: 3 },
      shades: [
        { id: 'S1', pos: [4.9, 1, 0] }, // 3D = 4.904 → trúng
        { id: 'S2', pos: [0, 1, -5] }, // 3D = 5.004 → trượt
      ],
    }),
    frames: [{ tick: 0, pulse: true }],
  });
  assert.deepEqual(r.ev('pulse')[0], { type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } });
  assert.equal(r.snapAt(1).player.carried, 0);
  assert.equal(r.snapAt(1).score, S.per_stun);
  assert.equal(r.snapAt(1).shades[0].state, 'stunned');
  assert.ok(near(r.snapAt(15).shades[0].pos[0], 8.9), `đẩy 4 m sau 15 tick: ${r.snapAt(15).shades[0].pos[0]}`);
  assert.equal(r.snapAt(30).shades[0].pos[0], r.snapAt(15).shades[0].pos[0]);
  assert.equal(r.snapAt(120).shades[0].state, 'stunned');
  assert.notEqual(r.snapAt(121).shades[0].state, 'stunned');
});

test('R8: hồi chiêu 180 tick; không đủ 3 đom đóm thì không kích hoạt; trúng con đang choáng vẫn +5', () => {
  const r = run({
    ticks: 200,
    scenario: empty({ player: { carried: 9 }, shades: [{ id: 'S1', pos: [3, 1, 0] }] }),
    frames: [
      { tick: 0, pulse: true },
      { tick: 1, pulse: false },
      { tick: 179, pulse: true }, // còn 1 tick hồi chiêu
      { tick: 180, pulse: false },
      { tick: 181, pulse: true },
    ],
  });
  assert.deepEqual(r.ev('pulse').map((e) => e.tick), [1, 182]);
  assert.equal(r.end.score, 2 * S.per_stun); // con thứ 2 lúc bị trúng đã hết choáng hoặc đang choáng: đều +5
  const poor = run({ ticks: 2, scenario: empty({ player: { carried: 2 }, shades: [{ pos: [3, 1, 0] }] }), frames: [{ tick: 0, pulse: true }] });
  assert.equal(poor.ev('pulse').length, 0);
});

test('R9: vùng an toàn 6 m của đèn đã sáng chặn Bóng Mực; đèn chưa sáng thì không', () => {
  const sc = (lit) =>
    empty({ player: { pos: [0, 0, 10] }, lanterns: [{ id: 'L1', pos: [0, 0, 10], lit }], shades: [{ id: 'S1', pos: [0, 1, 0] }] });
  const r = run({ ticks: 600, scenario: sc(true) });
  for (const s of r.snaps) {
    const [x, , z] = s.shades[0].pos;
    assert.ok(Math.hypot(x, z - 10) >= TUNING.safe_radius - 1e-3, `tick ${s.tick}`);
  }
  assert.equal(r.ev('player_hit').length, 0);
  assert.ok(run({ ticks: 600, scenario: sc(false) }).ev('player_hit').length > 0);
});

test('R9: Bóng Mực trong vùng lúc đèn vừa thắp bị đẩy ra mép trong 30 tick', () => {
  const r = run({
    ticks: 40,
    scenario: empty({ player: { pos: [0, 0, 8], carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 10] }], shades: [{ id: 'S1', pos: [0, 1, 13] }] }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.ok(near(r.snapAt(1).shades[0].pos[2], 13.1));
  assert.ok(near(r.snapAt(30).shades[0].pos[2], 16));
  assert.equal(r.ev('player_hit').length, 0);
});

test('R10: hết giờ → thua dawn; time_left_s = thời lượng − sim_tick/60', () => {
  const r = run({ ticks: 1000, every: 10, scenario: empty({ time_left_s: 1 }) });
  assert.equal(r.snapAt(30).time_left_s, 0.5);
  assert.deepEqual(r.ev('game_over')[0], { type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
  assert.deepEqual(r.end, { type: 'end', ticks: 60, state: 'lost', score: 0 });
});

test('R11: tất định; khác seed thì khác', () => {
  const frames = [
    { tick: 0, move: [0.3, 1], cam_yaw_deg: 30 },
    { tick: 90, jump: true },
    { tick: 91, jump: false, dash: true },
    { tick: 200, move: [-1, 0] },
  ];
  for (const night of [1, 2, 3]) {
    const a = run({ seed: 42, night, ticks: 3000, every: 10, frames }).text;
    const b = run({ seed: 42, night, ticks: 3000, every: 10, frames }).text;
    const c = run({ seed: 43, night, ticks: 3000, every: 10, frames }).text;
    assert.equal(a, b, `night ${night}`);
    assert.notEqual(a, c, `night ${night}`);
  }
});

test('R11/T4: lịch sinh Bóng Mực Đêm 1: 2 con tick 300, rồi mỗi 480, tối đa 6, cách Mây ≥ 15 m, trên vòng 37 m', () => {
  const r = run({ ticks: 4000, every: 10, scenario: { random_motes: false, random_drifters: false, player: { flames: 99 } } });
  const sp = r.ev('shade_spawned');
  assert.deepEqual(sp.map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2'], [780, 'S3'], [1260, 'S4'], [1740, 'S5'], [2220, 'S6']]);
  const s300 = r.snapAt(300);
  for (const s of s300.shades) {
    assert.equal(s.state, 'spawning');
    assert.ok(near(Math.hypot(s.pos[0], s.pos[2]), 37, 0.01));
    assert.ok(Math.hypot(s.pos[0], s.pos[2]) >= 15);
  }
  assert.notEqual(r.snapAt(360).shades[0].state, 'spawning');
});

test('T4: đom đóm sinh thêm ở tick 240, 480… vào điểm trống (Đêm 1 có 24 điểm)', () => {
  const r = run({ ticks: 1300, every: 10, scenario: { random_shades: false, random_drifters: false } });
  assert.equal(r.snapAt(230).motes_active, 20);
  assert.equal(r.snapAt(240).motes_active, 21);
  assert.equal(r.snapAt(960).motes_active, 24);
  assert.equal(r.snapAt(1200).motes_active, 24); // hết điểm trống → bỏ lượt
});

test('R13: --ticks N chạy đúng N bước; snapshot mỗi `every`; dòng cuối end; làm tròn 3 chữ số', () => {
  const r = run({ ticks: 95, every: 10, scenario: empty(), frames: [{ tick: 0, move: [0.37, 0.61], cam_yaw_deg: 17 }] });
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  assert.equal(r.end.ticks, 95);
  for (const s of r.snaps) {
    for (const v of s.player.pos) assert.equal(v, Math.round(v * 1000) / 1000);
    assert.equal(s.sim_tick, s.tick);
  }
});
