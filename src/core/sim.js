// Logic game thuần, tất định (Test Contract v1.0). Không import three/DOM, không Math.random.
// Thứ tự xử lý trong một bước: giả định A17 trong docs/notes/phase-1.md.
import { TUNING, WORLD } from './tuning.js';
import { createRng } from './rng.js';
import { BUTTONS, LANTERN_IDS } from './formats.js';

const TICK_RATE = WORLD.tick_rate;
const EPS = 1e-9; // "trong bán kính r" nghĩa là ≤ r; EPS chống sai số dấu phẩy động
const secToTicks = (s) => Math.round(s * TICK_RATE);

export function round3(v) {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r; // tránh -0
}

export function distXZ(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function idNum(id) {
  const m = /^[A-Z](\d+)$/.exec(id);
  return m ? Number(m[1]) : Infinity;
}
export function compareIds(a, b) {
  const d = idNum(a) - idNum(b);
  if (d !== 0 && Number.isFinite(d)) return d;
  return a < b ? -1 : a > b ? 1 : 0;
}

function defaultLanterns() {
  return LANTERN_IDS.map((id, i) => {
    const a = (i * 2 * Math.PI) / LANTERN_IDS.length;
    const r = WORLD.lantern_ring_radius;
    return { id, pos: [round3(r * Math.sin(a)), 0, round3(r * Math.cos(a))], lit: false, deposited: 0 };
  });
}

function randomPointInDisk(g, radius, minDistFromPlayer) {
  // Thử tối đa 20 lần để giữ khoảng cách tối thiểu tới Mây; luôn tất định theo seed.
  let pt = null;
  for (let i = 0; i < 20; i++) {
    const r = radius * Math.sqrt(g.rng());
    const a = g.rng() * 2 * Math.PI;
    pt = [round3(r * Math.cos(a)), 0, round3(r * Math.sin(a))];
    if (distXZ(pt, g.player.pos) >= minDistFromPlayer) break;
  }
  return pt;
}

function randomPointOnRing(g, radius, minDistFromPlayer, y) {
  let pt = null;
  for (let i = 0; i < 20; i++) {
    const a = g.rng() * 2 * Math.PI;
    pt = [round3(radius * Math.cos(a)), y, round3(radius * Math.sin(a))];
    if (distXZ(pt, g.player.pos) >= minDistFromPlayer) break;
  }
  return pt;
}

function nextFreeId(g, prefix, counterKey, used) {
  let id;
  do {
    id = `${prefix}${g[counterKey]++}`;
  } while (used.has(id));
  return id;
}

function addMote(g, pos, id) {
  const used = new Set(g.motes.map((m) => m.id));
  const mote = { id: id ?? nextFreeId(g, 'M', 'nextMoteId', used), pos: [...pos] };
  g.motes.push(mote);
  return mote;
}

function addShade(g, pos, id) {
  const used = new Set(g.shades.map((s) => s.id));
  const shade = { id: id ?? nextFreeId(g, 'S', 'nextShadeId', used), pos: [...pos], stunTicks: 0 };
  g.shades.push(shade);
  return shade;
}

function spawnRandomMote(g) {
  return addMote(g, randomPointInDisk(g, WORLD.mote_spawn_radius, WORLD.mote_min_dist_player));
}

function spawnRandomShade(g) {
  return addShade(g, randomPointOnRing(g, WORLD.shade_spawn_radius, WORLD.shade_min_dist_player, WORLD.shade_y));
}

// Bóng Mực không vào được safe_radius quanh đèn đã thắp (giả định A8).
function keepOutOfSafeZones(g, s) {
  const r = TUNING.safe_radius + WORLD.safe_margin;
  for (let pass = 0; pass < 2; pass++) {
    for (const L of g.lanterns) {
      if (!L.lit) continue;
      const dx = s.pos[0] - L.pos[0];
      const dz = s.pos[2] - L.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < r) {
        const ux = d > 0 ? dx / d : 1;
        const uz = d > 0 ? dz / d : 0;
        s.pos[0] = L.pos[0] + ux * r;
        s.pos[2] = L.pos[2] + uz * r;
      }
    }
  }
}

export function createGame({ seed = 0, scenario = null } = {}) {
  const sc = scenario ?? {};
  const g = {
    seed,
    rng: createRng(seed),
    tick: 0,
    state: 'playing',
    result: null,
    reason: null,
    score: 0,
    timeLeftTicks: secToTicks(TUNING.night1_duration_s),
    player: {
      pos: [0, 0, 0],
      vy: 0,
      flames: TUNING.flames,
      carried: 0,
      invulnTicks: 0,
      pulseCooldownTicks: 0,
    },
    lanterns: defaultLanterns(),
    motes: [],
    shades: [],
    randomMotes: sc.random_motes ?? true,
    randomShades: sc.random_shades ?? true,
    nextMoteId: 1,
    nextShadeId: 1,
    shadeSpawnTicks: secToTicks(WORLD.shade_spawn_interval_s),
    prevButtons: { jump: false, interact: false, pulse: false, dash: false },
  };

  // Dựng scenario: không phát sự kiện, không cộng điểm.
  if (sc.player) {
    if (sc.player.pos) g.player.pos = [...sc.player.pos];
    if ('carried' in sc.player) g.player.carried = sc.player.carried;
    if ('flames' in sc.player) g.player.flames = sc.player.flames;
  }
  if ('time_left_s' in sc) g.timeLeftTicks = secToTicks(sc.time_left_s);
  for (const upd of sc.lanterns ?? []) {
    const L = g.lanterns.find((l) => l.id === upd.id);
    if (upd.pos) L.pos = [...upd.pos];
    if ('deposited' in upd) L.deposited = upd.deposited;
    if ('lit' in upd) {
      L.lit = upd.lit;
      if (upd.lit && !('deposited' in upd)) L.deposited = TUNING.lantern_cost;
    }
  }

  if (sc.motes) {
    for (const m of sc.motes) Array.isArray(m) ? addMote(g, m) : addMote(g, m.pos, m.id);
  } else if (g.randomMotes) {
    for (let i = 0; i < WORLD.mote_count; i++) spawnRandomMote(g);
  }
  if (sc.shades) {
    for (const s of sc.shades) Array.isArray(s) ? addShade(g, s) : addShade(g, s.pos, s.id);
  } else if (g.randomShades) {
    for (let i = 0; i < WORLD.shade_initial; i++) spawnRandomShade(g);
  }
  for (const s of g.shades) keepOutOfSafeZones(g, s);
  return g;
}

function endGame(g, result, reason, emit) {
  if (result === 'won') {
    // Thưởng cuối màn chỉ khi thắng (giả định A11).
    g.score += TUNING.score.per_second_left * Math.floor(g.timeLeftTicks / TICK_RATE);
    g.score += TUNING.score.per_flame_left * g.player.flames;
  }
  g.state = result;
  g.result = result;
  g.reason = reason;
  emit('game_over', { result, reason });
}

// Chạy một bước: đọc input của tick k (= g.tick), tạo trạng thái k+1. Trả về danh sách sự kiện.
export function step(g, input) {
  if (g.state !== 'playing') return [];
  const events = [];
  const t = g.tick + 1;
  const emit = (name, data) => events.push({ type: 'event', tick: t, name, data });
  runStep(g, input, emit);
  g.tick = t;
  return events;
}

function runStep(g, input, emit) {
  const T = TUNING;
  const p = g.player;

  // 1. Cạnh lên của nút (false → true)
  const pressed = {};
  for (const b of BUTTONS) {
    pressed[b] = !!input[b] && !g.prevButtons[b];
    g.prevButtons[b] = !!input[b];
  }

  // 2. Bộ đếm thời gian
  if (p.invulnTicks > 0) p.invulnTicks--;
  if (p.pulseCooldownTicks > 0) p.pulseCooldownTicks--;
  for (const s of g.shades) if (s.stunTicks > 0) s.stunTicks--;
  g.timeLeftTicks--;

  // 3. Di chuyển theo hướng camera + nhảy
  let [mx, mz] = input.move ?? [0, 0];
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const th = ((input.cam_yaw_deg ?? 0) * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  const d = T.player_speed / TICK_RATE;
  let nx = p.pos[0] + wx * d;
  let nz = p.pos[2] + wz * d;
  const oldR = Math.hypot(p.pos[0], p.pos[2]);
  const newR = Math.hypot(nx, nz);
  const R = WORLD.player_bound_radius;
  if (newR > R && newR > oldR) {
    const k = Math.max(oldR, R) / newR;
    nx *= k;
    nz *= k;
  }
  p.pos[0] = nx;
  p.pos[2] = nz;
  const onGround = p.pos[1] <= 0 && p.vy <= 0;
  if (pressed.jump && onGround) p.vy = WORLD.jump_speed;
  if (p.pos[1] > 0 || p.vy > 0) {
    p.vy -= WORLD.gravity / TICK_RATE;
    p.pos[1] += p.vy / TICK_RATE;
    if (p.pos[1] <= 0) {
      p.pos[1] = 0;
      p.vy = 0;
    }
  }

  // 4. Nhặt đom đóm (tự động, theo id tăng dần)
  for (const m of [...g.motes]) {
    if (p.carried >= T.carry_capacity) break;
    if (distXZ(p.pos, m.pos) <= T.pickup_radius + EPS) {
      g.motes.splice(g.motes.indexOf(m), 1);
      p.carried++;
      g.score += T.score.per_mote;
      emit('mote_picked', { carried: p.carried });
      if (g.randomMotes) spawnRandomMote(g);
    }
  }

  // 5. Interact: nạp ánh sáng vào đèn chưa thắp gần nhất
  if (pressed.interact && p.carried > 0) {
    let best = null;
    let bestD = Infinity;
    for (const L of g.lanterns) {
      if (L.lit) continue;
      const dd = distXZ(p.pos, L.pos);
      if (dd <= T.interact_radius + EPS && dd < bestD) {
        best = L;
        bestD = dd;
      }
    }
    if (best) {
      const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      }
      if (best.deposited >= T.lantern_cost) {
        best.lit = true;
        g.score += T.score.per_lantern;
        emit('lantern_lit', { lantern_id: best.id });
        for (const s of g.shades) keepOutOfSafeZones(g, s);
        if (g.lanterns.every((l) => l.lit)) {
          endGame(g, 'won', 'all_lit', emit);
          return;
        }
      }
    }
  }

  // 6. Tỏa sáng: tốn đom đóm, có hồi chiêu, choáng + đẩy Bóng Mực trong bán kính
  if (pressed.pulse && p.pulseCooldownTicks === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCooldownTicks = secToTicks(T.pulse_cooldown_s);
    const ids = [];
    for (const s of g.shades) {
      const dd = distXZ(p.pos, s.pos);
      if (dd <= T.pulse_radius + EPS) {
        s.stunTicks = secToTicks(T.pulse_stun_s);
        const ux = dd > 0 ? (s.pos[0] - p.pos[0]) / dd : 1;
        const uz = dd > 0 ? (s.pos[2] - p.pos[2]) / dd : 0;
        s.pos[0] += ux * T.pulse_push_m;
        s.pos[2] += uz * T.pulse_push_m;
        keepOutOfSafeZones(g, s);
        ids.push(s.id);
      }
    }
    ids.sort(compareIds);
    g.score += T.score.per_stun * ids.length;
    emit('pulse', { stunned_ids: ids });
  }

  // 7. Bóng Mực đuổi theo Mây
  const sd = T.shade_speed / TICK_RATE;
  for (const s of g.shades) {
    if (s.stunTicks > 0) continue;
    const dx = p.pos[0] - s.pos[0];
    const dz = p.pos[2] - s.pos[2];
    const dd = Math.hypot(dx, dz);
    if (dd > 0) {
      const m = Math.min(sd, dd);
      s.pos[0] += (dx / dd) * m;
      s.pos[2] += (dz / dd) * m;
    }
    keepOutOfSafeZones(g, s);
  }

  // 8. Va chạm: tối đa một lần mỗi bước, có thời gian bất tử
  if (p.invulnTicks === 0) {
    for (const s of g.shades) {
      if (s.stunTicks > 0) continue;
      if (distXZ(p.pos, s.pos) <= T.shade_hit_radius + EPS) {
        p.flames = Math.max(0, p.flames - 1);
        const dropped = Math.floor(p.carried * T.hit_drop_ratio + EPS);
        p.carried -= dropped;
        p.invulnTicks = secToTicks(T.invuln_s);
        emit('player_hit', { by: 'shade', flames: p.flames, dropped });
        if (p.flames <= 0) {
          endGame(g, 'lost', 'no_flames', emit);
          return;
        }
        break;
      }
    }
  }

  // 9. Sinh thêm Bóng Mực theo chu kỳ
  if (g.randomShades) {
    g.shadeSpawnTicks--;
    if (g.shadeSpawnTicks <= 0) {
      g.shadeSpawnTicks = secToTicks(WORLD.shade_spawn_interval_s);
      if (g.shades.length < WORLD.shade_max) {
        const s = spawnRandomShade(g);
        keepOutOfSafeZones(g, s);
        emit('shade_spawned', { id: s.id });
      }
    }
  }

  // 10. Hết giờ → bình minh, thua
  if (g.timeLeftTicks <= 0) {
    g.timeLeftTicks = 0;
    endGame(g, 'lost', 'dawn', emit);
  }
}

export function snapshot(g) {
  const p = g.player;
  return {
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.tick,
    state: g.state,
    time_left_s: round3(Math.max(0, g.timeLeftTicks) / TICK_RATE),
    score: g.score,
    player: { pos: p.pos.map(round3), flames: p.flames, carried: p.carried },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(round3), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: s.pos.map(round3), state: s.stunTicks > 0 ? 'stunned' : 'chase' })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: m.pos.map(round3) })),
  };
}
