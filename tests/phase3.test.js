// Test Ticket-03 "Đèn cạn dầu" (Contract v1.2). Giá trị mong đợi tính tay; dầu theo đơn vị 1/60.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, empty, near } from './helpers.js';

const litAt = (id, pos, extra = {}) => ({ id, pos, lit: true, ...extra });

test('P3-FUEL: đèn sáng hao 1/giây; snapshot fuel 1 chữ số thập phân; lit:true không có fuel → 100', () => {
  const r = run({ ticks: 600, every: 60, scenario: empty({ lanterns: [litAt('L1', [0, 0, 10])] }) });
  assert.equal(r.snapAt(0).lanterns[0].fuel, 100);
  assert.equal(r.snapAt(60).lanterns[0].fuel, 99);
  assert.equal(r.snapAt(600).lanterns[0].fuel, 90);
  assert.equal(r.snapAt(0).lanterns[1].fuel, 0);
});

test('P3-OUT: hết dầu → lantern_out, tắt, deposited 0, ever_lit true', () => {
  const r = run({ ticks: 70, every: 1, scenario: empty({ lanterns: [litAt('L1', [0, 0, 10], { fuel: 1 })] }) });
  assert.deepEqual(r.ev('lantern_out')[0], { type: 'event', tick: 60, name: 'lantern_out', data: { lantern_id: 'L1' } });
  assert.deepEqual(
    (({ lit, deposited, fuel, ever_lit }) => ({ lit, deposited, fuel, ever_lit }))(r.snapAt(60).lanterns[0]),
    { lit: false, deposited: 0, fuel: 0, ever_lit: true },
  );
});

test('P3-REFUEL: used = min(mang, ceil((100−fuel)/10)), +10 fuel mỗi con, +5 điểm mỗi con', () => {
  const r = run({
    ticks: 1,
    scenario: empty({ player: { carried: 10 }, lanterns: [litAt('L1', [0, 0, 2], { fuel: 55 })] }),
    frames: [{ tick: 0, interact: true }],
  });
  // bước 2 trừ 1/60 trước: 54.983 → ceil(4.50) = 5 con → 100
  assert.deepEqual(r.ev('refuel')[0].data, { lantern_id: 'L1', amount: 5, fuel: 100 });
  assert.equal(r.snapAt(1).player.carried, 5);
  assert.equal(r.snapAt(1).score, 25);
});

test('P3-PICK: đèn đầy dầu không được chọn → chọn đèn nhận được kế bên', () => {
  // L1 vừa thắp trong cùng tick thì đầy; ở đây dùng L1 fuel 100 nhưng bước 2 đã trừ 1/60 → vẫn nhận 1 con.
  const r = run({
    ticks: 1,
    scenario: empty({ player: { carried: 3 }, lanterns: [litAt('L1', [0, 0, 1]), { id: 'L2', pos: [0, 0, 1.5] }] }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.deepEqual(r.ev('refuel')[0].data, { lantern_id: 'L1', amount: 1, fuel: 100 });
});

test('P3-RELIGHT: đèn từng sáng chỉ cần 5; +40 điểm; relit_count, capacity tăng 2', () => {
  const r = run({
    ticks: 1,
    scenario: empty({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 2], ever_lit: true }] }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.deepEqual(r.ev('lantern_lit')[0].data, { lantern_id: 'L1', relight: true });
  const s = r.snapAt(1);
  assert.equal(s.score, 5 * 5 + 40);
  assert.equal(s.lanterns[0].relit_count, 1);
  assert.equal(s.lanterns[0].fuel, 100);
  assert.equal(s.player.capacity, 12);
});

test('P3-CAP: sức chứa = 10 + 2 × successful_lights, tối đa 20; nhặt theo sức chứa mới', () => {
  assert.equal(run({ ticks: 0, scenario: empty({ player: { successful_lights: 5 } }) }).snapAt(0).player.capacity, 20);
  assert.equal(run({ ticks: 0, scenario: empty({ player: { successful_lights: 9 } }) }).snapAt(0).player.capacity, 20);
  const r = run({ ticks: 1, scenario: empty({ player: { carried: 10, successful_lights: 1 }, motes: [[0, 0, 0.5]] }) });
  assert.deepEqual(r.ev('mote_picked')[0].data, { carried: 11 });
});

test('P3-WIN: bình minh với ≥ 3/5 đèn sáng → won dawn_survived; điểm = Σ(50 + floor(fuel)) + 50 × lửa', () => {
  const r = run({
    ticks: 100,
    scenario: empty({ time_left_s: 1, lanterns: [litAt('L1', [0, 0, 25]), litAt('L2', [23.8, 0, 7.7]), litAt('L3', [14.7, 0, -20.2])] }),
  });
  assert.deepEqual(r.ev('game_over')[0], { type: 'event', tick: 60, name: 'game_over', data: { result: 'won', reason: 'dawn_survived' } });
  assert.deepEqual(r.end, { type: 'end', ticks: 60, state: 'won', score: 3 * (50 + 99) + 3 * 50 });
});

test('P3-WIN: dưới ngưỡng → lost dawn; ngưỡng Đêm 2 = 4/6, Đêm 3 = 5/7', () => {
  const two = run({ ticks: 100, scenario: empty({ time_left_s: 1, lanterns: [litAt('L1', [0, 0, 25]), litAt('L2', [23.8, 0, 7.7])] }) });
  assert.deepEqual(two.ev('game_over')[0].data, { result: 'lost', reason: 'dawn' });
  const lit = (n) => Array.from({ length: n }, (_, i) => ({ id: `L${i + 1}`, lit: true }));
  const n2 = (k) => run({ night: 2, ticks: 100, scenario: empty({ time_left_s: 1, lanterns: lit(k) }) }).end.state;
  assert.equal(n2(3), 'lost');
  assert.equal(n2(4), 'won');
  const n3 = (k) => run({ night: 3, ticks: 100, scenario: empty({ time_left_s: 1, lanterns: lit(k) }) }).end.state;
  assert.equal(n3(4), 'lost');
  assert.equal(n3(5), 'won');
});

test('P3-WIN: thắp đủ đèn không kết thúc Đêm sớm', () => {
  const all = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true }));
  const r = run({
    ticks: 120,
    scenario: empty({ player: { carried: 10 }, lanterns: [...all, { id: 'L5', pos: [0, 0, 2] }] }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.equal(r.ev('lantern_lit').length, 1);
  assert.equal(r.ev('game_over').length, 0);
  assert.equal(r.end.state, 'playing');
});

test('P3-WIN: hết lửa đúng tick bình minh → luôn thua no_flames', () => {
  const r = run({
    ticks: 5,
    scenario: empty({ time_left_s: 1 / 60, player: { flames: 1 }, shades: [{ pos: [0.3, 1, 0] }], lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true })) }),
  });
  assert.deepEqual(r.ev('game_over')[0].data, { result: 'lost', reason: 'no_flames' });
});

test('P3-DRAIN: Bóng wander đi tới đèn yếu (< 30), drain khi ≤ 2 m, hút 5/s + hao 1/s, fuel_drain mỗi 60 tick, đèn tắt', () => {
  const r = run({
    ticks: 320,
    every: 1,
    // Mây đứng xa (z = −25) để Bóng không chuyển chase khi đi qua vùng 12 m quanh Mây
    scenario: empty({ player: { pos: [0, 0, -25] }, lanterns: [litAt('L1', [0, 0, 10], { fuel: 20 })], shades: [{ id: 'S1', pos: [0, 1, 15] }] }),
  });
  assert.equal(r.snapAt(119).shades[0].state, 'wander');
  assert.equal(r.snapAt(120).shades[0].state, 'drain');
  assert.deepEqual(r.ev('fuel_drain')[0], { type: 'event', tick: 180, name: 'fuel_drain', data: { lantern_id: 'L1', shade_id: 'S1', fuel: 12 } });
  assert.deepEqual(r.ev('lantern_out')[0], { type: 'event', tick: 300, name: 'lantern_out', data: { lantern_id: 'L1' } });
  assert.equal(r.snapAt(300).shades[0].state, 'wander');
});

test('P3-DRAIN: đèn fuel < 30 mất vùng an toàn; đúng 30 vẫn còn', () => {
  const weak = run({ ticks: 1, scenario: empty({ lanterns: [litAt('L1', [0, 0, 0], { fuel: 29 })], shades: [{ id: 'S1', pos: [0, 1, 3], state: 'chase' }] }) });
  assert.ok(Math.hypot(...[0, 2].map((i) => weak.snapAt(1).shades[0].pos[i])) < 6);
  const ok = run({ ticks: 1, scenario: empty({ lanterns: [litAt('L1', [0, 0, 20], { fuel: 30.1 })], shades: [{ id: 'S1', pos: [0, 1, 17], state: 'chase' }] }) });
  assert.ok(Math.abs(ok.snapAt(1).shades[0].pos[2] - 20) >= 6 - 1e-3);
});

test('P3-DRAIN: drain → chase khi Mây trong 6 m; Tỏa Sáng trúng con đang drain +15, hết choáng về wander', () => {
  const sc = (ppos) => empty({ player: { pos: ppos, carried: 3 }, lanterns: [litAt('L1', [0, 0, 10], { fuel: 20 })], shades: [{ id: 'S1', pos: [0, 1, 11.5], state: 'drain', target_lantern_id: 'L1' }] });
  assert.equal(run({ ticks: 1, scenario: sc([0, 0, 6]) }).snapAt(1).shades[0].state, 'chase');
  assert.equal(run({ ticks: 1, scenario: sc([0, 0, -10]) }).snapAt(1).shades[0].state, 'drain');
  const p = run({ ticks: 125, scenario: sc([0, 0, 8]), frames: [{ tick: 0, pulse: true }] });
  assert.equal(p.snapAt(1).score, 15);
  assert.equal(p.snapAt(1).shades[0].state, 'stunned');
});

test('P3-EVICT: châm dầu lên ≥ 30 khi có Bóng trong 6 m → đẩy ra mép trong 30 tick, không gây sát thương', () => {
  const r = run({
    ticks: 40,
    every: 1,
    scenario: empty({ player: { pos: [0, 0, 0], carried: 10 }, lanterns: [litAt('L1', [0, 0, 2], { fuel: 20 })], shades: [{ id: 'S1', pos: [0, 1, 3.5], state: 'drain', target_lantern_id: 'L1' }] }),
    frames: [{ tick: 0, interact: true }],
  });
  assert.deepEqual(r.ev('refuel')[0].data, { lantern_id: 'L1', amount: 9, fuel: 100 });
  assert.ok(near(r.snapAt(30).shades[0].pos[2], 8));
  assert.equal(r.ev('player_hit').length, 0);
});
