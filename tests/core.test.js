// Unit/scenario test cho các tiêu chí nghiệm thu R1–R13 (docs/notes/phase-1.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, empty } from './helpers.js';
import { TUNING } from '../src/core/tuning.js';

const S = TUNING.score;

test('R1: snapshot tick 0 — Mây ở gốc, 5 đèn, đang chơi, 300 s', () => {
  const r = run({ ticks: 0 });
  const s = r.snapAt(0);
  assert.deepEqual(s.player, { pos: [0, 0, 0], flames: 3, carried: 0 });
  assert.equal(s.lanterns.length, 5);
  assert.deepEqual(s.lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.equal(s.state, 'playing');
  assert.equal(s.time_left_s, 300);
  assert.equal(s.motes_active, 20);
  assert.equal(s.shades.length, 2);
  assert.deepEqual(r.end, { type: 'end', ticks: 0, state: 'playing', score: 0 });
});

test('R2: di chuyển theo yaw camera, đúng player_speed, chuẩn hóa vector', () => {
  const go = (move, yaw) =>
    run({ ticks: 60, scenario: empty(), frames: [{ tick: 0, move, cam_yaw_deg: yaw }] }).snapAt(60).player.pos;
  assert.deepEqual(go([0, 1], 0), [0, 0, 6]);
  assert.deepEqual(go([1, 0], 0), [6, 0, 0]);
  assert.deepEqual(go([0, 1], 90), [6, 0, 0]);
  assert.deepEqual(go([1, 0], 90), [0, 0, -6]);
  assert.deepEqual(go([1, 1], 0), [4.243, 0, 4.243]); // |v| = 6, không phải 8.485
  assert.deepEqual(go([0, 0.5], 0), [0, 0, 3]);
});

test('R2: nhảy rời mặt đất rồi rơi về Y = 0', () => {
  const r = run({ ticks: 60, scenario: empty(), frames: [{ tick: 0, jump: true }] });
  assert.ok(r.snapAt(10).player.pos[1] > 0.5);
  assert.equal(r.snapAt(60).player.pos[1], 0);
});

test('R3: nhặt đom đóm trong pickup_radius (≤), không nhặt khi ngoài bán kính', () => {
  const r = run({ ticks: 1, scenario: empty({ motes: [[0, 0, TUNING.pickup_radius]] }) });
  assert.deepEqual(r.events[0], { type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } });
  assert.equal(r.snapAt(1).score, S.per_mote);
  assert.equal(r.snapAt(1).motes_active, 0);

  const far = run({ ticks: 1, scenario: empty({ motes: [[0, 0, TUNING.pickup_radius + 0.01]] }) });
  assert.equal(far.events.length, 0);
});

test('R3: không nhặt khi đã đầy carry_capacity', () => {
  const r = run({
    ticks: 5,
    scenario: empty({ player: { carried: TUNING.carry_capacity }, motes: [[0, 0, 0.5]] }),
  });
  assert.equal(r.events.length, 0);
  assert.equal(r.snapAt(5).motes_active, 1);
});

test('R3: đi tới đom đóm thì nhặt ở đúng tick', () => {
  // Đi +Z 0.1 m/tick; đom đóm ở z = 3.2 → vào bán kính 1.2 khi z = 2.0 (tick 20)
  const r = run({ ticks: 40, scenario: empty({ motes: [[0, 0, 3.2]] }), frames: [{ tick: 0, move: [0, 1] }] });
  const ev = r.events.find((e) => e.name === 'mote_picked');
  assert.equal(ev.tick, 20);
});

test('R4: interact cạnh đèn → deposit + lantern_lit, điểm per_lantern', () => {
  const r = run({
    ticks: 2,
    scenario: empty({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.deepEqual(
    r.events.map((e) => [e.tick, e.name, e.data]),
    [
      [1, 'deposit', { lantern_id: 'L1', amount: 5, deposited: 5 }],
      [1, 'lantern_lit', { lantern_id: 'L1' }],
    ],
  );
  const s = r.snapAt(1);
  assert.equal(s.player.carried, 0);
  assert.equal(s.lanterns[0].lit, true);
  assert.equal(s.score, S.per_lantern);
});

test('R4: nạp một phần, giữ nút không nạp lại (chỉ cạnh lên), ngoài interact_radius không nạp', () => {
  const r = run({
    ticks: 30,
    scenario: empty({ player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 2], deposited: 1 }] }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.deepEqual(r.events.map((e) => e.name), ['deposit']);
  assert.deepEqual(r.events[0].data, { lantern_id: 'L1', amount: 3, deposited: 4 });

  const far = run({
    ticks: 2,
    scenario: empty({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, TUNING.interact_radius + 0.01] }] }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(far.events.length, 0);
});

test('R4: sự kiện ghi tick = k+1 cho input ở tick k', () => {
  const r = run({
    ticks: 200,
    scenario: empty({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] }),
    frames: [{ tick: 120, interact: true }],
  });
  assert.equal(r.events[0].tick, 121);
});

test('R5: thắp đèn cuối → thắng all_lit, điểm thưởng thời gian + ngọn lửa', () => {
  const lit = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true }));
  const r = run({
    ticks: 100,
    scenario: empty({ player: { carried: 5 }, lanterns: [...lit, { id: 'L5', pos: [0, 0, 2] }] }),
    frames: [{ tick: 0, interact: true }],
  });
  const over = r.events.find((e) => e.name === 'game_over');
  assert.deepEqual(over, { type: 'event', tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } });
  // đèn đặt sẵn lit:true không được cộng điểm
  const expected = S.per_lantern + S.per_second_left * 299 + S.per_flame_left * 3;
  assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'won', score: expected });
});

test('R6: Bóng Mực chạm → mất 1 ngọn lửa, rơi floor(carried × ratio), bất tử invuln_s', () => {
  const r = run({
    ticks: 200,
    scenario: empty({ player: { carried: 5, flames: 3 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }),
  });
  const hits = r.events.filter((e) => e.name === 'player_hit');
  assert.deepEqual(hits[0], { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 2, dropped: 2 } });
  assert.equal(hits[1].tick - hits[0].tick, Math.round(TUNING.invuln_s * 60));
  assert.equal(hits[1].data.dropped, 1); // floor(3 × 0.5)
});

test('R6: Bóng Mực đuổi theo Mây với shade_speed', () => {
  const r = run({ ticks: 60, scenario: empty({ shades: [{ id: 'S1', pos: [20, 1, 0] }] }) });
  assert.deepEqual(r.snapAt(60).shades[0], { id: 'S1', pos: [16, 1, 0], state: 'chase' });
});

test('R7: hết ngọn lửa → thua no_flames', () => {
  const r = run({ ticks: 100, scenario: empty({ player: { flames: 1 }, shades: [{ pos: [0.2, 1, 0] }] }) });
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'lost', score: 0 });
});

test('R8: tỏa sáng → choáng + đẩy Bóng Mực trong pulse_radius, tốn pulse_cost, có điểm', () => {
  const r = run({
    ticks: 1,
    scenario: empty({
      player: { carried: 2 },
      shades: [
        { id: 'S1', pos: [TUNING.pulse_radius, 1, 0] },
        { id: 'S2', pos: [0, 1, 20] },
      ],
    }),
    frames: [{ tick: 0, pulse: true }],
  });
  assert.deepEqual(r.events[0], { type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } });
  const s = r.snapAt(1);
  assert.deepEqual(s.shades[0], { id: 'S1', pos: [TUNING.pulse_radius + TUNING.pulse_push_m, 1, 0], state: 'stunned' });
  assert.equal(s.shades[1].state, 'chase');
  assert.equal(s.player.carried, 2 - TUNING.pulse_cost);
  assert.equal(s.score, S.per_stun);
});

test('R8: choáng đúng pulse_stun_s rồi đuổi tiếp; hồi chiêu pulse_cooldown_s', () => {
  const stun = Math.round(TUNING.pulse_stun_s * 60);
  const cd = Math.round(TUNING.pulse_cooldown_s * 60);
  const r = run({
    ticks: 300,
    scenario: empty({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [3, 1, 0] }] }),
    frames: [
      { tick: 0, pulse: true },
      { tick: 1, pulse: false },
      { tick: cd - 1, pulse: true }, // còn hồi chiêu → không có sự kiện
      { tick: cd, pulse: false },
      { tick: cd + 1, pulse: true }, // đã hồi → có sự kiện
      { tick: cd + 2, pulse: false },
    ],
  });
  const pulses = r.events.filter((e) => e.name === 'pulse');
  assert.deepEqual(pulses.map((e) => e.tick), [1, cd + 2]);
  // lần 1: choáng ở các trạng thái 1..stun
  const r1 = run({
    ticks: stun + 2,
    scenario: empty({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [3, 1, 0] }] }),
    frames: [{ tick: 0, pulse: true }],
  });
  assert.equal(r1.snapAt(stun).shades[0].state, 'stunned');
  assert.equal(r1.snapAt(stun + 1).shades[0].state, 'chase');
});

test('R8: không đủ đom đóm thì không tỏa sáng được', () => {
  const r = run({
    ticks: 2,
    scenario: empty({ player: { carried: 0 }, shades: [{ id: 'S1', pos: [3, 1, 0] }] }),
    frames: [{ tick: 0, pulse: true }],
  });
  assert.equal(r.events.filter((e) => e.name === 'pulse').length, 0);
});

test('R9: Bóng Mực không vào safe_radius của đèn đã thắp; Mây đứng trong vùng an toàn không bị chạm', () => {
  const r = run({
    ticks: 600,
    scenario: empty({
      player: { pos: [0, 0, 10] },
      lanterns: [{ id: 'L1', pos: [0, 0, 10], lit: true }],
      shades: [{ id: 'S1', pos: [0, 1, 0] }],
    }),
  });
  for (const s of r.snaps) {
    const [x, , z] = s.shades[0].pos;
    assert.ok(Math.hypot(x - 0, z - 10) > TUNING.safe_radius, `tick ${s.tick}`);
  }
  assert.equal(r.events.filter((e) => e.name === 'player_hit').length, 0);
});

test('R9: đèn chưa thắp không tạo vùng an toàn (giả định A8)', () => {
  const r = run({
    ticks: 600,
    scenario: empty({
      player: { pos: [0, 0, 10] },
      lanterns: [{ id: 'L1', pos: [0, 0, 10] }],
      shades: [{ id: 'S1', pos: [0, 1, 0] }],
    }),
  });
  assert.ok(r.events.some((e) => e.name === 'player_hit'));
});

test('R10: hết giờ → thua dawn; time_left_s = thời lượng − bước/60', () => {
  const r = run({ ticks: 1000, every: 10, scenario: empty({ time_left_s: 1 }) });
  assert.equal(r.snapAt(30).time_left_s, 0.5);
  assert.deepEqual(r.events.at(-1), { type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
  assert.deepEqual(r.end, { type: 'end', ticks: 60, state: 'lost', score: 0 });
});

test('R11: tất định — cùng seed/scenario/inputs cho output giống hệt; khác seed thì khác', () => {
  const frames = [
    { tick: 0, move: [0.3, 1], cam_yaw_deg: 30 },
    { tick: 90, jump: true },
    { tick: 91, jump: false, pulse: true },
    { tick: 200, move: [-1, 0] },
  ];
  const a = run({ seed: 42, ticks: 3000, every: 10, frames }).text;
  const b = run({ seed: 42, ticks: 3000, every: 10, frames }).text;
  const c = run({ seed: 43, ticks: 3000, every: 10, frames }).text;
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('R11: sinh Bóng Mực theo chu kỳ có id tự sinh và sự kiện shade_spawned', () => {
  const r = run({ ticks: 1600, every: 100, scenario: { shades: [] } });
  const spawned = r.events.filter((e) => e.name === 'shade_spawned');
  assert.deepEqual(spawned.map((e) => [e.tick, e.data.id]), [[1500, 'S1']]);
});

test('R13: --ticks N chạy đúng N bước; snapshot mỗi `every` tick; dòng cuối là end; làm tròn 3 chữ số', () => {
  const r = run({ ticks: 95, every: 10, scenario: empty(), frames: [{ tick: 0, move: [0.37, 0.61], cam_yaw_deg: 17 }] });
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  assert.equal(r.end.type, 'end');
  assert.equal(r.end.ticks, 95);
  for (const s of r.snaps) {
    for (const v of s.player.pos) assert.equal(v, Math.round(v * 1000) / 1000);
    assert.equal(s.sim_tick, s.tick);
  }
});
