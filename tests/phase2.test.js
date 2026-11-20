// Test tính năng mới của Ticket-02 (T2, T5–T13). Giá trị mong đợi tính tay từ số chuẩn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, empty, near } from './helpers.js';

test('T2: snapshot v1.1 có đủ trường mới', () => {
  const s = run({ night: 2, ticks: 0 }).snapAt(0);
  for (const k of ['night', 'wind', 'drifters', 'charms', 'motes']) assert.ok(k in s, k);
  assert.deepEqual(Object.keys(s.player).sort(), ['carried', 'charm_s', 'dash_cd_s', 'flames', 'grounded', 'invuln', 'pos', 'pulse_cd_s', 'vel'].sort());
  assert.deepEqual(s.wind, { active: false, dir_deg: null });
  assert.deepEqual(s.charms, [{ id: 'C1', available: true, respawn_s: 0 }]);
  assert.deepEqual(Object.keys(s.motes[0]).sort(), ['id', 'kind', 'pos', 'ttl_s']);
});

test('T5: lướt 14 m/s × 12 tick theo hướng di chuyển, hồi 90 tick từ lúc bắt đầu', () => {
  const r = run({
    ticks: 100,
    scenario: empty(),
    frames: [{ tick: 0, move: [0, 1], dash: true }, { tick: 1, dash: false }, { tick: 89, dash: true }, { tick: 90, dash: false }, { tick: 91, dash: true }],
  });
  assert.deepEqual(r.ev('dash').map((e) => e.tick), [1, 92]);
  assert.ok(near(r.snapAt(12).player.pos[2], 2.8));
  assert.ok(near(r.snapAt(60).player.pos[2], 2.8 + 48 * 0.1));
  assert.equal(r.snapAt(1).player.dash_cd_s, 1.5); // hồi 90 tick tính từ lúc bắt đầu lướt (tick 0)
});

test('T5: đứng yên thì lướt theo hướng đang quay mặt (+Z lúc đầu); trên không giữ độ cao', () => {
  const still = run({ ticks: 12, scenario: empty(), frames: [{ tick: 0, dash: true }] });
  assert.ok(near(still.snapAt(12).player.pos[2], 2.8));
  const air = run({ ticks: 40, scenario: empty(), frames: [{ tick: 0, jump: true }, { tick: 10, dash: true }] });
  const y10 = air.snapAt(10).player.pos[1];
  const y11 = air.snapAt(11).player.pos[1];
  assert.equal(air.snapAt(22).player.pos[1], y11);
  assert.ok(y11 >= y10 - 1e-9);
});

test('T6: tạm dừng — tick tăng, sim_tick/thời gian đứng yên, state paused; tiếp tục chạy lại', () => {
  const r = run({
    ticks: 30,
    scenario: empty(),
    frames: [{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 20, pause: true }],
  });
  assert.deepEqual(r.events.map((e) => [e.tick, e.name]), [[11, 'paused'], [21, 'resumed']]);
  assert.equal(r.snapAt(15).state, 'paused');
  assert.equal(r.snapAt(15).sim_tick, 10);
  assert.equal(r.snapAt(15).time_left_s, r.snapAt(11).time_left_s);
  assert.equal(r.snapAt(30).sim_tick, 20);
  assert.ok(near(r.snapAt(30).player.pos[2], 2.0));
});

test('T7: đom đóm rơi ra vành 1.5–2.5 m, kind dropped, TTL 480 tick, nhặt lại được', () => {
  const r = run({ ticks: 490, scenario: empty({ player: { carried: 4, flames: 9 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }) });
  const d1 = r.snapAt(1).motes.filter((m) => m.kind === 'dropped');
  assert.equal(d1.length, 2);
  for (const m of d1) {
    const d = Math.hypot(m.pos[0], m.pos[2]);
    assert.ok(d >= 1.5 - 1e-3 && d <= 2.5 + 1e-3, `r=${d}`);
    assert.equal(m.ttl_s, 8);
  }
  const ids = d1.map((m) => m.id);
  assert.ok(ids.every((id) => r.snapAt(480).motes.some((m) => m.id === id)));
  assert.ok(ids.every((id) => !r.snapAt(481).motes.some((m) => m.id === id)));
  // recoil: lùi 2 m trong 60 tick
  assert.ok(near(r.snapAt(61).shades[0].pos[0], 0.5 - 4 / 60 + 2));
  // nhặt lại: đi tới đom đóm rơi
  const m = d1[0];
  const back = run({
    ticks: 120,
    scenario: empty({ player: { carried: 4 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }),
    frames: [{ tick: 1, move: [m.pos[0] / Math.hypot(m.pos[0], m.pos[2]), m.pos[2] / Math.hypot(m.pos[0], m.pos[2])] }, { tick: 20, move: [0, 0] }],
  });
  assert.ok(back.ev('mote_picked').length >= 1);
});

test('T8: rơi khỏi đảo — −1 lửa, mất hết đom đóm, chờ 60 tick, hồi sinh tại xuất phát, bất tử', () => {
  const r = run({ ticks: 300, scenario: empty({ player: { pos: [39.5, 0, 0], carried: 5 } }), frames: [{ tick: 0, move: [1, 0] }, { tick: 10, move: [0, 0] }] });
  const fall = r.ev('player_hit');
  assert.equal(fall.length, 1);
  assert.deepEqual(fall[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 5 });
  const t = fall[0].tick;
  assert.ok(r.snapAt(t + 59).player.pos[1] < -10);
  assert.deepEqual(r.snapAt(t + 60).player.pos, [0, 0, 0]);
  assert.equal(r.snapAt(t + 60).player.invuln, true);
  assert.equal(r.snapAt(t + 60).player.carried, 0);
  const dead = run({ ticks: 300, scenario: empty({ player: { pos: [39.5, 0, 0], flames: 1 } }), frames: [{ tick: 0, move: [1, 0] }] });
  assert.deepEqual(dead.ev('game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(dead.ev('game_over')[0].tick, dead.ev('player_hit')[0].tick);
});

test('T9: Bóng Mực wander → chase (≤ 12) → wander (> 18); trạng thái đặt từ scenario', () => {
  const lose = run({ ticks: 1, scenario: empty({ shades: [{ id: 'S1', pos: [19, 1, 0], state: 'chase' }] }) });
  assert.equal(lose.snapAt(1).shades[0].state, 'wander');
  const keep = run({ ticks: 1, scenario: empty({ shades: [{ id: 'S1', pos: [17, 1, 0], state: 'chase' }] }) });
  assert.equal(keep.snapAt(1).shades[0].state, 'chase');
  const det = run({ ticks: 1, scenario: empty({ shades: [{ id: 'S1', pos: [12, 1, 0] }] }) });
  assert.equal(det.snapAt(1).shades[0].state, 'chase');
  const stun = run({ ticks: 31, scenario: empty({ shades: [{ id: 'S1', pos: [8, 1, 0], state: 'stunned', state_ticks_left: 30 }] }) });
  assert.equal(stun.snapAt(29).shades[0].state, 'stunned');
  assert.equal(stun.snapAt(30).shades[0].state, 'chase');
});

test('T10: Đêm 2 — 6 đèn chuẩn, bục nhảy bắn sang đảo B (~1.4 s), cầu tre đi được', () => {
  const s0 = run({ night: 2, ticks: 0 }).snapAt(0);
  assert.deepEqual(s0.lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
  assert.equal(s0.time_left_s, 330);
  const pad = run({ night: 2, ticks: 120, scenario: empty({ player: { pos: [20, 0, 18] } }) });
  const landed = pad.snaps.find((s) => s.tick > 5 && s.player.grounded);
  assert.ok(landed.tick >= 80 && landed.tick <= 90, `đáp ở tick ${landed.tick}`);
  assert.ok(Math.hypot(landed.player.pos[0] - 70, landed.player.pos[2]) <= 28, 'đáp trong đảo B');
  const bridge = run({ night: 2, ticks: 200, scenario: empty({ player: { pos: [24, 0, 0] } }), frames: [{ tick: 0, move: [1, 0] }] });
  assert.equal(bridge.ev('player_hit').length, 0);
  assert.ok(bridge.snapAt(200).player.pos[0] > 44);
  const off = run({ night: 2, ticks: 200, scenario: empty({ player: { pos: [30, 0, 1] } }), frames: [{ tick: 0, move: [0, 1] }] });
  assert.equal(off.ev('player_hit')[0].data.by, 'fall');
});

test('T11: Đêm 3 — xuất phát (0,0,−20), 7 đèn, vách chặn, dốc lên tầng 1, tháp chặn, bục lên tầng 2, Bóng Mực 4.5 m/s', () => {
  const s0 = run({ night: 3, ticks: 0 }).snapAt(0);
  assert.deepEqual(s0.player.pos, [0, 0, -20]);
  assert.equal(s0.lanterns.length, 7);
  const wall = run({ night: 3, ticks: 60, scenario: empty({ player: { pos: [0, 0, 9] } }), frames: [{ tick: 0, move: [0, 1] }] });
  assert.ok(wall.snapAt(60).player.pos[2] <= 12 && wall.snapAt(60).player.pos[1] === 0, 'vách tầng 1 chặn');
  const a = (30 * Math.PI) / 180;
  const ramp = run({
    night: 3,
    ticks: 70,
    scenario: empty({ player: { pos: [30 * Math.cos(a), 0, 30 * Math.sin(a)] } }),
    frames: [{ tick: 0, move: [-Math.cos(a), -Math.sin(a)] }],
  });
  assert.equal(ramp.snapAt(70).player.pos[1], 3);
  assert.equal(ramp.snapAt(70).player.grounded, true);
  const tower = run({ night: 3, ticks: 60, scenario: empty({ player: { pos: [0, 6, -5] } }), frames: [{ tick: 0, move: [0, 1] }] });
  assert.ok(near(Math.hypot(tower.snapAt(60).player.pos[0], tower.snapAt(60).player.pos[2]), 2, 0.01));
  const pad = run({ night: 3, ticks: 90, scenario: empty({ player: { pos: [0, 3, 13] } }) });
  assert.equal(pad.snapAt(90).player.pos[1], 6);
  assert.equal(pad.snapAt(90).player.grounded, true);
  const sp = run({ night: 3, ticks: 60, scenario: empty({ shades: [{ id: 'S1', pos: [10, 1, -20] }] }) });
  assert.ok(near(sp.snapAt(60).shades[0].pos[0], 5.5));
});

test('T11: Đêm 3 — gió mạnh mỗi 30 s, kéo dài 5 s, đẩy 2 m/s', () => {
  const r = run({ night: 3, ticks: 2200, every: 10, scenario: empty() });
  assert.equal(r.snapAt(1790).wind.active, false);
  assert.equal(r.snapAt(1800).wind.active, true);
  assert.ok(r.snapAt(1800).wind.dir_deg >= 0 && r.snapAt(1800).wind.dir_deg < 360);
  assert.equal(r.snapAt(2090).wind.active, true);
  assert.equal(r.snapAt(2100).wind.active, false);
  const moved = Math.hypot(r.snapAt(2100).player.pos[0] - 0, r.snapAt(2100).player.pos[2] + 20);
  assert.ok(near(moved, 10, 0.05), `gió đẩy 2 m/s × 5 s = 10 m, thực tế ${moved}`);
  const calm = run({ night: 1, ticks: 2000, every: 100, scenario: empty() });
  assert.equal(calm.snapAt(1800).wind.active, false);
});

test('T12: Gió Lạc — đuổi khi mang ≥ 5 và ≤ 15 m, cướp min(3,n), flee 240 tick rồi removed', () => {
  const r = run({ night: 2, ticks: 400, scenario: empty({ player: { carried: 6 }, drifters: [{ id: 'D1', pos: [10, 1, 0] }] }) });
  assert.equal(r.snapAt(1).drifters[0].state, 'chase');
  assert.deepEqual(r.ev('drifter_steal')[0], { type: 'event', tick: 76, name: 'drifter_steal', data: { drifter_id: 'D1', amount: 3, carried: 3 } });
  assert.equal(r.snapAt(76).drifters[0].state, 'flee');
  assert.equal(r.snapAt(76).drifters[0].stolen, 3);
  assert.equal(r.snapAt(315).drifters[0].state, 'flee');
  assert.equal(r.snapAt(316).drifters[0].state, 'removed');
  assert.equal(r.ev('player_hit').length, 0, 'Gió Lạc không làm mất lửa');
  const lazy = run({ night: 2, ticks: 1, scenario: empty({ player: { carried: 4 }, drifters: [{ id: 'D1', pos: [10, 1, 0] }] }) });
  assert.equal(lazy.snapAt(1).drifters[0].state, 'idle');
});

test('T12: Tỏa Sáng trúng Gió Lạc đang chase → flee không cướp; đang flee có đồ → thả lại, biến mất sau 120 tick', () => {
  const c = run({
    night: 2,
    ticks: 300,
    scenario: empty({ player: { carried: 8 }, drifters: [{ id: 'D1', pos: [4, 1, 0], state: 'chase' }] }),
    frames: [{ tick: 0, pulse: true }],
  });
  assert.equal(c.snapAt(1).drifters[0].state, 'flee');
  assert.equal(c.ev('drifter_steal').length, 0);
  const f = run({
    night: 2,
    ticks: 200,
    scenario: empty({ player: { carried: 3 }, drifters: [{ id: 'D1', pos: [3, 1, 0], state: 'flee', stolen: 3 }] }),
    frames: [{ tick: 0, pulse: true }],
  });
  assert.deepEqual(f.ev('drifter_drop')[0].data, { drifter_id: 'D1', amount: 3 });
  assert.equal(f.snapAt(1).motes.filter((m) => m.kind === 'dropped').length, 3);
  assert.equal(f.snapAt(120).drifters[0].state, 'flee');
  assert.equal(f.snapAt(121).drifters[0].state, 'removed');
});

test('T12: Gió Lạc sinh ở tick 1200 trên Đêm 2, không có ở Đêm 1', () => {
  const r = run({ night: 2, ticks: 1200, every: 100, scenario: { random_shades: false } });
  assert.equal(r.snapAt(1100).drifters.length, 0);
  assert.equal(r.snapAt(1200).drifters.length, 1);
  assert.equal(r.snapAt(1200).drifters[0].id, 'D1');
  assert.equal(run({ night: 1, ticks: 1200, every: 100, scenario: { random_shades: false } }).snapAt(1200).drifters.length, 0);
});

test('T13: Bùa Gió — nhặt → 600 tick, chạy 7.2 m/s, lướt không hồi chiêu, xuất hiện lại sau 2700 tick', () => {
  const r = run({
    night: 2,
    ticks: 2710,
    every: 1,
    scenario: empty({ player: { pos: [34.5, 0, 0] } }),
    frames: [{ tick: 1, move: [0, 1] }, { tick: 61, move: [0, 0] }],
  });
  assert.deepEqual(r.ev('charm_picked')[0], { type: 'event', tick: 1, name: 'charm_picked', data: { charm_id: 'C1', charm_ticks: 600 } });
  assert.equal(r.snapAt(1).player.charm_s, 10);
  assert.ok(near(r.snapAt(61).player.pos[2] - r.snapAt(1).player.pos[2], 7.2));
  assert.deepEqual(r.snapAt(1).charms[0], { id: 'C1', available: false, respawn_s: 45 });
  assert.equal(r.snapAt(2700).charms[0].available, false);
  assert.equal(r.snapAt(2701).charms[0].available, true);
  const d = run({
    night: 2,
    ticks: 40,
    scenario: empty({ player: { charm_ticks: 600 } }),
    frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 12, dash: true }],
  });
  assert.deepEqual(d.ev('dash').map((e) => e.tick), [1, 13]); // tick 5 đang lướt → bỏ qua; tick 12 không cần hồi chiêu
});

test('T18: một Đêm đầy đủ 21.600 tick headless chạy ≤ 30 s', () => {
  for (const night of [1, 2, 3]) {
    const t0 = process.hrtime.bigint();
    run({ night, ticks: 21600, every: 10, scenario: { player: { flames: 999 } } });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.ok(ms < 30000, `night ${night}: ${ms} ms`);
  }
});
